export interface StreamMetrics {
  readonly streamStartMs: number;
  readonly firstTokenMs?: number;
  readonly lastChunkMs: number;
  readonly completionTokens: number;
  readonly chunkCount: number;
  readonly outputChars: number;
}

export interface ThroughputSnapshot {
  readonly tokensPerSec: number;
  readonly state: "warming" | "active";
}

const MIN_SAMPLE_DURATION_MS = 500;

export function createStreamMetrics(now: number): StreamMetrics {
  return {
    streamStartMs: now,
    firstTokenMs: undefined,
    lastChunkMs: now,
    completionTokens: 0,
    chunkCount: 0,
    outputChars: 0,
  };
}

export function updateStreamMetrics(
  metrics: StreamMetrics,
  now: number,
  contentLength: number
): StreamMetrics {
  return {
    ...metrics,
    firstTokenMs: metrics.firstTokenMs ?? now,
    lastChunkMs: now,
    completionTokens: metrics.completionTokens + Math.ceil(contentLength / 4),
    chunkCount: metrics.chunkCount + 1,
    outputChars: metrics.outputChars + contentLength,
  };
}

export function calculateThroughput(metrics: StreamMetrics, now: number): ThroughputSnapshot {
  if (metrics.firstTokenMs === undefined || metrics.completionTokens === 0) {
    return { tokensPerSec: 0, state: "warming" };
  }

  const elapsedSinceFirst = now - metrics.firstTokenMs;
  if (elapsedSinceFirst < MIN_SAMPLE_DURATION_MS) {
    return { tokensPerSec: 0, state: "warming" };
  }

  const tokensPerSec = (metrics.completionTokens / elapsedSinceFirst) * 1000;

  return {
    tokensPerSec: Math.round(tokensPerSec),
    state: "active",
  };
}
