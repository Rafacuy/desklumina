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
    lines.push(`    ${tf("tool.result.search_complete", { count: matchCount })}`);
  } else if (result.status === "no_matches") {
    lines.push(`    ${t("tool.result.no_matches")}`);
  } else if (result.status === "preview_ready") {
    lines.push(`    ${t("tool.result.preview_ready")}`);
  } else if (result.status === "history_ready") {
    lines.push(`    ${tf("tool.result.history_entries", { count: files.length })}`);
  } else if (result.status === "history_empty") {
    lines.push(`    ${t("tool.result.history_empty")}`);
  } else if (result.status === "invalid_request") {
    lines.push(`    ${t("tool.result.invalid_request")}`);
  }

  if (result.selectedFile) {
    lines.push(`    ${tf("tool.result.selected", { path: result.selectedFile })}`);
  } else {
    files.slice(0, 3).forEach((file) => {
      lines.push(`    • ${file.path}`);
    });
    if (files.length > 3) {
      const moreWord = t("common.more") || "more";
      lines.push(`    • +${files.length - 3} ${moreWord}`);
    }
  }

  if (result.preview?.path && result.preview.path !== result.selectedFile) {
    lines.push(`    ${tf("tool.result.preview", { path: result.preview.path })}`);
  }

  if (result.success === false && result.stderr) {
    lines.push(`    ${result.stderr}`);
  }

  return lines;
}

function summarizeResult(result: ToolResult): string[] {
  if (result.tool === "file") {
    return formatFileResult(result);
  }

  if (result.tool === "music") {
    const lines: string[] = [];
    const files = result.files || [];
    if (files.length > 0) {
      files.slice(0, 3).forEach((f) => lines.push(`    • ${f.name}`));
      if (files.length > 3) {
        const moreWord = t("common.more") || "more";
        lines.push(`    • +${files.length - 3} ${moreWord}`);
      }
    }
    return lines;
  }

  if (result.success === false && result.stderr) {
    return [`    ${result.stderr}`];
  }

  return [];
}

export class ToolDisplay {
  private static readonly SEPARATOR = "━".repeat(36);

  /**
   * Format tool calls for inline display (during AI response)
   * Shows action bullets, results will be appended inline
   */
  static formatInline(calls: ParsedToolCall[]): string {
    if (calls.length === 0) return "";

    const uniqueTools = [...new Set(calls.map((c) => c.tool))];
    
    let output = `${this.SEPARATOR}\n`;
    
    uniqueTools.forEach((tool) => {
      const label = getToolLabel(tool);
      output += `  • ${label}\n`;
    });

    return output.trim();
  }

  /**
   * Format tool results for inline display (after execution)
   */
  static formatResultsInline(results: ToolResult[]): string {
    if (results.length === 0) return "";

    let output = `${this.SEPARATOR}\n`;

    results.forEach((result) => {
      const label = getToolLabel(result.tool);
      const mark = result.success === false ? "✕" : "✓";
      const attemptSuffix = result.attempt && result.attempt > 1 ? ` (attempt ${result.attempt})` : "";
      output += `  • ${label} ${mark}${attemptSuffix}\n`;
      const summaryLines = summarizeResult(result);
      if (summaryLines.length > 0) {
        output += `${summaryLines.join("\n")}\n`;
      }
    });

    output += this.SEPARATOR;
    return output.trim();
  }

  static formatRetryUpdate(attempt: number, tools: string[], reason: string): string {
    const uniqueTools = [...new Set(tools)];
    const labels = uniqueTools.map((tool) => getToolLabel(tool)).join(", ");
    const retryingWord = t("common.retrying") || "Retrying";
    return `${this.SEPARATOR}\n  • ${retryingWord} (${attempt}) ${labels}\n  • ${reason}\n${this.SEPARATOR}`.trim();
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

  /**
   * Format tool calls for detailed display (debug/expanded view)
   * Shows full tool names and arguments
   */
  static formatDetailed(calls: ParsedToolCall[]): string {
    if (calls.length === 0) return "";

    let output = `${this.SEPARATOR}\n🔧 ${t("tool.executing_actions")}\n${this.SEPARATOR}`;

    calls.forEach((call) => {
      const icon = getToolIcon(call.tool);
      const label = getToolLabel(call.tool);
      output += `\n${icon} ${label}`;
    });

    return output;
  }

  /**
   * Format tool results for detailed display
   * Shows full tool names and results
   */
  static formatResultsDetailed(results: ToolResult[]): string {
    if (results.length === 0) return "";

    let output = `${this.SEPARATOR}\n✓ ${t("tool.actions_completed")}\n${this.SEPARATOR}`;

    results.forEach((r) => {
      const icon = getToolIcon(r.tool);
      const label = getToolResultLabel(r.tool);
      output += `\n${icon} ${label}`;
    });

    return output;
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
