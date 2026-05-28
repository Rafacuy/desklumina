import type { ParsedToolCall, ToolResult } from "../types";
import { t, tf } from "../utils/i18n";

interface ToolConfig {
  icon: string;
  label: string;
  resultLabel: string;
}

/**
 * Tool category mapping 
 */
const TOOL_CONFIG: Record<string, ToolConfig> = {
  app: { icon: "🚀", label: "tool.opening_app", resultLabel: "tool.app_opened" },
  terminal: { icon: "💻", label: "tool.running_terminal", resultLabel: "tool.command_executed" },
  file: { icon: "📁", label: "tool.managing_files", resultLabel: "tool.file_op_complete" },
  media: { icon: "🎵", label: "tool.controlling_media", resultLabel: "tool.media_controlled" },
  clipboard: { icon: "📋", label: "tool.clipboard", resultLabel: "tool.clipboard_updated" },
  notify: { icon: "🔔", label: "tool.sending_notification", resultLabel: "tool.notification_sent" },
  music: { icon: "🎶", label: "tool.music_system", resultLabel: "tool.music_controlled" },
  math: { icon: "🧮", label: "math.loading", resultLabel: "math.result_label" },
};

/**
 * Get label for a tool
 */
function getToolLabel(tool: string): string {
  const label = TOOL_CONFIG[tool]?.label || "tool.executing_actions";
  return t(label);
}

/**
 * Get result label for a tool
 */
function getToolResultLabel(tool: string): string {
  const label = TOOL_CONFIG[tool]?.resultLabel || "tool.action_complete";
  return t(label);
}

/**
 * Get icon for a tool
 */
function getToolIcon(tool: string): string {
  return TOOL_CONFIG[tool]?.icon || "🔧";
}

function formatFileResult(result: ToolResult): string[] {
  const lines: string[] = [];
  const files = result.files || [];

  if (result.status === "search_complete") {
    const matchCount = files.length;
    lines.push(tf("tool.result.search_complete", { count: matchCount }));
  } else if (result.status === "no_matches") {
    lines.push(t("tool.result.no_matches"));
  } else if (result.status === "preview_ready") {
    lines.push(t("tool.result.preview_ready"));
  } else if (result.status === "history_ready") {
    lines.push(tf("tool.result.history_entries", { count: files.length }));
  } else if (result.status === "history_empty") {
    lines.push(t("tool.result.history_empty"));
  } else if (result.status === "invalid_request") {
    lines.push(t("tool.result.invalid_request"));
  }

  if (result.selectedFile) {
    lines.push(tf("tool.result.selected", { path: result.selectedFile }));
  } else {
    files.slice(0, 3).forEach((file) => {
      lines.push(`• ${file.path}`);
    });
    if (files.length > 3) {
      const moreWord = t("common.more") || "more";
      lines.push(`• +${files.length - 3} ${moreWord}`);
    }
  }

  if (result.preview?.path && result.preview.path !== result.selectedFile) {
    lines.push(tf("tool.result.preview", { path: result.preview.path }));
  }

  if (result.success === false) {
    lines.push(t("tool.result.failed"));
  }

  return lines;
}

function formatMathResult(result: ToolResult): string[] {
  const lines: string[] = [];
  if (result.expression) {
    lines.push(`${t("math.expression_label")}: ${result.expression}`);
  }
  if (result.success !== false) {
    lines.push(`${t("math.result_label")}:     ${result.result}`);
  } else {
    // result string already contains "❌ Math error: ..." or localized version
    lines.push(result.result);
  }
  return lines;
}

function summarizeResult(result: ToolResult): string[] {
  if (result.tool === "file") {
    return formatFileResult(result);
  }

  if (result.tool === "math") {
    return formatMathResult(result);
  }

  if (result.tool === "music") {
    const lines: string[] = [];
    const files = result.files || [];
    if (files.length > 0) {
      files.slice(0, 3).forEach((f) => lines.push(`• ${f.name}`));
      if (files.length > 3) {
        const moreWord = t("common.more") || "more";
        lines.push(`• +${files.length - 3} ${moreWord}`);
      }
    }
    return lines;
  }

  if (result.success === false) {
    return [t("tool.result.failed")];
  }

  return [];
}

const GUTTER = "  ┃";
const COL_WIDTH = 18;

function padLabel(label: string): string {
  const len = Array.from(label).length; // unicode-safe
  return label + " ".repeat(Math.max(1, COL_WIDTH - len));
}

export class ToolDisplay {
  /**
   * Format tool calls for inline display (during AI response)
   * Shows action bullets, results will be appended inline
   */
  static formatInline(calls: ParsedToolCall[]): string {
    if (calls.length === 0) return "";
    const tools = [...new Set(calls.map((c) => c.tool))];
    const parts = tools.map((t) => `${getToolIcon(t)} ${getToolLabel(t)}`).join("  ");
    return `  · ${parts}`;
  }

  /**
   * Format tool results for inline display (after execution)
   */
  static formatResultsInline(results: ToolResult[]): string {
    if (results.length === 0) return "";

    return results.flatMap((result) => {
      const mark = result.success === false ? "✗" : "✓";
      const retry = result.attempt && result.attempt > 1 ? ` ↺${result.attempt}` : "";
      const label = padLabel(getToolLabel(result.tool));
      const detail = summarizeResult(result);

      const mainRow = `${GUTTER} ${getToolIcon(result.tool)} ${label} ${mark}${retry}`;
      const detailRows = detail.map((d) => `${GUTTER}   ${d.trim()}`);

      return [mainRow, ...detailRows];
    }).join("\n");
  }

  static formatRetryUpdate(attempt: number, tools: string[], _reason: string): string {
    return [...new Set(tools)]
      .map((t) => `${GUTTER} ↺ ${padLabel(getToolLabel(t))} · (${attempt})`)
      .join("\n");
  }

  /**
   * Format tool calls for history panel (compact)
   */
  static formatHistoryCalls(calls: ParsedToolCall[]): string {
    if (calls.length === 0) return "";

    const count = calls.length;
    const actionWord = t("common.actions_count");
    return `🔧 ${count} ${actionWord}`;
  }

  /**
   * Format tool results for history panel (compact)
   */
  static formatHistoryResults(results: ToolResult[]): string {
    if (results.length === 0) return "";

    const count = results.length;
    const completedWord = t("common.completed_count");
    return `✓ ${count} ${completedWord}`;
  }

  /**
   * Format combined tool context for history panel
   * Shows both calls and results in a single compact line
   */
  static formatHistoryContext(calls: ParsedToolCall[], results: ToolResult[]): string {
    if (calls.length === 0 && results.length === 0) return "";

    const callPart = this.formatHistoryCalls(calls);
    const resultPart = this.formatHistoryResults(results);

    if (callPart && resultPart) {
      return `${callPart} • ${resultPart}`;
    }

    return callPart || resultPart;
  }
}

// Backward compatibility exports
export function formatToolCall(call: ParsedToolCall): string {
  const icon = getToolIcon(call.tool);
  const label = getToolLabel(call.tool);
  return `${icon} ${label}`;
}

export function formatToolCalls(calls: ParsedToolCall[]): string {
  return ToolDisplay.formatInline(calls);
}

export function formatToolResult(tool: string, result: string): string {
  const icon = getToolIcon(tool);
  const label = getToolResultLabel(tool);
  return `${icon} ${label}`;
}

export function formatToolResults(results: ToolResult[]): string {
  return ToolDisplay.formatResultsInline(results);
}
