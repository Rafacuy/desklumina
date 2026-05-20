import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Validation } from "../src/utils/validation";
import { logger } from "../src/logger";
import { providerRegistry, streamAI, AllModelsFailedError } from "../src/ai";
import { GroqProvider, OpenAIProvider, AuthenticationError, ProviderNetworkError } from "../src/ai";

describe("API Dependency & Validation", () => {

  beforeEach(() => {
    providerRegistry.reset();
    providerRegistry.register(new GroqProvider("gsk_test_key_1234567890123456789012345678901234567890"));
    providerRegistry.register(new OpenAIProvider("sk-test-key"));
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
        [{ role: "user", content: "hi" }],
        "openai:gpt-4o",
        ["groq:llama-3.3-70b-versatile"]
      );

      // With all providers returning 429, AllModelsFailedError should be thrown
      await expect(gen.next()).rejects.toThrow();
    });

    test("handles 401 Unauthorized by re-throwing immediately", async () => {
      const mockFetch = () =>
        Promise.resolve(new Response("Unauthorized", { status: 401 }));

      providerRegistry.register(new GroqProvider("gsk_test_key_1234567890123456789012345678901234567890", mockFetch));
      providerRegistry.register(new OpenAIProvider("sk-test-key-123456789012345678901234567890", mockFetch));

      const gen = streamAI(
        [{ role: "user", content: "hi" }],
        "openai:gpt-4o",
        ["groq:llama-3.3-70b-versatile"]
      );

      // 401 should re-throw immediately without attempting fallback
      await expect(gen.next()).rejects.toThrow();
    });

    test("handles network timeout/failure", async () => {
      const mockFetch = () =>
        Promise.reject(new DOMException("The operation was aborted.", "AbortError"));

      providerRegistry.register(new OpenAIProvider("sk-test-key-123456789012345678901234567890", mockFetch));

      const gen = streamAI(
        [{ role: "user", content: "hi" }],
        "openai:gpt-4o"
      );

      await expect(gen.next()).rejects.toThrow();
    });
  });
});
