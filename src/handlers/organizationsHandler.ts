import { influxRequest } from "../utils/influxClient";
import { INFLUXDB_TOKEN, INFLUXDB_URL } from "../config/env";
import { InfluxOrganizationsResponse } from "../types/influx";

/**
 * Resource: List Organizations
 * Retrieves all organizations from InfluxDB and returns them as a JSON resource.
 */
export async function listOrganizations(uri: URL) {
  console.log("Processing list organizations request - START");

  try {
    // Add detailed debug logging
    console.log(`INFLUXDB_URL: ${INFLUXDB_URL}`);
    console.log(`INFLUXDB_TOKEN set: ${INFLUXDB_TOKEN ? "Yes" : "No"}`);

    console.log("Making request to InfluxDB API...");
    const response = await influxRequest("/api/v2/orgs", {}, 5000);
    console.log(
      "Organizations API response received, status:",
      response.status,
    );

    console.log("Parsing response body...");
    const data = await response.json() as InfluxOrganizationsResponse;
    console.log(`Found ${data.orgs?.length || 0} organizations`);

    // Prepare the result as JSON data in text field
    console.log("Returning organization data as JSON...");
    const result = {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(data),
      }],
    };

    console.log("Successfully processed list organizations request - END");
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error in list organizations resource:", errorMessage);
    if (errorStack) console.error(errorStack);

    // Return error as stringified JSON in text field
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          error: `Error retrieving organizations: ${errorMessage}`,
        }),
      }],
      error: true,
    };
  }
}
