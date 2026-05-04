import { influxRequest } from "../utils/influxClient";
import { INFLUXDB_TOKEN, INFLUXDB_URL } from "../config/env";
import { InfluxBucketsResponse } from "../types/influx";

/**
 * Resource: List Buckets
 * Retrieves all buckets from InfluxDB and returns them as a JSON resource.
 */
export async function listBuckets(uri: URL) {
  console.log("Processing list buckets request - START");

  try {
    // Add detailed debug logging
    console.log(`INFLUXDB_URL: ${INFLUXDB_URL}`);
    console.log(`INFLUXDB_TOKEN set: ${INFLUXDB_TOKEN ? "Yes" : "No"}`);

    console.log("Making request to InfluxDB API for buckets...");
    const response = await influxRequest("/api/v2/buckets", {}, 5000);
    console.log(
      "Buckets API response received, status:",
      response.status,
    );

    console.log("Parsing response body for buckets...");
    const data = await response.json() as InfluxBucketsResponse;
    console.log(`Found ${data.buckets?.length || 0} buckets`);

    // Prepare the result as JSON data in text field
    console.log("Returning bucket data as JSON...");
    const result = {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(data),
      }],
    };

    console.log("Successfully processed list buckets request - END");
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error in list buckets resource:", errorMessage);
    if (errorStack) console.error(errorStack);

    // Return error as stringified JSON in text field
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          error: `Error retrieving buckets: ${errorMessage}`,
        }),
      }],
      error: true,
    };
  }
}
