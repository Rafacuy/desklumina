const GROQ_API_KEY = Bun.env.GROQ_API_KEY;
const MODEL_NAME = Bun.env.MODEL_NAME;

if (!GROQ_API_KEY || GROQ_API_KEY.trim() === "") {
  console.error("❌ FATAL: GROQ_API_KEY tidak ditemukan di .env");
  process.exit(1);
}

if (!MODEL_NAME || MODEL_NAME.trim() === "") {
  console.error("❌ FATAL: MODEL_NAME tidak ditemukan di .env");
  process.exit(1);
}

export const env = {
  GROQ_API_KEY,
  MODEL_NAME,
};
