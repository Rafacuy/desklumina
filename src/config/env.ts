import { t } from "../utils";
import { DEFAULT_FALLBACK_MODELS } from "../constants";
import { Validation } from "../utils/validation";

const GROQ_API_KEY = Bun.env.GROQ_API_KEY;
const MODEL_NAME = Bun.env.MODEL_NAME;
const FALLBACK_MODELS = Bun.env.FALLBACK_MODELS;

try {
  Validation.validateEnv({ GROQ_API_KEY, MODEL_NAME });
} catch (error) {
  if (Bun.env.NODE_ENV !== "test") {
    console.error(`\x1b[31m${(error as Error).message}\x1b[0m`);
    process.exit(1);
  }
}

// Parse fallback models from comma-separated string
const fallbackModels: string[] = FALLBACK_MODELS
  ? FALLBACK_MODELS.split(",").map((m) => m.trim()).filter((m) => m.length > 0)
  : [];

export const modelConfig = {
  primaryModel: MODEL_NAME || "llama-3.3-70b-versatile",
  fallbackModels: fallbackModels.length > 0 ? fallbackModels : DEFAULT_FALLBACK_MODELS,
  getAllModels: () => [
    MODEL_NAME || "llama-3.3-70b-versatile",
    ...(fallbackModels.length > 0 ? fallbackModels : DEFAULT_FALLBACK_MODELS),
  ],
};

export const env = {
  GROQ_API_KEY: GROQ_API_KEY || "",
  MODEL_NAME: MODEL_NAME || "",
  FALLBACK_MODELS,
};
