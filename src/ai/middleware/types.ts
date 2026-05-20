import type { ProviderId, ProviderRequest, ProviderStreamChunk } from "../types";

export interface MiddlewareMetrics {
  estimatedInputTokens: number;
  outputTokens: number;
  startMs: number;
}

export interface MiddlewareContext {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly requestId: string;
  readonly request: ProviderRequest;
  metrics: MiddlewareMetrics;
}

export type MiddlewareNext = () => AsyncGenerator<ProviderStreamChunk>;

export type MiddlewareHandler = (
  ctx: MiddlewareContext,
  next: MiddlewareNext
) => AsyncGenerator<ProviderStreamChunk>;

export async function* runMiddlewarePipeline(
  ctx: MiddlewareContext,
  handlers: readonly MiddlewareHandler[],
  terminal: () => AsyncGenerator<ProviderStreamChunk>
): AsyncGenerator<ProviderStreamChunk> {
  async function* execute(index: number): AsyncGenerator<ProviderStreamChunk> {
    const handler = handlers[index];
    if (!handler) {
      yield* terminal();
      return;
    }
    yield* handler(ctx, () => execute(index + 1));
  }

  yield* execute(0);
}
