/**
 * Typed dot-path keys used by the Settings UI rows.
 *
 * These are logical keys exposed to the user interface, not necessarily
 * one-to-one mappings to the physical JSON path in settings.json.
 */
export type SettingKey =
  | "tts.enabled"
  | "tts.naturalVoice.enabled"
  | "tts.naturalVoice.latencyMasking"
  | "tts.naturalVoice.disfluency"
  | "ui.toolDisplay"
  | "history.enabled"
  | "system.confirmations"
  | "i18n.locale"
  | "webSearch.provider"
  | "webSearch.fallback"
  | "webSearch.safeSearch";
