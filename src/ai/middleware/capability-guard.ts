import { logger } from "../../logger";
import { tokenManager } from "../../core/services/token-manager";
import { providerRegistry } from "../registry";
import type { MiddlewareContext, MiddlewareNext } from "./types";

export interface CapabilityRequirement {
  vision?: boolean;
  jsonMode?: boolean;
  functionCalling?: boolean;
  minContextTokens?: number;
}

export function createCapabilityGuardMiddleware(requirements: CapabilityRequirement) {
  return async function* capabilityGuard(ctx: MiddlewareContext, next: MiddlewareNext) {
    const provider = providerRegistry.get(ctx.providerId);
    if (!provider) {
      throw new Error(`Provider '${ctx.providerId}' not found`);
    }

    const caps = provider.capabilities();

    // Set provider-specific TPM limit
    tokenManager.setTpmLimit(caps.tpmLimit ?? 0);

    if (requirements.vision && !caps.visionSupported) {
      throw new Error(
        `Provider '${ctx.providerId}' does not support vision. ` +
        `Use a provider with vision support (OpenAI, Anthropic).`
      );
    }

    if (requirements.jsonMode && !caps.jsonModeSupported) {
      logger.warn(
        "capability-guard",
        `Provider '${ctx.providerId}' does not declare JSON mode support. Response may not be valid JSON.`
      );
    }

    if (requirements.functionCalling && !caps.functionCallingSupported) {
      throw new Error(
        `Provider '${ctx.providerId}' does not support function calling. ` +
        `Use OpenAI or Anthropic.`
      );
    }

    if (requirements.minContextTokens && caps.maxContextTokens < requirements.minContextTokens) {
      logger.warn(
        "capability-guard",
        `Provider '${ctx.providerId}' context window (${caps.maxContextTokens}) ` +
        `is smaller than required (${requirements.minContextTokens}).`
      );
    }

    yield* next();
  };
}
