import { logger } from "../logger";

type ToolCall = {
  tool: string;
  arg: string;
};

export function parseToolCalls(text: string): ToolCall[] {
  const regex = /<tool:(\w+)>([^<]*)<\/tool:\1>/g;
  const calls: ToolCall[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    calls.push({
      tool: match[1],
      arg: match[2].trim(),
    });
  }

  logger.debug("planner", `Ditemukan ${calls.length} tool calls`);
  return calls;
}
