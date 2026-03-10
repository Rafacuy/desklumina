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
  return `${icon} ${call.arg || ""}`;
}

export function formatToolCalls(calls: ParsedToolCall[]): string {
  if (calls.length === 0) return "";

  const firstCall = calls[0];
  if (!firstCall) return "";

  if (calls.length === 1) {
    return `⚡ ${formatToolCall(firstCall)}`;
  }

  const formatted = calls.map((call) => formatToolCall(call)).join("\n");
  return `⚡ Actions:\n${formatted}`;
}

export function formatToolResult(tool: string, result: string): string {
  const icon = TOOL_ICONS[tool] || "🔧";
  return `${icon} ${result}`;
}

export function formatToolResults(results: Array<{ tool: string; result: string }>): string {
  if (results.length === 0) return "";

  const firstResult = results[0];
  if (!firstResult) return "";

  if (results.length === 1) {
    return `✓ ${formatToolResult(firstResult.tool, firstResult.result)}`;
  }

  const formatted = results.map((r) => formatToolResult(r.tool, r.result)).join("\n");
  return `✓ Results:\n${formatted}`;
}
