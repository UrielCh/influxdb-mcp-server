import { INFLUXDB_TOKEN, INFLUXDB_URL } from "../config/env";

// Helper function for InfluxDB API requests with timeout
export async function influxRequest(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const url = `${INFLUXDB_URL}${endpoint}`;
  const defaultOptions: RequestInit = {
    headers: {
      Authorization: `Token ${INFLUXDB_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  console.log(`Making request to: ${url}`);

  try {
    // Use AbortController for proper request cancellation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(`InfluxDB API request timed out after ${timeoutMs}ms`);
    }, timeoutMs);

    // Properly merge headers to avoid conflicts
    const mergedHeaders = {
      ...(defaultOptions.headers as Record<string, string>),
      ...((options.headers || {}) as Record<string, string>),
    };

    // Add the abort signal to the request options
    const requestOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    };

    console.log(`Request options: ${JSON.stringify({
      method: requestOptions.method || 'GET',
      headers: Object.keys(requestOptions.headers as Record<string, string>),
    })}`);

    // Make the request using Bun's native fetch (or global fetch)
    const response = await fetch(url, requestOptions);

    // Clear the timeout since the request completed
    clearTimeout(timeoutId);

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await Promise.race([
        response.text(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Response text timeout")), 3000)
        ),
      ]);
      throw new Error(`InfluxDB API Error (${response.status}): ${errorText}`);
    }

    return response;
  } catch (error: any) {
    // Log the error with more details
    console.error(`Error in influxRequest to ${url}:`, error.message);
    // Rethrow to be handled by the caller
    throw error;
  }
}
