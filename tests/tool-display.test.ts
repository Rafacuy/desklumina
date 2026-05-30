import { describe, test, expect } from "bun:test";
import { ToolDisplay } from "../src/ui/tool-display";
import type { ToolResult, ParsedToolCall } from "../src/types";

// Mock i18n
import { mock } from "bun:test";
mock.module("../src/utils/i18n", () => ({
  t: (key: string) => {
    if (key === "tool.running_terminal") return "Terminal";
    if (key === "tool.managing_files") return "Files";
    if (key === "tool.sending_notification") return "Notify";
    return key;
  },
  tf: (key: string, args: any) => `${key}(${JSON.stringify(args)})`,
}));

describe("ToolDisplay", () => {
  describe("formatInline", () => {
    test("returns empty string for empty calls", () => {
      expect(ToolDisplay.formatInline([])).toBe("");
    });

    test("formats multiple unique tool calls into a single line", () => {
      const calls: ParsedToolCall[] = [
        { tool: "terminal", args: {}, raw: "" },
        { tool: "file", args: {}, raw: "" },
        { tool: "terminal", args: {}, raw: "" },
      ];
      const output = ToolDisplay.formatInline(calls);
      expect(output).toBe("  · 💻 Terminal  📁 Files");
    });
  });

  describe("formatResultsInline", () => {
    test("returns empty string for empty results", () => {
      expect(ToolDisplay.formatResultsInline([])).toBe("");
    });

    test("formats success results with gutter", () => {
      const results: ToolResult[] = [
        { tool: "terminal", result: "ok", success: true, arg: "", normalizedArg: "" },
      ];
      const output = ToolDisplay.formatResultsInline(results);
      expect(output).toContain("  ┃ 💻 Terminal           ✓");
      expect(output).not.toContain("━");
    });

    test("formats failed results with ✗", () => {
      const results: ToolResult[] = [
        { tool: "notify", result: "error", success: false, arg: "", normalizedArg: "" },
      ];
      const output = ToolDisplay.formatResultsInline(results);
      expect(output).toContain("  ┃ 🔔 Notify             ✗");
      expect(output).toContain("  ┃   tool.result.failed");
    });

    test("includes retry attempts", () => {
      const results: ToolResult[] = [
        { tool: "file", result: "ok", success: true, attempt: 2, arg: "", normalizedArg: "" },
      ];
      const output = ToolDisplay.formatResultsInline(results);
      expect(output).toContain("  ┃ 📁 Files              ✓ ↺2");
    });

    test("formats file results with details", () => {
      const results: ToolResult[] = [
        { 
          tool: "file", 
          result: "found", 
          success: true, 
          status: "search_complete",
          extra: {
            files: [{ path: "file1.ts" }, { path: "file2.ts" }],
          },
          arg: "",
          normalizedArg: ""
        },
      ];
      const output = ToolDisplay.formatResultsInline(results);
      expect(output).toContain("  ┃ 📁 Files              ✓");
      expect(output).toContain("  ┃   tool.result.search_complete({\"count\":2})");
      expect(output).toContain("  ┃   • file1.ts");
      expect(output).toContain("  ┃   • file2.ts");
    });
  });

  describe("formatRetryUpdate", () => {
    test("formats retry message with gutter", () => {
      const output = ToolDisplay.formatRetryUpdate(2, ["file"], "needed more context");
      expect(output).toBe("  ┃ ↺ Files              · (2)");
    });
  });

  describe("History Formatters", () => {
    test("formatHistoryCalls returns compact action count", () => {
      const calls: ParsedToolCall[] = [{ tool: "terminal", args: {}, raw: "" }];
      expect(ToolDisplay.formatHistoryCalls(calls)).toBe("🔧 1 common.actions_count");
    });

    test("formatHistoryResults returns compact completion count", () => {
      const results: ToolResult[] = [{ tool: "terminal", result: "ok", success: true, arg: "", normalizedArg: "" }];
      expect(ToolDisplay.formatHistoryResults(results)).toBe("✓ 1 common.completed_count");
    });

    test("formatHistoryContext combines both", () => {
      const calls: ParsedToolCall[] = [{ tool: "terminal", args: {}, raw: "" }];
      const results: ToolResult[] = [{ tool: "terminal", result: "ok", success: true, arg: "", normalizedArg: "" }];
      expect(ToolDisplay.formatHistoryContext(calls, results)).toBe("🔧 1 common.actions_count • ✓ 1 common.completed_count");
    });
  });
});
