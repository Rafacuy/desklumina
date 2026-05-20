import { describe, expect, test } from "bun:test";
import {
  createStreamMetrics,
  updateStreamMetrics,
  calculateThroughput,
  type StreamMetrics,
} from "../../../src/ai/observability/stream-metrics";

describe("Stream Metrics", () => {
  test("createStreamMetrics initializes correctly", () => {
    const now = 1000;
    const metrics = createStreamMetrics(now);

    expect(metrics.streamStartMs).toBe(1000);
    expect(metrics.firstTokenMs).toBeUndefined();
    expect(metrics.lastChunkMs).toBe(1000);
    expect(metrics.completionTokens).toBe(0);
    expect(metrics.chunkCount).toBe(0);
    expect(metrics.outputChars).toBe(0);
  });

  test("updateStreamMetrics tracks first token", () => {
    const metrics = createStreamMetrics(1000);
    const updated = updateStreamMetrics(metrics, 1100, 20);

    expect(updated.firstTokenMs).toBe(1100);
    expect(updated.lastChunkMs).toBe(1100);
    expect(updated.completionTokens).toBe(5);
    expect(updated.chunkCount).toBe(1);
    expect(updated.outputChars).toBe(20);
  });

  test("updateStreamMetrics accumulates tokens", () => {
    let metrics = createStreamMetrics(1000);
    metrics = updateStreamMetrics(metrics, 1100, 20);
    metrics = updateStreamMetrics(metrics, 1200, 40);
    metrics = updateStreamMetrics(metrics, 1300, 16);

    expect(metrics.firstTokenMs).toBe(1100);
    expect(metrics.lastChunkMs).toBe(1300);
    expect(metrics.completionTokens).toBe(19);
    expect(metrics.chunkCount).toBe(3);
    expect(metrics.outputChars).toBe(76);
  });

  test("calculateThroughput returns warming state before first token", () => {
    const metrics = createStreamMetrics(1000);
    const throughput = calculateThroughput(metrics, 1600);

    expect(throughput.state).toBe("warming");
    expect(throughput.tokensPerSec).toBe(0);
  });

  test("calculateThroughput returns warming state before minimum duration", () => {
    let metrics = createStreamMetrics(1000);
    metrics = updateStreamMetrics(metrics, 1100, 20);

    const throughput = calculateThroughput(metrics, 1400);

    expect(throughput.state).toBe("warming");
    expect(throughput.tokensPerSec).toBe(0);
  });

  test("calculateThroughput computes active throughput after minimum duration", () => {
    let metrics = createStreamMetrics(1000);
    metrics = updateStreamMetrics(metrics, 1100, 20);
    metrics = updateStreamMetrics(metrics, 1200, 40);
    metrics = updateStreamMetrics(metrics, 1300, 40);

    const throughput = calculateThroughput(metrics, 1700);

    expect(throughput.state).toBe("active");
    expect(throughput.tokensPerSec).toBeGreaterThan(0);
  });

  test("calculateThroughput produces realistic tok/s values", () => {
    let metrics = createStreamMetrics(0);
    metrics = updateStreamMetrics(metrics, 100, 100);
    metrics = updateStreamMetrics(metrics, 200, 100);
    metrics = updateStreamMetrics(metrics, 300, 100);
    metrics = updateStreamMetrics(metrics, 400, 100);
    metrics = updateStreamMetrics(metrics, 500, 100);
    metrics = updateStreamMetrics(metrics, 600, 100);

    const throughput = calculateThroughput(metrics, 600);

    expect(throughput.state).toBe("active");
    expect(throughput.tokensPerSec).toBeGreaterThan(100);
    expect(throughput.tokensPerSec).toBeLessThan(400);
  });

  test("calculateThroughput never returns 0 tok/s in active state", () => {
    let metrics = createStreamMetrics(0);
    metrics = updateStreamMetrics(metrics, 100, 4);
    metrics = updateStreamMetrics(metrics, 600, 4);

    const throughput = calculateThroughput(metrics, 600);

    expect(throughput.state).toBe("active");
    expect(throughput.tokensPerSec).toBeGreaterThan(0);
  });

  test("calculateThroughput uses rolling window for recent activity", () => {
    let metrics = createStreamMetrics(0);
    metrics = updateStreamMetrics(metrics, 100, 400);
    metrics = updateStreamMetrics(metrics, 3000, 400);

    const throughput = calculateThroughput(metrics, 3000);

    expect(throughput.state).toBe("active");
    expect(throughput.tokensPerSec).toBeGreaterThan(0);
  });
});
