import { spawn } from "bun";
import { settingsManager } from "../core/settings-manager";
import type { Settings } from "../types";

const THEME_PATH = `${process.env.HOME}/.config/bspwm/agent/src/ui/themes/lumina.rasi`;

export async function rofiSettings(): Promise<boolean> {
  const settings = settingsManager.get();

  const menuItems = [
    `🔊 Text-to-Speech: ${settings.features.tts ? "✓ ON" : "✗ OFF"}`,
    `🔧 Tool Display: ${settings.features.toolDisplay ? "✓ ON" : "✗ OFF"}`,
    `💬 Chat History: ${settings.features.chatHistory ? "✓ ON" : "✗ OFF"}`,
    `🪟 Window Context: ${settings.features.windowContext ? "✓ ON" : "✗ OFF"}`,
    `⚠️ Dangerous Command Confirmation: ${settings.features.dangerousCommandConfirmation ? "✓ ON" : "✗ OFF"}`,
    "──────────────────",
    "🎤 Change TTS Voice",
    "⚡ TTS Speed Settings",
    "──────────────────",
    "💾 Save & Exit",
  ];

  const result = await rofiDmenu(menuItems.join("\n"), "⚙️ Settings");

  if (!result) return false;

  if (result.includes("Text-to-Speech")) {
    settingsManager.toggleFeature("tts");
    return rofiSettings();
  }

  if (result.includes("Tool Display")) {
    settingsManager.toggleFeature("toolDisplay");
    return rofiSettings();
  }

  if (result.includes("Chat History")) {
    settingsManager.toggleFeature("chatHistory");
    return rofiSettings();
  }

  if (result.includes("Window Context")) {
    settingsManager.toggleFeature("windowContext");
    return rofiSettings();
  }

  if (result.includes("Dangerous Command")) {
    settingsManager.toggleFeature("dangerousCommandConfirmation");
    return rofiSettings();
  }

  if (result.includes("Change TTS Voice")) {
    const voices = [
      "id-ID-GadisNeural - Gadis (Female)",
      "id-ID-ArdiNeural - Ardi (Male)",
    ];
    const voice = await rofiDmenu(voices.join("\n"), "Select Voice");
    if (voice) {
      const voiceId = voice.split(" - ")[0]?.trim();
      if (voiceId) settingsManager.setTTSVoice(voiceId);
    }
    return rofiSettings();
  }

  if (result.includes("TTS Speed")) {
    const speeds = ["0.5x", "0.75x", "1.0x (Default)", "1.25x", "1.5x", "2.0x"];
    const speed = await rofiDmenu(speeds.join("\n"), "TTS Speed");
    if (speed) {
      const value = Number(speed.replace("x", "")) || 1.0;
      settingsManager.setTTSSpeed(value);
    }
    return rofiSettings();
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
