import { influxRequest } from "../utils/influxClient";

/**
 * Resource: Query data as a resource
 * Executes a Flux query and returns the results as a JSON resource.
 */
export async function executeQuery(uri: URL, vars: Record<string, string | string[] | undefined>) {
  const { orgName, fluxQuery } = vars;
  if (typeof orgName !== "string" || typeof fluxQuery !== "string") {
    throw new Error("orgName and fluxQuery must be strings");
  }
  console.log(`=== QUERY RESOURCE CALLED ===`);
  console.log(`Query for org: ${orgName}, query length: ${fluxQuery.length}`);

  try {
    const decodedQuery = decodeURIComponent(fluxQuery);
    console.log(`Decoded query: ${decodedQuery.substring(0, 50)}...`);

    const response = await influxRequest(
      `/api/v2/query?org=${encodeURIComponent(orgName)}`,
      {
        method: "POST",
        body: JSON.stringify({ query: decodedQuery, type: "flux" }),
      }
    );

    console.log(`Query response status: ${response.status}`);

    const responseText = await response.text();
    console.log(`Query response length: ${responseText.length}`);

    console.log(`=== QUERY RESOURCE COMPLETED SUCCESSFULLY ===`);

    // Parse CSV to JSON
    const lines = responseText.split("\n").filter((line) => line.trim() !== "");
    let result;

    if (lines.length > 1) {
      const headers = lines[0].split(",").map(h => h.trim());
      const data = lines.slice(1).map((line) => {
        const values = line.split(",").map(v => v.trim());
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        return record;
      });

      result = {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            query: decodedQuery,
            organization: orgName,
            headers: headers,
            data: data,
          }),
        }],
      };
    } else {
      // No results or headers only
      result = {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            query: decodedQuery,
            organization: orgName,
            data: [],
          }),
        }],
      };
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`=== QUERY RESOURCE ERROR: ${errorMessage} ===`);
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          error: `Error executing query: ${errorMessage}`,
        }),
      }],
      error: true,
    };
  }
}
