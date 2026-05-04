import { influxRequest } from "../utils/influxClient";

interface CreateOrgArgs {
  name: string;
  description?: string;
}

/**
 * Tool: Create Organization
 * Creates a new organization in InfluxDB.
 */
export async function createOrg({ name, description }: CreateOrgArgs) {
  console.log(`=== CREATE-ORG TOOL CALLED ===`);
  console.log(`Creating organization: ${name}`);

  try {
    const response = await influxRequest("/api/v2/orgs", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });

    console.log(`Create org response status: ${response.status}`);
    const result = (await response.json()) as any;

    console.log(`=== CREATE-ORG TOOL COMPLETED SUCCESSFULLY ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Organization '${name}' created successfully (ID: ${result.id})`,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`=== CREATE-ORG TOOL ERROR: ${errorMessage} ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Error creating organization: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
