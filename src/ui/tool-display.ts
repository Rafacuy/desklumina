import type { ParsedToolCall, ToolResult } from "../types";
import { t } from "../utils/i18n";

interface ToolConfig {
  icon: string;
  label: string;
  resultLabel: string;
}

/**
 * Tool category mapping 
 */
const TOOL_CONFIG: Record<string, ToolConfig> = {
  app: { icon: "🚀", label: "Opening application", resultLabel: "Application opened" },
  terminal: { icon: "💻", label: "Running terminal command", resultLabel: "Command executed" },
  file: { icon: "📁", label: "Managing files", resultLabel: "File operation complete" },
  media: { icon: "🎵", label: "Controlling media", resultLabel: "Media controlled" },
  clipboard: { icon: "📋", label: "Clipboard operation", resultLabel: "Clipboard updated" },
  notify: { icon: "🔔", label: "Sending notification", resultLabel: "Notification sent" },
};

/**
 * Get label for a tool
 */
function getToolLabel(tool: string): string {
  const label = TOOL_CONFIG[tool]?.label || "Executing actions";
  return t(label);
}

/**
 * Get result label for a tool
 */
function getToolResultLabel(tool: string): string {
  const label = TOOL_CONFIG[tool]?.resultLabel || "Action complete";
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
    lines.push(`    Search complete: ${matchCount} match${matchCount === 1 ? "" : "es"}`);
  } else if (result.status === "no_matches") {
    lines.push("    Search complete: no matches");
  } else if (result.status === "preview_ready") {
    lines.push("    Preview ready");
  } else if (result.status === "history_ready") {
    lines.push(`    History entries: ${files.length}`);
  } else if (result.status === "history_empty") {
    lines.push("    Search history is empty");
  } else if (result.status === "invalid_request") {
    lines.push("    Invalid file request");
  }

  if (result.selectedFile) {
    lines.push(`    Selected: ${result.selectedFile}`);
  } else {
    files.slice(0, 3).forEach((file) => {
      lines.push(`    • ${file.path}`);
    });
    if (files.length > 3) {
      lines.push(`    • +${files.length - 3} more`);
    }
  }

  if (result.preview?.path && result.preview.path !== result.selectedFile) {
    lines.push(`    Preview: ${result.preview.path}`);
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
    return `${this.SEPARATOR}\n  • Retrying (${attempt}) ${labels}\n  • ${reason}\n${this.SEPARATOR}`.trim();
  }

  /**
   * Format tool calls for history panel (compact)
   */
  static formatHistoryCalls(calls: ParsedToolCall[]): string {
    if (calls.length === 0) return "";

    const count = calls.length;
    const actionWord = t("actions");
    return `🔧 ${count} ${actionWord}`;
  }

  /**
   * Format tool results for history panel (compact)
   */
  static formatHistoryResults(results: ToolResult[]): string {
    if (results.length === 0) return "";

    const count = results.length;
    const completedWord = t("completed");
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

    let output = `${this.SEPARATOR}\n🔧 ${t("Executing actions")}\n${this.SEPARATOR}`;

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

    let output = `${this.SEPARATOR}\n✓ ${t("Actions completed")}\n${this.SEPARATOR}`;

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
