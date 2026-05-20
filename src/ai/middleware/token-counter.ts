import { tokenManager } from "../../core/token-manager";
import type { AIMessage } from "../../types";
import type { MiddlewareContext, MiddlewareHandler } from "./types";

export interface ProviderTokenCounter {
  estimateMessages(messages: readonly AIMessage[]): number;
  estimateText(text: string): number;
  enforceBudget(estimatedTokens: number): Promise<void>;
  trackUsage(totalTokens: number): void;
}

export const providerTokenCounter: ProviderTokenCounter = {
  estimateMessages(messages: readonly AIMessage[]): number {
    return messages.reduce((sum, message) => sum + tokenManager.estimateTokens(message.content), 0);
  },
  estimateText(text: string): number {
    return tokenManager.estimateTokens(text);
  },
  enforceBudget(estimatedTokens: number): Promise<void> {
    return tokenManager.enforceBudget(estimatedTokens);
  },
  trackUsage(totalTokens: number): void {
    tokenManager.trackUsage(totalTokens);
  },
};

export function createTokenCounterMiddleware(counter: ProviderTokenCounter): MiddlewareHandler {
  return async function* (ctx: MiddlewareContext, next) {
    const estimatedInputTokens = counter.estimateMessages(ctx.request.messages);
    ctx.metrics.estimatedInputTokens = estimatedInputTokens;

    await counter.enforceBudget(estimatedInputTokens);

    let fullResponse = "";
    let actualTotalTokens: number | undefined;

    for await (const chunk of next()) {
      if (chunk.content) {
        fullResponse += chunk.content;
      }
      if (chunk.usage) {
        actualTotalTokens = chunk.usage.totalTokens;
        ctx.metrics.outputTokens = chunk.usage.completionTokens;
      }
      yield chunk;
    }

    const totalTokensUsed = actualTotalTokens ?? estimatedInputTokens + counter.estimateText(fullResponse);
    counter.trackUsage(totalTokensUsed);
  };
}
