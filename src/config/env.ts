import { Validation } from "../utils/validation";
import { validateProviderRuntimeConfig, type ProviderRuntimeConfig } from "../ai/config/runtime";
import { loadModelsConfig } from "../ai/config/models-config";

const GROQ_API_KEY = Bun.env.GROQ_API_KEY;
const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = Bun.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = Bun.env.OPENROUTER_API_KEY;
const HF_API_KEY = Bun.env.HF_API_KEY;

// CLI flags or env vars for backwards compatibility/overrides
const DESKLUMINA_MODEL = Bun.env.DESKLUMINA_MODEL || Bun.env.MODEL_NAME;
const DESKLUMINA_FALLBACKS = Bun.env.DESKLUMINA_FALLBACKS || Bun.env.FALLBACK_MODELS;

// Deprecation warnings for legacy env vars
if (!Bun.env.DESKLUMINA_MODEL && Bun.env.MODEL_NAME) {
  console.warn("\x1b[33m[DEPRECATED] MODEL_NAME is deprecated. Use DESKLUMINA_MODEL instead (format: provider:model). Create models.json for full configuration.\x1b[0m");
}
if (!Bun.env.DESKLUMINA_FALLBACKS && Bun.env.FALLBACK_MODELS) {
  console.warn("\x1b[33m[DEPRECATED] FALLBACK_MODELS is deprecated. Use DESKLUMINA_FALLBACKS instead (format: provider:model,...). Create models.json for full configuration.\x1b[0m");
}

let primaryModel = DESKLUMINA_MODEL || "";
let fallbackModels: string[] = DESKLUMINA_FALLBACKS
  ? DESKLUMINA_FALLBACKS.split(",").map((m) => m.trim()).filter((m) => m.length > 0)
  : [];

// If env vars didn't provide a model, fall back to models.json
if (!primaryModel) {
  const modelsConfig = loadModelsConfig();
  if (modelsConfig) {
    primaryModel = `${modelsConfig.primary.provider}:${modelsConfig.primary.model}`;
    fallbackModels = modelsConfig.fallbacks.map(f => `${f.provider}:${f.model}`);
  }
}

if (!primaryModel && Bun.env.NODE_ENV !== "test") {
  console.error("\x1b[31mNo model configured. Create models.json or set DESKLUMINA_MODEL\x1b[0m");
  process.exit(1);
}

const runtimeProviderConfig: ProviderRuntimeConfig = {
  groqApiKey: GROQ_API_KEY,
  openaiApiKey: OPENAI_API_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY,
  geminiApiKey: GEMINI_API_KEY,
  openrouterApiKey: OPENROUTER_API_KEY,
  hfApiKey: HF_API_KEY,
  primaryModel: primaryModel,
  fallbackModels: fallbackModels,
};

try {
  // If we have a primary model, skip the validateEnv strict MODEL_NAME check by passing it.
  Validation.validateEnv({ MODEL_NAME: primaryModel });
  validateProviderRuntimeConfig(runtimeProviderConfig);
} catch (error) {
  if (Bun.env.NODE_ENV !== "test") {
    console.error(`\x1b[31m${(error as Error).message}\x1b[0m`);
    process.exit(1);
  }
}

export const modelConfig = {
  primaryModel: runtimeProviderConfig.primaryModel,
  fallbackModels: [...runtimeProviderConfig.fallbackModels],
  getAllModels: () => [
    runtimeProviderConfig.primaryModel,
    ...runtimeProviderConfig.fallbackModels,
  ],
};

export const env = {
  GROQ_API_KEY: runtimeProviderConfig.groqApiKey || "",
  OPENAI_API_KEY: runtimeProviderConfig.openaiApiKey || "",
  ANTHROPIC_API_KEY: runtimeProviderConfig.anthropicApiKey || "",
  GEMINI_API_KEY: runtimeProviderConfig.geminiApiKey || "",
  OPENROUTER_API_KEY: runtimeProviderConfig.openrouterApiKey || "",
  HF_API_KEY: runtimeProviderConfig.hfApiKey || "",
  MODEL_NAME: DESKLUMINA_MODEL || "",
  FALLBACK_MODELS: DESKLUMINA_FALLBACKS,
};
