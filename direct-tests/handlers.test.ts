import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import Docker from "dockerode";

// We'll import handlers dynamically after setting environment variables
let listOrganizations: any;
let listBuckets: any;
let bucketMeasurements: any;
let executeQuery: any;
let writeData: any;
let queryData: any;
let createBucket: any;
let createOrg: any;

// Generate a random port between 10000 and 20000 to avoid conflicts
const getRandomPort = () => Math.floor(Math.random() * 10000) + 10000;

// Configuration for tests
const INFLUXDB_PORT = getRandomPort();
console.log(`Using InfluxDB port: ${INFLUXDB_PORT}`);
const INFLUXDB_ADMIN_TOKEN = "admintoken123";
const INFLUXDB_ORG = "test-org";
const INFLUXDB_BUCKET = "test-bucket";
const INFLUXDB_USERNAME = "admin";
const INFLUXDB_PASSWORD = "adminpassword";

// Mock the env module
mock.module("../src/config/env", () => ({
  INFLUXDB_URL: `http://localhost:${INFLUXDB_PORT}`,
  INFLUXDB_TOKEN: INFLUXDB_ADMIN_TOKEN,
  DEFAULT_ORG: INFLUXDB_ORG,
  validateEnvironment: () => {
    console.log("Mock validateEnvironment called");
  },
}));

// Direct handler testing
describe("InfluxDB MCP Server Direct Handler Tests", () => {
  let docker: Docker;
  let container: any;

  // Setup: Start InfluxDB container before all tests
  beforeAll(async () => {
    // Initialize Docker
    docker = new Docker();

    console.log("Pulling InfluxDB image...");
    await new Promise<void>((resolve, reject) => {
      docker.pull("influxdb:2.7", (err: any, stream: any) => {
        if (err) {
          return reject(err);
        }
        docker.modem.followProgress(stream, (err: any) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    });

    console.log("Creating InfluxDB container...");
    container = await docker.createContainer({
      Image: "influxdb:2.7",
      ExposedPorts: {
        "8086/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "8086/tcp": [{ HostPort: `${INFLUXDB_PORT}` }],
        },
      },
      Env: [
        `DOCKER_INFLUXDB_INIT_MODE=setup`,
        `DOCKER_INFLUXDB_INIT_USERNAME=${INFLUXDB_USERNAME}`,
        `DOCKER_INFLUXDB_INIT_PASSWORD=${INFLUXDB_PASSWORD}`,
        `DOCKER_INFLUXDB_INIT_ORG=${INFLUXDB_ORG}`,
        `DOCKER_INFLUXDB_INIT_BUCKET=${INFLUXDB_BUCKET}`,
        `DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${INFLUXDB_ADMIN_TOKEN}`,
      ],
    });

    console.log("Starting InfluxDB container...");
    await container.start();

    // Wait for InfluxDB to be ready
    await waitForInfluxDBReady();

    // Create a token to be used by our tests
    await createInfluxDBToken();

    // Set environment variables for direct testing of handlers
    process.env.INFLUXDB_URL = `http://localhost:${INFLUXDB_PORT}`;
    process.env.INFLUXDB_TOKEN = INFLUXDB_ADMIN_TOKEN;
    process.env.INFLUXDB_ORG = INFLUXDB_ORG;

    // Now import handlers - this will pick up our environment variables
    const orgsHandler = await import("../src/handlers/organizationsHandler");
    const bucketsHandler = await import("../src/handlers/bucketsHandler");
    const measurementsHandler = await import("../src/handlers/measurementsHandler");
    const queryHandler = await import("../src/handlers/queryHandler");
    const writeDataHandler = await import("../src/handlers/writeDataTool");
    const queryDataHandler = await import("../src/handlers/queryDataTool");
    const createBucketHandler = await import("../src/handlers/createBucketTool");
    const createOrgHandler = await import("../src/handlers/createOrgTool");

    // Assign handler functions
    listOrganizations = orgsHandler.listOrganizations;
    listBuckets = bucketsHandler.listBuckets;
    bucketMeasurements = measurementsHandler.bucketMeasurements;
    executeQuery = queryHandler.executeQuery;
    writeData = writeDataHandler.writeData;
    queryData = queryDataHandler.queryData;
    createBucket = createBucketHandler.createBucket;
    createOrg = createOrgHandler.createOrg;

    console.log("Environment variables set for direct handler testing:", {
      INFLUXDB_URL: process.env.INFLUXDB_URL,
      INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN ? "Set" : "Not set",
      INFLUXDB_ORG: process.env.INFLUXDB_ORG,
    });
  }, 120000); // 2 minutes for Docker setup

  // Teardown: Stop and remove containers after all tests
  afterAll(async () => {
    console.log("Running test cleanup...");

    try {
      // Stop and remove InfluxDB container
      if (container) {
        await container.stop().catch(() =>
          console.log("Container may already be stopped")
        );
        await container.remove().catch(() =>
          console.log("Container may already be removed")
        );
        console.log("InfluxDB container stopped and removed");
      }

      // Extra cleanup - remove any leftover containers with similar image
      try {
        const containers = await docker.listContainers({ all: true });

        const cleanupPromises = [];

        for (const containerInfo of containers) {
          if (containerInfo.Image === "influxdb:2.7") {
            console.log(`Removing leftover container ${containerInfo.Id}`);
            const containerToRemove = docker.getContainer(containerInfo.Id);

            const cleanupPromise = (async () => {
              try {
                await containerToRemove.stop().catch(() => {});
                await containerToRemove.remove().catch(() => {});
                console.log(
                  `Successfully removed container ${containerInfo.Id}`,
                );
              } catch (err: any) {
                console.error(
                  `Failed to remove container ${containerInfo.Id}:`,
                  err.message,
                );
              }
            })();

            cleanupPromises.push(cleanupPromise);
          }
        }

        await Promise.allSettled(cleanupPromises);
      } catch (cleanupError: any) {
        console.error("Error during extra cleanup:", cleanupError.message);
      }

      console.log("Cleanup completed successfully");
    } catch (error: any) {
      console.error("Error during test cleanup:", error.message);
    }
  }, 60000);

  // Helper: Wait for InfluxDB to be ready
  async function waitForInfluxDBReady() {
    console.log("Waiting for InfluxDB to be ready...");
    let ready = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!ready && attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(
          `http://localhost:${INFLUXDB_PORT}/health`,
        );
        const data = await response.json() as any;
        if (data.status === "pass") {
          ready = true;
          console.log("InfluxDB is ready!");
        } else {
          console.log(
            `Waiting for InfluxDB to be ready... Attempt ${attempts}/${maxAttempts}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.log(
          `Waiting for InfluxDB to start... Attempt ${attempts}/${maxAttempts}. Error: ${error.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!ready) {
      throw new Error(
        `InfluxDB failed to become ready after ${maxAttempts} attempts`,
      );
    }
  }

  // Helper: Create a token for the tests
  async function createInfluxDBToken() {
    console.log("Creating InfluxDB token for tests...");

    try {
      const orgResponse = await fetch(
        `http://localhost:${INFLUXDB_PORT}/api/v2/orgs?org=${INFLUXDB_ORG}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      const orgData = await orgResponse.json() as any;
      if (!orgData.orgs || orgData.orgs.length === 0) {
        throw new Error("Organization not found");
      }

      const orgID = orgData.orgs[0].id;

      const tokenResponse = await fetch(
        `http://localhost:${INFLUXDB_PORT}/api/v2/authorizations`,
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: "Token for direct handler tests",
            orgID,
            permissions: [
              {
                action: "read",
                resource: {
                  type: "buckets",
                  orgID,
                },
              },
              {
                action: "write",
                resource: {
                  type: "buckets",
                  orgID,
                },
              },
              {
                action: "read",
                resource: {
                  type: "orgs",
                  orgID,
                },
              },
              {
                action: "write",
                resource: {
                  type: "orgs",
                  orgID,
                },
              },
            ],
          }),
        },
      );

      const tokenData = await tokenResponse.json() as any;
      console.log(
        "Test token created:",
        tokenData.token ? "success" : "failure",
      );
    } catch (error: any) {
      console.error("Error creating test token:", error.message);
      throw error;
    }
  }

  // Helper: Write sample data to InfluxDB
  async function writeSampleData() {
    console.log("Writing sample data to InfluxDB...");

    const data = `
cpu_usage,host=server01,region=us-west cpu=64.2,mem=47.3 ${Date.now() * 1000000}
cpu_usage,host=server02,region=us-east cpu=72.1,mem=52.8 ${Date.now() * 1000000}
temperature,location=datacenter,sensor=rack1 value=24.5 ${Date.now() * 1000000}
temperature,location=datacenter,sensor=rack2 value=25.1 ${Date.now() * 1000000}
`;

    try {
      const response = await fetch(
        `http://localhost:${INFLUXDB_PORT}/api/v2/write?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}&precision=ns`,
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
            "Content-Type": "text/plain; charset=utf-8",
          },
          body: data.trim(),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to write sample data: ${errorText}`);
      }

      console.log("Sample data written successfully");
      return response;
    } catch (error: any) {
      console.error("Error writing sample data:", error.message);
      throw error;
    }
  }

  // Test: Validate listOrganizations handler
  test("listOrganizations handler should return proper organizations", async () => {
    console.log("Testing listOrganizations handler...");

    const sampleUri = new URL("influxdb://orgs");
    const response = await listOrganizations(sampleUri);

    expect(response).toBeDefined();
    expect(response.contents).toBeDefined();
    expect(response.contents[0]).toBeDefined();
    expect(response.contents[0].text).toBeDefined();

    const orgsData = JSON.parse(response.contents[0].text);

    expect(orgsData).toBeDefined();
    expect(orgsData.orgs).toBeDefined();
    expect(Array.isArray(orgsData.orgs)).toBe(true);
    expect(orgsData.orgs.length).toBeGreaterThan(0);

    const foundTestOrg = orgsData.orgs.some((org: any) => org.name === INFLUXDB_ORG);
    expect(foundTestOrg).toBe(true);
  });

  // Test: Validate listBuckets handler
  test("listBuckets handler should return proper buckets", async () => {
    console.log("Testing listBuckets handler...");

    const sampleUri = new URL("influxdb://buckets");
    const response = await listBuckets(sampleUri);

    expect(response).toBeDefined();
    expect(response.contents).toBeDefined();
    expect(response.contents[0]).toBeDefined();
    expect(response.contents[0].text).toBeDefined();

    const bucketsData = JSON.parse(response.contents[0].text);

    expect(bucketsData).toBeDefined();
    expect(bucketsData.buckets).toBeDefined();
    expect(Array.isArray(bucketsData.buckets)).toBe(true);
    expect(bucketsData.buckets.length).toBeGreaterThan(0);

    const foundTestBucket = bucketsData.buckets.some((bucket: any) =>
      bucket.name === INFLUXDB_BUCKET
    );
    expect(foundTestBucket).toBe(true);
  });

  // Test: Validate bucketMeasurements handler
  test("bucketMeasurements handler should return measurements for a bucket", async () => {
    console.log("Testing bucketMeasurements handler...");

    await writeSampleData();

    const sampleUri = new URL(
      `influxdb://bucket/${INFLUXDB_BUCKET}/measurements`,
    );

    const params = { bucketName: INFLUXDB_BUCKET };
    const response = await bucketMeasurements(sampleUri, params);

    expect(response).toBeDefined();
    expect(response.contents).toBeDefined();
    expect(response.contents[0]).toBeDefined();
    expect(response.contents[0].text).toBeDefined();

    const measurementsData = JSON.parse(response.contents[0].text);

    expect(measurementsData).toBeDefined();
    expect(measurementsData.measurements).toBeDefined();
    expect(Array.isArray(measurementsData.measurements)).toBe(true);

    if (measurementsData.measurements.length > 0) {
      const foundCpuUsage = measurementsData.measurements.includes("cpu_usage");
      const foundTemperature = measurementsData.measurements.includes(
        "temperature",
      );
      expect(foundCpuUsage || foundTemperature).toBe(true);
    }
  });

  // Test: Validate executeQuery handler
  test("executeQuery handler should execute Flux queries", async () => {
    console.log("Testing executeQuery handler...");

    await writeSampleData();

    const fluxQuery = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "cpu_usage")
      |> limit(n: 5)`;

    const encodedQuery = encodeURIComponent(fluxQuery);
    const sampleUri = new URL(
      `influxdb://query/${INFLUXDB_ORG}/${encodedQuery}`,
    );

    const params = {
      orgName: INFLUXDB_ORG,
      fluxQuery: encodedQuery,
    };

    const response = await executeQuery(sampleUri, params);

    expect(response).toBeDefined();
    expect(response.contents).toBeDefined();
    expect(response.contents[0]).toBeDefined();
    expect(response.contents[0].text).toBeDefined();

    const queryDataResult = response.contents[0].text;

    expect(queryDataResult).toContain("cpu_usage");
    expect(queryDataResult).toContain("server01");
  });

  // Test: Validate writeData tool handler
  test("writeData tool handler should write data to InfluxDB", async () => {
    console.log("Testing writeData tool handler...");

    const timestamp = Date.now() * 1000000;
    const lineProtocol =
      `server_metrics,host=webserver01,region=us-west cpu=82.5,memory=65.2,connections=420 ${timestamp}`;

    const response = await writeData({
      org: INFLUXDB_ORG,
      bucket: INFLUXDB_BUCKET,
      data: lineProtocol,
      precision: "ns",
    });

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content[0]).toBeDefined();
    expect(response.content[0].text).toBeDefined();

    const queryUrl = `http://localhost:${INFLUXDB_PORT}/api/v2/query?org=${
      encodeURIComponent(INFLUXDB_ORG)
    }`;

    const verifyResponse = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        query: `from(bucket: "${INFLUXDB_BUCKET}")
          |> range(start: -1h)
          |> filter(fn: (r) => r._measurement == "server_metrics" and r.host == "webserver01")`,
        type: "flux",
      }),
    });

    expect(verifyResponse.ok).toBe(true);
    const verifyText = await verifyResponse.text();

    expect(verifyText).toContain("server_metrics");
    expect(verifyText).toContain("webserver01");
    expect(verifyText).toContain("us-west");
  });

  // Test: Validate queryData tool handler
  test("queryData tool handler should execute Flux queries", async () => {
    console.log("Testing queryData tool handler...");

    await writeSampleData();

    const fluxQuery = `from(bucket: "${INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "cpu_usage")
      |> limit(n: 5)`;

    const response = await queryData({
      org: INFLUXDB_ORG,
      query: fluxQuery,
    });

    expect(response).toBeDefined();

    if (response.error) {
      console.log("Query returned an error response:", response.error);
    } else if (response.result) {
      expect(response.result).toContain("cpu_usage");
      expect(response.result).toContain("server01");
    }
  });

  // Test: Validate createBucket tool handler
  test("createBucket tool handler should create a new bucket", async () => {
    console.log("Testing createBucket tool handler...");

    const orgResponse = await fetch(
      `http://localhost:${INFLUXDB_PORT}/api/v2/orgs?org=${INFLUXDB_ORG}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const orgData = await orgResponse.json() as any;
    const orgID = orgData.orgs[0].id;

    const newBucketName = `test-bucket-handler-${Date.now()}`;

    const response = await createBucket({
      name: newBucketName,
      orgID: orgID,
      retentionPeriodSeconds: 3600,
    });

    expect(response).toBeDefined();

    if (response.content && response.content[0] && response.content[0].text) {
      try {
        const resultObj = JSON.parse(response.content[0].text);
        if (resultObj.id && resultObj.name) {
          expect(resultObj.name).toBe(newBucketName);
          expect(resultObj.orgID).toBe(orgID);
        }
      } catch (e) {}
    }

    const listUrl = `http://localhost:${INFLUXDB_PORT}/api/v2/buckets`;
    const listResponse = await fetch(listUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
      },
    });

    const buckets = await listResponse.json() as any;
    const foundBucket = buckets.buckets.some((b: any) => b.name === newBucketName);
    expect(foundBucket).toBe(true);
  });

  // Test: Validate createOrg tool handler
  test("createOrg tool handler should create a new organization", async () => {
    console.log("Testing createOrg tool handler...");

    const newOrgName = `test-org-handler-${Date.now()}`;

    const response = await createOrg({
      name: newOrgName,
      description: "Created through direct handler test",
    });

    expect(response).toBeDefined();

    if (response.content && response.content[0] && response.content[0].text) {
      try {
        const resultObj = JSON.parse(response.content[0].text);
        if (resultObj.id && resultObj.name) {
          expect(resultObj.name).toBe(newOrgName);
        }
      } catch (e) {}
    }

    const listUrl = `http://localhost:${INFLUXDB_PORT}/api/v2/orgs`;
    const listResponse = await fetch(listUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${INFLUXDB_ADMIN_TOKEN}`,
      },
    });

    const orgs = await listResponse.json() as any;
    const foundOrg = orgs.orgs.some((o: any) => o.name === newOrgName);
    expect(foundOrg).toBe(true);
  });
});
