import { describe, test, expect } from "bun:test";
import { music } from "../src/tools/music";

describe("Music Tool", () => {
  test("music tool is defined", () => {
    expect(music).toBeDefined();
    expect(typeof music).toBe("function");
  });

  test("music search handles empty query", async () => {
    const result = await music("search");
    expect(result.success).toBe(false);
    expect(result.result).toContain("❌");
  });

  test("music play handles missing target", async () => {
    const result = await music("play");
    expect(result.success).toBe(false);
    expect(result.result).toContain("❌");
  });

  test("music status returns info if mpc is available", async () => {
    const result = await music("status");
    // Even if mpc fails due to no connection, the tool should return a structured failure or success
    expect(result.tool).toBe("music");
    expect(typeof result.result).toBe("string");
  });

  test("music ls music/playlists parsing", async () => {
    const result1 = await music("ls music");
    const result2 = await music("ls playlists");
    expect(result1.tool).toBe("music");
    expect(result2.tool).toBe("music");
  });

  test("music queue parsing", async () => {
    const result = await music("queue");
    expect(result.tool).toBe("music");
  });

  test("music handles unknown actions gracefully", async () => {
    const result = await music("dance");
    expect(result.success).toBe(false);
    expect(result.result).toContain("Unknown music action");
  });
});
