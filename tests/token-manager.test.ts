import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { TokenManager, tokenManager } from "../src/core/services/token-manager";
import { logger } from "../src/logger";

describe("TokenManager", () => {
  beforeEach(() => {
    // Accessing private usageHistory to reset for tests
    (tokenManager as any).usageHistory = [];
    tokenManager.setTpmLimit(30_000);
  });

  test("estimateTokens uses script-aware multipliers", () => {
    // Latin: 4 chars * 0.25 = 1
    expect(tokenManager.estimateTokens("abcd")).toBe(1);
    // Numbers: 4 chars * 0.5 = 2
    expect(tokenManager.estimateTokens("1234")).toBe(2);
    // CJK: 2 chars * 1.2 = 2.4 -> ceil = 3
    expect(tokenManager.estimateTokens("你好")).toBe(3);
    // Mixed: "hi 你好 123"
    // "hi" (2 latin) * 0.25 = 0.5
    // "你好" (2 cjk) * 1.2 = 2.4
    // "123" (3 dense) * 0.5 = 1.5
    // "  " (2 spaces) * 0.25 = 0.5
    // Total = 0.5 + 2.4 + 1.5 + 0.5 = 4.9 -> ceil = 5
    expect(tokenManager.estimateTokens("hi 你好 123")).toBe(5);

    expect(tokenManager.estimateTokens("")).toBe(0);
    expect(tokenManager.estimateTokens(null as any)).toBe(0);
  });

  test("estimateTokens yields a reasonable count for large latin input", () => {
    const largeInput = "a".repeat(10_000);
    const estimate = tokenManager.estimateTokens(largeInput);
    // 10k chars at 0.25 = 2500, give it some slack
    expect(estimate).toBeGreaterThanOrEqual(2500);
    expect(estimate).toBeLessThanOrEqual(3000);
  });

  test("trackUsage adds to history and calculates TPM", () => {
    tokenManager.trackUsage(100);
    tokenManager.trackUsage(200);
    expect(tokenManager.getCurrentTPM()).toBe(300);
  });

  test("pruneHistory removes old entries", () => {
    const now = Date.now();
    (tokenManager as any).usageHistory = [
      { timestamp: now - 70000, tokens: 500 }, // Expired
      { timestamp: now - 30000, tokens: 200 }, // Active
    ];
    
    expect(tokenManager.getCurrentTPM()).toBe(200);
  });

  test("isLikelyToLimit correctly identifies potential overflows", () => {
    tokenManager.trackUsage(25000);
    // Limit is 30,000. 25,000 + 6,000 = 31,000 (> 30,000)
    expect(tokenManager.isLikelyToLimit(6000)).toBe(true);
    // 25,000 + 4,000 = 29,000 (< 30,000)
    expect(tokenManager.isLikelyToLimit(4000)).toBe(false);
  });

  test("enforceBudget waits when limit is approached", async () => {
    tokenManager.trackUsage(28000);

    const warnSpy = spyOn(logger, "warn");

    // bump it up, then clear right away so it doesn't hang forever waiting on real time
    const enforcePromise = tokenManager.enforceBudget(3000);
    (tokenManager as any).usageHistory = [];
    await enforcePromise;

    // shouldve screamed about throttling by now
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("enforceBudget throws if request is larger than total limit", async () => {
    await expect(tokenManager.enforceBudget(35000)).rejects.toThrow(/exceeds total TPM limit/);
  });

  test("logs warning when exceeding threshold", () => {
    const warnSpy = spyOn(logger, "warn");
    // Threshold is 80% of 30,000 = 24,000
    tokenManager.trackUsage(25000);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
