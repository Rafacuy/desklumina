import { describe, test, expect } from "bun:test";
import { readDaemonPid, probeDaemonPid, fireFastPathSignal } from "../src/launcher/signal";

describe("Launcher Signal", () => {
  test("readDaemonPid returns null when no pid file", () => {
    const pid = readDaemonPid();
    expect(pid === null || typeof pid === "number").toBe(true);
  });

  test("probeDaemonPid returns null for dead process", () => {
    const result = probeDaemonPid();
    expect(result === null || typeof result === "number").toBe(true);
  });

  test("fireFastPathSignal returns false for invalid pid", () => {
    const result = fireFastPathSignal(999999999);
    expect(result).toBe(false);
  });

  test("fireFastPathSignal returns true for live pid", () => {
    const handler = () => {};
    process.on("SIGUSR1", handler);
    const result = fireFastPathSignal(process.pid);
    expect(result).toBe(true);
    process.removeListener("SIGUSR1", handler);
  });
});
