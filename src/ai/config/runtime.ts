export interface ProviderRuntimeConfig {
  groqApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  hfApiKey?: string;
  primaryModel: string;
  fallbackModels: readonly string[];
}

export function validateProviderRuntimeConfig(config: ProviderRuntimeConfig): void {
  const missing: string[] = [];
  
  if (!config.groqApiKey && !config.openaiApiKey && !config.anthropicApiKey && !config.geminiApiKey && !config.openrouterApiKey && !config.hfApiKey) {
    missing.push("At least one provider API key (GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, or HF_API_KEY)");
  }
  
  if (!config.primaryModel) missing.push("MODEL_NAME");

  if (missing.length > 0) {
    throw new Error(`Missing required provider configuration: ${missing.join(", ")}`);
  }
}

