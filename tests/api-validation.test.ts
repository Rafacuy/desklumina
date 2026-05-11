import { describe, test, expect, spyOn, beforeEach } from "bun:test";
import { Validation } from "../src/utils/validation";
import { logger } from "../src/logger";
import { streamGroq, GroqAPIError } from "../src/ai/groq";

describe("API Dependency & Validation", () => {
  
  describe("Environment Validation", () => {
    test("detects missing GROQ_API_KEY", () => {
      expect(() => {
        Validation.validateEnv({ MODEL_NAME: "test-model" });
      }).toThrow(/Missing required environment variables: GROQ_API_KEY/);
    });

    test("detects missing MODEL_NAME", () => {
      expect(() => {
        Validation.validateEnv({ GROQ_API_KEY: "gsk_test_key_1234567890123456789012345678901234567890" });
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

  describe("Provider Error Handling (Simulated)", () => {
    test("handles 429 Rate Limit error", async () => {
      // Mock fetch to return 429
      const mockFetch = spyOn(globalThis, "fetch").mockImplementation(() => 
        Promise.resolve(new Response("Rate limit exceeded", { status: 429 }))
      );

      try {
        const gen = streamGroq([{ role: "user", content: "hi" }]);
        await gen.next();
      } catch (error) {
        expect(error).toBeDefined();
        // Now throws GroqAPIError directly for 429 to avoid wasting TPM
        expect(error.name).toBe("GroqAPIError");
        expect((error as any).statusCode).toBe(429);
      }

      mockFetch.mockRestore();
    });

    test("handles 401 Unauthorized error", async () => {
      const mockFetch = spyOn(globalThis, "fetch").mockImplementation(() => 
        Promise.resolve(new Response("Invalid API Key", { status: 401 }))
      );

      try {
        const gen = streamGroq([{ role: "user", content: "hi" }]);
        await gen.next();
      } catch (error) {
        expect(error.name).toBe("AllModelsFailedError");
      }

      mockFetch.mockRestore();
    });
    
    test("handles network timeout/failure", async () => {
      const mockFetch = spyOn(globalThis, "fetch").mockImplementation(() => 
        Promise.reject(new Error("Network connection lost"))
      );

      try {
        const gen = streamGroq([{ role: "user", content: "hi" }]);
        await gen.next();
      } catch (error) {
        expect(error.message).toBe("Network connection lost");
      }

      mockFetch.mockRestore();
    });
  });
});
