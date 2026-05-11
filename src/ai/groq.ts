import { env, modelConfig } from "../config/env";
import { logger } from "../logger";
import { parseSSE } from "./stream";
import { GROQ_API_ENDPOINT, MODEL_TEMPERATURE, MAX_TOKENS } from "../constants";
import { tokenManager } from "../core/token-manager";
import type { AIMessage } from "../types";

const SAFE_TOKEN_LIMIT = 6000;

/**
 * Rough token estimation (1 token ≈ 4 chars)
 */
function estimateTokens(messages: AIMessage[]): number {
  return messages.reduce((sum, msg) => sum + tokenManager.estimateTokens(msg.content), 0);
}

export class GroqAPIError extends Error {
  constructor(
    public statusCode: number,
    public body: string,
    public model: string
  ) {
    super(`Groq API Error ${statusCode} (model: ${model}): ${body}`);
    this.name = "GroqAPIError";
  }
}

export class ModelNotFoundError extends GroqAPIError {
  constructor(model: string, body: string) {
    super(404, body, model);
    this.name = "ModelNotFoundError";
  }
}

export class AllModelsFailedError extends Error {
  constructor(public attemptedModels: string[], public lastError: Error) {
    super(`All models failed. Models attempted: ${attemptedModels.join(", ")}`);
    this.name = "AllModelsFailedError";
  }
}

/**
 * Check if error indicates model not found/unavailable
 */
function isModelNotFoundError(statusCode: number, body: string): boolean {
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

/**
 * Stream response from Groq API with a specific model
 */
async function* streamWithModel(
  messages: AIMessage[],
  model: string
): AsyncGenerator<string> {
  const estimatedInputTokens = estimateTokens(messages);
  logger.debug("groq", `Estimated input tokens: ${estimatedInputTokens} (limit: ${SAFE_TOKEN_LIMIT})`);

  if (estimatedInputTokens > SAFE_TOKEN_LIMIT) {
    logger.warn("groq", `Token count (${estimatedInputTokens}) exceeds safe limit (${SAFE_TOKEN_LIMIT}). Request may fail.`);
  }

  await tokenManager.enforceBudget(estimatedInputTokens);

  logger.info("groq", `Sending request to Groq with model ${model}`);

  const response = await fetch(GROQ_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: MODEL_TEMPERATURE,
      max_tokens: MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error("groq", `API error occured for ${model}: ${response.status} - ${body}`);

    if (isModelNotFoundError(response.status, body)) {
      throw new ModelNotFoundError(model, body);
    }

    throw new GroqAPIError(response.status, body, model);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  let fullResponse = "";
  let actualUsage: { total_tokens: number } | undefined;

  for await (const chunk of parseSSE(response.body)) {
    if (chunk.content) {
      fullResponse += chunk.content;
      yield chunk.content;
    }
    if (chunk.usage) {
      actualUsage = chunk.usage;
    }
  }

  // Track usage after success. Use actual usage if provided by API, otherwise fallback to estimation.
  const totalTokensUsed = actualUsage 
    ? actualUsage.total_tokens 
    : estimatedInputTokens + tokenManager.estimateTokens(fullResponse);
  
  tokenManager.trackUsage(totalTokensUsed);
}

/**
 * Stream response from Groq API with automatic fallback
 */
export async function* streamGroq(messages: AIMessage[]): AsyncGenerator<string> {
  const models = modelConfig.getAllModels();
  const attemptedModels: string[] = [];
  let lastError: Error | null = null;

  for (const model of models) {
    attemptedModels.push(model);
    let hasYielded = false;

    try {
      for await (const chunk of streamWithModel(messages, model)) {
        hasYielded = true;
        yield chunk;
      }
      return; // Success, exit the generator
    } catch (error) {
      // If we already yielded text, we shouldn't fallback to another model
      // as it would duplicate the beginning of the response.
      if (hasYielded) {
        logger.error("groq", `Model ${model} failed after producing output. Cannot fallback.`);
        throw error;
      }

      if (error instanceof ModelNotFoundError) {
        logger.warn("groq", `Model ${model} is unavailable, trying fallback...`);
        lastError = error;
        continue; // Try next model
      }

      if (error instanceof GroqAPIError) {
        if (error.statusCode === 429) {
          logger.error("groq", `Rate limit (429) hit. Account-wide limit reached. stopping fallback.`);
          throw error;
        }
        logger.warn("groq", `Model ${model} failed with error ${error.statusCode}, trying fallback...`);
        lastError = error;
        continue;
      }

      // Non-API errors (network, etc.) - rethrow immediately
      throw error;
    }
  }

  // All models failed
  throw new AllModelsFailedError(attemptedModels, lastError || new Error("Unknown error"));
}


/**
 * Get list of available models (primary + fallbacks)
 */
export function getAvailableModels(): string[] {
  return modelConfig.getAllModels();
}

/**
 * Get current active model info
 */
export function getModelInfo(): { primary: string; fallbacks: string[] } {
  return {
    primary: modelConfig.primaryModel,
    fallbacks: modelConfig.fallbackModels,
  };
}
