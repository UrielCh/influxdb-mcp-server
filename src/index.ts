#!/usr/bin/env bun

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { program } from "commander";
// Import config
import { validateEnvironment } from "./config/env";

// Import utilities
import { configureLogger } from "./utils/loggerConfig";

// Import resource handlers
import { listOrganizations } from "./handlers/organizationsHandler";
import { listBuckets } from "./handlers/bucketsHandler";
import { bucketMeasurements } from "./handlers/measurementsHandler";
import { executeQuery } from "./handlers/queryHandler";

// Import tool handlers
import { writeData } from "./handlers/writeDataTool";
import { queryData } from "./handlers/queryDataTool";
import { createBucket } from "./handlers/createBucketTool";
import { createOrg } from "./handlers/createOrgTool";

// Import prompt handlers
import { fluxQueryExamplesPrompt } from "./prompts/fluxQueryExamplesPrompt";
import { lineProtocolGuidePrompt } from "./prompts/lineProtocolGuidePrompt";

// Declare global types for Bun/Node compatibility
declare global {
  var mcpHeartbeatInterval: ReturnType<typeof setInterval> | null;
  var testCleanupInProgress: boolean;
}

// Configure logger and validate environment
configureLogger();
validateEnvironment();

// Parse command-line arguments
program
  .option("--http [port]", "Start server with Streamable HTTP transport on specified port (default: 3000)")
  .option("--stdio", "Force stdio transport (default behavior)")
  .parse(process.argv);

const options = program.opts();

if (options.http !== undefined && options.stdio) {
  console.error("Cannot use --http and --stdio at the same time. Please choose one transport.");
  process.exit(1);
}

// Function to create and configure a new MCP server instance
const createMcpServer = () => {
  const server = new McpServer({
    name: "InfluxDB",
    version: "0.2.0",
  });

  // Register resources
  (server as any).resource("orgs", "influxdb://orgs", listOrganizations);
  (server as any).resource("buckets", "influxdb://buckets", listBuckets);
  (server as any).resource(
    "bucket-measurements",
    new ResourceTemplate("influxdb://bucket/{bucketName}/measurements", {
      list: undefined,
    }),
    bucketMeasurements as any,
  );
  (server as any).resource(
    "query",
    new ResourceTemplate("influxdb://query/{orgName}/{fluxQuery}", {
      list: undefined,
    }),
    executeQuery as any,
  );

  // Register tools
  (server as any).tool(
    "write-data",
    "Stream newline-delimited line protocol records into a bucket. Use this after composing measurements so the LLM can insert real telemetry, optionally controlling timestamp precision.",
    {
      org: z
        .string()
        .describe(
          "Human-readable organization name that owns the destination bucket (the same value returned by the orgs resource).",
        ),
      bucket: z
        .string()
        .describe(
          "Bucket name to receive the points. Make sure it already exists or call create-bucket first.",
        ),
      data: z
        .string()
        .describe(
          "Payload containing one or more line protocol lines (measurements, tags, fields, timestamps) separated by newlines.",
        ),
      precision: z
        .enum(["ns", "us", "ms", "s"])
        .optional()
        .describe(
          "Optional timestamp precision. Provide it only when the line protocol omits unit suffix context; defaults to nanoseconds.",
        ),
    },
    writeData as any,
  );
  (server as any).tool(
    "query-data",
    "Execute a Flux query inside an organization to inspect measurement schemas, run aggregations, or validate recently written data.",
    {
      org: z
        .string()
        .describe(
          "Organization whose buckets the query should target (exact name, not ID).",
        ),
      query: z
        .string()
        .describe(
          "Flux query text. Multi-line strings are supported; results are returned as annotated CSV for easy parsing.",
        ),
    },
    queryData as any,
  );
  (server as any).tool(
    "create-bucket",
    "Provision a new bucket under an organization so that subsequent write-data calls have a destination.",
    {
      name: z
        .string()
        .describe(
          "Friendly bucket name. Follow InfluxDB naming rules (alphanumeric, dashes, underscores).",
        ),
      orgID: z
        .string()
        .describe(
          "Organization ID (UUID) that will own the bucket. Retrieve it from the organizations resource or create-org output.",
        ),
      retentionPeriodSeconds: z
        .number()
        .optional()
        .describe(
          "Optional retention duration expressed in seconds. Omit for infinite retention.",
        ),
    },
    createBucket as any,
  );
  (server as any).tool(
    "create-org",
    "Create a brand-new organization to isolate users or projects before generating buckets and tokens.",
    {
      name: z
        .string()
        .describe(
          "Display name for the organization as it should appear in InfluxDB Cloud/OSS.",
        ),
      description: z
        .string()
        .optional()
        .describe(
          "Optional free-form description that helps humans understand why the org exists.",
        ),
    },
    createOrg as any,
  );

  // Register prompts
  server.prompt("flux-query-examples", {}, fluxQueryExamplesPrompt as any);
  server.prompt("line-protocol-guide", {}, lineProtocolGuidePrompt as any);

  return server;
};

// Create MCP server for stdio or as a template for HTTP
const globalServer = createMcpServer();

// Add a global error handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Enhanced MCP protocol debugging
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function logMcpDebug(...args: unknown[]) {
  originalConsoleLog("[MCP-DEBUG]", ...args);
}

function logMcpError(...args: unknown[]) {
  originalConsoleError("[MCP-ERROR]", ...args);
}

// Enable extra protocol tracing for all requests/responses
if ((globalServer as any).server && !options.http) {
  const serverInstance = (globalServer as any).server;
  const originalOnMessage = serverInstance.onmessage;
  serverInstance.onmessage = function (message: any) {
    logMcpDebug("SERVER RECEIVED MESSAGE:", JSON.stringify(message));
    if (originalOnMessage) {
      return originalOnMessage.call(this, message);
    }
  };

  const originalSendResponse = serverInstance._sendResponse;
  if (originalSendResponse) {
    serverInstance._sendResponse = function (id: any, result: any) {
      logMcpDebug("SERVER SENDING RESPONSE:", JSON.stringify({ id, result }));
      return originalSendResponse.call(this, id, result);
    };
  }

  const originalSendError = serverInstance._sendError;
  if (originalSendError) {
    serverInstance._sendError = function (id: any, error: any) {
      logMcpDebug("SERVER SENDING ERROR:", JSON.stringify({ id, error }));
      return originalSendError.call(this, id, error);
    };
  }
}

const useHttpTransport = options.http !== undefined;

if (!useHttpTransport) {
  console.log("Starting MCP server with stdio transport...");
  const stdioTransport = new StdioServerTransport();

  const transportAny = stdioTransport as any;
  if (transportAny._send) {
    const originalSend = transportAny._send;
    transportAny._send = function (data: any) {
      logMcpDebug("STDIO SENDING:", JSON.stringify(data));
      return originalSend.call(this, data);
    };
  }

  if (transportAny._receive) {
    const originalReceive = transportAny._receive;
    transportAny._receive = function (data: any) {
      logMcpDebug("STDIO RECEIVED:", JSON.stringify(data));
      return originalReceive.call(this, data);
    };
  }

  const originalStdioOnMessageCallback = stdioTransport.onmessage;
  stdioTransport.onmessage = function (message: any) {
    logMcpDebug("MESSAGE RECEIVED VIA STDIO:", JSON.stringify(message));
    if (originalStdioOnMessageCallback) {
      return originalStdioOnMessageCallback.call(this, message);
    }
  };

  const isTestMode = process.env.MCP_TEST_MODE === "true";
  if (isTestMode) {
    console.log("Running in test mode with enhanced protocol debugging for STDIO");

    const originalConnect = globalServer.connect;
    globalServer.connect = async function (transportInstance: any) {
      logMcpDebug("GlobalServer.connect() called with stdio transport");
      try {
        const result = await originalConnect.call(this, transportInstance);
        logMcpDebug("GlobalServer.connect() with stdio succeeded");
        return result;
      } catch (err) {
        logMcpError("GlobalServer.connect() with stdio failed:", err);
        throw err;
      }
    };
  }

  const connectStdioServer = async () => {
    try {
      console.log("Connecting global server to stdio transport...");
      await globalServer.connect(stdioTransport);
      console.log("Global server successfully connected to stdio transport");

      if (isTestMode) {
        if (!global.mcpHeartbeatInterval) {
          global.mcpHeartbeatInterval = setInterval(() => {
            if (!global.testCleanupInProgress) {
              console.log("[Heartbeat] MCP server (stdio) is still running...");
            }
          }, 3000);
          process.on("exit", () => {
            if (global.mcpHeartbeatInterval) {
              clearInterval(global.mcpHeartbeatInterval);
              global.mcpHeartbeatInterval = null;
            }
          });
        }
        const serverInstance = (globalServer as any).server;
        if (serverInstance) {
          serverInstance.onclose = () => {
            logMcpError("STDIO SERVER CONNECTION CLOSED");
            if (global.mcpHeartbeatInterval) {
              clearInterval(global.mcpHeartbeatInterval);
              global.mcpHeartbeatInterval = null;
            }
          };
          serverInstance.onerror = (err: any) => {
            logMcpError("STDIO SERVER ERROR:", err);
          };
        }
      }
    } catch (err) {
      console.error("Error starting MCP server with stdio:", err);
      process.exit(1);
    }
  };

  setTimeout(() => {
    connectStdioServer();
  }, 200);
} else {
  const port = typeof options.http === 'string' ? parseInt(options.http, 10) : 3000;

  console.log(`Starting MCP Streamable HTTP Server on port ${port}...`);

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (pathname === '/mcp') {
        if (req.method === 'POST') {
          logMcpDebug("HTTP POST /mcp received, creating new server and transport.");
          const server = createMcpServer();
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });

          // Debugging wrappers for transport
          if ((transport as any)._send) {
            const originalSend = (transport as any)._send;
            (transport as any)._send = function (data: any) {
              logMcpDebug("HTTP SENDING:", JSON.stringify(data));
              return originalSend.call(this, data);
            };
          }
          if ((transport as any)._receive) {
            const originalReceive = (transport as any)._receive;
            (transport as any)._receive = function (data: any) {
              logMcpDebug("HTTP RECEIVED:", JSON.stringify(data));
              return originalReceive.call(this, data);
            };
          }
          const originalOnMessageCallback = transport.onmessage;
          transport.onmessage = function (message: any) {
            logMcpDebug("HTTP MESSAGE RECEIVED:", JSON.stringify(message));
            if (originalOnMessageCallback) {
              return originalOnMessageCallback.call(this, message);
            }
          };

          const body = await req.json() as { id?: string, error?: any, result?: any };

          // Convert Bun Headers to Node.js style plain object for compatibility
          const nodeHeaders: Record<string, string> = {};
          req.headers.forEach((value, key) => {
            nodeHeaders[key.toLowerCase()] = value;
          });

          // Create an adapter for Node.js http.ServerResponse that Bun.serve can use via ReadableStream
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();

          let resStatusCode = 200;
          const resHeaders = new Headers();

          const resMock: any = {
            get statusCode() { return resStatusCode; },
            set statusCode(val) { resStatusCode = val; },
            setHeader(name: string, value: string) {
              resHeaders.set(name, value);
            },
            writeHead(status: number, headers?: any) {
              resStatusCode = status;
              if (headers) {
                for (const [key, value] of Object.entries(headers)) {
                  resHeaders.set(key, value as string);
                }
              }
              return this;
            },
            write(chunk: any) {
              writer.write(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
            },
            end(chunk?: any) {
              if (chunk) {
                writer.write(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
              }
              writer.close();
            },
            on(event: string, listener: any) {
              if (event === 'close') {
                req.signal.addEventListener('abort', () => {
                  logMcpDebug('HTTP connection closed via abort signal.');
                  listener();
                });
              }
            }
          };

          const reqMock = {
            method: req.method,
            url: req.url,
            headers: nodeHeaders,
            socket: {} // Some libraries expect a socket object
          };

          // Handle server/transport cleanup
          req.signal.addEventListener('abort', () => {
            logMcpDebug('HTTP POST /mcp request aborted, cleaning up server and transport.');
            if (transport) transport.close();
            if (server) server.close();
          });

          try {
            await server.connect(transport);
            // We run handleRequest but don't await it here because we need to return the Response 
            // handleRequest will call resMock.write/end which will drive the ReadableStream
            transport.handleRequest(reqMock as any, resMock as any, body).catch(error => {
              logMcpError('Error in transport.handleRequest:', error);
              if (!writer.closed) {
                writer.abort(error);
              }
            });

            return new Response(readable, {
              status: resStatusCode,
              headers: resHeaders
            });
          } catch (error: any) {
            logMcpError('Error connecting server to transport:', error);
            if (server) server.close();
            if (transport) transport.close();
            return Response.json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: body?.id || null,
            }, { status: 500 });
          }
        } else if (req.method === 'GET' || req.method === 'DELETE') {
          logMcpDebug(`Received ${req.method} /mcp request`);
          return Response.json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Method not allowed for stateless transport."
            },
            id: null
          }, { status: 405 });
        }
      }

      return new Response("Not Found", { status: 404 });
    },
    error(err) {
      console.error('Bun.serve error:', err);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
}
