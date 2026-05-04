import { influxRequest } from "../utils/influxClient";

interface CreateOrgArgs {
  name: string;
  description?: string;
}

// Tool: Create Organization
export async function createOrg({ name, description }: CreateOrgArgs) {
  try {
    const orgData = {
      name,
      description,
    };

    const response = await influxRequest("/api/v2/orgs", {
      method: "POST",
      body: JSON.stringify(orgData),
    });

    const org = await response.json() as any;

    return {
      content: [{
        type: "text" as const,
        text:
          `Organization created successfully:\nID: ${org.id}\nName: ${org.name}\nDescription: ${org.description || "N/A"}`,
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text" as const,
        text: `Error creating organization: ${error.message}`,
      }],
      isError: true,
    };
  }
}
