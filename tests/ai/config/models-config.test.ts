import { describe, test, expect } from "bun:test";
import { parseModelsConfig } from "../../../src/ai/config/models-config";
import { ModelRegistry } from "../../../src/ai/registry/models";
import { providerRegistry } from "../../../src/ai/registry/provider-registry";
import { GroqProvider } from "../../../src/ai/providers/groq/provider";
import { AnthropicProvider } from "../../../src/ai/providers/anthropic/provider";
import { GeminiProvider } from "../../../src/ai/providers/gemini/provider";

describe("models.json Parser", () => {
  test("Valid models.json with primary only parses correctly", () => {
    const config = parseModelsConfig({
      primary: { provider: "gemini", model: "gemini-2.5-flash" }
    });
    expect(config.primary.provider).toBe("gemini");
    expect(config.primary.model).toBe("gemini-2.5-flash");
    expect(config.fallbacks).toHaveLength(0);
  });

  test("Valid models.json with primary and fallbacks parses correctly", () => {
    const config = parseModelsConfig({
      primary: { provider: "gemini", model: "gemini-2.5-flash" },
      fallbacks: [
        { provider: "groq", model: "llama-3.3-70b-versatile", reason: "provider-down" }
      ]
    });
    expect(config.fallbacks).toHaveLength(1);
    expect(config.fallbacks[0].provider).toBe("groq");
    expect(config.fallbacks[0].reason).toBe("provider-down");
  });

  test("Valid models.json with aliases parses correctly", () => {
    const config = parseModelsConfig({
      primary: { provider: "gemini", model: "gemini-2.5-flash" },
      aliases: {
        "fast": { provider: "groq", model: "llama-8b" }
      }
    });
    expect(config.aliases["fast"].provider).toBe("groq");
  });

  test("Unknown provider in primary throws with a message naming the invalid value", () => {
    expect(() => parseModelsConfig({
      primary: { provider: "unknown_prov", model: "test" }
    })).toThrow(/Unknown provider 'unknown_prov'/);
  });

  test("Unknown provider in a fallback throws with a message naming the invalid value", () => {
    expect(() => parseModelsConfig({
      primary: { provider: "gemini", model: "gemini-2.5-flash" },
      fallbacks: [
        { provider: "unknown_fb", model: "test" }
      ]
    })).toThrow(/Unknown provider 'unknown_fb'/);
  });

  test("Missing primary field throws", () => {
    expect(() => parseModelsConfig({})).toThrow(/must have a 'primary' field/);
  });

  test("Missing primary.model throws", () => {
    expect(() => parseModelsConfig({
      primary: { provider: "gemini" }
    })).toThrow(/primary.model must be a non-empty string/);
  });

  test("primary.model as empty string throws", () => {
    expect(() => parseModelsConfig({
      primary: { provider: "gemini", model: "" }
    })).toThrow(/primary.model must be a non-empty string/);
  });

  test("fallbacks as a non-array throws", () => {
    expect(() => parseModelsConfig({
      primary: { provider: "gemini", model: "test" },
      fallbacks: "not-an-array"
    })).toThrow(/fallbacks must be an array/);
  });
});

describe("resolveModels", () => {
  test("Duplicate provider:model pair in resolved model list is deduplicated", () => {
    providerRegistry.register(new GroqProvider("test"));
    providerRegistry.register(new AnthropicProvider("test"));
    providerRegistry.register(new GeminiProvider("test"));

    const reg = new ModelRegistry();
    const resolved = reg.resolveModels("gemini:gemini-2.5-flash", [
      "groq:llama-3.3-70b-versatile",
      "gemini:gemini-2.5-flash"
    ]);

    // Ensure it doesn't appear twice
    const geminiModels = resolved.filter(m => m.providerId === "gemini" && m.modelId === "gemini-2.5-flash");
    expect(geminiModels).toHaveLength(1);
    expect(resolved.length).toBe(2);
  });

  test("resolveModels() returns primary first, then fallbacks in declared order", () => {
    providerRegistry.register(new GroqProvider("test"));
    providerRegistry.register(new AnthropicProvider("test"));
    providerRegistry.register(new GeminiProvider("test"));

    const reg = new ModelRegistry();
    const resolved = reg.resolveModels("gemini:gemini-2.5-flash", [
      "groq:llama-3.3-70b-versatile",
      "anthropic:claude-sonnet"
    ]);

    expect(resolved[0]).toEqual({ providerId: "gemini", modelId: "gemini-2.5-flash" });
    expect(resolved[1]).toEqual({ providerId: "groq", modelId: "llama-3.3-70b-versatile" });
    expect(resolved[2]).toEqual({ providerId: "anthropic", modelId: "claude-sonnet" });
  });
});
