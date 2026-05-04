/**
 * Prompt: Line Protocol Guide
 * Provides a guide for the InfluxDB Line Protocol format.
 * 
 * @returns An object containing the prompt messages with the Line Protocol guide.
 */
export async function lineProtocolGuidePrompt(): Promise<{ messages: { role: "user"; content: { type: "text"; text: string } }[] }> {
  console.log(`=== LINE-PROTOCOL-GUIDE PROMPT CALLED ===`);

  const promptResponse = {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Here is a guide on InfluxDB Line Protocol:

The basic format is:
\`measurement_name,tag_key=tag_value,tag_key2=tag_value2 field_key=field_value,field_key2=field_value2 timestamp\`

Components:
1. **Measurement**: The name of the data structure (required).
2. **Tag set**: Key-value pairs for metadata. Tags are indexed (optional).
3. **Field set**: Key-value pairs for the actual data. Fields are not indexed (required).
4. **Timestamp**: Unix nanosecond-scale time (optional).

Examples:
- Simple point: \`weather,location=us-midwest temperature=82 1465839830100400200\`
- Multiple fields: \`cpu,host=serverA1 usage_user=24.5,usage_system=3.2\`
- No tags: \`heartrate value=70\`

Rules:
- Separate measurement and tags with a comma.
- Separate tags and fields with a space.
- Separate multiple tags or multiple fields with a comma.
- Fields can be floats (default), integers (suffixed with 'i'), strings (in quotes), or booleans.
- Escape spaces, commas, and equals signs in names and tag values.`,
      },
    }],
  };

  console.log(`=== LINE-PROTOCOL-GUIDE PROMPT COMPLETED SUCCESSFULLY ===`);
  return promptResponse;
}
