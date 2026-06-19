import { describe, test, expect } from "bun:test";
import { execute } from "../src/tools/frameworks/terminal";

describe("terminal.execute — blocking path", () => {
  test("captures stdout for a fast command", async () => {
    const result = await execute("echo hello-world");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello-world");
    expect(result.timedOut).toBe(false);
    expect(result.dispatched).toBeFalsy();
  });

  test("captures stderr and non-zero exit code on failure", async () => {
    const result = await execute("bash -c 'echo oops >&2; exit 3'");
    expect(result.exitCode).toBe(3);
    expect(result.stderr.trim()).toBe("oops");
    expect(result.timedOut).toBe(false);
  });

  test("command with internal && is blocking and sequential", async () => {
    const result = await execute("echo first && echo second");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("first");
    expect(result.stdout).toContain("second");
  });
});

describe("terminal.execute — non-blocking path", () => {
  test("GUI app returns immediately with dispatched=true", async () => {
    // Use true(1) which exits immediately; classification still sees a GUI
    // binary name and chooses non-blocking. We use a GUI app that won't
    // actually open a window in CI: "mpv --version" is short-circuit and
    // exits, but the classifier still picks non-blocking by binary name.
    // To avoid spawning a real GUI process in tests, we use a binary name
    // from the GUI list wrapped in `:` via a fake alias — instead, we use
    // "alacritty --version" if available, but that's environment-dependent.
    // Safer: use the trailing '&' form with a fast command.
    const result = await execute("true &");
    expect(result.dispatched).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  test("trailing '&' captures output for ResultStore injection", async () => {
    const result = await execute("echo background-test &");
    expect(result.dispatched).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("background-test");
  });

  // GUI detection by binary name (without `&`) is exercised by the
  // classifier unit tests in terminal-classify.test.ts to avoid spawning
  // real GUI processes here. The detached spawn path is identical whether
  // triggered by `&` or by GUI binary name.
});

describe("terminal.execute — rejected path", () => {
  test("interactive ssh is rejected with exitCode 1", async () => {
    const result = await execute("ssh user@remote");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ssh");
    expect(result.dispatched).toBeFalsy();
    expect(result.timedOut).toBe(false);
  });

  test("empty command is rejected", async () => {
    const result = await execute("   ");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Empty");
  });
});
