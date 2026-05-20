import { describe, test, expect } from "bun:test";

describe("Environment Configuration", () => {
  test("MODEL_NAME is defined", () => {
    expect(process.env.MODEL_NAME).toBeDefined();
  });

  test("environment variables are strings", () => {
    expect(typeof process.env.MODEL_NAME).toBe("string");
  });
});
