import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface ModelBinding {
  provider: string;
  model: string;
}

export interface FallbackBinding extends ModelBinding {
  reason: "rate-limit" | "provider-down" | "model-not-found";
}

export interface ModelsConfig {
  primary: ModelBinding;
  fallbacks: FallbackBinding[];
  aliases: Record<string, ModelBinding>;
}

const PROVIDERS = ["openai", "anthropic", "gemini", "groq", "openrouter", "huggingface"] as const;

/**
 * Parses and validates a raw object into a ModelsConfig.
 */
export function parseModelsConfig(raw: unknown): ModelsConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("models.json must be a JSON object");
  }

  const config = raw as Record<string, unknown>;

  // Validate primary
  if (!config.primary || typeof config.primary !== "object") {
    throw new Error("models.json must have a 'primary' field with { provider, model }");
  }
  const primary = config.primary as Record<string, string>;
  if (!PROVIDERS.includes(primary.provider as any)) {
    throw new Error(`Unknown provider '${primary.provider}'. Valid: ${PROVIDERS.join(", ")}`);
  }
  if (!primary.model || typeof primary.model !== "string") {
    throw new Error("primary.model must be a non-empty string");
  }

  // Validate fallbacks
  const fallbacks: FallbackBinding[] = [];
  if (config.fallbacks) {
    if (!Array.isArray(config.fallbacks)) {
      throw new Error("fallbacks must be an array");
    }
    for (const fb of config.fallbacks) {
      if (!PROVIDERS.includes(fb.provider as any)) {
        throw new Error(`Unknown provider '${fb.provider}' in fallback`);
      }
      if (!fb.model || typeof fb.model !== "string") {
        throw new Error("fallback.model must be a non-empty string");
      }
      fallbacks.push({
        provider: fb.provider,
        model: fb.model,
        reason: (fb.reason as any) || "provider-down",
      });
    }
  }

  // Validate aliases
  const aliases: Record<string, ModelBinding> = {};
  if (config.aliases) {
    if (typeof config.aliases !== "object" || Array.isArray(config.aliases)) {
      throw new Error("aliases must be an object");
    }
    for (const [name, binding] of Object.entries(config.aliases)) {
      const b = binding as Record<string, string>;
      if (!PROVIDERS.includes(b.provider as any)) {
        throw new Error(`Unknown provider '${b.provider}' in alias '${name}'`);
      }
      if (!b.model || typeof b.model !== "string") {
        throw new Error(`model in alias '${name}' must be a non-empty string`);
      }
      aliases[name] = { provider: b.provider as string, model: b.model as string };
    }
  }

  return {
    primary: { provider: primary.provider as string, model: primary.model as string },
    fallbacks,
    aliases,
  };
}

/**
 * Loads models.json from ~/.config/desklumina/models.json
 * Returns null if the file does not exist.
 */
export function loadModelsConfig(): ModelsConfig | null {
  const path = join(homedir(), ".config/desklumina/models.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return parseModelsConfig(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Failed to load models.json: ${(error as Error).message}`);
  }
}
