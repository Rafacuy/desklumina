import { describe, test, expect } from "bun:test";
import {
  AuthenticationError,
  RateLimitError,
  ProviderAPIError,
  ProviderError,
  ProviderNetworkError,
} from "../src/ai/errors";
import {
  classifyError,
  buildRawErrorString,
  truncateRawPreview,
  CATEGORY_I18N_KEYS,
  type ErrorCategory,
} from "../src/ui/error-classify";

describe("Error classification: taxonomy", () => {
  test("CATEGORY_I18N_KEYS covers all seven categories", () => {
    const categories: ErrorCategory[] = [
      "network",
      "provider",
      "model",
      "auth",
      "ratelimit",
      "timeout",
      "unknown",
    ];
    for (const cat of categories) {
      const keys = CATEGORY_I18N_KEYS[cat];
      expect(keys).toBeDefined();
      expect(keys!.title).toBe(`error.${cat}.title`);
      expect(keys!.suggestion).toBe(`error.${cat}.suggestion`);
    }
  });

  test("AuthenticationError → auth", () => {
    const err = new AuthenticationError({
      provider: "groq",
      message: "Invalid API key",
      statusCode: 401,
    });
    expect(classifyError(err)).toBe("auth");
  });

  test("RateLimitError → ratelimit", () => {
    const err = new RateLimitError({
      provider: "groq",
      message: "Too many requests",
      statusCode: 429,
    });
    expect(classifyError(err)).toBe("ratelimit");
  });

  test("HTTP 404 on model endpoint → model", () => {
    const err = new ProviderAPIError({
      provider: "groq",
      message: "Not found",
      statusCode: 404,
      retryable: false,
    });
    expect(classifyError(err)).toBe("model");
  });

  test("HTTP 400 with model_not_found in body → model", () => {
    const err = new ProviderAPIError({
      provider: "openai",
      message: "Bad request",
      statusCode: 400,
      rawPayload: "model_not_found: llama-3.3-70b does not exist",
      retryable: false,
    });
    expect(classifyError(err)).toBe("model");
  });

  test("ProviderNetworkError → network", () => {
    const err = new ProviderNetworkError({
      provider: "groq",
      message: "fetch failed",
      cause: new Error("ECONNREFUSED"),
    });
    expect(classifyError(err)).toBe("network");
  });

  test("HTTP 408 → timeout", () => {
    const err = new ProviderAPIError({
      provider: "groq",
      message: "Request timeout",
      statusCode: 408,
      retryable: true,
    });
    expect(classifyError(err)).toBe("timeout");
  });

  test("AbortError → timeout", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(classifyError(err)).toBe("timeout");
  });

  test("TimeoutError → timeout", () => {
    const err = new Error("timed out");
    err.name = "TimeoutError";
    expect(classifyError(err)).toBe("timeout");
  });

  test("ECONNREFUSED in message → network", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
    expect(classifyError(err)).toBe("network");
  });

  test("ENOTFOUND in message → network", () => {
    const err = new Error("getaddrinfo ENOTFOUND api.groq.com");
    expect(classifyError(err)).toBe("network");
  });

  test("HTTP 500 → provider", () => {
    const err = new ProviderAPIError({
      provider: "groq",
      message: "Internal server error",
      statusCode: 500,
      retryable: true,
    });
    expect(classifyError(err)).toBe("provider");
  });

  test("HTTP 503 → provider", () => {
    const err = new ProviderAPIError({
      provider: "groq",
      message: "Service unavailable",
      statusCode: 503,
      retryable: true,
    });
    expect(classifyError(err)).toBe("provider");
  });

  test("rate limit in body (no status code) → ratelimit", () => {
    const err = new Error("You have exceeded the rate limit for this endpoint");
    expect(classifyError(err)).toBe("ratelimit");
  });

  test("quota in body (no status code) → ratelimit", () => {
    const err = new Error("Your quota has been exceeded");
    expect(classifyError(err)).toBe("ratelimit");
  });

  test("Unknown error → unknown", () => {
    const err = new Error("Something completely unexpected happened");
    expect(classifyError(err)).toBe("unknown");
  });

  test("String error → unknown", () => {
    expect(classifyError("a plain string error")).toBe("unknown");
  });

  test("Null → unknown", () => {
    expect(classifyError(null)).toBe("unknown");
  });

  test("Undefined → unknown", () => {
    expect(classifyError(undefined)).toBe("unknown");
  });
});

describe("Error classification: priority order", () => {
  test("AuthenticationError takes priority over 404 status", () => {
    const err = new AuthenticationError({
      provider: "groq",
      message: "Forbidden",
      statusCode: 403,
    });
    expect(classifyError(err)).toBe("auth");
  });

  test("RateLimitError takes priority over 5xx pattern", () => {
    const err = new RateLimitError({
      provider: "groq",
      message: "Rate limited",
      statusCode: 429,
    });
    expect(classifyError(err)).toBe("ratelimit");
  });

  test("ProviderNetworkError takes priority over timeout pattern in message", () => {
    const err = new ProviderNetworkError({
      provider: "groq",
      message: "timeout while connecting",
      cause: new Error("ETIMEDOUT"),
    });
    expect(classifyError(err)).toBe("network");
  });
});

describe("buildRawErrorString", () => {
  test("ProviderError: joins rawPayload, message, and status code", () => {
    const err = new ProviderAPIError({
      provider: "groq",
      message: "Internal server error",
      statusCode: 500,
      rawPayload: "detail: something broke",
      retryable: true,
    });
    const raw = buildRawErrorString(err);
    expect(raw).toContain("detail: something broke");
    expect(raw).toContain("Internal server error");
    expect(raw).toContain("(HTTP 500)");
  });

  test("Plain Error: uses message only", () => {
    const err = new Error("Plain failure");
    expect(buildRawErrorString(err)).toBe("Plain failure");
  });

  test("String: returned as-is", () => {
    expect(buildRawErrorString("a string error")).toBe("a string error");
  });

  test("AllModelsFailedError: appends attempted models", () => {
    const err = new Error("All models failed");
    (err as any).attemptedModels = ["groq:llama-3.3-70b", "openai:gpt-4o"];
    const raw = buildRawErrorString(err);
    expect(raw).toContain("All models failed");
    expect(raw).toContain("[attempted: groq:llama-3.3-70b, openai:gpt-4o]");
  });

  test("ProviderError: sanitizes Authorization header from rawPayload", () => {
    const err = new ProviderError({
      provider: "groq",
      message: "Auth failed",
      rawPayload: "Authorization: Bearer gsk_abcdef1234567890",
      retryable: false,
    });
    const raw = buildRawErrorString(err);
    expect(raw).toContain("[REDACTED]");
    expect(raw).not.toContain("gsk_abcdef");
  });

  test("Never translates or modifies the raw error value", () => {
    const err = new Error("Connection refused: ECONNREFUSED 127.0.0.1:443");
    const raw = buildRawErrorString(err);
    expect(raw).toBe("Connection refused: ECONNREFUSED 127.0.0.1:443");
  });
});

describe("truncateRawPreview", () => {
  test("Short string: returned as-is (no ellipsis)", () => {
    expect(truncateRawPreview("short error")).toBe("short error");
  });

  test("Exactly 60 chars: returned as-is (no ellipsis)", () => {
    const s = "a".repeat(60);
    expect(truncateRawPreview(s)).toBe(s);
  });

  test("61 chars: truncated to 60 + ellipsis", () => {
    const s = "a".repeat(61);
    const result = truncateRawPreview(s);
    expect(result).toBe("a".repeat(60) + "···");
    expect(result.length).toBe(63); // 60 + 3 ellipsis chars
  });

  test("Long string: truncated to 60 chars with trailing ellipsis", () => {
    const s = "x".repeat(200);
    const result = truncateRawPreview(s);
    expect(result.endsWith("···")).toBe(true);
    expect(Array.from(result).length).toBe(63);
  });

  test("Unicode-safe: counts code points, not UTF-16 units", () => {
    const emoji = "🌐".repeat(61); // 61 code points, 122 UTF-16 units
    const result = truncateRawPreview(emoji);
    expect(Array.from(result).length).toBe(63); // 60 emojis + 3 ellipsis
  });

  test("Empty string: returned as-is", () => {
    expect(truncateRawPreview("")).toBe("");
  });
});

describe("ChatRequestError: error wrapping", () => {
  test("ChatRequestError preserves original error object", async () => {
    const { ChatRequestError } = await import("../src/types");
    const original = new ProviderAPIError({
      provider: "groq",
      message: "Server error",
      statusCode: 503,
      retryable: true,
    });
    const wrapped = new ChatRequestError(original);
    expect(wrapped.originalError).toBe(original);
    expect(wrapped.message).toBe("Server error");
    expect(wrapped.name).toBe("ChatRequestError");
    // Classification should work on the original error
    expect(classifyError(wrapped.originalError)).toBe("provider");
  });

  test("ChatRequestError preserves non-Error originals", async () => {
    const { ChatRequestError } = await import("../src/types");
    const wrapped = new ChatRequestError("a string error");
    expect(wrapped.originalError).toBe("a string error");
    expect(wrapped.message).toBe("a string error");
  });
});
