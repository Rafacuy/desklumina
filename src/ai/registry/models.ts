import { readFileSync } from "fs";
import { join } from "path";
import type { ProviderId } from "../types";
import { providerRegistry } from "./provider-registry";

export interface ResolvedModel {
  providerId: string;
  modelId: string;
}

/**
 * Parses a `provider:model` reference. Throws when the format is invalid
 * or the model identifier is empty.
 */
export function parseModelRef(ref: string): ResolvedModel {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error("Model reference is empty");
  }
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx <= 0) {
    throw new Error(`Model format must be provider:model (e.g. gemini:gemini-2.5-flash). Invalid model: ${ref}`);
  }
  const modelId = trimmed.slice(colonIdx + 1);
  if (!modelId) {
    throw new Error(`Model identifier is empty after provider prefix: ${ref}`);
  }
  return {
    providerId: trimmed.slice(0, colonIdx).toLowerCase(),
    modelId,
  };
}

const DEFAULT_ALIASES: Record<string, string[]> = {
  fast: [
    "openai:gpt-5.4-mini",
    "anthropic:claude-sonnet-4-6",
    "groq:llama-3.3-70b-versatile",
    "gemini:gemini-3.1-flash-lite-preview",
    "openrouter:openrouter/free",
    "huggingface:meta-llama/Llama-3.2-3B-Instruct",
  ],
  smart: [
    "openai:gpt-5.5",
    "anthropic:claude-opus-4-6",
    "groq:llama-3.3-70b-versatile",
    "gemini:gemini-3.1-pro-preview",
    "openrouter:qwen/qwen3.6-plus",
    "huggingface:meta-llama/Llama-3.3-70B-Instruct",
  ]
};

export class ModelRegistry {
  private aliases: Record<string, string[]> = { ...DEFAULT_ALIASES };

  initialize(): void {
    this.aliases = { ...DEFAULT_ALIASES };
    this.loadOverrides();
  }

  private loadOverrides(): void {
    try {
      const configPath = join(Bun.env.HOME!, ".config", "desklumina", "models.json");
      const data = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed)) {
          if (Array.isArray(value) && value.every(v => typeof v === "string")) {
            this.aliases[key] = value;
          }
        }
      }
    } catch {
      //fail silently if absent or invalid
    }
  }

  /**
   * Resolves a requested primary model/alias and explicit fallbacks
   * into an ordered, deduplicated list of { providerId, modelId }.
   */
  resolveModels(primary: string, explicitFallbacks: readonly string[]): ResolvedModel[] {
    const resolved: ResolvedModel[] = [];
    const seen = new Set<string>();

    const addModel = (modelStr: string) => {
      if (!modelStr.trim()) return;
      const ref = parseModelRef(modelStr);
      const key = `${ref.providerId}:${ref.modelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        resolved.push(ref);
      }
    };

    //resolved alias internal chain, or just the primary model
    if (this.aliases[primary]) {
      for (const m of this.aliases[primary]) {
        addModel(m);
      }
    } else {
      addModel(primary);
    }

    // Explicit FALLBACK_MODELS
    for (const fb of explicitFallbacks) {
      if (this.aliases[fb]) {
         for (const m of this.aliases[fb]) {
            addModel(m);
         }
      } else {
         addModel(fb);
      }
    }

    // Filter by available providers
    return resolved.filter(m => providerRegistry.get(m.providerId as ProviderId) !== undefined);
  }
}

export const modelRegistry = new ModelRegistry();
