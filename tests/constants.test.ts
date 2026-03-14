import { describe, test, expect } from "bun:test";
import { COMMAND_TIMEOUT } from "../src/constants/commands";
import { DEFAULT_FALLBACK_MODELS, GROQ_API_ENDPOINT } from "../src/constants/models";

describe("Constants", () => {
  test("COMMAND_TIMEOUT is defined and valid", () => {
    expect(COMMAND_TIMEOUT).toBeDefined();
    expect(typeof COMMAND_TIMEOUT).toBe("number");
    expect(COMMAND_TIMEOUT).toBeGreaterThan(0);
  });

  test("GROQ_API_ENDPOINT is valid URL", () => {
    expect(GROQ_API_ENDPOINT).toBeDefined();
    expect(GROQ_API_ENDPOINT).toContain("https://");
    expect(GROQ_API_ENDPOINT).toContain("groq.com");
  });

  test("DEFAULT_FALLBACK_MODELS is valid array", () => {
    expect(Array.isArray(DEFAULT_FALLBACK_MODELS)).toBe(true);
    expect(DEFAULT_FALLBACK_MODELS.length).toBeGreaterThan(0);
  });
});
