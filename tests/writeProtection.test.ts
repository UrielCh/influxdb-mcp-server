import { describe, expect, test } from "bun:test";
import {
  assertInfluxRequestAllowed,
  isFluxWriteQuery,
  setReadWriteMode,
} from "../src/utils/writeProtection";

describe("InfluxDB write protection", () => {
  test("allows read requests in read-only mode", () => {
    setReadWriteMode(false);

    expect(() => {
      assertInfluxRequestAllowed("/api/v2/buckets");
    }).not.toThrow();
  });

  test("blocks write endpoints in read-only mode", () => {
    setReadWriteMode(false);

    expect(() => {
      assertInfluxRequestAllowed("/api/v2/write?org=test&bucket=test", {
        method: "POST",
        body: "cpu value=1",
      });
    }).toThrow("InfluxDB write requests are disabled");
  });

  test("allows read-only Flux queries in read-only mode", () => {
    setReadWriteMode(false);

    expect(() => {
      assertInfluxRequestAllowed("/api/v2/query?org=test", {
        method: "POST",
        body: JSON.stringify({
          query: 'from(bucket: "metrics") |> range(start: -1h)',
          type: "flux",
        }),
      });
    }).not.toThrow();
  });

  test("blocks Flux queries that write in read-only mode", () => {
    setReadWriteMode(false);

    expect(() => {
      assertInfluxRequestAllowed("/api/v2/query?org=test", {
        method: "POST",
        body: JSON.stringify({
          query:
            'from(bucket: "source") |> range(start: -1h) |> to(bucket: "dest")',
          type: "flux",
        }),
      });
    }).toThrow("InfluxDB Flux queries that write data are disabled");
  });

  test("ignores write-looking text inside strings and comments", () => {
    expect(isFluxWriteQuery('from(bucket: "to(bucket: dest)")')).toBe(false);
    expect(isFluxWriteQuery("// |> to(bucket: dest)\nfrom(bucket: \"metrics\")")).toBe(
      false,
    );
  });

  test("allows writes when read-write mode is enabled", () => {
    setReadWriteMode(true);

    expect(() => {
      assertInfluxRequestAllowed("/api/v2/write?org=test&bucket=test", {
        method: "POST",
        body: "cpu value=1",
      });
    }).not.toThrow();

    setReadWriteMode(false);
  });
});
