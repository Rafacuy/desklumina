import { spawn } from "bun";
import { settingsManager } from "../core/settings-manager";
import type { Settings } from "../types";
import { t, getLang } from "../utils/i18n";

const THEME_PATH = `${process.env.HOME}/.config/bspwm/agent/src/ui/themes/lumina.rasi`;

export async function rofiSettings(): Promise<boolean> {
  const settings = settingsManager.get();
  const currentLang = getLang();

  const menuItems = [
    `🌐 ${t("Language")}: ${currentLang === "id" ? "Bahasa Indonesia" : "English"}`,
    `🔊 ${t("Text-to-Speech")}: ${settings.features.tts ? `✓ ${t("ON")}` : `✗ ${t("OFF")}`}`,
    `🔧 ${t("Tool Display")}: ${settings.features.toolDisplay ? `✓ ${t("ON")}` : `✗ ${t("OFF")}`}`,
    `💬 ${t("Chat History")}: ${settings.features.chatHistory ? `✓ ${t("ON")}` : `✗ ${t("OFF")}`}`,
    `🪟 ${t("Window Context")}: ${settings.features.windowContext ? `✓ ${t("ON")}` : `✗ ${t("OFF")}`}`,
    `⚠️ ${t("Dangerous Command Confirmation")}: ${settings.features.dangerousCommandConfirmation ? `✓ ${t("ON")}` : `✗ ${t("OFF")}`}`,
    "──────────────────",
    `🎤 ${t("Change TTS Voice")}`,
    `⚡ ${t("TTS Speed Settings")}`,
    "──────────────────",
    `💾 ${t("Save & Exit")}`,
  ];

  const result = await rofiDmenu(menuItems.join("\n"), `⚙️ ${t("Settings")}`);

  if (!result) return false;

  if (result.includes(t("Language"))) {
    const langs = [
      "Bahasa Indonesia (id)",
      "English (en)"
    ];
    const langSelection = await rofiDmenu(langs.join("\n"), t("Select Language"));
    if (langSelection) {
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

  if (result.includes(t("Window Context"))) {
    settingsManager.toggleFeature("windowContext");
    return rofiSettings();
  }

  if (result.includes(t("Dangerous Command Confirmation"))) {
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
        
    const voice = await rofiDmenu(voices.join("\n"), t("Select Voice"));
    if (voice) {
      const voiceId = voice.split(" - ")[0]?.trim();
      if (voiceId) settingsManager.setTTSVoice(voiceId);
    }
    return rofiSettings();
  }

  if (result.includes(t("TTS Speed Settings"))) {
    const speeds = ["0.5x", "0.75x", "1.0x (Default)", "1.25x", "1.5x", "2.0x"];
    const speed = await rofiDmenu(speeds.join("\n"), t("TTS Speed"));
    if (speed) {
      const value = Number(speed.replace("x", "")) || 1.0;
      settingsManager.setTTSSpeed(value);
    }
    return rofiSettings();
  }

  if (result.includes(t("Save & Exit"))) {
    return true;
  }

  return true;
}

async function rofiDmenu(input: string, prompt: string): Promise<string | null> {
  const proc = spawn([
    "rofi",
    "-dmenu",
    "-i",
    "-p",
    prompt,
    "-theme",
    THEME_PATH,
    "-markup-rows",
  ], {
    stdin: "pipe",
    stdout: "pipe",
  });

  proc.stdin?.write(input);
  proc.stdin?.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  return output.trim() || null;
}
