import { describe, test, expect } from "bun:test";
import { parseMeasurementsFromCsv } from "../src/handlers/measurementsHandler";

describe("CSV Parsing Edge Cases - Issue #8", () => {
  test("should handle CSV with Flux metadata rows (Issue #8)", () => {
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

    const measurements = parseMeasurementsFromCsv(problematicCsvResponse);

    // Validate measurements were correctly extracted
    expect(measurements).toBeDefined();
    expect(Array.isArray(measurements)).toBe(true);
    expect(measurements).toHaveLength(3);
    expect(measurements).toContain("cpu_usage");
    expect(measurements).toContain("temperature");
    expect(measurements).toContain("memory_usage");

    console.log("✓ Successfully parsed CSV by filtering metadata rows");
  });

  test("should trim whitespace from header names", () => {
    console.log("Testing CSV parsing with whitespace in headers");

    const csvWithWhitespace =
      "#datatype,string,long,string\n" +
      ", result , table , _value \n" +
      ",,0,disk_usage\n" +
      ",,0,network_traffic\n";

    const measurements = parseMeasurementsFromCsv(csvWithWhitespace);

    expect(measurements).toHaveLength(2);
    expect(measurements).toContain("disk_usage");
    expect(measurements).toContain("network_traffic");

    console.log("✓ Successfully parsed CSV with whitespace in headers");
  });

  test("should handle CSV with extensive metadata rows", () => {
    console.log("Testing CSV parsing with extensive metadata");

    const csvWithMetadata =
      "#datatype,string,long,string\r\n" +
      "#group,false,false,false\r\n" +
      "#default,_result,,\r\n" +
      "# This is a comment\r\n" +
      "#another,metadata,row\r\n" +
      ",result,table,_value\r\n" +
      ",,0,sensor_data\r\n";

    const measurements = parseMeasurementsFromCsv(csvWithMetadata);

    expect(measurements).toHaveLength(1);
    expect(measurements).toContain("sensor_data");

    console.log("✓ Successfully filtered metadata rows");
  });

  test("should handle empty CSV response", () => {
    console.log("Testing CSV parsing with empty response");

    const emptyCsv =
      "#datatype,string,long,string\r\n" +
      "#group,false,false,false\r\n";

    const measurements = parseMeasurementsFromCsv(emptyCsv);

    expect(measurements).toBeDefined();
    expect(Array.isArray(measurements)).toBe(true);
    expect(measurements).toHaveLength(0);

    console.log("✓ Successfully handled empty CSV");
  });

  test("should handle CSV with missing _value column", () => {
    console.log("Testing CSV parsing without _value column");

    const csvWithoutValue =
      ",result,table,measurement\r\n" +
      ",,0,cpu_usage\r\n";

    const measurements = parseMeasurementsFromCsv(csvWithoutValue);

    expect(measurements).toBeDefined();
    expect(Array.isArray(measurements)).toBe(true);
    expect(measurements).toHaveLength(0);

    console.log("✓ Successfully handled missing _value column");
  });

  test("should handle CSV with values containing whitespace", () => {
    console.log("Testing CSV parsing with whitespace in values");

    const csvWithValueWhitespace =
      ",result,table,_value\r\n" +
      ",,0, cpu_usage \r\n" +
      ",,0,  temperature  \r\n" +
      ",,0,memory_usage   \r\n";

    const measurements = parseMeasurementsFromCsv(csvWithValueWhitespace);

    expect(measurements).toHaveLength(3);
    expect(measurements).toContain("cpu_usage");
    expect(measurements).toContain("temperature");
    expect(measurements).toContain("memory_usage");

    measurements.forEach((m: string) => {
      expect(m).toBe(m.trim());
    });

    console.log("✓ Successfully trimmed whitespace from values");
  });
});
