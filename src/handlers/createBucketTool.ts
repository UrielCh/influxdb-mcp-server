import { INFLUXDB_TOKEN, INFLUXDB_URL } from "../config/env";

interface CreateBucketArgs {
  name: string;
  orgID: string;
  retentionPeriodSeconds?: number;
}

// Tool: Create Bucket
export async function createBucket({ name, orgID, retentionPeriodSeconds }: CreateBucketArgs) {
  console.log(`=== CREATE-BUCKET TOOL CALLED ===`);
  console.log(`Creating bucket: ${name}, orgID: ${orgID}`);

  try {
    const bucketData = {
      name,
      orgID,
      retentionRules: retentionPeriodSeconds
        ? [
          { type: "expire", everySeconds: retentionPeriodSeconds },
        ]
        : undefined,
    };

    console.log(`Creating bucket with data: ${JSON.stringify(bucketData)}`);

    // Use fetch directly
    const response = await fetch(`${INFLUXDB_URL}/api/v2/buckets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${INFLUXDB_TOKEN}`,
      },
      body: JSON.stringify(bucketData),
    });

    console.log(`Create bucket response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create bucket: ${response.status} ${errorText}`,
      );
    }

    const bucketResponse = await response.json() as any;

    console.log(`=== CREATE-BUCKET TOOL COMPLETED SUCCESSFULLY ===`);
    return {
      content: [{
        type: "text" as const,
        text:
          `Bucket created successfully:\nID: ${bucketResponse.id}\nName: ${bucketResponse.name}\nOrganization ID: ${bucketResponse.orgID}`,
      }],
    };
  } catch (error: any) {
    console.error(`=== CREATE-BUCKET TOOL ERROR: ${error.message} ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Error creating bucket: ${error.message}`,
      }],
      isError: true,
    };
  }
}
