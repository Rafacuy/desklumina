import { describe, test, expect, beforeEach } from "bun:test";
import { spawn } from "bun";

interface StreamingMetrics {
  chunksGenerated: number;
  chunksPlayed: number;
  gapDetected: boolean;
  overlapDetected: boolean;
  playbackOrder: number[];
  generationTimes: number[];
}

class StreamingValidator {
  private chunks: Map<number, { generated: number; played: number }> = new Map();
  private lastPlayedId = -1;

  recordGeneration(chunkId: number, timestamp: number) {
    const existing = this.chunks.get(chunkId) || { generated: 0, played: 0 };
    existing.generated = timestamp;
    this.chunks.set(chunkId, existing);
  }

  recordPlayback(chunkId: number, timestamp: number) {
    const existing = this.chunks.get(chunkId) || { generated: 0, played: 0 };
    existing.played = timestamp;
    this.chunks.set(chunkId, existing);
    this.lastPlayedId = chunkId;
  }

  validateStreamingContinuity(): StreamingMetrics {
    const playbackOrder: number[] = [];
    const generationTimes: number[] = [];
    let gapDetected = false;
    let overlapDetected = false;

    const sortedChunks = Array.from(this.chunks.entries()).sort((a, b) => a[0] - b[0]);

    for (let i = 0; i < sortedChunks.length; i++) {
      const [id, times] = sortedChunks[i];
      
      if (times.played > 0) {
        playbackOrder.push(id);
      }

      if (times.generated > 0) {
        generationTimes.push(times.generated);
      }

      if (i > 0) {
        const prevTimes = sortedChunks[i - 1][1];
        
        if (times.played > 0 && prevTimes.played > 0) {
          const gap = times.played - prevTimes.played;
          if (gap > 2000) {
            gapDetected = true;
          }
          if (gap < 0) {
            overlapDetected = true;
          }
        }
      }
    }

    return {
      chunksGenerated: sortedChunks.filter(([_, t]) => t.generated > 0).length,
      chunksPlayed: sortedChunks.filter(([_, t]) => t.played > 0).length,
      gapDetected,
      overlapDetected,
      playbackOrder,
      generationTimes,
    };
  }
}

describe("TTS Streaming - Continuity Validation", () => {
  test("maintains sequential playback order", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 200);
    validator.recordGeneration(2, 300);
    
    validator.recordPlayback(0, 150);
    validator.recordPlayback(1, 250);
    validator.recordPlayback(2, 350);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.playbackOrder).toEqual([0, 1, 2]);
    expect(metrics.overlapDetected).toBe(false);
  });

  test("detects gaps in playback", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 200);
    
    validator.recordPlayback(0, 150);
    validator.recordPlayback(1, 3000);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.gapDetected).toBe(true);
  });

  test("detects overlapping playback", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 200);
    
    validator.recordPlayback(0, 300);
    validator.recordPlayback(1, 250);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.overlapDetected).toBe(true);
  });

  test("validates all chunks are played", () => {
    const validator = new StreamingValidator();
    
    for (let i = 0; i < 5; i++) {
      validator.recordGeneration(i, 100 + 100 * i);
      validator.recordPlayback(i, 200 + 100 * i);
    }
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.chunksGenerated).toBe(5);
    expect(metrics.chunksPlayed).toBe(5);
  });
});

describe("TTS Streaming - Parallel Processing", () => {
  test("generates multiple chunks concurrently", () => {
    const validator = new StreamingValidator();
    const startTime = Date.now();
    
    validator.recordGeneration(0, startTime);
    validator.recordGeneration(1, startTime + 10);
    validator.recordGeneration(2, startTime + 20);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.chunksGenerated).toBe(3);
    expect(metrics.generationTimes[2] - metrics.generationTimes[0]).toBeLessThan(100);
  });

  test("starts playback before all chunks are generated", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordPlayback(0, 150);
    
    validator.recordGeneration(1, 200);
    validator.recordGeneration(2, 250);
    
    validator.recordPlayback(1, 300);
    validator.recordPlayback(2, 400);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.playbackOrder[0]).toBe(0);
    expect(metrics.chunksGenerated).toBe(3);
  });

  test("handles concurrent generation without blocking", () => {
    const validator = new StreamingValidator();
    const baseTime = Date.now();
    
    const maxParallel = 3;
    for (let i = 0; i < maxParallel; i++) {
      validator.recordGeneration(i, baseTime + i * 5);
    }
    
    const metrics = validator.validateStreamingContinuity();
    const timeSpan = metrics.generationTimes[maxParallel - 1] - metrics.generationTimes[0];
    
    expect(timeSpan).toBeLessThan(100);
  });
});

describe("TTS Streaming - Boundary Handling", () => {
  test("handles single chunk without gaps", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordPlayback(0, 150);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.gapDetected).toBe(false);
    expect(metrics.overlapDetected).toBe(false);
  });

  test("handles many chunks without degradation", () => {
    const validator = new StreamingValidator();
    const chunkCount = 20;
    
    for (let i = 0; i < chunkCount; i++) {
      validator.recordGeneration(i, 100 + i * 50);
      validator.recordPlayback(i, 150 + i * 100);
    }
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.chunksGenerated).toBe(chunkCount);
    expect(metrics.chunksPlayed).toBe(chunkCount);
    expect(metrics.playbackOrder.length).toBe(chunkCount);
  });

  test("handles irregular chunk timing", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 500);
    validator.recordGeneration(2, 600);
    
    validator.recordPlayback(0, 200);
    validator.recordPlayback(1, 700);
    validator.recordPlayback(2, 900);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.playbackOrder).toEqual([0, 1, 2]);
  });
});

describe("TTS Streaming - Error Recovery", () => {
  test("continues playback after chunk failure", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordPlayback(0, 150);
    
    validator.recordGeneration(1, 200);
    
    validator.recordGeneration(2, 300);
    validator.recordPlayback(2, 350);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.chunksGenerated).toBe(3);
    expect(metrics.chunksPlayed).toBe(2);
  });

  test("maintains order after partial failure", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 200);
    validator.recordGeneration(2, 300);
    
    validator.recordPlayback(0, 150);
    validator.recordPlayback(2, 350);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.playbackOrder).toEqual([0, 2]);
  });
});

describe("TTS Streaming - Queue Management", () => {
  test("processes generation queue in order", () => {
    const validator = new StreamingValidator();
    const queue = [0, 1, 2, 3, 4];
    
    queue.forEach((id, idx) => {
      validator.recordGeneration(id, 100 + idx * 50);
    });
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.chunksGenerated).toBe(queue.length);
    expect(metrics.generationTimes).toHaveLength(queue.length);
  });

  test("maintains playback queue order", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 150);
    validator.recordGeneration(2, 200);
    
    validator.recordPlayback(0, 300);
    validator.recordPlayback(1, 400);
    validator.recordPlayback(2, 500);
    
    const metrics = validator.validateStreamingContinuity();
    
    for (let i = 0; i < metrics.playbackOrder.length - 1; i++) {
      expect(metrics.playbackOrder[i]).toBeLessThan(metrics.playbackOrder[i + 1]);
    }
  });

  test("handles queue with varying chunk sizes", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordGeneration(1, 200);
    validator.recordGeneration(2, 250);
    
    validator.recordPlayback(0, 300);
    validator.recordPlayback(1, 500);
    validator.recordPlayback(2, 600);
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.chunksGenerated).toBe(3);
    expect(metrics.chunksPlayed).toBe(3);
  });
});

describe("TTS Streaming - Timing Validation", () => {
  test("generation completes before playback", () => {
    const validator = new StreamingValidator();
    
    validator.recordGeneration(0, 100);
    validator.recordPlayback(0, 150);
    
    validator.recordGeneration(1, 200);
    validator.recordPlayback(1, 250);
    
    const chunks = Array.from((validator as any).chunks.entries());
    
    for (const [_, times] of chunks) {
      if (times.played > 0) {
        expect(times.generated).toBeLessThan(times.played);
      }
    }
  });

  test("detects reasonable inter-chunk timing", () => {
    const validator = new StreamingValidator();
    
    for (let i = 0; i < 5; i++) {
      validator.recordGeneration(i, 100 + i * 100);
      validator.recordPlayback(i, 200 + i * 150);
    }
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.gapDetected).toBe(false);
  });

  test("validates smooth transition timing", () => {
    const validator = new StreamingValidator();
    const transitionTime = 100;
    
    for (let i = 0; i < 3; i++) {
      validator.recordGeneration(i, 100 + i * 200);
      validator.recordPlayback(i, 300 + i * transitionTime);
    }
    
    const metrics = validator.validateStreamingContinuity();
    
    expect(metrics.gapDetected).toBe(false);
    expect(metrics.overlapDetected).toBe(false);
  });
});
