import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolveProviderRuntimeConfig, modelConfig, env } from "../src/config/env";
import { loadModelsConfig } from "../src/ai/config/models-config";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TEST_CONFIG_DIR = join(homedir(), ".config/desklumina");
const TEST_MODELS_PATH = join(TEST_CONFIG_DIR, "models.json");

describe("Provider Runtime Resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean environment for each test
    delete process.env.DESKLUMINA_MODEL;
    delete process.env.MODEL_NAME;
    delete process.env.DESKLUMINA_FALLBACKS;
    delete process.env.FALLBACK_MODELS;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.HF_API_KEY;
  });

  afterEach(() => {
    // Restore environment
    Object.assign(process.env, originalEnv);
    try {
      unlinkSync(TEST_MODELS_PATH);
    } catch {
      // ignore if file doesn't exist
    }
  });

  test("Scenario 1: resolves primary and fallbacks from environment variables", () => {
    process.env.DESKLUMINA_MODEL = "gemini:gemini-3.1-flash-lite";
    process.env.DESKLUMINA_FALLBACKS = "groq:openai/gpt-oss-20b,groq:llama-3.3-70b-versatile";

    const config = resolveProviderRuntimeConfig();

    expect(config.primaryModel).toBe("gemini:gemini-3.1-flash-lite");
    expect(config.fallbackModels).toEqual([
      "groq:openai/gpt-oss-20b",
      "groq:llama-3.3-70b-versatile",
    ]);
  });

  test("Scenario 2: changing environment variables is reflected immediately", () => {
    process.env.DESKLUMINA_MODEL = "openai:gpt-4";
    process.env.DESKLUMINA_FALLBACKS = "groq:llama-3.3-70b-versatile";

    const config1 = resolveProviderRuntimeConfig();
    expect(config1.fallbackModels).toEqual(["groq:llama-3.3-70b-versatile"]);

    // Change environment
    delete process.env.DESKLUMINA_FALLBACKS;

    const config2 = resolveProviderRuntimeConfig();
    expect(config2.primaryModel).toBe("openai:gpt-4");
    expect(config2.fallbackModels).toEqual([]);
  });

  test("Scenario 3: modelConfig getters return current environment values on each access", () => {
    process.env.DESKLUMINA_MODEL = "anthropic:claude-sonnet";
    process.env.DESKLUMINA_FALLBACKS = "gemini:gemini-pro,groq:llama-70b";

    expect(modelConfig.primaryModel).toBe("anthropic:claude-sonnet");
    expect(modelConfig.fallbackModels).toEqual(["gemini:gemini-pro", "groq:llama-70b"]);

    // Mutate environment
    process.env.DESKLUMINA_FALLBACKS = "openai:gpt-4";

    expect(modelConfig.fallbackModels).toEqual(["openai:gpt-4"]);
  });

  test("Scenario 4: env getters return current environment values on each access", () => {
    process.env.GROQ_API_KEY = "gsk_test_key";
    process.env.DESKLUMINA_MODEL = "groq:llama-3.1-8b";

    expect(env.GROQ_API_KEY).toBe("gsk_test_key");
    expect(env.MODEL_NAME).toBe("groq:llama-3.1-8b");

    delete process.env.GROQ_API_KEY;
    expect(env.GROQ_API_KEY).toBe("");
  });

  test("Scenario 5: models.json fallbacks are loaded even when primary model is from env", () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_MODELS_PATH,
      JSON.stringify({
        primary: { provider: "gemini", model: "gemini-2.5-flash" },
        fallbacks: [
          { provider: "groq", model: "llama-3.3-70b-versatile", reason: "provider-down" },
          { provider: "openai", model: "gpt-4", reason: "rate-limit" },
        ],
      })
    );

    // Primary model from env, no env fallbacks
    process.env.DESKLUMINA_MODEL = "anthropic:claude-opus";

    const config = resolveProviderRuntimeConfig();

    expect(config.primaryModel).toBe("anthropic:claude-opus");
    expect(config.fallbackModels).toEqual([
      "groq:llama-3.3-70b-versatile",
      "openai:gpt-4",
    ]);
  });

  test("Scenario 6: env fallbacks take precedence over models.json fallbacks", () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_MODELS_PATH,
      JSON.stringify({
        primary: { provider: "gemini", model: "gemini-2.5-flash" },
        fallbacks: [
          { provider: "groq", model: "llama-3.3-70b-versatile", reason: "provider-down" },
        ],
      })
    );

    process.env.DESKLUMINA_MODEL = "openai:gpt-4";
    process.env.DESKLUMINA_FALLBACKS = "anthropic:claude-haiku";

    const config = resolveProviderRuntimeConfig();

    expect(config.primaryModel).toBe("openai:gpt-4");
    expect(config.fallbackModels).toEqual(["anthropic:claude-haiku"]);
  });

  test("Scenario 7: when no env primary and models.json exists, primary and fallbacks come from models.json", () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_MODELS_PATH,
      JSON.stringify({
        primary: { provider: "gemini", model: "gemini-2.5-flash" },
        fallbacks: [
          { provider: "groq", model: "llama-3.3-70b-versatile", reason: "provider-down" },
        ],
      })
    );

    const config = resolveProviderRuntimeConfig();

    expect(config.primaryModel).toBe("gemini:gemini-2.5-flash");
    expect(config.fallbackModels).toEqual(["groq:llama-3.3-70b-versatile"]);
  });

  test("Scenario 8: deleted models.json is not cached - subsequent resolution returns empty fallbacks", () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_MODELS_PATH,
      JSON.stringify({
        primary: { provider: "gemini", model: "gemini-2.5-flash" },
        fallbacks: [
          { provider: "groq", model: "llama-3.3-70b-versatile", reason: "provider-down" },
        ],
      })
    );

    // No env vars, so models.json is used
    const config1 = resolveProviderRuntimeConfig();
    expect(config1.fallbackModels).toEqual(["groq:llama-3.3-70b-versatile"]);

    // Delete models.json
    unlinkSync(TEST_MODELS_PATH);

    const config2 = resolveProviderRuntimeConfig();
    expect(config2.primaryModel).toBe("");
    expect(config2.fallbackModels).toEqual([]);
  });
});
