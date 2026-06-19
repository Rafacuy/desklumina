import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resultStore } from "../src/tools/result-store";
import type { PendingOperation, ToolResult } from "../src/types";

describe("ResultStore", () => {
  afterEach(async () => {
    await resultStore.shutdown();
  });

  test("registerPending adds to pending map", () => {
    const op: PendingOperation = {
      id: "op-1",
      tool: "app",
      arg: "firefox",
      startedAt: Date.now(),
      status: "pending",
    };

    resultStore.registerPending(op);
    const pending = resultStore.getPending();

    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe("op-1");
    expect(pending[0]!.tool).toBe("app");
    expect(pending[0]!.arg).toBe("firefox");
    expect(pending[0]!.status).toBe("pending");
  });

  test("complete moves from pending to completed", () => {
    const op: PendingOperation = {
      id: "op-2",
      tool: "app",
      arg: "firefox",
      startedAt: Date.now(),
      status: "pending",
    };

    resultStore.registerPending(op);
    expect(resultStore.getPending()).toHaveLength(1);

    const result: ToolResult = {
      tool: "app",
      result: "Application launched",
      success: true,
      normalizedArg: "firefox",
      exitCode: 0,
      attempt: 0,
    };

    resultStore.complete("op-2", result);

    expect(resultStore.getPending()).toHaveLength(0);

    const completed = resultStore.drainCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.id).toBe("op-2");
    expect(completed[0]!.status).toBe("success");
    expect(completed[0]!.result.success).toBe(true);
    expect(completed[0]!.completedAt).toBeGreaterThanOrEqual(completed[0]!.startedAt);
  });

  test("complete with success: false stores as failure", () => {
    const op: PendingOperation = {
      id: "op-3",
      tool: "terminal",
      arg: "deploy.sh",
      startedAt: Date.now(),
      status: "pending",
    };

    resultStore.registerPending(op);

    const result: ToolResult = {
      tool: "terminal",
      result: "Error: Permission denied",
      success: false,
      normalizedArg: "deploy.sh",
      stderr: "Permission denied to /var/www",
      exitCode: 1,
      attempt: 0,
    };

    resultStore.complete("op-3", result);

    const completed = resultStore.drainCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.status).toBe("failure");
    expect(completed[0]!.result.success).toBe(false);
    expect(completed[0]!.result.exitCode).toBe(1);
  });

  test("drainCompleted returns and clears completed operations", () => {
    const op1: PendingOperation = {
      id: "op-a",
      tool: "app",
      arg: "firefox",
      startedAt: Date.now(),
      status: "pending",
    };
    const op2: PendingOperation = {
      id: "op-b",
      tool: "notify",
      arg: "Hello|World|normal",
      startedAt: Date.now(),
      status: "pending",
    };

    resultStore.registerPending(op1);
    resultStore.registerPending(op2);

    resultStore.complete("op-a", { tool: "app", result: "OK", success: true, attempt: 0 });
    resultStore.complete("op-b", { tool: "notify", result: "Sent", success: true, attempt: 0 });

    const first = resultStore.drainCompleted();
    expect(first).toHaveLength(2);

    const second = resultStore.drainCompleted();
    expect(second).toHaveLength(0);
  });

  test("getPending returns current pending operations", () => {
    resultStore.registerPending({
      id: "p1", tool: "app", arg: "firefox", startedAt: Date.now(), status: "pending",
    });
    resultStore.registerPending({
      id: "p2", tool: "notify", arg: "test", startedAt: Date.now(), status: "pending",
    });

    expect(resultStore.getPending()).toHaveLength(2);

    resultStore.complete("p1", { tool: "app", result: "OK", success: true, attempt: 0 });

    expect(resultStore.getPending()).toHaveLength(1);
    expect(resultStore.getPending()[0]!.id).toBe("p2");
  });

  test("shutdown clears all state", async () => {
    resultStore.registerPending({
      id: "s1", tool: "app", arg: "test", startedAt: Date.now(), status: "pending",
    });
    resultStore.complete("s1", { tool: "app", result: "OK", success: true, attempt: 0 });

    resultStore.registerPending({
      id: "s2", tool: "terminal", arg: "sleep 60", startedAt: Date.now(), status: "pending",
    });

    await resultStore.shutdown();

    expect(resultStore.getPending()).toHaveLength(0);
    expect(resultStore.drainCompleted()).toHaveLength(0);
  });

  test("complete with unknown ID does not throw", () => {
    expect(() => {
      resultStore.complete("nonexistent-id", {
        tool: "app",
        result: "OK",
        success: true,
        attempt: 0,
      });
    }).not.toThrow();

    expect(resultStore.drainCompleted()).toHaveLength(0);
  });
});
