import { influxRequest } from "../utils/influxClient";

interface CreateBucketArgs {
  name: string;
  orgID: string;
  retentionPeriodSeconds?: number;
}

/**
 * Tool: Create Bucket
 * Creates a new bucket in InfluxDB.
 */
export async function createBucket({ name, orgID, retentionPeriodSeconds }: CreateBucketArgs) {
  console.log(`=== CREATE-BUCKET TOOL CALLED ===`);
  console.log(`Creating bucket: ${name} for orgID: ${orgID}`);

  try {
    interface BucketRequestBody {
      name: string;
      orgID: string;
      retentionRules?: Array<{
        type: "expire";
        everySeconds: number;
      }>;
    }

    const body: BucketRequestBody = {
      name,
      orgID,
    };

    if (retentionPeriodSeconds) {
      body.retentionRules = [{
        type: "expire",
        everySeconds: retentionPeriodSeconds,
      }];
    }

    const response = await influxRequest("/api/v2/buckets", {
      method: "POST",
      body: JSON.stringify(body),
    });

    console.log(`Create bucket response status: ${response.status}`);
    interface CreateBucketResponse {
      id: string;
      name: string;
    }
    const result = (await response.json()) as CreateBucketResponse;

    console.log(`=== CREATE-BUCKET TOOL COMPLETED SUCCESSFULLY ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Bucket '${name}' created successfully (ID: ${result.id})`,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`=== CREATE-BUCKET TOOL ERROR: ${errorMessage} ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Error creating bucket: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
