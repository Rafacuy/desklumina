import { Validation } from "../utils/validation";
import { validateProviderRuntimeConfig, type ProviderRuntimeConfig } from "../ai/config/runtime";
import { loadModelsConfig } from "../ai/config/models-config";

/**
 * Resolves the effective provider runtime configuration from current
 * environment variables and models.json. This function reads fresh
 * values on every call and never relies on stale cached state.
 */
export function resolveProviderRuntimeConfig(): ProviderRuntimeConfig {
  const groqApiKey = Bun.env.GROQ_API_KEY;
  const openaiApiKey = Bun.env.OPENAI_API_KEY;
  const anthropicApiKey = Bun.env.ANTHROPIC_API_KEY;
  const geminiApiKey = Bun.env.GEMINI_API_KEY;
  const openrouterApiKey = Bun.env.OPENROUTER_API_KEY;
  const hfApiKey = Bun.env.HF_API_KEY;

  const deskluminaModel = Bun.env.DESKLUMINA_MODEL;
  const deskluminaFallbacks = Bun.env.DESKLUMINA_FALLBACKS;
  const deskluminaEmbedModel = Bun.env.DESKLUMINA_EMBED_MODEL;

  let primaryModel = deskluminaModel || "";
  let fallbackModels: string[] = deskluminaFallbacks
    ? deskluminaFallbacks.split(",").map((m) => m.trim()).filter((m) => m.length > 0)
    : [];
  let primaryEmbedModel: string | undefined = deskluminaEmbedModel?.trim() || undefined;

  // Always consult models.json so that fallbacks configured there are
  // respected even when the primary model comes from an env var.
  const modelsConfig = loadModelsConfig();
  if (modelsConfig) {
    if (!primaryModel) {
      primaryModel = `${modelsConfig.primary.provider}:${modelsConfig.primary.model}`;
    }
    if (fallbackModels.length === 0 && modelsConfig.fallbacks.length > 0) {
      fallbackModels = modelsConfig.fallbacks.map(f => `${f.provider}:${f.model}`);
    }
    if (!primaryEmbedModel && modelsConfig.primary.embedModel) {
      const embedModelValue = modelsConfig.primary.embedModel;
      primaryEmbedModel = embedModelValue.includes(":")
        ? embedModelValue
        : `${modelsConfig.primary.provider}:${embedModelValue}`;
    }
  }

  return {
    groqApiKey,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    openrouterApiKey,
    hfApiKey,
    primaryModel,
    fallbackModels,
    primaryEmbedModel,
  };
}

export function validateOrExit(): void {
  if (Bun.env.NODE_ENV === "test") return;

  const config = resolveProviderRuntimeConfig();

  if (!config.primaryModel) {
    console.error("\x1b[31mNo model configured. Create models.json or set DESKLUMINA_MODEL\x1b[0m");
    process.exit(1);
  }

  try {
    Validation.validateEnv({ MODEL_NAME: config.primaryModel });
    validateProviderRuntimeConfig(config);
  } catch (error) {
    console.error(`\x1b[31m${(error as Error).message}\x1b[0m`);
    process.exit(1);
  }
}

/**
 * Runtime-resolving model configuration. Accessing these properties
 * re-evaluates the underlying environment and models.json on every
 * read, guaranteeing the returned values are never stale.
 */
export const modelConfig = {
  get primaryModel(): string {
    return resolveProviderRuntimeConfig().primaryModel;
  },
  get fallbackModels(): string[] {
    return [...resolveProviderRuntimeConfig().fallbackModels];
  },
  get primaryEmbedModel(): string | undefined {
    return resolveProviderRuntimeConfig().primaryEmbedModel;
  },
  getAllModels(): string[] {
    const runtime = resolveProviderRuntimeConfig();
    return [runtime.primaryModel, ...runtime.fallbackModels];
  },
};

/**
 * Runtime-resolving environment snapshot. Accessing these properties
 * re-evaluates the current environment on every read.
 */
export const env = {
  get GROQ_API_KEY(): string {
    return Bun.env.GROQ_API_KEY || "";
  },
  get OPENAI_API_KEY(): string {
    return Bun.env.OPENAI_API_KEY || "";
  },
  get ANTHROPIC_API_KEY(): string {
    return Bun.env.ANTHROPIC_API_KEY || "";
  },
  get GEMINI_API_KEY(): string {
    return Bun.env.GEMINI_API_KEY || "";
  },
  get OPENROUTER_API_KEY(): string {
    return Bun.env.OPENROUTER_API_KEY || "";
  },
  get HF_API_KEY(): string {
    return Bun.env.HF_API_KEY || "";
  },
  get MODEL_NAME(): string {
    return Bun.env.DESKLUMINA_MODEL || "";
  },
  get FALLBACK_MODELS(): string | undefined {
    return Bun.env.DESKLUMINA_FALLBACKS;
  },
  get EMBED_MODEL(): string | undefined {
    return Bun.env.DESKLUMINA_EMBED_MODEL || undefined;
  },
  get SERPER_API_KEY(): string {
    return Bun.env.SERPER_API_KEY || "";
  },
  get SERPAPI_API_KEY(): string {
    return Bun.env.SERPAPI_API_KEY || "";
  },
  get SEARXNG_BASE_URL(): string {
    return Bun.env.SEARXNG_BASE_URL || "";
  },
  get SEARXNG_AUTH_HEADER_NAME(): string {
    return Bun.env.SEARXNG_AUTH_HEADER_NAME || "";
  },
  get SEARXNG_AUTH_HEADER_VALUE(): string {
    return Bun.env.SEARXNG_AUTH_HEADER_VALUE || "";
  },
  get TAVILY_API_KEY(): string {
    return Bun.env.TAVILY_API_KEY || "";
  },
  get DESKLUMINA_WEB_SEARCH_PROVIDER(): string {
    return Bun.env.DESKLUMINA_WEB_SEARCH_PROVIDER || "";
  },
  get DESKLUMINA_WEB_SEARCH_TIMEOUT_MS(): number | undefined {
    const raw = Bun.env.DESKLUMINA_WEB_SEARCH_TIMEOUT_MS;
    if (!raw) return undefined;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return undefined;
    const MIN_TIMEOUT_MS = 2000;
    const MAX_TIMEOUT_MS = 20000;
    return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, parsed));
  },
};
