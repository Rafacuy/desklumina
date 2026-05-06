import { spawn } from "bun";
import { settingsManager } from "../core/settings-manager";
import type { Settings } from "../types";
import { t, getLang } from "../utils/i18n";

const THEME_PATH = `${process.env.HOME}/.config/desklumina/src/ui/themes/lumina.rasi`;

import { rofiMenu } from "./rofi";

export async function rofiSettings(): Promise<boolean> {
  const settings = settingsManager.get();
  const currentLang = getLang();

  // Helper for toggle labels
  const getToggleLabel = (feature: keyof Settings["features"], icon: string, label: string) => {
    const isEnabled = settings.features[feature];
    return `${icon} ${label.padEnd(25)} │ ${isEnabled ? `󰄬 ${t("common.on")}` : `󰅖 ${t("common.off")}`}`;
  };

  const menuItems: string[] = [];

  // Header
  menuItems.push(`⚙️ ${t("ui.settings.title")}`);
  menuItems.push("──────────────────");

  // Core Features
  menuItems.push(getToggleLabel("tts", "🔊", t("ui.settings.tts")));
  menuItems.push(getToggleLabel("toolDisplay", "🔧", t("ui.settings.tool_display")));
  menuItems.push(getToggleLabel("chatHistory", "💬", t("ui.settings.chat_history")));
  menuItems.push(getToggleLabel("dangerousCommandConfirmation", "⚠️", t("ui.settings.confirmation")));

  // Localization
  menuItems.push("──────────────────");
  const langDisplay = currentLang === "id" ? "Indonesian" : currentLang === "en" ? "English" : "Japanese";
  menuItems.push(`🌐 ${t("ui.settings.language").padEnd(25)} │ ${langDisplay}`);
  
  // TTS submenu
  if (settings.features.tts) {
    menuItems.push(`🎤 ${t("ui.settings.change_tts_voice")}`);
    menuItems.push(`⚡ ${t("ui.settings.tts_speed_settings")}`);
  }

  // Actions
  menuItems.push("──────────────────");
  menuItems.push(`💾 ${t("common.save_exit")}`);
  menuItems.push(`✕ ${t("common.cancel")}`);

  const resultObj = await rofiMenu(
    menuItems.join("\n"), 
    t("ui.settings.title"), 
    "listview { lines: 13; }",
    t("ui.settings.search"),
    `󰌑 ${t("common.select")}/${t("common.toggle")} │ 󱊷 ${t("common.back")}/${t("common.exit")} │ 󰍉 ${t("common.search")}`
  );

  if (resultObj.code !== 0 || !resultObj.output || resultObj.output === `✕ ${t("common.cancel")}` || resultObj.output.includes(t("ui.settings.title"))) {
    return false;
  }

  const result = resultObj.output;

  if (result.includes("──────────────────")) {
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.language"))) {
    const langs = [
      "Bahasa Indonesia (id)",
      "English (en)",
      "日本語 (ja)",
      "──────────────────",
      `✕ ${t("common.back")}`
    ];
    const langRes = await rofiMenu(
      langs.join("\n"), 
      t("ui.settings.select_language"), 
      "", 
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const langSelection = langRes.output;
    if (langRes.code === 0 && langSelection && !langSelection.includes(t("common.back")) && !langSelection.includes("──")) {
      if (langSelection.includes("(id)")) settingsManager.setLanguage("id");
      if (langSelection.includes("(en)")) settingsManager.setLanguage("en");
      if (langSelection.includes("(ja)")) settingsManager.setLanguage("ja");
    }
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.tts"))) {
    settingsManager.toggleFeature("tts");
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.tool_display"))) {
    settingsManager.toggleFeature("toolDisplay");
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.chat_history"))) {
    settingsManager.toggleFeature("chatHistory");
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.confirmation"))) {
    settingsManager.toggleFeature("dangerousCommandConfirmation");
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.change_tts_voice"))) {
    const currentLang = getLang();
    let voices: string[] = [];
    if (currentLang === "id") {
      voices = [
        "id-ID-GadisNeural - Gadis (Female)",
        "id-ID-ArdiNeural - Ardi (Male)",
      ];
    } else if (currentLang === "en") {
      voices = [
        "en-US-AvaNeural - Ava (Female)",
        "en-US-AndrewNeural - Andrew (Male)",
        "en-GB-SoniaNeural - Sonia (Female)",
      ];
    } else if (currentLang === "ja") {
      voices = [
        "ja-JP-NanamiNeural - Nanami (Female)",
        "ja-JP-KeitaNeural - Keita (Male)",
      ];
    }
    voices.push("──────────────────", `✕ ${t("common.back")}`);
        
    const voiceRes = await rofiMenu(
      voices.join("\n"), 
      t("ui.settings.select_voice"), 
      "", 
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const voice = voiceRes.output;
    if (voiceRes.code === 0 && voice && !voice.includes(t("common.back")) && !voice.includes("──")) {
      const voiceId = voice.split(" - ")[0]?.trim();
      if (voiceId) settingsManager.setTTSVoice(voiceId);
    }
    return rofiSettings();
  }

  if (result.includes(t("ui.settings.tts_speed_settings"))) {
    const speeds = ["0.5x", "0.75x", "1.0x (Default)", "1.25x", "1.5x", "2.0x", "──────────────────", `✕ ${t("common.back")}`];
    const speedRes = await rofiMenu(
      speeds.join("\n"), 
      t("ui.settings.tts_speed"), 
      "", 
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const speed = speedRes.output;
    if (speedRes.code === 0 && speed && !speed.includes(t("common.back")) && !speed.includes("──")) {
      const value = Number(speed.replace("x", "").split(" ")[0]) || 1.0;
      settingsManager.setTTSSpeed(value);
    }
    return rofiSettings();
  }

  if (result.includes(t("common.save_exit"))) {
    return true;
  }

  return true;
}
