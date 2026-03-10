export interface FeatureFlags {
  tts: boolean;
  toolDisplay: boolean;
  chatHistory: boolean;
  windowContext: boolean;
  dangerousCommandConfirmation: boolean;
}

export interface Settings {
  features: FeatureFlags;
  tts: {
    voiceId: string;
    speed: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  features: {
    tts: false,
    toolDisplay: true,
    chatHistory: true,
    windowContext: true,
    dangerousCommandConfirmation: true,
  },
  tts: {
    voiceId: "id-ID-GadisNeural",
    speed: 1.0,
  },
};
