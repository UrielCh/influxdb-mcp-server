import { INFLUXDB_TOKEN, INFLUXDB_URL } from "../config/env";
import { assertInfluxRequestAllowed } from "./writeProtection";

/**
 * Helper function for InfluxDB API requests with timeout and proper error handling.
 * 
 * @param endpoint The API endpoint (e.g., "/api/v2/orgs")
 * @param options Standard fetch RequestInit options
 * @param timeoutMs Request timeout in milliseconds
 * @returns Promise<Response>
 */
export async function influxRequest(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  assertInfluxRequestAllowed(endpoint, options);

  const url = endpoint.startsWith('http') ? endpoint : `${INFLUXDB_URL}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Token ${INFLUXDB_TOKEN}`);
  }
  // Default to JSON but allow override (e.g. for write data)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  console.log(`Making request to: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      let errorText = "Unknown error";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `Could not read error response: ${e instanceof Error ? e.message : String(e)}`;
      }
      throw new Error(`InfluxDB API Error (${response.status}): ${errorText}`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`InfluxDB API request timed out after ${timeoutMs}ms`, {
        cause: error,
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error in influxRequest to ${url}:`, errorMessage);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
