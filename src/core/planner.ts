import { logger } from "../logger";
import type { ParsedToolCall } from "../types";

const VALID_TOOLS = new Set(["app", "terminal", "file", "media", "clipboard", "notify"]);

const MAX_JSON_LENGTH = 50000; // 50KB limit
const MAX_JSON_DEPTH = 5;

function checkDepth(str: string, maxDepth: number): boolean {
  let depth = 0;
  for (const char of str) {
    if (char === "{" || char === "[") {
      depth++;
      if (depth > maxDepth) return false;
    } else if (char === "}" || char === "]") {
      depth--;
    }
  }
  return depth === 0; // Ensure balanced
}

function toParsedToolCall(candidate: unknown): ParsedToolCall | null {
  if (!candidate || typeof candidate !== "object") return null;

  const tool = "tool" in (candidate as any) ? (candidate as any).tool : undefined;
  const args = "args" in (candidate as any) ? (candidate as any).args : undefined;

  if (typeof tool !== "string" || (typeof args !== "string" && typeof args !== "object")) {
    return null;
  }

  if (!VALID_TOOLS.has(tool)) {
    logger.warn("planner", `Ignoring unknown tool call: ${tool}`);
    return null;
  }

  // Handle object args by stringifying them (some models might send JSON objects as args)
  const argString = typeof args === "string" ? args : JSON.stringify(args);

  return {
    tool,
    arg: argString.trim(),
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

    if (jsonContent.length > MAX_JSON_LENGTH) {
      logger.warn("planner", `JSON block too large: ${jsonContent.length} bytes`);
      continue;
    }

    if (!checkDepth(jsonContent, MAX_JSON_DEPTH)) {
      logger.warn("planner", "JSON block too deep or unbalanced");
      continue;
    }

    try {
      const parsed = JSON.parse(jsonContent);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const arrayCall = toParsedToolCall(item);
          if (arrayCall) {
            calls.push(arrayCall);
          }
        }
      } else {
        const singleCall = toParsedToolCall(parsed);
        if (singleCall) {
          calls.push(singleCall);
        }
      }
    } catch (e) {
      logger.error("planner", `Failed to parse JSON tool call: ${e instanceof Error ? e.message : e}`);
    }
  }

  logger.debug("planner", `Found ${calls.length} tool calls`);
  return calls;
}
