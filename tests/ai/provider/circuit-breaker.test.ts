import { describe, test, expect } from "bun:test";
import { CircuitBreaker } from "../../../src/ai/provider/circuit-breaker";

describe("CircuitBreaker", () => {
  test("starts healthy for unknown provider", () => {
    const breaker = new CircuitBreaker();
    expect(breaker.isHealthy("openai")).toBe(true);
  });

  test("becomes unhealthy after failures", () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure("openai");
    breaker.recordFailure("openai");
    breaker.recordFailure("openai");
    expect(breaker.isHealthy("openai")).toBe(false);
  });

  test("recovers after timeout expires", () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure("openai");

    const state = (breaker as any).state.get("openai");
    if (state) {
      state.until = Date.now() - 1000;
    }

    expect(breaker.isHealthy("openai")).toBe(true);
  });

  test("resets to healthy after success", () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure("openai");
    breaker.recordFailure("openai");
    expect(breaker.isHealthy("openai")).toBe(false);

    breaker.recordSuccess("openai");
    expect(breaker.isHealthy("openai")).toBe(true);
  });

  test("tracks failures per provider independently", () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure("openai");
    breaker.recordFailure("openai");

    expect(breaker.isHealthy("openai")).toBe(false);
    expect(breaker.isHealthy("anthropic")).toBe(true);
    expect(breaker.isHealthy("gemini")).toBe(true);
  });

  test("backoff increases exponentially with failures", () => {
    const breaker = new CircuitBreaker();

    breaker.recordFailure("openai");
    const state1 = (breaker as any).state.get("openai");
    const until1 = state1.until;

    breaker.recordSuccess("openai");

    breaker.recordFailure("openai");
    breaker.recordFailure("openai");
    const state2 = (breaker as any).state.get("openai");
    const until2 = state2.until;

    const backoff1 = until1 - (Date.now() - 100);
    const backoff2 = until2 - (Date.now() - 100);
    expect(backoff2).toBeGreaterThan(backoff1);
  });
});
