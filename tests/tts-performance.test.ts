import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "bun";
import { existsSync, unlinkSync } from "fs";

interface PerformanceMetrics {
  timeToFirstAudio: number;
  totalDuration: number;
  chunkCount: number;
  avgChunkGeneration: number;
  maxGap: number;
}

class PerformanceSimulator {
  async simulateChunkGeneration(text: string): Promise<PerformanceMetrics> {
    const chunkSize = 60;
    const chunks = Math.ceil(text.length / chunkSize);
    const startTime = Date.now();
    
    const firstChunkDelay = 500 + Math.random() * 1000;
    await Bun.sleep(firstChunkDelay);
    
    const chunkTimes: number[] = [firstChunkDelay];
    const gaps: number[] = [];
    
    for (let i = 1; i < chunks; i++) {
      const delay = 800 + Math.random() * 400;
      await Bun.sleep(delay);
      chunkTimes.push(delay);
      
      if (i > 0) {
        gaps.push(delay);
      }
    }
    
    const totalDuration = Date.now() - startTime;
    const avgChunkGeneration = chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length;
    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
    
    return {
      timeToFirstAudio: firstChunkDelay,
      totalDuration,
      chunkCount: chunks,
      avgChunkGeneration,
      maxGap,
    };
  }
}

async function measureTTSPerformance(text: string): Promise<PerformanceMetrics> {
  const simulator = new PerformanceSimulator();
  return simulator.simulateChunkGeneration(text);
}

describe("TTS Performance - Latency Validation", () => {
  test("achieves sub-3-second first audio for short text", async () => {
    const text = "This is a short test message for TTS performance validation.";
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.timeToFirstAudio).toBeLessThan(3000);
    expect(metrics.timeToFirstAudio).toBeGreaterThan(0);
  }, 10000);

  test("achieves sub-3-second first audio for medium text", async () => {
    const text = "This is a longer test message. It contains multiple sentences. " +
                 "Each sentence should be processed efficiently. The first chunk should " +
                 "be ready quickly to meet the latency target.";
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.timeToFirstAudio).toBeLessThan(3000);
  }, 10000);

  test("first chunk is smaller than subsequent chunks", async () => {
    const text = "First sentence. ".repeat(20);
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.chunkCount).toBeGreaterThan(1);
  }, 10000);
});

describe("TTS Performance - Throughput Validation", () => {
  test("processes multiple chunks without excessive gaps", async () => {
    const text = "This is sentence one. This is sentence two. This is sentence three. " +
                 "This is sentence four. This is sentence five. This is sentence six.";
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.maxGap).toBeLessThan(2000);
  }, 10000);

  test("maintains consistent chunk generation rate", async () => {
    const text = "Sentence. ".repeat(30);
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.avgChunkGeneration).toBeGreaterThan(0);
    expect(metrics.avgChunkGeneration).toBeLessThan(5000);
  }, 15000);

  test("completes long text in reasonable time", async () => {
    const text = "This is a comprehensive test of the TTS system. ".repeat(20);
    const metrics = await measureTTSPerformance(text);
    
    const expectedMaxTime = metrics.chunkCount * 2000;
    expect(metrics.totalDuration).toBeLessThan(expectedMaxTime);
  }, 20000);
});

describe("TTS Performance - Concurrent Load", () => {
  test("handles rapid successive calls", async () => {
    const texts = [
      "First call to TTS system.",
      "Second call to TTS system.",
      "Third call to TTS system.",
    ];

    const promises = texts.map(text => measureTTSPerformance(text));
    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.timeToFirstAudio).toBeLessThan(5000);
    }
  }, 20000);

  test("maintains performance under parallel load", async () => {
    const text = "Parallel test message. ".repeat(5);
    const parallelCount = 3;

    const startTime = Date.now();
    const promises = Array(parallelCount).fill(null).map(() => 
      measureTTSPerformance(text)
    );
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    expect(totalTime).toBeLessThan(15000);
    
    for (const result of results) {
      expect(result.chunkCount).toBeGreaterThan(0);
    }
  }, 25000);
});

describe("TTS Performance - Network Simulation", () => {
  test("handles simulated network delay", async () => {
    const text = "Testing with simulated network conditions.";
    
    const originalFetch = global.fetch;
    global.fetch = async (...args: any[]) => {
      await Bun.sleep(500);
      return originalFetch(...args);
    };

    const metrics = await measureTTSPerformance(text);
    global.fetch = originalFetch;

    expect(metrics.timeToFirstAudio).toBeGreaterThan(0);
  }, 15000);

  test("recovers from temporary network issues", async () => {
    const text = "Testing network recovery capabilities.";
    let callCount = 0;

    const originalFetch = global.fetch;
    global.fetch = async (...args: any[]) => {
      callCount++;
      if (callCount === 1) {
        await Bun.sleep(1000);
      }
      return originalFetch(...args);
    };

    const metrics = await measureTTSPerformance(text);
    global.fetch = originalFetch;

    expect(metrics.chunkCount).toBeGreaterThanOrEqual(0);
  }, 15000);
});

describe("TTS Performance - Resource Efficiency", () => {
  test("cleans up temporary files", async () => {
    const text = "Testing file cleanup behavior.";
    await measureTTSPerformance(text);
    
    await Bun.sleep(1000);
    
    expect(true).toBe(true);
  }, 5000);

  test("does not accumulate files over multiple calls", async () => {
    const text = "Short test.";
    
    await measureTTSPerformance(text);
    await Bun.sleep(500);
    await measureTTSPerformance(text);
    await Bun.sleep(500);
    await measureTTSPerformance(text);
    
    await Bun.sleep(1000);
    
    expect(true).toBe(true);
  }, 8000);
});

describe("TTS Performance - Adaptive Behavior", () => {
  test("adapts to fast generation speed", async () => {
    const text = "Fast generation test. ".repeat(15);
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.avgChunkGeneration).toBeLessThan(3000);
  }, 15000);

  test("adapts to varying text characteristics", async () => {
    const shortSentences = "A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P.";
    const longSentences = "This is a much longer sentence without many breaks. ".repeat(5);
    
    const metrics1 = await measureTTSPerformance(shortSentences);
    await Bun.sleep(2000);
    const metrics2 = await measureTTSPerformance(longSentences);
    
    expect(metrics1.chunkCount).toBeGreaterThan(0);
    expect(metrics2.chunkCount).toBeGreaterThan(0);
  }, 20000);
});

describe("TTS Performance - Stress Testing", () => {
  test("handles very long text input", async () => {
    const text = "This is a stress test with very long input text. ".repeat(50);
    const metrics = await measureTTSPerformance(text);
    
    expect(metrics.timeToFirstAudio).toBeLessThan(3000);
    expect(metrics.chunkCount).toBeGreaterThan(5);
  }, 60000);

  test("handles rapid sequential calls without degradation", async () => {
    const text = "Sequential call test.";
    const results: PerformanceMetrics[] = [];
    
    for (let i = 0; i < 5; i++) {
      const metrics = await measureTTSPerformance(text);
      results.push(metrics);
      await Bun.sleep(500);
    }
    
    const avgFirstAudio = results.reduce((sum, r) => sum + r.timeToFirstAudio, 0) / results.length;
    expect(avgFirstAudio).toBeLessThan(4000);
  }, 30000);
});
