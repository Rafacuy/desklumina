export interface FeatureFlags {
  tts: boolean;
  toolDisplay: boolean;
  chatHistory: boolean;
  dangerousCommandConfirmation: boolean;
  ltm: boolean;
}

export interface SemanticRetrievalSettings {
  enabled: boolean;
  threshold: number;
  topK: number;
}

export interface LtmSettings {
  provider: string;
  model: string;
  /**
   * Dedicated embedding model. Accepts either a bare model id (uses provider
   * above) or a full `provider:model` reference. when empty/undefined, embedding
   * resolution falls back to the chat model and finally to the main provider
   * chain (see src/ltm/pipeline/extractor.ts#resolveEmbeddingProvider)
   */
  embedModel?: string;
  episodicCap: number;
  tokenBudget: number;
  dbPath: string;
  semanticRetrieval: SemanticRetrievalSettings;
}

export interface Settings {
  language: "id" | "en" | "ja";
  persona: string;
  features: FeatureFlags;
  tts: {
    voiceId: string;
    speed: number;
  };
  ltm: LtmSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  persona: "default",
  features: {
    tts: false,
    toolDisplay: true,
    chatHistory: true,
    dangerousCommandConfirmation: true,
    ltm: true,
  },
  tts: {
    voiceId: "en-US-AvaNeural",
    speed: 1.0,
  },
  ltm: {
    provider: "",
    model: "",
    embedModel: "",
    episodicCap: 50,
    tokenBudget: 600,
    dbPath: "~/.local/share/desklumina/ltm.db",
    semanticRetrieval: {
      enabled: true,
      threshold: 0.65,
      topK: 5,
    },
  },
};
