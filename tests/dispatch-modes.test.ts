import { describe, test, expect } from "bun:test";
import { getDispatchMode, getDispatchConfig } from "../src/tools/registry/modes";

describe("Dispatch Modes", () => {
  test("getDispatchMode returns non-blocking for app", () => {
    expect(getDispatchMode("app")).toBe("non-blocking");
  });

  test("getDispatchMode returns non-blocking for notify", () => {
    expect(getDispatchMode("notify")).toBe("non-blocking");
  });

  test("getDispatchMode returns blocking for terminal", () => {
    expect(getDispatchMode("terminal")).toBe("blocking");
  });

  test("getDispatchMode returns blocking for file", () => {
    expect(getDispatchMode("file")).toBe("blocking");
  });

  test("getDispatchMode returns blocking for math", () => {
    expect(getDispatchMode("math")).toBe("blocking");
  });

  test("getDispatchMode returns blocking for clipboard", () => {
    expect(getDispatchMode("clipboard")).toBe("blocking");
  });

  test("getDispatchMode returns blocking for music", () => {
    expect(getDispatchMode("music")).toBe("blocking");
  });

  test("getDispatchMode returns blocking for unknown tools (default)", () => {
    expect(getDispatchMode("unknown_tool_xyz")).toBe("blocking");
  });

  test("getDispatchConfig returns full config for known tool", () => {
    const config = getDispatchConfig("app");
    expect(config.mode).toBe("non-blocking");
  });

  test("getDispatchConfig returns default config for unknown tool", () => {
    const config = getDispatchConfig("nonexistent");
    expect(config.mode).toBe("blocking");
  });
});
