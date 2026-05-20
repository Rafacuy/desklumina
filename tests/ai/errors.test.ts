import { describe, test, expect } from "bun:test";
import {
  ProviderError,
  AuthenticationError,
  RateLimitError,
  ProviderAPIError,
  ProviderNetworkError,
  ProviderParseError,
} from "../../src/ai/errors";

describe("Error hierarchy", () => {
  test("ProviderError is base class with required fields", () => {
    const err = new ProviderError({
      provider: "groq",
      message: "Test error",
      statusCode: 500,
      retryable: true,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ProviderError");
    expect(err.provider).toBe("groq");
    expect(err.message).toBe("Test error");
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(true);
  });

  test("AuthenticationError is not retryable", () => {
    const err = new AuthenticationError({
      provider: "openai",
      message: "Invalid key",
      statusCode: 401,
    });

    expect(err).toBeInstanceOf(ProviderError);
    expect(err.name).toBe("AuthenticationError");
    expect(err.retryable).toBe(false);
  });

  test("RateLimitError is retryable by default", () => {
    const err = new RateLimitError({
      provider: "groq",
      message: "Rate limited",
      statusCode: 429,
    });

    expect(err).toBeInstanceOf(ProviderError);
    expect(err.name).toBe("RateLimitError");
    expect(err.retryable).toBe(true);
  });

  test("RateLimitError can be marked non-retryable", () => {
    const err = new RateLimitError({
      provider: "groq",
      message: "Rate limited",
      statusCode: 429,
      retryable: false,
    });

    expect(err.retryable).toBe(false);
  });

  test("ProviderAPIError preserves retryable flag", () => {
    const retryable = new ProviderAPIError({
      provider: "anthropic",
      message: "Server error",
      statusCode: 503,
      retryable: true,
    });

    const nonRetryable = new ProviderAPIError({
      provider: "anthropic",
      message: "Bad request",
      statusCode: 400,
      retryable: false,
    });

    expect(retryable.retryable).toBe(true);
    expect(nonRetryable.retryable).toBe(false);
  });

  test("ProviderNetworkError is retryable by default", () => {
    const err = new ProviderNetworkError({
      provider: "gemini",
      message: "Network timeout",
      cause: new Error("ETIMEDOUT"),
    });

    expect(err).toBeInstanceOf(ProviderError);
    expect(err.name).toBe("ProviderNetworkError");
    expect(err.retryable).toBe(true);
  });

  test("ProviderParseError is not retryable by default", () => {
    const err = new ProviderParseError({
      provider: "openrouter",
      message: "Invalid JSON",
      rawPayload: "not json",
    });

    expect(err).toBeInstanceOf(ProviderError);
    expect(err.name).toBe("ProviderParseError");
    expect(err.retryable).toBe(false);
  });

  test("ProviderError sanitizes raw payload", () => {
    const err = new ProviderError({
      provider: "groq",
      message: "Auth failed",
      rawPayload: "Authorization: Bearer gsk_abcdefghijklmnopqrstuvwxyz1234567890",
      retryable: false,
    });

    expect(err.rawPayload).toContain("[REDACTED]");
    expect(err.rawPayload).not.toContain("gsk_");
  });

  test("ProviderError preserves cause", () => {
    const cause = new Error("Underlying network error");
    const err = new ProviderNetworkError({
      provider: "openai",
      message: "Request failed",
      cause,
    });

    expect(err.cause).toBe(cause);
  });
});
