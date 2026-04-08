export interface FeatureFlags {
  tts: boolean;
  toolDisplay: boolean;
  chatHistory: boolean;
  dangerousCommandConfirmation: boolean;
}

export interface Settings {
  language: "id" | "en";
  features: FeatureFlags;
  tts: {
    voiceId: string;
    speed: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  language: "id",
  features: {
    tts: false,
    toolDisplay: true,
    chatHistory: true,
    dangerousCommandConfirmation: true,
  },
  tts: {
    voiceId: "id-ID-GadisNeural",
    speed: 1.0,
  },
};
