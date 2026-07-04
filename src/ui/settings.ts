import { join } from "path";
import { getLang, t } from "../utils/localization/i18n";
import { settingsManager } from "../core/services/settings-manager";
import { rofiMenu } from "./rofi";
import { resolveColorScheme, getColorTokens, type ColorTokens } from "./settings/tokens";
import { buildFooterHint } from "./settings/footer";
import { renderRow, type SettingsRow, type NavRow } from "./settings/rows";
import { setThemeMode } from "./theme-cache";
import type { SettingKey } from "../constants/settings-keys";
import type { Settings } from "../types";

const SETTINGS_THEME_PATH_LIGHT = join(Bun.env.HOME!, ".config/desklumina/src/ui/themes/settings.rasi");
const SETTINGS_THEME_PATH_DARK = join(Bun.env.HOME!, ".config/desklumina/src/ui/themes/settings-dark.rasi");

function getSettingsThemePath(): string {
  return settingsManager.getDarkMode() ? SETTINGS_THEME_PATH_DARK : SETTINGS_THEME_PATH_LIGHT;
}

const PROVIDERS: Settings["webSearch"]["defaultProvider"][] = ["auto", "tavily", "serper", "serpapi", "searxng"];

const LANG_NAMES: Record<string, string> = {
  id: "Bahasa Indonesia",
  en: "English",
  ja: "日本語",
};

const PERSONAS = ["default", "tsundere", "catgirl", "deredere", "kuudere", "dandere"];

function buildSettingsRows(lang: string): SettingsRow[] {
  const settings = settingsManager.get();
  const langDisplay = LANG_NAMES[lang] ?? lang;

  const rows: SettingsRow[] = [];

  rows.push({ type: "section", label: t("ui.settings.section.ai") });
  rows.push({
    type: "nav",
    icon: "󰙨",
    label: t("ui.settings.persona"),
    value: settings.persona,
    panel: "persona",
  });
  rows.push({
    type: "toggle",
    icon: "󰔡",
    label: t("ui.settings.tts"),
    key: "tts.enabled",
    value: settings.features.tts,
  });

  if (settings.features.tts) {
    rows.push({
      type: "nav",
      icon: "󰔊",
      label: t("ui.settings.change_tts_voice"),
      value: settings.tts.voiceId,
      panel: "tts-voice",
      depth: 1,
    });
    rows.push({
      type: "nav",
      icon: "󰁾",
      label: t("ui.settings.tts_speed_settings"),
      value: `${settings.tts.speed}×`,
      panel: "tts-speed",
      depth: 1,
    });
    rows.push({
      type: "toggle",
      icon: "󰔡",
      label: t("ui.settings.natural_voices"),
      key: "tts.naturalVoice.enabled",
      value: settings.tts.naturalVoices.enabled,
      depth: 1,
    });

    if (settings.tts.naturalVoices.enabled) {
      rows.push({
        type: "nav",
        icon: "󰒓",
        label: t("ui.settings.natural_voices_settings"),
        panel: "natural-voices-settings",
        depth: 2,
      });
    }
  }

  rows.push({
    type: "toggle",
    icon: "󰘚",
    label: t("ui.settings.tool_display"),
    key: "ui.toolDisplay",
    value: settings.features.toolDisplay,
  });

  rows.push({ type: "section", label: t("ui.settings.section.history") });
  rows.push({
    type: "toggle",
    icon: "󰭹",
    label: t("ui.settings.chat_history"),
    key: "history.enabled",
    value: settings.features.chatHistory,
  });

  rows.push({ type: "section", label: t("ui.settings.section.system") });
  rows.push({
    type: "toggle",
    icon: "󱇎",
    label: t("ui.settings.confirmation"),
    key: "system.confirmations",
    value: settings.features.dangerousCommandConfirmation,
  });
  rows.push({
    type: "nav",
    icon: "󰖟",
    label: t("ui.settings.language"),
    value: langDisplay,
    panel: "language",
    key: "i18n.locale",
  });

  rows.push({ type: "section", label: t("ui.settings.section.customization") });
  rows.push({
    type: "toggle",
    icon: "",
    label: t("ui.settings.dark_mode"),
    key: "ui.darkMode",
    value: settings.ui.customization.darkMode,
  });

  rows.push({ type: "section", label: t("ui.settings.web_search") });
  rows.push({
    type: "nav",
    icon: "󰖟",
    label: t("ui.settings.web_search_provider"),
    value: settings.webSearch.defaultProvider,
    panel: "web-search-provider",
    key: "webSearch.provider",
  });
  rows.push({
    type: "toggle",
    icon: "󰔡",
    label: t("ui.settings.web_search_fallback"),
    key: "webSearch.fallback",
    value: settings.webSearch.fallbackEnabled,
  });
  rows.push({
    type: "toggle",
    icon: "󰔡",
    label: t("ui.settings.web_search_safe_search"),
    key: "webSearch.safeSearch",
    value: settings.webSearch.safeSearch,
  });

  return rows;
}

function applyToggle(key: SettingKey): void {
  switch (key) {
    case "tts.enabled":
      settingsManager.toggleFeature("tts");
      break;
    case "tts.naturalVoice.enabled":
      settingsManager.setNaturalVoicesEnabled(!settingsManager.get().tts.naturalVoices.enabled);
      break;
    case "ui.toolDisplay":
      settingsManager.toggleFeature("toolDisplay");
      break;
    case "history.enabled":
      settingsManager.toggleFeature("chatHistory");
      break;
    case "system.confirmations":
      settingsManager.toggleFeature("dangerousCommandConfirmation");
      break;
    case "i18n.locale":
      //navigational setting. toggling is not applicable.
      break;
    case "webSearch.fallback":
      settingsManager.toggleWebSearchFallback();
      break;
    case "webSearch.safeSearch":
      settingsManager.setWebSearchSafeSearch(!settingsManager.get().webSearch.safeSearch);
      break;
    case "ui.darkMode":
      settingsManager.toggleDarkMode();
      setThemeMode(settingsManager.getDarkMode() ? "dark" : "light");
      break;
  }
}

function buildSettingsThemeOverride(colors: ColorTokens, rowCount: number): string {
  return `
    window { 
      width: 540px; 
      height: 400px;
    }
    listview { 
      lines: ${rowCount}; 
      fixed-height: true;
    }
    element selected.normal element-text {
      border-color: ${colors.accentPurple};
    }
  `;
}

async function promptSettings(rows: SettingsRow[], selectedRow: number, colors: ColorTokens): Promise<boolean> {
  const headerIndices = new Set<number>();
  rows.forEach((row, index) => {
    if (row.type === "section") headerIndices.add(index);
  });

  const renderedRows = rows.map((row) => renderRow(row, colors, t));
  const safeSelectedRow = Math.max(0, Math.min(selectedRow, rows.length - 1));
  const focusedRow = rows[safeSelectedRow];

  const result = await rofiMenu(
    renderedRows.join("\n"),
    t("ui.settings.title"),
    buildSettingsThemeOverride(colors, rows.length),
    t("ui.settings.search"),
    focusedRow ? buildFooterHint(focusedRow, t) : "",
    "",
    true, // isMessagePango
    true, // isMarkupRows
    {
      kbCustom1: "space",
      format: "i",
      selectedRow: safeSelectedRow,
      themePath: getSettingsThemePath(),
      fixedNumLines: true,
    }
  );

  // Cancelled or otherwise closed without a selection.
  if ((result.code !== 0 && result.code !== 10) || !result.output) {
    return false;
  }

  const selectedIndex = parseInt(result.output, 10);
  if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= rows.length) {
    return false;
  }

  // Headers are non-selectable dividers; re-prompt at the same position.
  if (headerIndices.has(selectedIndex)) {
    return promptSettings(rows, selectedIndex, colors);
  }

  const selectedRowData = rows[selectedIndex];
  if (!selectedRowData) {
    return false;
  }

  if (result.code === 10) {
    if (selectedRowData.type === "toggle") {
      applyToggle(selectedRowData.key);
      const newRows = buildSettingsRows(getLang());
      return promptSettings(newRows, selectedIndex, colors);
    }
    return promptSettings(rows, selectedIndex, colors);
  }

  // Enter (exit code 0)
  if (selectedRowData.type === "toggle") {
    applyToggle(selectedRowData.key);
    const newRows = buildSettingsRows(getLang());
    return promptSettings(newRows, selectedIndex, colors);
  }

  if (selectedRowData.type === "nav") {
    await handleNavPanel(selectedRowData);
    const newRows = buildSettingsRows(getLang());
    return promptSettings(newRows, selectedIndex, colors);
  }

  return false;
}

async function handleNavPanel(row: NavRow): Promise<void> {
  switch (row.panel) {
    case "persona":
      await promptPersonaPanel();
      break;
    case "language":
      await promptLanguagePanel();
      break;
    case "tts-voice":
      await promptTTSVoicePanel();
      break;
    case "tts-speed":
      await promptTTSSpeedPanel();
      break;
    case "natural-voices-settings":
      await promptNaturalVoicesSettingsPanel();
      break;
    case "web-search-provider":
      await promptWebSearchProviderPanel();
      break;
  }
}

async function promptWebSearchProviderPanel(): Promise<void> {
  const current = settingsManager.get().webSearch.defaultProvider;
  const options = PROVIDERS.map((p) => `${current === p ? "󰄬 " : "   "}${p}`);
  options.push(`󰜺 ${t("common.back")}`);

  const result = await rofiMenu(
    options.join("\n"),
    t("ui.settings.web_search_provider"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")}`
  );

  if (result.code === 0 && result.output && !result.output.startsWith("󰜺")) {
    const clean = result.output.trimStart().replace(/^󰄬\s+/, "");
    const provider = PROVIDERS.find((p) => p === clean);
    if (provider) settingsManager.setWebSearchProvider(provider);
  }
}

async function promptPersonaPanel(): Promise<void> {
  const settings = settingsManager.get();
  const options = PERSONAS.map((p) => {
    const desc = t(`ui.settings.personas.${p}`);
    return `${settings.persona === p ? "󰄬 " : "   "}${p} - ${desc}`;
  });
  options.push(`󰜺 ${t("common.back")}`);

  const result = await rofiMenu(
    options.join("\n"),
    t("ui.settings.select_persona"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
  );

  if (result.code === 0 && result.output && !result.output.startsWith("󰜺")) {
    const cleanLabel = result.output.trimStart().replace(/^󰄬\s+/, "");
    const selectedId = cleanLabel.split(" - ")[0];
    if (selectedId) settingsManager.setPersona(selectedId);
  }
}

async function promptLanguagePanel(): Promise<void> {
  const currentLang = getLang();
  const langs: [string, string][] = [
    ["id", "Bahasa Indonesia"],
    ["en", "English"],
    ["ja", "日本語"],
  ];
  const options = langs.map(([code, name]) =>
    `${currentLang === code ? "󰄬 " : "   "}${name} (${code})`
  );
  options.push(`󰜺 ${t("common.back")}`);

  const result = await rofiMenu(
    options.join("\n"),
    t("ui.settings.select_language"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
  );

  if (result.code === 0 && result.output && !result.output.startsWith("󰜺")) {
    if (result.output.includes("(id)")) settingsManager.setLanguage("id");
    else if (result.output.includes("(en)")) settingsManager.setLanguage("en");
    else if (result.output.includes("(ja)")) settingsManager.setLanguage("ja");
  }
}

async function promptTTSVoicePanel(): Promise<void> {
  const settings = settingsManager.get();
  const currentLang = getLang();
  const currentVoice = settings.tts.voiceId;

  const markActive = (v: string) => {
    const id = v.split(" - ")[0]?.trim() ?? "";
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

  const result = await rofiMenu(
    voiceOptions.join("\n"),
    t("ui.settings.select_voice"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
  );

  if (result.code === 0 && result.output && !result.output.startsWith("󰜺")) {
    const rawId = result.output.split(" - ")[0]?.trim() ?? "";
    const voiceId = rawId.startsWith("󰄬 ") ? rawId.slice(2).trim() : rawId.trimStart();
    if (voiceId) settingsManager.setTTSVoice(voiceId);
  }
}

async function promptTTSSpeedPanel(): Promise<void> {
  const currentSpeed = settingsManager.get().tts.speed;
  const SPEED_MAP: [string, number][] = [
    ["0.5×", 0.5],
    ["0.75×", 0.75],
    [`1.0× (${t("common.default")})`, 1.0],
    ["1.25×", 1.25],
    ["1.5×", 1.5],
    ["2.0×", 2.0],
  ];
  const speedItems = SPEED_MAP.map(([label, value]) =>
    `${Math.abs(value - currentSpeed) < 0.01 ? "󰄬 " : "   "}${label}`
  );
  speedItems.push(`󰜺 ${t("common.back")}`);

  const result = await rofiMenu(
    speedItems.join("\n"),
    t("ui.settings.tts_speed"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")} │ 󰍉 ${t("common.search")}`
  );

  if (result.code === 0 && result.output && !result.output.startsWith("󰜺")) {
    const cleanLabel = result.output.trimStart().replace(/^󰄬\s+/, "");
    const entry = SPEED_MAP.find(([label]) => label === cleanLabel);
    if (entry) settingsManager.setTTSSpeed(entry[1]);
  }
}

function buildNaturalVoicesSettingsRows(): SettingsRow[] {
  const nv = settingsManager.get().tts.naturalVoices;
  const rows: SettingsRow[] = [];

  rows.push({
    type: "toggle",
    icon: "󰔊",
    label: t("ui.settings.latency_masking"),
    key: "tts.naturalVoice.latencyMasking",
    value: nv.latencyMasking?.enabled ?? false,
  });

  rows.push({
    type: "toggle",
    icon: "󰙨",
    label: t("ui.settings.disfluency"),
    key: "tts.naturalVoice.disfluency",
    value: nv.disfluency?.enabled ?? false,
  });

  rows.push({
    type: "nav",
    icon: "󰁾",
    label: t("ui.settings.volume"),
    value: `${nv.volume}%`,
    panel: "natural-voices-volume",
  });

  return rows;
}

function applyNaturalVoicesToggle(key: SettingKey): void {
  const nv = settingsManager.get().tts.naturalVoices;
  switch (key) {
    case "tts.naturalVoice.latencyMasking":
      settingsManager.setNaturalVoicesLatencyMaskingEnabled(!nv.latencyMasking?.enabled);
      break;
    case "tts.naturalVoice.disfluency":
      settingsManager.setNaturalVoicesDisfluencyEnabled(!nv.disfluency?.enabled);
      break;
  }
}

async function promptNaturalVoicesSettingsPanel(): Promise<void> {
  const scheme = await resolveColorScheme();
  const colors = getColorTokens(scheme);
  const rows = buildNaturalVoicesSettingsRows();

  const renderedRows = rows.map((row) => renderRow(row, colors, t));

  const result = await rofiMenu(
    renderedRows.join("\n"),
    t("ui.settings.natural_voices_settings"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")}`,
    "",
    true,
    true,
    { kbCustom1: "space", format: "i" }
  );

  if (result.code === 10 || result.code === 0) {
    if (!result.output) return;

    const selectedIndex = parseInt(result.output, 10);
    if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= rows.length) {
      return;
    }

    const selectedRow = rows[selectedIndex];
    if (!selectedRow) return;

    if (selectedRow.type === "toggle") {
      applyNaturalVoicesToggle(selectedRow.key);
      await promptNaturalVoicesSettingsPanel();
    } else if (selectedRow.type === "nav" && selectedRow.panel === "natural-voices-volume") {
      const nv = settingsManager.get().tts.naturalVoices;
      await promptNaturalVoicesVolumePanel(nv.volume);
    }
  }
}

async function promptNaturalVoicesVolumePanel(currentVolume: number): Promise<void> {
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

  const result = await rofiMenu(
    volItems.join("\n"),
    t("ui.settings.volume"),
    "",
    t("ui.settings.type_to_search"),
    `󰌑 ${t("common.select")} │ 󱊷 ${t("common.back")}`
  );

  if (result.code === 0 && result.output && !result.output.startsWith("󰜺")) {
    const cleanLabel = result.output.trimStart().replace(/^󰄬\s+/, "");
    const entry = VOLUME_MAP.find(([label]) => label === cleanLabel);
    if (entry) settingsManager.setNaturalVoicesVolume(entry[1]);
  }
}

export async function rofiSettings(): Promise<boolean> {
  // Initialize theme mode based on dark mode setting
  setThemeMode(settingsManager.getDarkMode() ? "dark" : "light");
  
  const scheme = await resolveColorScheme();
  const colors = getColorTokens(scheme);
  const rows = buildSettingsRows(getLang());
  const initialRow = rows.findIndex((row) => row.type !== "section");
  return promptSettings(rows, initialRow >= 0 ? initialRow : 0, colors);
}
