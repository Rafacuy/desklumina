import { describe, test, expect, spyOn, beforeEach } from "bun:test";
import { getSystemContext, _resetPromptCache } from "../src/ai/prompts";

describe("System Prompt Caching", () => {
  beforeEach(() => {
    _resetPromptCache();
  });

  test("getSystemContext should cache results for 3 seconds", async () => {
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

  test("should selectively include media context based on query", async () => {
    _resetPromptCache();
    const { buildSystemPrompt } = await import("../src/ai/prompts");
    
    const mediaPrompt = await buildSystemPrompt("play some music");
    expect(mediaPrompt).toContain("Media State:");
    expect(mediaPrompt).toContain("Active Players:");
    expect(mediaPrompt).toContain("Current Track:");

    _resetPromptCache();
    const nonMediaPrompt = await buildSystemPrompt("ls -la");
    expect(nonMediaPrompt).not.toContain("Media State:");
    expect(nonMediaPrompt).not.toContain("Active Players:");
    expect(nonMediaPrompt).not.toContain("Current Track:");
    
    // Volume and Active window should still be there
    expect(nonMediaPrompt).toContain("Volume:");
    expect(nonMediaPrompt).toContain("Active window:");
  });
});
