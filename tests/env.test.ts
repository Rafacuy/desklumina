import { describe, test, expect } from "bun:test";

describe("Environment Configuration", () => {
  test("GROQ_API_KEY is defined", () => {
    expect(process.env.GROQ_API_KEY).toBeDefined();
  });

  test("MODEL_NAME is defined", () => {
    expect(process.env.MODEL_NAME).toBeDefined();
  });

  test("environment variables are strings", () => {
    expect(typeof process.env.GROQ_API_KEY).toBe("string");
    expect(typeof process.env.MODEL_NAME).toBe("string");
  });
});
