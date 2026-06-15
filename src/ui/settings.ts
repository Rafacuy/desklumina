import { getLang, t } from "../utils/localization/i18n";
import { settingsManager } from "../core/services/settings-manager";
import type { Settings } from "../types";
import { spawn } from "bun";
import { rofiMenu } from "./rofi";

export async function rofiSettings(): Promise<boolean> {
  const settings = settingsManager.get();
  const currentLang = getLang();

  const langNames: Record<string, string> = {
    id: "Bahasa Indonesia",
    en: "English",
    ja: "日本語"
  };
  const langDisplay = langNames[currentLang] || currentLang;

  const getToggleLabel = (feature: keyof Settings["features"], icon: string, label: string) => {
    const isEnabled = settings.features[feature];
    const stateIcon = isEnabled ? "󰄬" : "󱃓";
    const stateText = isEnabled ? t("common.on") : t("common.off");
    return `${icon} ${label} │ ${stateIcon} ${stateText}`;
  };
  const SECTION_PREFIX = "── ";
  const section = (label: string) => `${SECTION_PREFIX}${label.toUpperCase()}`;

  const menuItems: string[] = [
    section(t("ui.settings.section.ai")),
    `󰙨 ${t("ui.settings.persona")} │ ${settings.persona} ›`,
    getToggleLabel("tts", "󰔡", t("ui.settings.tts")),
    ...(settings.features.tts ? [
      `  󰔊 ${t("ui.settings.change_tts_voice")} ›`,
      `  󰁾 ${t("ui.settings.tts_speed_settings")} ›`,
      `  󰔡 ${t("ui.settings.natural_voices")} │ ${settings.tts.naturalVoices.enabled ? "󰄬 " + t("common.on") : "󱃓 " + t("common.off")}`,
      ...(settings.tts.naturalVoices.enabled ? [
        `    󰒓 ${t("ui.settings.natural_voices_settings")} ›`,
      ] : []),
    ] : []),
    getToggleLabel("toolDisplay", "󰘚", t("ui.settings.tool_display")),
    section(t("ui.settings.section.history")),
    getToggleLabel("chatHistory", "󰭹", t("ui.settings.chat_history")),
    section(t("ui.settings.section.system")),
    getToggleLabel("dangerousCommandConfirmation", "󱇎", t("ui.settings.confirmation")),
    `󰖟 ${t("ui.settings.language")} │ ${langDisplay} ›`,
    `󰆓 ${t("common.close")}`,
  ];

  const themeOverride = `
    window { width: 580px; }
    listview { lines: ${menuItems.length}; }
    element selected.normal {
      background-color: @accent-light;
      text-color: @text-primary;
      border: 0px 0px 0px 2px;
      border-color: @accent-color;
    }
  `;

  const resultObj = await rofiMenu(
    menuItems.join("\n"),
    t("ui.settings.title"),
    themeOverride,
    t("ui.settings.search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.exit")}`
  );

  if (resultObj.code !== 0 || !resultObj.output) {
    return false;
  }

  const result = resultObj.output;
  
  const is = (icon: string, label: string) =>
    result.trimStart().startsWith(`${icon} ${label}`);

  if (result.startsWith(SECTION_PREFIX)) {
    return rofiSettings();
  }

  if (is("󰔡", t("ui.settings.tts"))) {
    settingsManager.toggleFeature("tts");
    return rofiSettings();
  }

  if (is("󰘚", t("ui.settings.tool_display"))) {
    settingsManager.toggleFeature("toolDisplay");
    return rofiSettings();
  }

  if (is("󰭹", t("ui.settings.chat_history"))) {
    settingsManager.toggleFeature("chatHistory");
    return rofiSettings();
  }

  if (is("󱇎", t("ui.settings.confirmation"))) {
    settingsManager.toggleFeature("dangerousCommandConfirmation");
    return rofiSettings();
  }

  if (is("󰙨", t("ui.settings.persona"))) {
    const personas = ["default", "tsundere", "catgirl", "deredere", "kuudere", "dandere"];
    const personaOptions = personas.map((p) => {
      const desc = t(`ui.settings.personas.${p}`);
      return `${settings.persona === p ? "󰄬 " : "   "}${p} - ${desc}`;
    });
    personaOptions.push(`󰜺 ${t("common.back")}`);

    const personaRes = await rofiMenu(
      personaOptions.join("\n"),
      t("ui.settings.select_persona"),
      "",
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const selection = personaRes.output;
    if (personaRes.code === 0 && selection && !selection.startsWith("󰜺")) {
      const cleanLabel = selection.trimStart().replace(/^󰄬\s+/, "");
      const selectedId = cleanLabel.split(" - ")[0];
      if (selectedId) settingsManager.setPersona(selectedId);
    }
    return rofiSettings();
  }

  if (is("󰖟", t("ui.settings.language"))) {
    const langs = [
      `${currentLang === "id" ? "󰄬 " : "   "}Bahasa Indonesia (id)`,
      `${currentLang === "en" ? "󰄬 " : "   "}English (en)`,
      `${currentLang === "ja" ? "󰄬 " : "   "}日本語 (ja)`,
      `󰜺 ${t("common.back")}`
    ];
    const langRes = await rofiMenu(
      langs.join("\n"),
      t("ui.settings.select_language"),
      "",
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const langSelection = langRes.output;
    if (langRes.code === 0 && langSelection && !langSelection.startsWith("󰜺")) {
      if (langSelection.includes("(id)")) settingsManager.setLanguage("id");
      if (langSelection.includes("(en)")) settingsManager.setLanguage("en");
      if (langSelection.includes("(ja)")) settingsManager.setLanguage("ja");
    }
    return rofiSettings();
  }

  if (is("󰔊", t("ui.settings.change_tts_voice"))) {
    const currentVoice = settings.tts?.voiceId || "";
    const markActive = (v: string) => {
      const id = v.split(" - ")[0]?.trim();
      return `${id === currentVoice ? "󰄬 " : "   "}${v}`;
    };

    let voiceOptions: string[] = [];
    if (currentLang === "id") {
      voiceOptions = [
        "id-ID-GadisNeural - Gadis (Female)",
        "id-ID-ArdiNeural - Ardi (Male)",
      ].map(markActive);
    } else if (currentLang === "en") {
      voiceOptions = [
        "en-US-AvaNeural - Ava (Female)",
        "en-US-AndrewNeural - Andrew (Male)",
        "en-GB-SoniaNeural - Sonia (Female)",
      ].map(markActive);
    } else if (currentLang === "ja") {
      voiceOptions = [
        "ja-JP-NanamiNeural - Nanami (Female)",
        "ja-JP-KeitaNeural - Keita (Male)",
      ].map(markActive);
    } else {
      voiceOptions.push(`  ${t("ui.settings.no_voices_for_language")}`);
    }
    voiceOptions.push(`󰜺 ${t("common.back")}`);

    const voiceRes = await rofiMenu(
      voiceOptions.join("\n"),
      t("ui.settings.select_voice"),
      "",
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const voice = voiceRes.output;
    if (voiceRes.code === 0 && voice && !voice.startsWith("󰜺")) {
      const rawId = voice.split(" - ")[0]?.trim() ?? "";
      const voiceId = rawId.startsWith("󰄬 ")
        ? rawId.slice(2).trim()
        : rawId.trimStart();
      if (voiceId) settingsManager.setTTSVoice(voiceId);
    }
    return rofiSettings();
  }

  if (is("󰔡", t("ui.settings.natural_voices"))) {
    settingsManager.setNaturalVoicesEnabled(!settings.tts.naturalVoices.enabled);
    return rofiSettings();
  }

  if (is("󰒓", t("ui.settings.natural_voices_settings"))) {
    const nv = settings.tts.naturalVoices;
    const nvItems = [
      `󰔊 ${t("ui.settings.latency_masking")} │ ${nv.latencyMasking?.enabled ? "󰄬 " + t("common.on") : "󱃓 " + t("common.off")}`,
      `󰙨 ${t("ui.settings.disfluency")} │ ${nv.disfluency?.enabled ? "󰄬 " + t("common.on") : "󱃓 " + t("common.off")}`,
      `󰁾 ${t("ui.settings.volume")} │ ${nv.volume}% ›`,
      `󰜺 ${t("common.back")}`,
    ];

    const nvRes = await rofiMenu(
      nvItems.join("\n"),
      t("ui.settings.natural_voices_settings"),
      "",
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")}`
    );
    const nvSelection = nvRes.output;
    if (nvRes.code === 0 && nvSelection && !nvSelection.startsWith("󰜺")) {
      if (nvSelection.trimStart().startsWith(`󰔊 ${t("ui.settings.latency_masking")}`)) {
        settingsManager.setNaturalVoicesLatencyMaskingEnabled(!nv.latencyMasking?.enabled);
      } else if (nvSelection.trimStart().startsWith(`󰙨 ${t("ui.settings.disfluency")}`)) {
        settingsManager.setNaturalVoicesDisfluencyEnabled(!nv.disfluency?.enabled);
      } else if (nvSelection.trimStart().startsWith(`󰁾 ${t("ui.settings.volume")}`)) {
        const currentVolume = nv.volume;
        const VOLUME_MAP: [string, number][] = [
          ["25%", 25],
          ["50%", 50],
          ["75%", 75],
          [`100% (${t("common.default")})`, 100],
        ];
        const volItems = VOLUME_MAP.map(([label, value]) =>
          `${Math.abs(value - currentVolume) < 1 ? "󰄬 " : "   "}${label}`
        );
        volItems.push(`󰜺 ${t("common.back")}`);

        const volRes = await rofiMenu(
          volItems.join("\n"),
          t("ui.settings.volume"),
          "",
          t("ui.settings.type_to_search"),
          `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")}`
        );
        const vol = volRes.output;
        if (volRes.code === 0 && vol && !vol.startsWith("󰜺")) {
          const cleanLabel = vol.trimStart().replace(/^󰄬\s+/, "");
          const entry = VOLUME_MAP.find(([label]) => label === cleanLabel);
          if (entry) settingsManager.setNaturalVoicesVolume(entry[1]);
        }
      }
    }
    return rofiSettings();
  }

  if (is("󰁾", t("ui.settings.tts_speed_settings"))) {
    const currentSpeed = settings.tts?.speed || 1.0;
    const SPEED_MAP: [string, number][] = [
      ["0.5×",                    0.5],
      ["0.75×",                   0.75],
      [`1.0× (${t("common.default")})`, 1.0],
      ["1.25×",                   1.25],
      ["1.5×",                    1.5],
      ["2.0×",                    2.0],
    ];
    const speedItems = SPEED_MAP.map(([label, value]) =>
      `${Math.abs(value - currentSpeed) < 0.01 ? "󰄬 " : "   "}${label}`
    );
    speedItems.push(`󰜺 ${t("common.back")}`);

    const speedRes = await rofiMenu(
      speedItems.join("\n"),
      t("ui.settings.tts_speed"),
      "",
      t("ui.settings.type_to_search"),
      `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
    );
    const speed = speedRes.output;
    if (speedRes.code === 0 && speed && !speed.startsWith("󰜺")) {
      const cleanLabel = speed.trimStart().replace(/^󰄬\s+/, "");
      const entry = SPEED_MAP.find(([label]) => label === cleanLabel);
      if (entry) settingsManager.setTTSSpeed(entry[1]);
    }
    return rofiSettings();
  }

  if (is("󰆓", t("common.close"))) {
    return true;
  }

  return false;
}