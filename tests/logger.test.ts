import { describe, test, expect } from "bun:test";
import { logger } from "../src/logger";

describe("Logger", () => {
  test("logger has required methods", () => {
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  test("logger.info logs without error", () => {
    expect(() => {
      logger.info("test", "Test message");
    }).not.toThrow();
  });

  test("logger.warn logs without error", () => {
    expect(() => {
      logger.warn("test", "Warning message");
    }).not.toThrow();
  });

  test("logger.error logs without error", () => {
    expect(() => {
      logger.error("test", "Error message");
    }).not.toThrow();
  });

  test("logger handles error objects", () => {
    expect(() => {
      const error = new Error("Test error");
      logger.error("test", "Error occurred", error);
    }).not.toThrow();
  });
});
