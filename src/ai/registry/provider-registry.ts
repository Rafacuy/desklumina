import type { AIProvider, ProviderId } from "../types";
import { CircuitBreaker } from "../providers/circuit-breaker";
import { GroqProvider, GROQ_PROVIDER_ID } from "../providers/groq";
import { OpenAIProvider, OPENAI_PROVIDER_ID } from "../providers/openai";
import { AnthropicProvider, ANTHROPIC_PROVIDER_ID } from "../providers/anthropic";
import { GeminiProvider, GEMINI_PROVIDER_ID } from "../providers/gemini";
import { OpenRouterProvider, OPENROUTER_PROVIDER_ID } from "../providers/openrouter";
import { HuggingFaceProvider, HF_PROVIDER_ID } from "../providers/huggingface";
import { env } from "../../config/env";
import { logger } from "../../logger";

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, AIProvider>();
  private readonly circuitBreaker = new CircuitBreaker();

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: ProviderId): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  require(providerId: ProviderId): AIProvider {
    const provider = this.get(providerId);
    if (!provider) {
      const apiKeyVar = `${providerId.toUpperCase()}_API_KEY`;
      throw new Error(
        `Provider is not registered: ${providerId}. ` +
        `This usually means the ${apiKeyVar} environment variable is missing or empty.`
      );
    }
    return provider;
  }

  list(): readonly AIProvider[] {
    return [...this.providers.values()];
  }

  isHealthy(providerId: ProviderId): boolean {
    return this.circuitBreaker.isHealthy(providerId);
  }

  recordSuccess(providerId: ProviderId): void {
    this.circuitBreaker.recordSuccess(providerId);
  }

  recordFailure(providerId: ProviderId): void {
    this.circuitBreaker.recordFailure(providerId);
  }

  reset(): void {
    this.providers.clear();
    this.circuitBreaker.reset();
  }

  initialize(): void {
    if (env.GROQ_API_KEY) {
      this.register(new GroqProvider(env.GROQ_API_KEY));
    }
    if (env.OPENAI_API_KEY) {
      this.register(new OpenAIProvider(env.OPENAI_API_KEY));
    }
    if (env.ANTHROPIC_API_KEY) {
      this.register(new AnthropicProvider(env.ANTHROPIC_API_KEY));
    }
    if (env.GEMINI_API_KEY) {
      this.register(new GeminiProvider(env.GEMINI_API_KEY));
    }
    if (env.OPENROUTER_API_KEY) {
      this.register(new OpenRouterProvider(env.OPENROUTER_API_KEY));
    }
    if (env.HF_API_KEY) {
      this.register(new HuggingFaceProvider(env.HF_API_KEY));
    }
  }
}

export const providerRegistry = new ProviderRegistry();
