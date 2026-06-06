import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderId } from "../types";
import { providerRegistry } from "./provider-registry";

export interface ResolvedModel {
  providerId: string;
  modelId: string;
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
      const configPath = join(homedir(), ".config", "desklumina", "models.json");
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
      const trimmed = modelStr.trim();
      if (!trimmed) return;

      let providerId: string;
      let modelId: string;
      
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        providerId = trimmed.slice(0, colonIdx).toLowerCase();
        modelId = trimmed.slice(colonIdx + 1);
      } else {
        throw new Error(`Model format must be provider:model (e.g. gemini:gemini-2.5-flash). Invalid model: ${modelStr}`);
      }

      if (!modelId) {
        throw new Error(`Model identifier is empty after provider prefix: ${modelStr}`);
      }

      const key = `${providerId}:${modelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        resolved.push({ providerId, modelId });
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
