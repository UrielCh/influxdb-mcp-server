import { influxRequest } from "../utils/influxClient";

interface QueryDataArgs {
  org: string;
  query: string;
}

/**
 * Tool: Query Data
 * Executes a Flux query and returns the results.
 */
export async function queryData({ org, query }: QueryDataArgs) {
  console.log(`=== QUERY-DATA TOOL CALLED ===`);
  console.log(`Query for org: ${org}, query length: ${query.length}`);

  try {
    const response = await influxRequest(
      `/api/v2/query?org=${encodeURIComponent(org)}`,
      {
        method: "POST",
        body: JSON.stringify({ query, type: "flux" }),
      }
    );

    console.log(`Query response status: ${response.status}`);

    const responseText = await response.text();
    console.log(`Query response length: ${responseText.length}`);

    console.log(`=== QUERY-DATA TOOL COMPLETED SUCCESSFULLY ===`);
    return {
      content: [{
        type: "text" as const,
        text: responseText,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`=== QUERY-DATA TOOL ERROR: ${errorMessage} ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Error querying data: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
