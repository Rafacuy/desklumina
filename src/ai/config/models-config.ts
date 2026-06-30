import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ProviderConfig } from "../types";

export interface ModelBinding extends ProviderConfig {
  provider: string;
  model: string;
  /** Optional dedicated embedding model. Falls back to `model` when ommited */
  embedModel?: string;
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

function parseBinding(raw: unknown, context: string): ModelBinding {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${context} must be an object with { provider, model, embedModel? }`);
  }
  const obj = raw as Record<string, unknown>;
  if (!PROVIDERS.includes(obj.provider as any)) {
    throw new Error(`Unknown provider '${String(obj.provider)}' in ${context}. Valid: ${PROVIDERS.join(", ")}`);
  }
  if (!obj.model || typeof obj.model !== "string") {
    throw new Error(`${context}.model must be a non-empty string`);
  }
  if (obj.embedModel !== undefined && (typeof obj.embedModel !== "string" || obj.embedModel.trim().length === 0)) {
    throw new Error(`${context}.embedModel must be a non-empty string when present`);
  }
  const binding: ModelBinding = {
    provider: obj.provider as string,
    model: obj.model as string,
  };
  if (typeof obj.embedModel === "string") {
    binding.embedModel = obj.embedModel;
  }
  return binding;
}

/**
 * Parses and validates a raw object into a ModelsConfig.
 */
export function parseModelsConfig(raw: unknown): ModelsConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("models.json must be a JSON object");
  }

  const config = raw as Record<string, unknown>;
  if (!config.primary || typeof config.primary !== "object") {
    throw new Error("models.json must have a 'primary' field with { provider, model, embedModel? }");
  }
  const primary = parseBinding(config.primary, "primary");

  const fallbacks: FallbackBinding[] = [];
  if (config.fallbacks) {
    if (!Array.isArray(config.fallbacks)) {
      throw new Error("fallbacks must be an array");
    }
    for (const fb of config.fallbacks) {
      const binding = parseBinding(fb, "fallback");
      const reasonRaw = (fb as Record<string, unknown>).reason;
      const reason: FallbackBinding["reason"] =
        reasonRaw === "rate-limit" || reasonRaw === "model-not-found" ? reasonRaw : "provider-down";
      fallbacks.push({ ...binding, reason });
    }
  }

  const aliases: Record<string, ModelBinding> = {};
  if (config.aliases) {
    if (typeof config.aliases !== "object" || Array.isArray(config.aliases)) {
      throw new Error("aliases must be an object");
    }
    for (const [name, binding] of Object.entries(config.aliases)) {
      aliases[name] = parseBinding(binding, `aliases.${name}`);
    }
  }

  return { primary, fallbacks, aliases };
}

/**
 * Loads models.json from ~/.config/desklumina/models.json
 * Returns null if the file does not exist.
 */
export function loadModelsConfig(): ModelsConfig | null {
  const path = join(Bun.env.HOME!, ".config/desklumina/models.json");
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
