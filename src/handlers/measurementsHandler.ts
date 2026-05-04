import { DEFAULT_ORG } from "../config/env";
import { influxRequest } from "../utils/influxClient";

/**
 * Parses Flux CSV response to extract measurement names
 * @param responseText The raw CSV response from InfluxDB
 * @returns Array of measurement names
 */
export function parseMeasurementsFromCsv(responseText: string): string[] {
  const lines = responseText
    .split("\n")
    .map((line) => line.replace(/\r/g, ""))
    .filter((line) => line.trim() !== "");

  // Flux CSV responses include metadata rows that start with '#'
  const dataLines = lines.filter((line) => !line.startsWith("#"));

  if (dataLines.length === 0) {
    return [];
  }

  const headers = dataLines[0].split(",").map((header) => header.trim());
  const valueIndex = headers.indexOf("_value");

  if (valueIndex === -1) {
    return [];
  }

  return dataLines.slice(1)
    .map((line) => line.split(",")[valueIndex] || "")
    .map((value) => value.trim())
    .filter((m) => m !== "");
}

/**
 * Resource: Get Measurements in a Bucket
 * Returns a list of measurement names for a specific bucket.
 */
export async function bucketMeasurements(uri: URL, { bucketName }: { bucketName: string }) {
  console.log(
    `Processing measurements in bucket '${bucketName}' request - START`,
  );

  if (!DEFAULT_ORG) {
    console.error("Error: INFLUXDB_ORG environment variable is not set");
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          error: "INFLUXDB_ORG environment variable is not set",
        }),
      }],
      error: true,
    };
  }

  try {
    // Use Flux query to get measurements
    console.log(
      `Creating Flux query for bucket '${bucketName}' measurements`,
    );
    const queryBody = JSON.stringify({
      query: `import "influxdata/influxdb/schema"\n\nschema.measurements(bucket: "${bucketName}")`,
      type: "flux",
    });

    console.log(`Making InfluxDB API request for measurements...`);
    const response = await influxRequest(
      "/api/v2/query?org=" + encodeURIComponent(DEFAULT_ORG),
      {
        method: "POST",
        body: queryBody,
      },
      5000, // Explicit timeout
    );
    console.log(
      "Measurements API response received, status:",
      response.status,
    );

    const responseText = await response.text();

    console.log("Parsing CSV response...");
    const measurements = parseMeasurementsFromCsv(responseText);

    console.log(`Found ${measurements.length} measurements`);
    console.log("Successfully processed measurements request - END");

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          bucket: bucketName,
          measurements,
        }),
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`Error in bucket measurements resource: ${errorMessage}`);
    if (errorStack) console.error(errorStack);

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          error: `Error retrieving measurements: ${errorMessage}`,
        }),
      }],
      error: true,
    };
  }
}
