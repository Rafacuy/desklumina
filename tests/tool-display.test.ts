import { describe, test, expect } from "bun:test";
import { ToolDisplay } from "../src/ui/tool-display";
import type { ToolResult, ParsedToolCall } from "../src/types";

// Mock i18n
import { mock } from "bun:test";
mock.module("../src/utils/localization/i18n", () => ({
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

  describe("Dispatched (non-blocking) status", () => {
    // A non-blocking tool returns this synthetic ack immediately. It must
    // carry `dispatched: true` so the display doesn't render a misleading ✓
    // — the tool is still running in the background.
    const dispatchedResult = (): ToolResult => ({
      tool: "app",
      result: "Operation dispatched. Running in background.",
      success: true,
      normalizedArg: "firefox",
      exitCode: 0,
      dispatched: true,
      operationId: "op-123",
    });

    test("dispatched result renders the ↗ mark, not ✓ or ✗", () => {
      const output = ToolDisplay.formatResultsInline([dispatchedResult()]);
      expect(output).toContain("↗");
      expect(output).not.toContain("✓");
      expect(output).not.toContain("✗");
    });

    test("dispatched result shows the background hint as its detail line", () => {
      const output = ToolDisplay.formatResultsInline([dispatchedResult()]);
      // Under the i18n mock, the hint key is returned verbatim.
      expect(output).toContain("tool.result.dispatched_hint");
    });

    test("dispatched suppresses the retry marker even with a stale attempt", () => {
      const output = ToolDisplay.formatResultsInline([
        { ...dispatchedResult(), attempt: 3 },
      ]);
      expect(output).toContain("↗");
      expect(output).not.toContain("↺");
    });

    test("mixed dispatched + success renders both marks distinctly", () => {
      const success: ToolResult = {
        tool: "terminal", result: "ok", success: true, arg: "", normalizedArg: "",
      };
      const output = ToolDisplay.formatResultsInline([dispatchedResult(), success]);
      expect(output).toContain("↗");
      expect(output).toContain("✓");
      const rows = output.split("\n").filter((l) => l.includes("┃"));
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    test("formatHistoryResults does not count dispatched as completed", () => {
      const success: ToolResult = {
        tool: "terminal", result: "ok", success: true, arg: "", normalizedArg: "",
      };
      const output = ToolDisplay.formatHistoryResults([dispatchedResult(), success]);
      // Only the genuinely finished tool counts as completed.
      expect(output).toContain("✓ 1 common.completed_count");
      expect(output).toContain("↗ 1 common.dispatched_count");
    });

    test("formatHistoryResults with only dispatched omits the completed count", () => {
      const output = ToolDisplay.formatHistoryResults([dispatchedResult(), dispatchedResult()]);
      expect(output).toContain("↗");
      expect(output).not.toContain("✓");
    });

    test("formatHistoryContext splits completed and dispatched counts", () => {
      const success: ToolResult = {
        tool: "terminal", result: "ok", success: true, arg: "", normalizedArg: "",
      };
      const output = ToolDisplay.formatHistoryContext([], [dispatchedResult(), success]);
      expect(output).toContain("↗");
      expect(output).toContain("✓");
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
