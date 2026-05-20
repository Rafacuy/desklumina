import { modelConfig } from "../config/env";
import { MAX_TOKENS, MODEL_TEMPERATURE, SAFE_TOKEN_LIMIT } from "../constants";
import { t } from "../utils";
import { emitOrchestrationLog } from "./observability/emit";
import { ProviderError, AuthenticationError } from "./errors";
import { providerRegistry, modelRegistry, type ResolvedModel } from "./registry";
import { runMiddlewarePipeline, createTokenCounterMiddleware, createLoggerMiddleware, createCapabilityGuardMiddleware, providerTokenCounter } from "./middleware";
import type { ProviderId, AIMessage } from "./types";

export class NoModelsConfiguredError extends Error {
  constructor() {
    super("No models available to fulfill the request. Check your configuration and API keys.");
    this.name = "NoModelsConfiguredError";
  }
}

export class AllModelsFailedError extends Error {
  constructor(public attemptedModels: string[], public lastError: Error) {
    super(`All models failed. Models attempted: ${attemptedModels.join(", ")}. Last error: ${lastError.message}`);
    this.name = "AllModelsFailedError";
  }
}

function isModelNotFoundError(statusCode: number | undefined, body: string): boolean {
  if (statusCode === 404) return true;
  if (statusCode === 400) {
    const lowerBody = body.toLowerCase();
    return (
      lowerBody.includes("model_not_found") ||
      lowerBody.includes("model not found") ||
      lowerBody.includes("does not exist") ||
      lowerBody.includes("is not available") ||
      lowerBody.includes("unsupported model") ||
      lowerBody.includes("unknown model")
    );
  }
  return false;
}

async function* streamWithModel(
  messages: readonly AIMessage[],
  resolvedModel: ResolvedModel,
  requestId: string
): AsyncGenerator<string> {
  const { providerId, modelId: model } = resolvedModel;
  const provider = providerRegistry.require(providerId as ProviderId);

  const pipeline = [
    createCapabilityGuardMiddleware({}),
    createTokenCounterMiddleware(providerTokenCounter),
    createLoggerMiddleware(),
  ];

  const request = {
    messages,
    model,
    temperature: MODEL_TEMPERATURE,
    maxTokens: MAX_TOKENS,
    streamUsage: true,
    requestId,
  };

  const ctx = {
    providerId: providerId as ProviderId,
    model,
    requestId,
    request,
    metrics: {
      estimatedInputTokens: 0,
      outputTokens: 0,
      startMs: Date.now(),
    },
  };

  let fullResponse = "";
  let actualTotalTokens: number | undefined;

  for await (const chunk of runMiddlewarePipeline(ctx, pipeline, () => provider.streamChat(request))) {
    if (chunk.content) {
      fullResponse += chunk.content;
      yield chunk.content;
    }
    if (chunk.usage) {
      actualTotalTokens = chunk.usage.totalTokens;
    }
  }

  const totalTokensUsed = actualTotalTokens ?? ctx.metrics.estimatedInputTokens + providerTokenCounter.estimateText(fullResponse);
  providerTokenCounter.trackUsage(totalTokensUsed);
}

export async function* streamAI(messages: readonly AIMessage[]): AsyncGenerator<string> {
  const primaryModel = modelConfig.primaryModel;
  const fallbackModels = modelConfig.fallbackModels;

  const resolvedModels = modelRegistry.resolveModels(primaryModel, fallbackModels);
  if (resolvedModels.length === 0) {
    throw new NoModelsConfiguredError();
  }

  const attemptedModels: string[] = [];
  let lastError: Error | undefined;
  const turnRequestId = crypto.randomUUID();

  for (let i = 0; i < resolvedModels.length; i++) {
    const resolvedModel = resolvedModels[i]!;
    const nextModel = resolvedModels[i + 1];
    const { providerId, modelId: model } = resolvedModel;

    if (!providerRegistry.isHealthy(providerId as ProviderId)) {
      emitOrchestrationLog({
        kind: "DEBUG",
        severity: "debug",
        providerId,
        model,
        requestId: turnRequestId,
        detail: "provider circuit-broken, skipping",
      });
      continue;
    }

    const modelStringForLog = `${providerId}:${model}`;
    attemptedModels.push(modelStringForLog);
    let hasYielded = false;

    try {
      for await (const chunk of streamWithModel(messages, resolvedModel, turnRequestId)) {
        hasYielded = true;
        yield chunk;
      }
      providerRegistry.recordSuccess(providerId as ProviderId);
      return;
    } catch (error) {
      if (hasYielded) {
        throw error;
      }

      const statusCode = error instanceof ProviderError ? error.statusCode : undefined;
      const body = error instanceof ProviderError ? (error.rawPayload ?? error.message) : String(error);

      if (isModelNotFoundError(statusCode, body)) {
        emitOrchestrationLog({
          kind: "RETRY",
          severity: "warn",
          providerId,
          fromModel: model,
          toModel: nextModel ? nextModel.modelId : undefined,
          fallbackIndex: i,
          requestId: turnRequestId,
          detail: "model unavailable, trying next",
        });
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      if (error instanceof AuthenticationError) {
        throw error;
      }

      if (statusCode === 429 || (statusCode && statusCode >= 500)) {
        providerRegistry.recordFailure(providerId as ProviderId);

        emitOrchestrationLog({
          kind: "RETRY",
          severity: "warn",
          providerId,
          fromModel: model,
          toModel: nextModel ? nextModel.modelId : undefined,
          fallbackIndex: i,
          httpStatus: statusCode,
          requestId: turnRequestId,
          detail: `provider failed (status ${statusCode}), trying next`,
        });
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      throw error;
    }
  }

  const error = lastError ?? new Error("Unknown error");
  throw new AllModelsFailedError(attemptedModels, error);
}

export function getAvailableModels(): string[] {
  return modelRegistry.resolveModels(modelConfig.primaryModel, modelConfig.fallbackModels)
    .map(m => `${m.providerId}:${m.modelId}`);
}

export function getModelInfo(): { primary: string; fallbacks: string[] } {
  return {
    primary: modelConfig.primaryModel,
    fallbacks: modelConfig.fallbackModels,
  };
}
