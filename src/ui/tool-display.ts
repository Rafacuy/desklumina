import type { ParsedToolCall } from "../types";

const TOOL_ICONS: Record<string, string> = {
  app: "🚀",
  terminal: "⚡",
  bspwm: "🪟",
  file: "📁",
  media: "🎵",
  clipboard: "📋",
  notify: "🔔",
};

const TOOL_NAMES: Record<string, string> = {
  app: "Application",
  terminal: "Terminal",
  bspwm: "Window Manager",
  file: "File System",
  media: "Media Player",
  clipboard: "Clipboard",
  notify: "Notification",
};

export function formatToolCall(call: ParsedToolCall): string {
  const icon = TOOL_ICONS[call.tool] || "🔧";
  return `${icon} ${call.arg}`;
}

export function formatToolCalls(calls: ParsedToolCall[]): string {
  if (calls.length === 0) return "";
  
  if (calls.length === 1) {
    return `⚡ ${formatToolCall(calls[0])}`;
  }
  
  const formatted = calls.map((call, i) => `${i + 1}. ${formatToolCall(call)}`).join("\n");
  return `⚡ Actions:\n${formatted}`;
}

export function formatToolResult(tool: string, result: string): string {
  const icon = TOOL_ICONS[tool] || "🔧";
  return `${icon} ${result}`;
}

export function formatToolResults(results: Array<{ tool: string; result: string }>): string {
  if (results.length === 0) return "";
  
  if (results.length === 1) {
    return `✓ ${formatToolResult(results[0].tool, results[0].result)}`;
  }
  
  const formatted = results.map((r, i) => `${i + 1}. ${formatToolResult(r.tool, r.result)}`).join("\n");
  return `✓ Results:\n${formatted}`;
}
