import type { ChatManager } from "../core/services/chat-manager";
import { t } from "../utils/localization/i18n";
import { escapeHtml } from "../utils/formatting/format";
import { copyRawErrorToClipboard } from "../utils/system/clipboard-raw";
import { logger } from "../logger";
import { rofiMenu, rofiExpandedResponse } from "./rofi";
import { formatRofiResponse } from "../utils/formatting/table-formatter";
import { cleanAssistantResponse } from "../utils";
import { settingsManager } from "../core/services/settings-manager";

const COPY_KEY = "Alt+c";

// Light theme colors
const LIGHT_COLORS_CV = {
  muted: "#A79F96",
  success: "#4A8A5A",
};

// Dark theme colors
const DARK_COLORS_CV = {
  muted: "#8a8a8a",
  success: "#A9D6B0",
};

function getConvViewColors() {
  const isDark = settingsManager.getDarkMode();
  return isDark ? DARK_COLORS_CV : LIGHT_COLORS_CV;
}

function escapeRasiString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface ConversationViewResult {
  action: "back" | "copy" | "expand";
}

/**
 * Show the full content of the message at selectedMessageIndex.
 *
 * Short messages render in the response-panel-styled window (no reply bar,
 * Copy button + back hint). Long messages are truncted identically
 * to the response panel 
 *
 * the usr can press Tab to view the full text in
 * rofiExpandedResponse.
 *
 */
export async function rofiConversationView(
  chatManager: ChatManager,
  selectedMessageIndex: number
): Promise<ConversationViewResult> {
  const chat = chatManager.getCurrentChat();
  if (!chat) return { action: "back" };

  const msg = chat.messages[selectedMessageIndex];
  if (!msg || msg.role === "tool") return { action: "back" };

  const rawContent = cleanAssistantResponse(msg.content);
  if (!rawContent) return { action: "back" };

  let copied = false;
  let showExpanded = false;

  while (true) {
    if (showExpanded) {
      await rofiExpandedResponse(rawContent);
      showExpanded = false; // Rtrns back to the panel after expanded view closes
      continue;
    }

    const result = await renderPanel(rawContent, copied);
    if (result.action === "expand") {
      showExpanded = true;
      continue;
    }
    if (result.action === "back") {
      return result;
    }
    copied = result.copied;
  }
}

interface RenderResult {
  action: "back" | "copy" | "expand";
  copied: boolean;
}

async function renderPanel(rawContent: string, copied: boolean): Promise<RenderResult> {
  const WRAP_WIDTH = 50;
  const MAX_LISTVIEW_LINES = 12;
  
  // Get current colors based on theme mode
  const colors = getConvViewColors();

  const firstPass = formatRofiResponse(rawContent, WRAP_WIDTH);
  
  let windowWidth = 600;
  let dynamicWrapWidth = WRAP_WIDTH;
  let allLines = firstPass.lines;

  if (firstPass.hasTable) {
    const neededWidth = Math.floor(firstPass.maxTableWidth * 8.5) + 100;
    windowWidth = Math.min(1100, Math.max(600, neededWidth));
    dynamicWrapWidth = Math.floor((windowWidth - 100) / 10);
    allLines = formatRofiResponse(rawContent, dynamicWrapWidth).lines;
  }

  const needsTruncation = allLines.length > MAX_LISTVIEW_LINES;
  const displayLines = needsTruncation
    ? allLines.slice(0, MAX_LISTVIEW_LINES)
    : allLines;

  const truncationHint = needsTruncation
    ? `<span foreground="${colors.muted}">  ${escapeHtml(t("ui.panel.truncated"))} </span>`
    : "";

  const copyFeedback = copied
    ? ` <span foreground="${colors.success}" size="small" weight="bold">✓ ${escapeHtml(t("ui.conversationViewer.copied"))}</span>`
    : "";
  const hint =
    `<span foreground="${colors.muted}" size="small">` +
    `󰆏 ${escapeHtml(t("ui.conversationViewer.copy_hint"))} · ` +
    `󱊷 [ESC] ${escapeHtml(t("common.back"))}` +
    `</span>${copyFeedback}`;

  const titleLine = `<b>󱜙 ${escapeHtml(t("ui.conversationViewer.title"))}</b>`;
  const body = displayLines.join("\n");
  const trunc = truncationHint ? `\n\n${truncationHint}` : "";

  const formattedMessage = `${titleLine}\n\n${body}${trunc}\n\n${hint}`;

  const themeOverride = `
    window {
      width: ${windowWidth}px;
      location: southeast;
      anchor: southeast;
      x-offset: -15px;
      y-offset: -15px;
      border-radius: 20px;
      border: 1px;
      border-color: @border-subtle;
      background-color: @bg;
    }
    mainbox {
      children: [message, inputbar];
      padding: 0px;
      spacing: 0px;
      background-color: transparent;
    }
    message {
      padding: 30px 30px 20px 30px;
      border: 0;
      background-color: transparent;
      expand: true;
    }
    textbox {
      text-color: @text-primary;
      font: "JetBrainsMono Nerd Font 10.5";
      expand: true;
      wrap: true;
      line-height: 1.5;
    }
    inputbar {
      border: 1px 0px 0px 0px;
      border-color: @border-subtle;
      border-radius: 0px 0px 20px 20px;
      margin: 0px;
      padding: 16px 30px;
      spacing: 0px;
      children: [dummy, button];
      background-color: @bg;
    }
    dummy {
      expand: true;
      background-color: transparent;
    }
    button {
      action: "kb-custom-2";
      content: "󰆏  ${escapeRasiString(t("ui.conversationViewer.copy"))}";
      cursor: pointer;
      text-color: @bg;
      font: "JetBrainsMono Nerd Font Medium 10";
      padding: 10px 20px;
      expand: false;
      background-color: @accent-color;
      border-radius: 12px;
      horizontal-align: 0.5;
      vertical-align: 0.5;
    }
    listview {
      enabled: false;
    }
    prompt {
      text-color: @name-accent;
    }
  `;

  const result = await rofiMenu(
    "",
    t("common.lumina"),
    themeOverride,
    "",
    "",
    formattedMessage,
    /* isMessagePango */ true,
    /* isMarkupRows */ false,
    { kbCustom1: "Tab", kbCustom2: COPY_KEY }
  );

  // Tab (kb-custom-1) 
  if (result.code === 10 && needsTruncation) {
    return { action: "expand", copied: false };
  }

  // kb-custom-2 (Alt+C)
  if (result.code === 11) {
    const ok = await copyRawErrorToClipboard(rawContent);
    if (!ok) logger.warn("ui", "Failed to copy message to clipboard");
    return { action: "copy", copied: ok };
  }

  return { action: "back", copied: false };
}
