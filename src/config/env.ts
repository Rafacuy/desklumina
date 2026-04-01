import { t } from "../utils";
import { DEFAULT_FALLBACK_MODELS } from "../constants";

const GROQ_API_KEY = Bun.env.GROQ_API_KEY;
const MODEL_NAME = Bun.env.MODEL_NAME;
const FALLBACK_MODELS = Bun.env.FALLBACK_MODELS;

if (!GROQ_API_KEY || GROQ_API_KEY.trim() === "") {
  console.error(t("❌ FATAL: GROQ_API_KEY not found in .env"));
  process.exit(1);
}

if (!MODEL_NAME || MODEL_NAME.trim() === "") {
  console.error(t("❌ FATAL: MODEL_NAME not found in .env"));
  process.exit(1);
}

// Parse fallback models from comma-separated string
const fallbackModels: string[] = FALLBACK_MODELS
  ? FALLBACK_MODELS.split(",").map((m) => m.trim()).filter((m) => m.length > 0)
  : [];

export const modelConfig = {
  primaryModel: MODEL_NAME,
  fallbackModels: fallbackModels.length > 0 ? fallbackModels : DEFAULT_FALLBACK_MODELS,
  getAllModels: () => [
    MODEL_NAME,
    ...(fallbackModels.length > 0 ? fallbackModels : DEFAULT_FALLBACK_MODELS),
  ],
};

export const env = {
  GROQ_API_KEY,
  MODEL_NAME,
  FALLBACK_MODELS,
};
