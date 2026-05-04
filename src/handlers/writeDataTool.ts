import { influxRequest } from "../utils/influxClient";

interface WriteDataArgs {
  org: string;
  bucket: string;
  data: string;
  precision?: string;
}

/**
 * Tool: Write Data
 * Writes line protocol data to a specific InfluxDB bucket.
 */
export async function writeData({ org, bucket, data, precision }: WriteDataArgs) {
  // Add extremely clear logging
  console.log(`=== WRITE-DATA TOOL CALLED ===`);
  console.log(
    `Writing to org: ${org}, bucket: ${bucket}, data length: ${data.length}`,
  );

  try {
    // Simplified approach focusing on core functionality
    let endpoint = `/api/v2/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}`;
    if (precision) {
      endpoint += `&precision=${precision}`;
    }

    const response = await influxRequest(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: data,
    });

    console.log(`Write response status: ${response.status}`);

    console.log(`=== WRITE-DATA TOOL COMPLETED SUCCESSFULLY ===`);
    return {
      content: [{
        type: "text" as const,
        text: "Data written successfully",
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`=== WRITE-DATA TOOL ERROR: ${errorMessage} ===`);
    return {
      content: [{
        type: "text" as const,
        text: `Error writing data: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}
