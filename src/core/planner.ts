import { logger } from "../logger";
import type { ParsedToolCall } from "../types";

const VALID_TOOLS = new Set(["app", "terminal", "file", "media", "clipboard", "notify"]);

function toParsedToolCall(candidate: unknown): ParsedToolCall | null {
  if (!candidate || typeof candidate !== "object") return null;

  const tool = "tool" in candidate ? (candidate as { tool?: unknown }).tool : undefined;
  const args = "args" in candidate ? (candidate as { args?: unknown }).args : undefined;

  if (typeof tool !== "string" || typeof args !== "string") {
    return null;
  }

  if (!VALID_TOOLS.has(tool)) {
    logger.warn("planner", `Ignoring unknown tool call: ${tool}`);
    return null;
  }

  return {
    tool,
    arg: args.trim(),
  };
}

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

      const singleCall = toParsedToolCall(parsed);
      if (singleCall) {
        calls.push(singleCall);
      }

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const arrayCall = toParsedToolCall(item);
          if (arrayCall) {
            calls.push(arrayCall);
          }
        }
      }
    } catch (e) {
      logger.warn("planner", `Failed to parse JSON tool call: ${e}`);
    }
  }

  logger.debug("planner", `Found ${calls.length} tool calls`);
  return calls;
}
