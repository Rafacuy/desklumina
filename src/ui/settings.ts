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
    return `${icon} ${label.padEnd(25)} │ ${isEnabled ? `󰄬 ${t("ON")}` : `󰅖 ${t("OFF")}`}`;
  };

  const menuItems: string[] = [];

  // Header
  menuItems.push(`⚙️ ${t("Settings")}`);
  menuItems.push("──────────────────");

  // Core Features
  menuItems.push(getToggleLabel("tts", "🔊", t("Text-to-Speech")));
  menuItems.push(getToggleLabel("toolDisplay", "🔧", t("Tool Display")));
  menuItems.push(getToggleLabel("chatHistory", "💬", t("Chat History")));
  menuItems.push(getToggleLabel("dangerousCommandConfirmation", "⚠️", t("Confirmation")));

  // Localization
  menuItems.push("──────────────────");
  menuItems.push(`🌐 ${t("Language").padEnd(25)} │ ${currentLang === "id" ? "Indonesian" : "English"}`);
  
  // TTS submenu
  if (settings.features.tts) {
    menuItems.push(`🎤 ${t("Change TTS Voice")}`);
    menuItems.push(`⚡ ${t("TTS Speed Settings")}`);
  }

  // Actions
  menuItems.push("──────────────────");
  menuItems.push(`💾 ${t("Save & Exit")}`);
  menuItems.push(`✕ ${t("Cancel")}`);

  const resultObj = await rofiMenu(
    menuItems.join("\n"), 
    t("Settings"), 
    "listview { lines: 13; }",
    t("Search settings..."),
    `󰌑 ${t("Select")}/${t("Toggle")} │ 󱊷 ${t("Back")}/${t("Exit")} │ 󰍉 ${t("Search")}`
  );

  if (resultObj.code !== 0 || !resultObj.output || resultObj.output === `✕ ${t("Cancel")}` || resultObj.output.includes(t("Settings"))) {
    return false;
  }

  const result = resultObj.output;

  if (result.includes("──────────────────")) {
    return rofiSettings();
  }

  if (result.includes(t("Language"))) {
    const langs = [
      "Bahasa Indonesia (id)",
      "English (en)",
      "──────────────────",
      `✕ ${t("Back")}`
    ];
    const langRes = await rofiMenu(
      langs.join("\n"), 
      t("Select Language"), 
      "", 
      t("Type to search..."),
      `󰌑 ${t("Select")} │ 󱊷 ${t("Back")} │ 󰍉 ${t("Search")}`
    );
    const langSelection = langRes.output;
    if (langRes.code === 0 && langSelection && !langSelection.includes(t("Back")) && !langSelection.includes("──")) {
      if (langSelection.includes("(id)")) settingsManager.setLanguage("id");
      if (langSelection.includes("(en)")) settingsManager.setLanguage("en");
    }
    return rofiSettings();
  }

  if (result.includes(t("Text-to-Speech"))) {
    settingsManager.toggleFeature("tts");
    return rofiSettings();
  }

  if (result.includes(t("Tool Display"))) {
    settingsManager.toggleFeature("toolDisplay");
    return rofiSettings();
  }

  if (result.includes(t("Chat History"))) {
    settingsManager.toggleFeature("chatHistory");
    return rofiSettings();
  }

  if (result.includes(t("Confirmation"))) {
    settingsManager.toggleFeature("dangerousCommandConfirmation");
    return rofiSettings();
  }

  if (result.includes(t("Change TTS Voice"))) {
    const currentLang = getLang();
    const voices = currentLang === "id" 
      ? [
          "id-ID-GadisNeural - Gadis (Female)",
          "id-ID-ArdiNeural - Ardi (Male)",
        ]
      : [
          "en-US-AvaNeural - Ava (Female)",
          "en-US-AndrewNeural - Andrew (Male)",
          "en-GB-SoniaNeural - Sonia (Female)",
        ];
    voices.push("──────────────────", `✕ ${t("Back")}`);
        
    const voiceRes = await rofiMenu(
      voices.join("\n"), 
      t("Select Voice"), 
      "", 
      t("Type to search..."),
      `󰌑 ${t("Select")} │ 󱊷 ${t("Back")} │ 󰍉 ${t("Search")}`
    );
    const voice = voiceRes.output;
    if (voiceRes.code === 0 && voice && !voice.includes(t("Back")) && !voice.includes("──")) {
      const voiceId = voice.split(" - ")[0]?.trim();
      if (voiceId) settingsManager.setTTSVoice(voiceId);
    }
    return rofiSettings();
  }

  if (result.includes(t("TTS Speed Settings"))) {
    const speeds = ["0.5x", "0.75x", "1.0x (Default)", "1.25x", "1.5x", "2.0x", "──────────────────", `✕ ${t("Back")}`];
    const speedRes = await rofiMenu(
      speeds.join("\n"), 
      t("TTS Speed"), 
      "", 
      t("Type to search..."),
      `󰌑 ${t("Select")} │ 󱊷 ${t("Back")} │ 󰍉 ${t("Search")}`
    );
    const speed = speedRes.output;
    if (speedRes.code === 0 && speed && !speed.includes(t("Back")) && !speed.includes("──")) {
      const value = Number(speed.replace("x", "").split(" ")[0]) || 1.0;
      settingsManager.setTTSSpeed(value);
    }
    return rofiSettings();
  }

  if (result.includes(t("Save & Exit"))) {
    return true;
  }

  return true;
}
