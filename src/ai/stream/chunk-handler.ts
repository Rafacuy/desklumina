import { emitOrchestrationLog } from "../observability/emit";
import { updateStreamMetrics, calculateThroughput, type StreamMetrics } from "../observability/stream-metrics";
import type { ProviderStreamChunk } from "../types";

export const STREAM_LOG_INTERVAL_MS = (() => {
  const raw = Bun.env.DESKLUMINA_AI_STREAM_LOG_MS;
  if (!raw) return 1000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 50) return 1000;
  return Math.min(n, 60_000);
})();

export function newRequestId(): string {
  return crypto.randomUUID();
}

export interface StreamMetricsHandlerState {
  metrics: StreamMetrics;
  lastStreamLogAt: number;
}

export function processStreamChunk(
  state: StreamMetricsHandlerState,
  content: string,
  options: {
    providerId: string;
    model: string;
    requestId: string;
  }
): { newState: StreamMetricsHandlerState; chunk: ProviderStreamChunk } {
  const now = Date.now();
  const newMetrics = updateStreamMetrics(state.metrics, now, content.length);
  
  if (now - state.lastStreamLogAt >= STREAM_LOG_INTERVAL_MS) {
    const throughput = calculateThroughput(newMetrics, now);
    emitOrchestrationLog({
      kind: "STREAM",
      severity: "info",
      providerId: options.providerId,
      model: options.model,
      requestId: options.requestId,
      tokensPerSec: throughput.tokensPerSec,
      streamState: throughput.state,
      completionTokens: newMetrics.completionTokens,
    });
    return {
      newState: { metrics: newMetrics, lastStreamLogAt: now },
      chunk: { content }
    };
  }
  
  return {
    newState: { metrics: newMetrics, lastStreamLogAt: state.lastStreamLogAt },
    chunk: { content }
  };
}
