import { BaseProvider } from "./base";
import type { ProviderId, ProviderRequest, ProviderStreamChunk, TokenUsage } from "../types";
import { AuthenticationError, ProviderNetworkError, ProviderParseError } from "../errors";
import { normalizeProviderError } from "../transport/http";
import { parseSSEEvents, type SSEEvent } from "../stream/sse-parser";
import { processStreamChunk, type StreamMetricsHandlerState, newRequestId } from "../stream/chunk-handler";
import { createStreamMetrics } from "../observability/stream-metrics";
import { emitOrchestrationLog } from "../observability/emit";
import { orchestrationErrorFromUnknown } from "../observability/error-map";

export abstract class StreamingBaseProvider extends BaseProvider {
  protected constructor(protected readonly fetchImpl: typeof fetch = globalThis.fetch) {
    super("unknown" as any, "unknown"); // Let subclasses override or we just pass dummy because of how inheritance worked before
  }

  abstract readonly id: ProviderId;
  abstract readonly name: string;

  protected abstract getEndpoint(request: ProviderRequest): string;
  protected abstract getHeaders(request: ProviderRequest): Record<string, string>;
  protected abstract getRequestBody(request: ProviderRequest): any;
  protected abstract parseChunk(event: SSEEvent, request: ProviderRequest): ProviderStreamChunk | null | undefined;

  protected isRetryable?(status: number, parsed: any): boolean;

  async *streamChat(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk> {
    const validation = this.validateConfig();
    if (!validation.ok) {
      const err = new AuthenticationError({
        provider: this.id,
        message: validation.errors.join("; "),
      });
      this.logError(err, request);
      throw err;
    }

    const requestId = request.requestId ?? newRequestId();
    const t0 = Date.now();
    let streamState: StreamMetricsHandlerState = {
      metrics: createStreamMetrics(t0),
      lastStreamLogAt: t0,
    };
    let lastUsage: TokenUsage | undefined;

    this.logStart(request, requestId);

    let response: Response;
    try {
      response = await this.fetchImpl(this.getEndpoint(request), {
        method: "POST",
        headers: this.getHeaders(request),
        body: JSON.stringify(this.getRequestBody(request)),
        signal: request.signal,
      });
    } catch (error) {
      const wrapped = new ProviderNetworkError({
        provider: this.id,
        message: error instanceof Error ? error.message : "Provider network request failed",
        cause: error,
      });
      this.logError(wrapped, request, requestId);
      throw wrapped;
    }

    if (!response.ok) {
      const err = await normalizeProviderError({
        provider: this.id,
        response,
        isRetryable: this.isRetryable,
      });
      this.logError(err, request, requestId);
      throw err;
    }

    if (!response.body) {
      const err = new ProviderParseError({
        provider: this.id,
        message: "Provider response body is empty",
        statusCode: response.status,
      });
      this.logError(err, request, requestId);
      throw err;
    }

    try {
      for await (const event of parseSSEEvents(response.body, { provider: this.id, signal: request.signal })) {
        if (request.signal?.aborted) {
          this.logAbort(request, requestId);
          return;
        }

        const parsedChunk = this.parseChunk(event, request);
        if (!parsedChunk) continue;

        if (parsedChunk.content) {
          const result = processStreamChunk(streamState, parsedChunk.content, {
            providerId: this.id,
            model: request.model,
            requestId,
          });
          streamState = result.newState;
          yield result.chunk;
        }

        if (parsedChunk.usage) {
          lastUsage = parsedChunk.usage;
          yield { usage: lastUsage };
        }
      }

      this.logOk(request, requestId, Date.now() - t0, lastUsage);
    } catch (error) {
      if (request.signal?.aborted) {
        this.logAbort(request, requestId);
      } else {
        this.logError(error, request, requestId);
      }
      throw error;
    }
  }

  protected logStart(request: ProviderRequest, requestId: string): void {
    emitOrchestrationLog({
      kind: "START",
      severity: "info",
      providerId: this.id,
      model: request.model,
      requestId,
    });
  }

  protected logOk(request: ProviderRequest, requestId: string, durationMs: number, usage?: TokenUsage): void {
    emitOrchestrationLog({
      kind: "OK",
      severity: "info",
      providerId: this.id,
      model: request.model,
      requestId,
      durationMs,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
    });
  }

  protected logAbort(request: ProviderRequest, requestId: string): void {
    emitOrchestrationLog({
      kind: "ABORT",
      severity: "warn",
      providerId: this.id,
      model: request.model,
      requestId,
      detail: "aborted",
    });
  }

  protected logError(error: unknown, request: ProviderRequest, requestId?: string): void {
    emitOrchestrationLog(
      orchestrationErrorFromUnknown(error, {
        providerId: this.id,
        model: request.model,
        requestId,
      })
    );
  }
}
