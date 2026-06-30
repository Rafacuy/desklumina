import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { Validation } from "../src/utils/validation";
import { logger } from "../src/logger";
import { streamAI, AllModelsFailedError } from "../src/ai/runtime/orchestrator";
import { providerRegistry } from "../src/ai/registry";
import { GroqProvider, OpenAIProvider, AuthenticationError, ProviderNetworkError } from "../src/ai/providers";

describe("API Dependency & Validation", () => {
  const originalModel = Bun.env.DESKLUMINA_MODEL;
  const originalFallbacks = Bun.env.DESKLUMINA_FALLBACKS;

  beforeEach(() => {
    mock.restore();
    Bun.env.DESKLUMINA_MODEL = "openai:gpt-4o";
    Bun.env.DESKLUMINA_FALLBACKS = "groq:llama-3.3-70b-versatile";
    providerRegistry.reset();
    providerRegistry.register(new GroqProvider("gsk_test_key_1234567890123456789012345678901234567890"));
    providerRegistry.register(new OpenAIProvider("sk-test-key"));
  });

  afterEach(() => {
    mock.restore();
    providerRegistry.reset();

    if (originalModel === undefined) {
      delete Bun.env.DESKLUMINA_MODEL;
    } else {
      Bun.env.DESKLUMINA_MODEL = originalModel;
    }

    if (originalFallbacks === undefined) {
      delete Bun.env.DESKLUMINA_FALLBACKS;
    } else {
      Bun.env.DESKLUMINA_FALLBACKS = originalFallbacks;
    }
  });

  describe("Environment Validation", () => {
    test("detects missing MODEL_NAME", () => {
      expect(() => {
        Validation.validateEnv({});
      }).toThrow(/Missing required environment variables: MODEL_NAME/);
    });

    test("warns about malformed Groq key", () => {
      const warnSpy = spyOn(logger, "warn");
      Validation.validateEnv({
        GROQ_API_KEY: "invalid-key",
        MODEL_NAME: "test-model"
      });
      expect(warnSpy).toHaveBeenCalledWith("validation", expect.stringContaining("GROQ_API_KEY does not match expected format"));
      warnSpy.mockRestore();
    });

    test("accepts valid environment", () => {
      expect(() => {
        Validation.validateEnv({
          GROQ_API_KEY: "gsk_valid_key_1234567890123456789012345678901234567890",
          MODEL_NAME: "test-model"
        });
      }).not.toThrow();
    });
  });

  describe("Provider Error Handling", () => {
    test("handles 429 Rate Limit error with fallback", async () => {
      const mockFetch = () =>
        Promise.resolve(new Response("Rate limit exceeded", { status: 429 }));

      providerRegistry.register(new GroqProvider("gsk_test_key_1234567890123456789012345678901234567890", mockFetch));
      providerRegistry.register(new OpenAIProvider("sk-test-key-123456789012345678901234567890", mockFetch));

      const gen = streamAI(
        [{ role: "user", content: "hi" }]
      );

      // With all providers returning 429, AllModelsFailedError should be thrown
      await expect(gen.next()).rejects.toThrow(AllModelsFailedError);
    });

    test("handles 401 Unauthorized by re-throwing immediately", async () => {
      const mockFetch = () =>
        Promise.resolve(new Response("Unauthorized", { status: 401 }));

      providerRegistry.register(new GroqProvider("gsk_test_key_1234567890123456789012345678901234567890", mockFetch));
      providerRegistry.register(new OpenAIProvider("sk-test-key-123456789012345678901234567890", mockFetch));

      const gen = streamAI(
        [{ role: "user", content: "hi" }]
      );

      // 401 should re-throw immediately without attempting fallback
      await expect(gen.next()).rejects.toThrow(AuthenticationError);
    });

    test("handles network timeout/failure", async () => {
      const mockFetch = () =>
        Promise.reject(new DOMException("The operation was aborted.", "AbortError"));

      Bun.env.DESKLUMINA_FALLBACKS = "";
      providerRegistry.register(new OpenAIProvider("sk-test-key-123456789012345678901234567890", mockFetch));

      const gen = streamAI(
        [{ role: "user", content: "hi" }]
      );

      await expect(gen.next()).rejects.toThrow(ProviderNetworkError);
    });
  });
});
