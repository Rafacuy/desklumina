export interface FeatureFlags {
  tts: boolean;
  toolDisplay: boolean;
  chatHistory: boolean;
  dangerousCommandConfirmation: boolean;
}

export interface Settings {
  language: "id" | "en" | "ja";
  persona: string;
  features: FeatureFlags;
  tts: {
    voiceId: string;
    speed: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  persona: "default",
  features: {
    tts: false,
    toolDisplay: true,
    chatHistory: true,
    dangerousCommandConfirmation: true,
  },
  tts: {
    voiceId: "en-US-AvaNeural",
    speed: 1.0,
  },
};
