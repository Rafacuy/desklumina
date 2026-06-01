import { describe, test, expect, spyOn, beforeEach } from "bun:test";
import { getSystemContext, _resetPromptCache } from "../src/ai/runtime/prompts";

describe("System Prompt Caching", () => {
  beforeEach(() => {
    _resetPromptCache();
  });

  test("getSystemContext should cache results for 3 seconds", { timeout: 30000 }, async () => {
    const spawnSpy = spyOn(Bun, "spawn");
    
    // First call - should spawn
    const context1 = await getSystemContext();
    const initialSpawnCount = spawnSpy.mock.calls.length;
    expect(initialSpawnCount).toBeGreaterThan(0);

    // Second call - should NOT spawn (use cache)
    const context2 = await getSystemContext();
    expect(spawnSpy.mock.calls.length).toBe(initialSpawnCount);
    expect(context1).toBe(context2);

    // Reset cache manually
    _resetPromptCache();
    await getSystemContext();
    expect(spawnSpy.mock.calls.length).toBeGreaterThan(initialSpawnCount);
    
    spawnSpy.mockRestore();
  });

  test("getSystemContext returns volume and active window", { timeout: 30000 }, async () => {
    _resetPromptCache();
    const context = await getSystemContext();
    expect(context).toContain("Volume:");
    expect(context).toContain("Active window:");
  });
});
