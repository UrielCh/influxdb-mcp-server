let readWriteEnabled = false;

const WRITE_ENDPOINT_ERROR =
  "InfluxDB write requests are disabled. Restart the MCP server with --rw to allow writes.";

const WRITE_QUERY_ERROR =
  "InfluxDB Flux queries that write data are disabled. Restart the MCP server with --rw to allow writes.";

export function setReadWriteMode(enabled: boolean) {
  readWriteEnabled = enabled;
}

export function isReadWriteModeEnabled() {
  return readWriteEnabled;
}

export function isFluxWriteQuery(query: string) {
  const normalizedQuery = stripFluxCommentsAndStrings(query);

  return /(?:^|[|>\s.(])(?:[A-Za-z_][A-Za-z0-9_]*\.)*to\s*\(/m.test(
    normalizedQuery,
  );
}

export function assertInfluxRequestAllowed(
  endpoint: string,
  options: RequestInit = {},
) {
  if (readWriteEnabled) {
    return;
  }

  const method = (options.method ?? "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return;
  }

  const pathname = getEndpointPathname(endpoint);
  if (method === "POST" && pathname === "/api/v2/query") {
    const query = extractFluxQuery(options.body);
    if (!query) {
      throw new Error(
        "Unable to inspect InfluxDB query body in read-only mode. Restart the MCP server with --rw to allow this request.",
      );
    }

    if (isFluxWriteQuery(query)) {
      throw new Error(WRITE_QUERY_ERROR);
    }

    return;
  }

  throw new Error(WRITE_ENDPOINT_ERROR);
}

function getEndpointPathname(endpoint: string) {
  if (endpoint.startsWith("http")) {
    return new URL(endpoint).pathname;
  }

  return new URL(endpoint, "http://influxdb.local").pathname;
}

function extractFluxQuery(body: RequestInit["body"] | null | undefined) {
  if (typeof body !== "string") {
    return undefined;
  }

  try {
    const parsedBody = JSON.parse(body) as { query?: unknown };
    return typeof parsedBody.query === "string" ? parsedBody.query : undefined;
  } catch {
    return undefined;
  }
}

function stripFluxCommentsAndStrings(query: string) {
  let output = "";
  let index = 0;

  while (index < query.length) {
    const char = query[index];
    const nextChar = query[index + 1];

    if (char === "/" && nextChar === "/") {
      while (index < query.length && query[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }

    if (char === "/" && nextChar === "*") {
      output += "  ";
      index += 2;
      while (index < query.length) {
        if (query[index] === "*" && query[index + 1] === "/") {
          output += "  ";
          index += 2;
          break;
        }
        output += query[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      output += " ";
      index += 1;
      while (index < query.length) {
        if (query[index] === "\\") {
          output += "  ";
          index += 2;
          continue;
        }
        if (query[index] === quote) {
          output += " ";
          index += 1;
          break;
        }
        output += query[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}
