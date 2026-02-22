const GROQ_API_KEY = Bun.env.GROQ_API_KEY;
const MODEL_NAME = Bun.env.MODEL_NAME;
const FALLBACK_MODELS = Bun.env.FALLBACK_MODELS;

if (!GROQ_API_KEY || GROQ_API_KEY.trim() === "") {
  console.error("❌ FATAL: GROQ_API_KEY tidak ditemukan di .env");
  process.exit(1);
}

if (!MODEL_NAME || MODEL_NAME.trim() === "") {
  console.error("❌ FATAL: MODEL_NAME tidak ditemukan di .env");
  process.exit(1);
}

// Parse fallback models from comma-separated string
const fallbackModels: string[] = FALLBACK_MODELS 
  ? FALLBACK_MODELS.split(",").map(m => m.trim()).filter(m => m.length > 0)
  : [];

// Default fallback models if none specified
const defaultFallbackModels = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

export const modelConfig = {
  primaryModel: MODEL_NAME,
  fallbackModels: fallbackModels.length > 0 ? fallbackModels : defaultFallbackModels,
  getAllModels: () => [MODEL_NAME, ...fallbackModels.length > 0 ? fallbackModels : defaultFallbackModels],
};

export const env = {
  GROQ_API_KEY,
  MODEL_NAME,
  FALLBACK_MODELS,
};
