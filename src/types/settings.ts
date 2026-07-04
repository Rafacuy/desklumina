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

export interface DisfluencySettings {
  enabled: boolean;
  densityCurve?: { [chunkCount: string]: [min: number, max: number] };
  categoryBias?: {
    first?: Partial<FillerWeights>;
    middle?: Partial<FillerWeights>;
    last?: Partial<FillerWeights>;
  };
  /**
   * Minimum number of chunk-gaps between consecutive fillers.
   * Prevents back-to-back filler injection. Default: 2.
   */
  minFillerSpacing?: number;
}

export interface LatencyMaskingSettings {
  enabled: boolean;
  deadlineMs: number;
}

export interface FillerWeights {
  breath: number;
  think: number;
  pause: number;
  throat: number;
}

export interface NaturalVoiceSettings {
  enabled: boolean;
  thresholdMs: number;
  maxOverhangMs: number;
  volume: number;
  assetsDir: string;
  disfluency?: DisfluencySettings;
  latencyMasking?: LatencyMaskingSettings;
}

export interface CustomIconSettings {
  enabled: boolean;
  path: string | null;
  size: number;
  fallback: string;
}

export interface ActionHintsSettings {
  enabled: boolean;
}

export interface UICustomization {
  schemaVersion: number;
  promptDirection: string;
  darkMode: boolean;
  simplifyUI: boolean;
  actionHints: ActionHintsSettings;
  customIcon: CustomIconSettings;
}

export interface Settings {
  language: "id" | "en" | "ja";
  persona: string;
  features: FeatureFlags;
  webSearch: {
    defaultProvider: "auto" | "serper" | "serpapi" | "searxng" | "tavily";
    fallbackEnabled: boolean;
    defaultLimit: number;
    defaultType: "web" | "news" | "images";
    safeSearch: boolean;
    language: string;
    country: string;
    includeRawContent: boolean;
  };
  tts: {
    voiceId: string;
    speed: number;
    naturalVoices: NaturalVoiceSettings;
  };
  ltm: LtmSettings;
  ui: {
    customization: UICustomization;
  };
}

export const DEFAULT_SETTINGS = {
  language: "en",
  persona: "default",
  features: {
    tts: false,
    toolDisplay: true,
    chatHistory: true,
    dangerousCommandConfirmation: true,
    ltm: true,
  },
  webSearch: {
    defaultProvider: "auto",
    fallbackEnabled: true,
    defaultLimit: 5,
    defaultType: "web",
    safeSearch: false,
    language: "",
    country: "",
    includeRawContent: false,
  },
  tts: {
    voiceId: "en-US-AvaNeural",
    speed: 1.0,
    naturalVoices: {
      enabled: true,
      thresholdMs: 350,
      maxOverhangMs: 500,
      volume: 100,
      assetsDir: "",
      disfluency: {
        enabled: false,
      },
      latencyMasking: {
        enabled: true,
        deadlineMs: 400,
      },
    },
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
  ui: {
    customization: {
      schemaVersion: 1,
      promptDirection: "CENTER_TOP",
      darkMode: true,
      simplifyUI: true,
      actionHints: {
        enabled: true,
      },
      customIcon: {
        enabled: true,
        path: null,
        size: 20,
        fallback: "default",
      },
    },
  },
} satisfies Settings;
