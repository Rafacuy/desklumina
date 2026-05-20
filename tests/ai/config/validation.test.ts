import { describe, test, expect } from "bun:test";
import { validateProviderRuntimeConfig } from "../../../src/ai/config/runtime";

describe("Config validation", () => {
  test("rejects when no API keys provided", () => {
    expect(() =>
      validateProviderRuntimeConfig({
        groqApiKey: "",
        openaiApiKey: "",
        anthropicApiKey: "",
        geminiApiKey: "",
        openrouterApiKey: "",
        hfApiKey: "",
        primaryModel: "gpt-4",
        fallbackModels: [],
      })
    ).toThrow(/At least one provider API key/);
  });

  test("rejects when primary model is empty", () => {
    expect(() =>
      validateProviderRuntimeConfig({
        groqApiKey: "gsk_valid",
        primaryModel: "",
        fallbackModels: [],
      })
    ).toThrow(/MODEL_NAME/);
  });

  test("accepts valid config with at least one key", () => {
    expect(() =>
      validateProviderRuntimeConfig({
        geminiApiKey: "ai_valid_key",
        primaryModel: "gemini:gemini-2.5-flash",
        fallbackModels: [],
      })
    ).not.toThrow();
  });

  test("accepts config with multiple keys", () => {
    expect(() =>
      validateProviderRuntimeConfig({
        groqApiKey: "gsk_valid",
        openaiApiKey: "sk-valid",
        anthropicApiKey: "ant-valid",
        primaryModel: "openai:gpt-4",
        fallbackModels: ["anthropic:claude-3-sonnet"],
      })
    ).not.toThrow();
  });
});
