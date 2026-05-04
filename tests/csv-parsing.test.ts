import { describe, test, expect, beforeAll, mock } from "bun:test";

// Mock the influxClient module
mock.module("../src/utils/influxClient", () => ({
  influxRequest: mock(() => Promise.resolve({
    status: 200,
    ok: true,
    text: async () => ""
  })),
}));

// Mock the env module
mock.module("../src/config/env", () => ({
  INFLUXDB_URL: "http://localhost:8086",
  INFLUXDB_TOKEN: "test-token",
  DEFAULT_ORG: "test-org",
  validateEnvironment: () => {},
}));

describe("CSV Parsing Edge Cases - Issue #8", () => {
  let bucketMeasurements: any;
  let mockInfluxRequest: any;

  beforeAll(async () => {
    // Import the handler after mocking
    const measurementsHandler = await import("../src/handlers/measurementsHandler");
    bucketMeasurements = measurementsHandler.bucketMeasurements;

    // Get reference to the mocked function
    const influxClient = await import("../src/utils/influxClient");
    mockInfluxRequest = influxClient.influxRequest;
  });

  test("should handle CSV with Flux metadata rows (Issue #8)", async () => {
    console.log(
      "Testing CSV parsing with Flux metadata rows - reproducing Issue #8",
    );

    const problematicCsvResponse =
      "#datatype,string,long,string\n" +
      "#group,false,false,false\n" +
      "#default,_result,,\n" +
      ",result,table,_value\n" +
      ",,0,cpu_usage\n" +
      ",,0,temperature\n" +
      ",,0,memory_usage\n";

    // Mock the influxRequest to return this problematic CSV
    mockInfluxRequest.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => problematicCsvResponse,
    });

    // Call the handler
    const uri = new URL("influxdb://bucket/test-bucket/measurements");
    const params = { bucketName: "test-bucket" };

    const response = await bucketMeasurements(uri, params);

    // Verify the response
    expect(response).toBeDefined();
    expect(response.contents).toBeDefined();
    expect(response.contents[0]).toBeDefined();
    expect(response.contents[0].text).toBeDefined();

    // Parse the JSON response
    const result = JSON.parse(response.contents[0].text);

    // Validate measurements were correctly extracted
    expect(result.measurements).toBeDefined();
    expect(Array.isArray(result.measurements)).toBe(true);
    expect(result.measurements).toHaveLength(3);
    expect(result.measurements).toContain("cpu_usage");
    expect(result.measurements).toContain("temperature");
    expect(result.measurements).toContain("memory_usage");

    console.log("✓ Successfully parsed CSV by filtering metadata rows");
  });

  test("should trim whitespace from header names", async () => {
    console.log("Testing CSV parsing with whitespace in headers");

    const csvWithWhitespace =
      "#datatype,string,long,string\n" +
      ", result , table , _value \n" +
      ",,0,disk_usage\n" +
      ",,0,network_traffic\n";

    mockInfluxRequest.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => csvWithWhitespace,
    });

    const uri = new URL("influxdb://bucket/test-bucket/measurements");
    const params = { bucketName: "test-bucket" };

    const response = await bucketMeasurements(uri, params);
    const result = JSON.parse(response.contents[0].text);

    expect(result.measurements).toHaveLength(2);
    expect(result.measurements).toContain("disk_usage");
    expect(result.measurements).toContain("network_traffic");

    console.log("✓ Successfully parsed CSV with whitespace in headers");
  });

  test("should handle CSV with extensive metadata rows", async () => {
    console.log("Testing CSV parsing with extensive metadata");

    const csvWithMetadata =
      "#datatype,string,long,string\r\n" +
      "#group,false,false,false\r\n" +
      "#default,_result,,\r\n" +
      "# This is a comment\r\n" +
      "#another,metadata,row\r\n" +
      ",result,table,_value\r\n" +
      ",,0,sensor_data\r\n";

    mockInfluxRequest.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => csvWithMetadata,
    });

    const uri = new URL("influxdb://bucket/test-bucket/measurements");
    const params = { bucketName: "test-bucket" };

    const response = await bucketMeasurements(uri, params);
    const result = JSON.parse(response.contents[0].text);

    expect(result.measurements).toHaveLength(1);
    expect(result.measurements).toContain("sensor_data");

    console.log("✓ Successfully filtered metadata rows");
  });

  test("should handle empty CSV response", async () => {
    console.log("Testing CSV parsing with empty response");

    const emptyCsv =
      "#datatype,string,long,string\r\n" +
      "#group,false,false,false\r\n";

    mockInfluxRequest.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => emptyCsv,
    });

    const uri = new URL("influxdb://bucket/test-bucket/measurements");
    const params = { bucketName: "test-bucket" };

    const response = await bucketMeasurements(uri, params);
    const result = JSON.parse(response.contents[0].text);

    expect(result.measurements).toBeDefined();
    expect(Array.isArray(result.measurements)).toBe(true);
    expect(result.measurements).toHaveLength(0);

    console.log("✓ Successfully handled empty CSV");
  });

  test("should handle CSV with missing _value column", async () => {
    console.log("Testing CSV parsing without _value column");

    const csvWithoutValue =
      ",result,table,measurement\r\n" +
      ",,0,cpu_usage\r\n";

    mockInfluxRequest.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => csvWithoutValue,
    });

    const uri = new URL("influxdb://bucket/test-bucket/measurements");
    const params = { bucketName: "test-bucket" };

    const response = await bucketMeasurements(uri, params);
    const result = JSON.parse(response.contents[0].text);

    expect(result.measurements).toBeDefined();
    expect(Array.isArray(result.measurements)).toBe(true);
    expect(result.measurements).toHaveLength(0);

    console.log("✓ Successfully handled missing _value column");
  });

  test("should handle CSV with values containing whitespace", async () => {
    console.log("Testing CSV parsing with whitespace in values");

    const csvWithValueWhitespace =
      ",result,table,_value\r\n" +
      ",,0, cpu_usage \r\n" +
      ",,0,  temperature  \r\n" +
      ",,0,memory_usage   \r\n";

    mockInfluxRequest.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => csvWithValueWhitespace,
    });

    const uri = new URL("influxdb://bucket/test-bucket/measurements");
    const params = { bucketName: "test-bucket" };

    const response = await bucketMeasurements(uri, params);
    const result = JSON.parse(response.contents[0].text);

    expect(result.measurements).toHaveLength(3);
    expect(result.measurements).toContain("cpu_usage");
    expect(result.measurements).toContain("temperature");
    expect(result.measurements).toContain("memory_usage");

    result.measurements.forEach((m: string) => {
      expect(m).toBe(m.trim());
    });

    console.log("✓ Successfully trimmed whitespace from values");
  });
});
