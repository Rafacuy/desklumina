import { logger } from "../logger";
import type { ParsedToolCall } from "../types";

export function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  // Extract JSON blocks from markdown code fences
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    const jsonContent = match[1];
    if (!jsonContent) continue;

    try {
      const parsed = JSON.parse(jsonContent);

      // Handle single tool call object
      if (parsed.tool && parsed.args !== undefined) {
        calls.push({
          tool: parsed.tool,
          arg: typeof parsed.args === "string" ? parsed.args : JSON.stringify(parsed.args),
        });
      }

      // Handle array of tool calls
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.tool && item.args !== undefined) {
            calls.push({
              tool: item.tool,
              arg: typeof item.args === "string" ? item.args : JSON.stringify(item.args),
            });
          }
        }
      }
    } catch (e) {
      logger.warn("planner", `Gagal parse JSON tool call: ${e}`);
    }
  }

  logger.debug("planner", `Ditemukan ${calls.length} tool calls`);
  return calls;
}
