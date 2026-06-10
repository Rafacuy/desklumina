import { afterEach, describe, expect, test } from "bun:test";
import {
  _resetLtmRuntimeForTesting,
  _setLtmStoreForTesting,
  buildLtmContext,
  formatMemoryBlock,
  LtmStore,
  retrieveMemory,
  triggerLtmExtraction,
} from "../src/ltm";
import { buildSystemPrompt, _resetPromptCache } from "../src/ai/runtime/prompts";
import { settingsManager } from "../src/core/services/settings-manager";
import { providerRegistry, modelRegistry } from "../src/ai/registry";
import type { AIProvider, ProviderCapability, ProviderRequest, ProviderStreamChunk, ProviderValidationResult } from "../src/ai/types";

class FailingProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "Failing";

  async *streamChat(_request: ProviderRequest): AsyncGenerator<ProviderStreamChunk> {
    throw new Error("provider failed");
  }

  validateConfig(): ProviderValidationResult {
    return { ok: true, errors: [] };
  }

  capabilities(): ProviderCapability {
    return {
      maxContextTokens: 8192,
      streamingSupported: true,
      visionSupported: false,
      jsonModeSupported: false,
      functionCallingSupported: false,
      embeddingsSupported: false,
    };
  }
}

const originalSettings = JSON.parse(JSON.stringify(settingsManager.get()));

afterEach(() => {
  settingsManager.set(JSON.parse(JSON.stringify(originalSettings)));
  providerRegistry.reset();
  modelRegistry.initialize();
  _resetLtmRuntimeForTesting();
  _resetPromptCache();
});

describe("LTM integration", () => {
  test("full round-trip retrieves and formats inserted memories", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    store.upsertFact("name", "The user's name is Rapa.");
    store.upsertPattern("linux", "The user frequently asks about Linux.");
    store.insertEpisodic("The user configured a Groq extraction model.", JSON.stringify([1, 0, 0]));

    const payload = await retrieveMemory("Groq extraction", store, { queryEmbedding: [1, 0, 0] });
    const text = formatMemoryBlock(payload, 600);

    expect(text).toContain("LONG-TERM MEMORY:");
    expect(text).toContain("The user's name is Rapa.");
    expect(text).toContain("Groq extraction model");
    store.close();
  });

  test("buildLtmContext returns formatted memory when enabled", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);
    store.upsertFact("timezone", "The user lives in Indonesia.");
    settingsManager.set({
      features: { ...originalSettings.features, ltm: true },
      ltm: { ...originalSettings.ltm, tokenBudget: 600, embedModel: "" },
    });

    const text = await buildLtmContext("timezone");

    expect(text).toContain("LONG-TERM MEMORY:");
    expect(text).toContain("The user lives in Indonesia.");
  });

  test("buildLtmContext returns empty string when disabled", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);
    store.upsertFact("timezone", "The user lives in Indonesia.");
    settingsManager.set({
      features: { ...originalSettings.features, ltm: false },
    });

    await expect(buildLtmContext("timezone")).resolves.toBe("");
  });

  test("buildSystemPrompt injects memory before tool contracts", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);
    store.upsertFact("name", "The user's name is Rapa.");
    settingsManager.set({
      features: { ...originalSettings.features, ltm: true },
      ltm: { ...originalSettings.ltm, tokenBudget: 600, embedModel: "" },
    });

    const prompt = await buildSystemPrompt("name");
    const memoryIndex = prompt.indexOf("LONG-TERM MEMORY:");
    const toolIndex = prompt.indexOf("TOOL:");

    expect(memoryIndex).toBeGreaterThan(0);
    expect(toolIndex).toBeGreaterThan(memoryIndex);
  });

  test("triggerLtmExtraction does not throw on provider failure", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);
    providerRegistry.register(new FailingProvider());
    settingsManager.set({
      features: { ...originalSettings.features, ltm: true },
      ltm: { ...originalSettings.ltm, provider: "openai", model: "gpt-test", embedModel: "" },
    });

    expect(() => triggerLtmExtraction("hello", "world")).not.toThrow();
    await Bun.sleep(10);
    expect(store.getEpisodicCount()).toBe(0);
  });
});
