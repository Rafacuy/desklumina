import { describe, test, expect } from "bun:test";
import { formatBackgroundResults, formatPendingOperations } from "../src/agent/context";
import type { CompletedOperation, PendingOperation } from "../src/types";

describe("Context Injection — formatBackgroundResults", () => {
  test("formats single success", () => {
    const ops: CompletedOperation[] = [{
      id: "op-1",
      tool: "app",
      arg: "firefox",
      startedAt: Date.now() - 5000,
      completedAt: Date.now(),
      status: "success",
      result: {
        tool: "app",
        result: "Application launched",
        success: true,
        normalizedArg: "firefox",
        exitCode: 0,
        attempt: 0,
      },
    }];

    const output = formatBackgroundResults(ops);
    expect(output).toContain("[BACKGROUND OPERATIONS COMPLETED]");
    expect(output).toContain("app");
    expect(output).toContain("firefox");
    expect(output).toContain("OK");
    expect(output).toContain("Application launched");
  });

  test("formats single failure", () => {
    const ops: CompletedOperation[] = [{
      id: "op-2",
      tool: "terminal",
      arg: "deploy.sh",
      startedAt: Date.now() - 10000,
      completedAt: Date.now(),
      status: "failure",
      result: {
        tool: "terminal",
        result: "Error: Permission denied",
        success: false,
        normalizedArg: "deploy.sh",
        stderr: "Permission denied to /var/www",
        exitCode: 1,
        attempt: 0,
      },
    }];

    const output = formatBackgroundResults(ops);
    expect(output).toContain("FAILED");
    expect(output).toContain("exit code 1");
    expect(output).toContain("Permission denied to /var/www");
  });

  test("formats mixed results", () => {
    const ops: CompletedOperation[] = [
      {
        id: "op-a",
        tool: "app",
        arg: "firefox",
        startedAt: Date.now() - 5000,
        completedAt: Date.now(),
        status: "success",
        result: {
          tool: "app",
          result: "Application launched",
          success: true,
          attempt: 0,
        },
      },
      {
        id: "op-b",
        tool: "terminal",
        arg: "backup.sh",
        startedAt: Date.now() - 10000,
        completedAt: Date.now(),
        status: "failure",
        result: {
          tool: "terminal",
          result: "Error",
          success: false,
          stderr: "Disk full",
          exitCode: 1,
          attempt: 0,
        },
      },
    ];

    const output = formatBackgroundResults(ops);
    expect(output).toContain("OK");
    expect(output).toContain("FAILED");
    expect(output).toContain("firefox");
    expect(output).toContain("backup.sh");
  });
});

describe("Context Injection — formatPendingOperations", () => {
  test("formats single pending operation", () => {
    const ops: PendingOperation[] = [{
      id: "p-1",
      tool: "terminal",
      arg: "long-running-command.sh",
      startedAt: Date.now() - 12000,
      status: "pending",
    }];

    const output = formatPendingOperations(ops);
    expect(output).toContain("[BACKGROUND OPERATIONS]");
    expect(output).toContain("Pending (still running)");
    expect(output).toContain("terminal");
    expect(output).toContain("long-running-command.sh");
    expect(output).toContain("started");
  });

  test("formats multiple pending operations", () => {
    const ops: PendingOperation[] = [
      {
        id: "p-1",
        tool: "terminal",
        arg: "backup.sh",
        startedAt: Date.now() - 30000,
        status: "pending",
      },
      {
        id: "p-2",
        tool: "app",
        arg: "firefox",
        startedAt: Date.now() - 5000,
        status: "pending",
      },
    ];

    const output = formatPendingOperations(ops);
    expect(output).toContain("backup.sh");
    expect(output).toContain("firefox");
    expect(output).toContain("terminal");
    expect(output).toContain("app");
  });
});
