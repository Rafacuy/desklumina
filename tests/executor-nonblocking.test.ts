import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { resultStore } from "../src/tools/result-store";
import type { ParsedToolCall, ToolResult } from "../src/types";

mock.module("../src/tools/registry/registry", () => ({
  dispatch: mock(async (toolName: string, arg: string) => {
    if (toolName === "app") {
      await new Promise((r) => setTimeout(r, 100));
      return {
        tool: "app",
        result: "Application launched",
        success: true,
        normalizedArg: arg.trim(),
        exitCode: 0,
      };
    }
    if (toolName === "notify" && arg.trim() === "fail") {
      await new Promise((r) => setTimeout(r, 50));
      throw new Error("Tool crashed");
    }
    if (toolName === "notify") {
      await new Promise((r) => setTimeout(r, 50));
      return {
        tool: "notify",
        result: "Notification sent",
        success: true,
        normalizedArg: arg.trim(),
        exitCode: 0,
      };
    }
    return {
      tool: toolName,
      result: "Done",
      success: true,
      normalizedArg: arg.trim(),
      exitCode: 0,
    };
  }),
}));

import { executeToolCalls } from "../src/agent/executor";

describe("Executor — Non-Blocking Path", () => {
  afterEach(async () => {
    await resultStore.shutdown();
  });

  test("non-blocking tool returns synthetic result immediately", async () => {
    const calls: ParsedToolCall[] = [{ tool: "app", arg: "firefox" }];

    const start = Date.now();
    const results = await executeToolCalls(calls);
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(1);
    expect(results[0]!.tool).toBe("app");
    expect(results[0]!.success).toBe(true);
    expect(results[0]!.result).toContain("dispatched");
    // The synthetic ack must be marked dispatched and carry an operation id
    // linking it to the background task tracked in the result store.
    expect(results[0]!.dispatched).toBe(true);
    expect(typeof results[0]!.operationId).toBe("string");
    expect(results[0]!.operationId!.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(80);
  });

  test("synthetic result operationId matches the registered pending op", async () => {
    const calls: ParsedToolCall[] = [{ tool: "app", arg: "firefox" }];

    const [results] = [await executeToolCalls(calls)];
    const syntheticId = results[0]!.operationId;

    const pending = resultStore.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe(syntheticId);
  });

  test("non-blocking tool registers pending operation", async () => {
    const calls: ParsedToolCall[] = [{ tool: "app", arg: "firefox" }];

    await executeToolCalls(calls);

    const pending = resultStore.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.tool).toBe("app");
    expect(pending[0]!.arg).toBe("firefox");
    expect(pending[0]!.status).toBe("pending");
  });

  test("background promise resolves and updates resultStore", async () => {
    const calls: ParsedToolCall[] = [{ tool: "app", arg: "firefox" }];

    await executeToolCalls(calls);
    expect(resultStore.getPending()).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 200));

    expect(resultStore.getPending()).toHaveLength(0);
    const completed = resultStore.drainCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.status).toBe("success");
    expect(completed[0]!.result.tool).toBe("app");
  });

  test("background promise rejection stores failure", async () => {
    const calls: ParsedToolCall[] = [{ tool: "notify", arg: "fail" }];

    await executeToolCalls(calls);

    await new Promise((r) => setTimeout(r, 200));

    expect(resultStore.getPending()).toHaveLength(0);
    const completed = resultStore.drainCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.status).toBe("failure");
    expect(completed[0]!.result.success).toBe(false);
    expect(completed[0]!.result.stderr).toContain("Tool crashed");
  });

  test("blocking tools still use existing retry logic", async () => {
    const calls: ParsedToolCall[] = [{ tool: "terminal", arg: "ls" }];

    const results = await executeToolCalls(calls);

    expect(results).toHaveLength(1);
    expect(results[0]!.tool).toBe("terminal");
    expect(results[0]!.result).toBe("Done");
  });

  test("mixed blocking and non-blocking calls", async () => {
    const calls: ParsedToolCall[] = [
      { tool: "terminal", arg: "ls" },
      { tool: "app", arg: "firefox" },
    ];

    const start = Date.now();
    const results = await executeToolCalls(calls);
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(2);
    expect(results[0]!.tool).toBe("terminal");
    expect(results[0]!.result).toBe("Done");
    expect(results[1]!.tool).toBe("app");
    expect(results[1]!.result).toContain("dispatched");

    expect(elapsed).toBeLessThan(80);

    await new Promise((r) => setTimeout(r, 200));
    const completed = resultStore.drainCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.tool).toBe("app");
  });
});
