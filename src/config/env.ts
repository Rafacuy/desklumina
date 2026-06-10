import { Validation } from "../utils/validation";
import { validateProviderRuntimeConfig, type ProviderRuntimeConfig } from "../ai/config/runtime";
import { loadModelsConfig } from "../ai/config/models-config";

let deprecationWarningsEmitted = false;

function emitDeprecationWarnings(): void {
  if (deprecationWarningsEmitted) return;
  deprecationWarningsEmitted = true;

  if (!Bun.env.DESKLUMINA_MODEL && Bun.env.MODEL_NAME) {
    console.warn("\x1b[33m[DEPRECATED] MODEL_NAME is deprecated. Use DESKLUMINA_MODEL instead (format: provider:model). Create models.json for full configuration.\x1b[0m");
  }
  if (!Bun.env.DESKLUMINA_FALLBACKS && Bun.env.FALLBACK_MODELS) {
    console.warn("\x1b[33m[DEPRECATED] FALLBACK_MODELS is deprecated. Use DESKLUMINA_FALLBACKS instead (format: provider:model,...). Create models.json for full configuration.\x1b[0m");
  }
}

/**
 * Resolves the effective provider runtime configuration from current
 * environment variables and models.json. This function reads fresh
 * values on every call and never relies on stale cached state.
 */
export function resolveProviderRuntimeConfig(): ProviderRuntimeConfig {
  emitDeprecationWarnings();

  const groqApiKey = Bun.env.GROQ_API_KEY;
  const openaiApiKey = Bun.env.OPENAI_API_KEY;
  const anthropicApiKey = Bun.env.ANTHROPIC_API_KEY;
  const geminiApiKey = Bun.env.GEMINI_API_KEY;
  const openrouterApiKey = Bun.env.OPENROUTER_API_KEY;
  const hfApiKey = Bun.env.HF_API_KEY;

  const deskluminaModel = Bun.env.DESKLUMINA_MODEL || Bun.env.MODEL_NAME;
  const deskluminaFallbacks = Bun.env.DESKLUMINA_FALLBACKS || Bun.env.FALLBACK_MODELS;
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
    return Bun.env.DESKLUMINA_MODEL || Bun.env.MODEL_NAME || "";
  },
  get FALLBACK_MODELS(): string | undefined {
    return Bun.env.DESKLUMINA_FALLBACKS || Bun.env.FALLBACK_MODELS;
  },
  get EMBED_MODEL(): string | undefined {
    return Bun.env.DESKLUMINA_EMBED_MODEL || undefined;
  },
};
