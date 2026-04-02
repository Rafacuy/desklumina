import type { ParsedToolCall, ToolResult } from "../types";
import { t } from "../utils/i18n";

/**
 * Tool category mapping 
 */
const TOOL_CATEGORIES: Record<string, { icon: string; label: string; resultLabel: string }> = {
  app: { icon: "🚀", label: "Opening application", resultLabel: "Application opened" },
  terminal: { icon: "⚡", label: "Running terminal command", resultLabel: "Command executed" },
  bspwm: { icon: "🪟", label: "Managing windows", resultLabel: "Window managed" },
  file: { icon: "📁", label: "Managing files", resultLabel: "File operation complete" },
  media: { icon: "🎵", label: "Controlling media", resultLabel: "Media controlled" },
  clipboard: { icon: "📋", label: "Clipboard operation", resultLabel: "Clipboard updated" },
  notify: { icon: "🔔", label: "Sending notification", resultLabel: "Notification sent" },
};

/**
 * Getlabel for a tool
 */
function getToolLabel(tool: string): string {
  const label = TOOL_CATEGORIES[tool]?.label || "Executing actions";
  return t(label);
}

/**
 * Get result label for a tool
 */
function getToolResultLabel(tool: string): string {
  const label = TOOL_CATEGORIES[tool]?.resultLabel || "Action complete";
  return t(label);
}

/**
 * Get icon for a tool
 */
function getToolIcon(tool: string): string {
  return TOOL_CATEGORIES[tool]?.icon || "🔧";
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
      const icon = getToolIcon(tool);
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

    const uniqueTools = [...new Set(results.map((r) => r.tool))];
    
    let output = `${this.SEPARATOR}\n`;
    
    uniqueTools.forEach((tool) => {
      const label = getToolLabel(tool);
      output += `  • ${label} ✓\n`;
    });

    output += this.SEPARATOR;
    return output.trim();
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
