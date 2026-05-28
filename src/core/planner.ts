import { logger } from "../logger";
import type { ParsedToolCall } from "../types";

// "media" is retained as a legacy alias for older model outputs.
/**
 * Valid tools that Lumina can execute
 * "media" is retained as a legacy alias for older model outputs.
 */
const VALID_TOOLS = new Set(["app", "terminal", "file", "media", "music", "clipboard", "notify", "math"]);

const MAX_JSON_LENGTH = 50000; // 50KB limit
const MAX_JSON_DEPTH = 5;

/**
 * Calculates the depth of a nested object
 */
function getActualDepth(obj: any): number {
  if (obj === null || typeof obj !== "object") return 0;
  if (Array.isArray(obj)) {
    const depths = obj.map(getActualDepth);
    return 1 + (depths.length > 0 ? Math.max(...depths) : 0);
  }
  const values = Object.values(obj);
  const depths = values.map(getActualDepth);
  return 1 + (depths.length > 0 ? Math.max(...depths) : 0);
}

/**
 * Converts a raw object into a ParsedToolCall if it matches the schema
 */
function toParsedToolCall(candidate: unknown): ParsedToolCall | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;

  const obj = candidate as Record<string, unknown>;
  const tool = obj.tool;
  const args = obj.args;

  if (typeof tool !== "string" || (typeof args !== "string" && typeof args !== "object" && args !== null)) {
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

/**
 * Parses tool calls from text for markdown blocks and raw JSON
 */
export function parseToolCalls(text: string): ParsedToolCall[] {
  if (!text) return [];
  const calls: ParsedToolCall[] = [];
  const processedRanges: [number, number][] = [];

  // Helper to check if a position is already covered by a processed range
  const isProcessed = (index: number) => processedRanges.some(([start, end]) => index >= start && index < end);

  // Extract JSON from markdown code blocks (most reliable)
  // Lenient regex: optional "json" tag, optional newlines, multiple blocks
  const codeBlockRegex = /```(?:json|JSON)?\s*([\s\S]*?)\s*```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const jsonContent = match[1]?.trim();
    if (jsonContent) {
      processJsonCandidate(jsonContent, calls);
      processedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // [Fallback] Detect raw JSON objects that look like tool calls
  // This handles cases where models omit markdown blocks or provide extra text
  // We look for objects starting with { and containing "tool"
  const rawCandidateRegex = /\{(?:[^{}]|\{[^{}]*\})*\}/g; // Basic 1-level nesting support
  let rawMatch;

  while ((rawMatch = rawCandidateRegex.exec(text)) !== null) {
    if (isProcessed(rawMatch.index)) continue;

    const content = rawMatch[0].trim();
    // Heuristic: only try parsing if it likely contains a tool call
    if (content.includes('"tool"') || content.includes('"args"')) {
      processJsonCandidate(content, calls);
    }
  }

  logger.debug("planner", `Found ${calls.length} tool calls`);
  return calls;
}

/**
 * Attempts to parse a JSON string and extract tool calls from it
 */
function processJsonCandidate(content: string, calls: ParsedToolCall[]): void {
  if (content.length > MAX_JSON_LENGTH) {
    logger.warn("planner", `JSON candidate too large: ${content.length} bytes`);
    return;
  }

  try {
    const parsed = JSON.parse(content);
    
    // Check depth to prevent stack overflow or DoS
    if (getActualDepth(parsed) > MAX_JSON_DEPTH) {
      logger.warn("planner", "JSON block too deep");
      return;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const call = toParsedToolCall(item);
        if (call) calls.push(call);
      }
    } else {
      const call = toParsedToolCall(parsed);
      if (call) calls.push(call);
    }
  } catch (e) {
    // Silent fail for candidate parsing, but log if it looked very much like a tool call
    if (content.includes('"tool"') && content.includes('"args"')) {
      logger.debug("planner", `Failed to parse potential tool call: ${e instanceof Error ? e.message : e}`);
    }
  }
}
