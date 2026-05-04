import { influxRequest } from "../utils/influxClient";

interface QueryDataArgs {
  org: string;
  query: string;
}

// Tool: Query Data
export async function queryData({ org, query }: QueryDataArgs) {
  try {
    const response = await influxRequest(
      `/api/v2/query?org=${encodeURIComponent(org)}`,
      {
        method: "POST",
        body: JSON.stringify({ query, type: "flux" }),
      },
    );

    const responseText = await response.text();

    return {
      content: [{
        type: "text" as const,
        text: responseText,
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text" as const,
        text: `Error executing query: ${error.message}`,
      }],
      isError: true,
    };
  }
}
