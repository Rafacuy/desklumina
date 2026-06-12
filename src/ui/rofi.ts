import { spawn } from "bun";
import type { ChatManager, Chat } from "../core/services/chat-manager";
import { t } from "../utils/localization/i18n";
import { CancellationError } from "../types";
import { logger } from "../logger";
import { escapeHtml } from "../utils/formatting/format";
import { markdownToPango, wrapPangoText } from "../utils/formatting/pango";
import { formatRofiResponse } from "../utils/formatting/table-formatter";
import { randomLoader, randomLoaderImage } from "./loader";
import { getThemePathWithOverride } from "./theme-cache";

const STREAM_BATCH_MS = 50;
const MAX_LISTVIEW_LINES = 12;
const WRAP_WIDTH = 50;
const MUTED_COLOR = "#A79F96";

//Pre-computed static theme fragments 
// to avoid re-allocation on every spawn
const STATIC_LISTVIEW_DISABLED = "listview { enabled: false; } mainbox { children: [inputbar, message]; }";
const STATIC_INPUTBAR_ONLY = "listview { enabled: false; } mainbox { children: [inputbar]; }";

function escapeRasiString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function rofiChatInput(
  chatManager: ChatManager,
  prompt: string = "Lumina",
  isExpanded: boolean = false
): Promise<{ action: "send" | "new" | "select" | "settings" | "expand_toggle" | "exit"; input?: string }> {
  const currentChat = chatManager.getCurrentChat();
  const historyPreview = chatManager.getChatHistoryPreview(400);

  const menuItems: string[] = [];

  if (isExpanded) {
    // Show management options in expanded mode
    if (historyPreview) {
      menuItems.push(`── ${t("ui.recent_messages")} ──`);
      menuItems.push(historyPreview);
      menuItems.push("──────────────────");
    }

    menuItems.push(`📂 ${t("ui.select_chat")}`);
    menuItems.push(`⚙️ ${t("ui.settings.title")}`);
    menuItems.push(`✖ ${t("common.close")}`);
  }

  const themeOverride = isExpanded 
    ? "" 
    : STATIC_LISTVIEW_DISABLED;
    
const hints = isExpanded
    ? `${t("common.send")} · Esc ${t("common.exit")} · Tab ${t("common.hide")}`
    : `${t("common.send")} · Esc ${t("common.exit")} · Tab ${t("common.expand")}`;

  const result = await rofiMenu(
    menuItems.join("\n"), 
    prompt,
    themeOverride,
    t("ui.type_message"),
    hints
  );

  if (result.code === 10) { // TAB pressed
    return { action: "expand_toggle" };
  }

  const input = result.output;

  if (!input || result.code !== 0) {
    return { action: "exit" };
  }

  if (isExpanded) {
    if (input === `📂 ${t("ui.select_chat")}`) {
      return { action: "select" };
    }

    if (input === `⚙️ ${t("ui.settings.title")}`) {
      return { action: "settings" };
    }

    if (input === `✖ ${t("common.close")}`) {
      return { action: "exit" };
    }

    if (input.startsWith(`󱜙 ${t("common.you")}:`) || input.startsWith(`󱜙 ${t("common.lumina")}:`) || input.startsWith("──")) {
      // If user clicks a history item, treat it as wanting to send a new message
      const message = await rofiSimpleInput(t("common.message"), "");
      if (message) {
        return { action: "send", input: message };
      }
      return { action: "exit" };
    }
  }

  return { action: "send", input };
}

export async function rofiSelectChat(chatManager: ChatManager): Promise<string | null> {
  const chats = chatManager.getAllChats();
  
  if (chats.length === 0) {
    await rofiDisplay(t("ui.no_chats_start"));
    return null;
  }

  const chatItems = chats.map((chat: any) => {
    const date = new Date(chat.updatedAt).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
    const lastMsg = chat.lastMessage || "";
    const previewChars = Array.from(lastMsg.replace(/\n/g, " "));
    const preview = previewChars.length > 30 
      ? previewChars.slice(0, 30).join("") + "…"
      : previewChars.join("");
      
    return `󰭹 ${chat.title.padEnd(20)} │ 󰃭 ${date} │ 󰅒 ${chat.messageCount} │ ${preview}`;
  });
  
  const allItems = [
    ...chatItems,
    `📝 ${t("ui.new_chat")}`,
    `✕ ${t("common.cancel")}`
  ];

  const headerHint = `󰗋 ${t("ui.select_chat")}  │  󰌑 ${t("common.select")} │ 󱊷 ${t("common.cancel")}`;

  const result = await rofiMenu(
    allItems.join("\n"), 
    t("ui.select_chat"), 
    "listview { lines: 12; }",
    t("ui.search_chat"),
    headerHint
  );

  if (!result.output || result.code !== 0 || result.output === `✕ ${t("common.cancel")}`) {
    return null;
  }

  const selected = result.output;

  if (selected === `📝 ${t("ui.new_chat")}`) {
    return "__new__";
  }

  const chatTitle = selected.split(" │ ")[0]?.replace("󰭹 ", "").trim();
  const chat = chats.find((c) => c.title === chatTitle);
  
  if (!chat) return null;
  return chat.id;
}

/**
 * Generic Rofi menu helper
 */
export async function rofiMenu(
  items: string, 
  prompt: string = "Lumina", 
  themeOverride: string = "",
  placeholder: string = "",
  hints: string = "",
  message: string = "",
  isMessagePango: boolean = false,
  isMarkupRows: boolean = false
): Promise<{ output: string | null; code: number }> {
  const args = [
    "rofi", 
    "-dmenu", 
    "-i", 
    "-p", prompt,
    "-theme", getThemePathWithOverride(),
    "-kb-mode-next", "",
    "-kb-row-tab", "",
    "-kb-element-next", "",
    "-kb-custom-1", "Tab"
  ];
  
  if (isMessagePango) {
    args.push("-markup");
  } else if (isMarkupRows) {
    args.push("-markup-rows");
  }
  
  const finalMessage = message && hints
    ? `${message}\n\n${hints}`
    : message || hints;
  if (finalMessage) {
    args.push("-mesg", isMessagePango ? finalMessage : escapeHtml(finalMessage));
  }
  
  let finalTheme = themeOverride;
  if (placeholder) {
    //escape quotes in placeholder to prevent RASI parser breakage
    const safePlaceholder = placeholder.replace(/"/g, '\\"');
    finalTheme += ` entry { placeholder: "${safePlaceholder}"; }`;
  }

  if (finalTheme) {
    args.push("-theme-str", finalTheme);
  }

  const proc = spawn(args, {
    stdin: "pipe",
    stdout: "pipe",
  });

  proc.stdin.write(items || "");
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  const code = await proc.exited;
  
  return { 
    output: output.trim() || null, 
    code 
  };
}

export async function rofiExpandedResponse(fullMessage: string): Promise<void> {
  const WRAP_WIDTH = 62;
  const cleanMessage = fullMessage
    .replace(/^\s+·\s.+$/gm, "")
    .trim();

  const firstPass = formatRofiResponse(cleanMessage, WRAP_WIDTH);

  let windowWidth = 750;
  let dynamicWrapWidth = WRAP_WIDTH;
  let pangoLines = firstPass.lines;

  if (firstPass.hasTable) {
    const neededWidth = Math.floor(firstPass.maxTableWidth * 8.5) + 130;
    windowWidth = Math.min(1200, Math.max(750, neededWidth));
    dynamicWrapWidth = Math.floor((windowWidth - 130) / 10);
    pangoLines = formatRofiResponse(cleanMessage, dynamicWrapWidth).lines;
  }

  const windowHeight = Math.min(800, Math.round(pangoLines.length * 22 + 80));

  const themeOverride = `
    window {
      width: ${windowWidth}px;
      height: ${windowHeight}px;
      border-radius: 20px;
      border: 1px;
      border-color: @border-subtle;
      background-color: @bg;
    }
    mainbox {
      children: [listview];
      padding: 30px;
    }
    listview {
      scrollbar: true;
      fixed-height: true;
      expand: true;
    }
    element {
      padding: 4px 12px;
      border-radius: 10px;
      text-color: @text-primary;
      font: "JetBrainsMono Nerd Font 10";
    }
    element selected.normal {
      background-color: @accent-light;
      text-color: @accent-color;
    }
    element-text {
      wrap: true;
    }
    scrollbar {
      background-color: transparent;
      handle-color: @text-muted;
      handle-width: 4px;
      border-radius: 2px;
      width: 6px;
      margin: 4px 2px;
    }
  `;

  await rofiMenu(
    pangoLines.join('\n'),
    t("ui.full_response"),
    themeOverride,
    "",
    `󱊷 [ESC] ${t("common.back")}`,
    "",
    false,
    true
  );
}

export async function rofiResponsePanel(
  initialMessage: string,
  onToolUpdate?: (id: string, status: string, detail?: string[]) => void
): Promise<{ action: "reply" | "expand" | "exit"; input?: string }> {
  if (onToolUpdate) {
    onToolUpdate("", "", []);
  }

  const cleanMessage = initialMessage
    .replace(/^\s+·\s.+$/gm, "")
    .trim();

  const firstPass = formatRofiResponse(cleanMessage, WRAP_WIDTH);

  let windowWidth = 600;
  let dynamicWrapWidth = WRAP_WIDTH;
  let allLines = firstPass.lines;

  if (firstPass.hasTable) {
    const neededWidth = Math.floor(firstPass.maxTableWidth * 8.5) + 100;
    windowWidth = Math.min(1100, Math.max(600, neededWidth));
    dynamicWrapWidth = Math.floor((windowWidth - 100) / 10);
    allLines = formatRofiResponse(cleanMessage, dynamicWrapWidth).lines;
  }

  const needsTruncation = allLines.length > MAX_LISTVIEW_LINES;

  const displayLines = needsTruncation
    ? allLines.slice(0, MAX_LISTVIEW_LINES)
    : allLines;

  let hintText = "";
  if (needsTruncation) {
    hintText = `<span foreground="${MUTED_COLOR}">  ${escapeHtml(t("ui.panel.truncated"))} </span>`;
  }

  const formattedMessage = `<b>󱜙 ${escapeHtml(t("common.lumina"))}</b>\n\n${displayLines.join('\n')}${hintText ? '\n' + hintText : ''}`;

  const themeOverride = `
    window {
      width: ${windowWidth}px;
      height: 550px;
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
      padding: 24px 24px 24px 24px;
      border: 0;
      background-color: transparent;
      expand: true;
    }
    textbox {
      text-color: @text-primary;
      font: "JetBrainsMono Nerd Font 10";
      expand: true;
      wrap: true;
    }
    inputbar {
      border: 1px 0px 0px 0px;
      border-color: @border-subtle;
      border-radius: 0px 0px 20px 20px;
      margin: 0px;
      padding: 14px 24px;
      children: [prompt, entry];
    }
    prompt {
      text-color: @accent-color;
      font: "JetBrainsMono Nerd Font Medium 10";
      vertical-align: 0.5;
    }
    entry {
      placeholder: "${t("ui.reply_placeholder")}";
      placeholder-color: @text-muted;
      font: "JetBrainsMono Nerd Font 10";
      vertical-align: 0.5;
      cursor-color: @accent-bloom;
      cursor-width: 1px;
    }
    listview {
      enabled: false;
    }
  `;

  const result = await rofiMenu(
    "",
    t("common.lumina"),
    themeOverride,
    t("ui.type_reply"),
    "",
    formattedMessage,
    true
  );

  if (result.code === 10 && needsTruncation) {
    return { action: "expand" };
  }

  if (result.code === 0 && result.output) {
    return { action: "reply", input: result.output };
  }

  return { action: "exit" };
}

export async function rofiSimpleInput(prompt: string, placeholder: string = ""): Promise<string> {
  const result = await rofiMenu(
    "",
    prompt,
    STATIC_INPUTBAR_ONLY,
    placeholder
  );
  return result.output ?? "";
}

export async function rofiDisplay(message: string): Promise<void> {
  const cleanMessage = message
    .replace(/^\s+·\s.+$/gm, "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();

  const formattedMessage = `<b>󱜙 ${escapeHtml(t("common.lumina"))}</b>\n${"─".repeat(40)}\n\n${markdownToPango(cleanMessage)}`;
  const proc = spawn([
    "rofi", "-e", formattedMessage,
    "-markup",
    "-theme", getThemePathWithOverride(),
    "-theme-str", `
      window {
        width: 500px;
        height: 400px;
        border-radius: 18px;
        border: 1px;
        border-color: @border-subtle;
        background-color: @bg;
      }
      mainbox {
        children: [textbox];
        padding: 24px;
        background-color: transparent;
      }
      textbox {
        background-color: transparent;
        text-color: @text-primary;
        font: "JetBrainsMono Nerd Font 10";
        expand: true;
        vertical-align: 0.5;
        horizontal-align: 0.5;
        padding: 0;
        margin: 0;
        wrap: true;
      }
    `
  ], {
    stdio: ["ignore", "ignore", "ignore"],
  });

  await proc.exited;
}   

export async function rofiChatLoop(
  chatManager: ChatManager,
  onMessage: (message: string) => Promise<string>
): Promise<void> {
  let isExpanded = false;
  
  while (true) {
    const result = await rofiChatInput(chatManager, "Lumina", isExpanded);

    switch (result.action) {
      case "exit":
        return;

      case "expand_toggle":
        isExpanded = !isExpanded;
        break;

      case "send":
        if (result.input) {
          let currentInput: string | null = result.input;
          
          while (currentInput) {
            const userMessageIndex = chatManager.getCurrentChat()?.messages.length || 0;
            try {
              const loaderImage = randomLoaderImage();
              const loaderTheme = loaderImage
                ? `
                  window {
                    location: southeast;
                    anchor: southeast;
                    width: 360px;
                    border-radius: 0px;
                    border: 0px;
                    background-color: transparent;
                    x-offset: -24px;
                    y-offset: -12px;
                  }
                  mainbox {
                    orientation: vertical;
                    children: [icon-loader, loader-frame];
                    padding: 0px;
                    spacing: 0px;
                    background-color: transparent;
                  }
                  icon-loader {
                    filename: "${escapeRasiString(loaderImage)}";
                    width: 200px;
                    size: 200px;
                    expand: false;
                    horizontal-align: 0.5;
                    vertical-align: 1.0;
                    margin: 0px;
                    padding: 0px;
                    border: 0px;
                    background-color: transparent;
                  }
                  loader-frame {
                    orientation: vertical;
                    children: [message];
                    padding: 0px;
                    spacing: 0px;
                    margin: 0px;
                    border: 1px;
                    border-radius: 20px;
                    border-color: @border-subtle;
                    background-color: @bg;
                  }
                  inputbar {
                    enabled: false;
                  }
                  listview {
                    enabled: false;
                  }
                  message {
                    padding: 14px 20px;
                    border: 0px;
                    border-radius: 0px;
                    background-color: transparent;
                  }
                  textbox {
                    text-color: @accent-color;
                    font: "JetBrainsMono Nerd Font Medium 10";
                    horizontal-align: 0.5;
                    vertical-align: 0.5;
                    wrap: false;
                  }
                `
                : `
                  window {
                    location: southeast;
                    anchor: southeast;
                    width: 360px;
                    height: 52px;
                    border-radius: 20px;
                    border: 1px;
                    border-color: @border-subtle;
                    background-color: @bg;
                    x-offset: -24px;
                    y-offset: -12px;
                  }
                  mainbox {
                    children: [message];
                    padding: 0px;
                    spacing: 0px;
                  }
                  inputbar {
                    enabled: false;
                  }
                  listview {
                    enabled: false;
                  }
                  message {
                    padding: 14px 20px;
                    background-color: transparent;
                  }
                  textbox {
                    text-color: @accent-color;
                    font: "JetBrainsMono Nerd Font Medium 10";
                    horizontal-align: 0.5;
                    vertical-align: 0.5;
                    wrap: false;
                  }
                `;

              const loadingProc = spawn([
                "rofi", "-dmenu",
                "-theme", getThemePathWithOverride(),
                "-theme-str", loaderTheme,
                "-mesg", escapeHtml(randomLoader()),
              ], { stdin: "pipe", stdout: "pipe" });

              loadingProc.stdin.end();

              const response = await onMessage(currentInput);

              loadingProc.kill();
              await loadingProc.exited.catch(() => {});
              
              if (response && response !== "Done.") {
                let showResponse = true;
                let fullResponse = response;
                
                while (showResponse) {
                  const panelResult = await rofiResponsePanel(fullResponse);
                  
                  if (panelResult.action === "expand") {
                    await rofiExpandedResponse(fullResponse);
                  } else if (panelResult.action === "reply" && panelResult.input) {
                    currentInput = panelResult.input;
                    showResponse = false;
                  } else {
                    currentInput = null;
                    showResponse = false;
                  }
                }
              } else {
                currentInput = null;
              }
            } catch (error) {
              const isCancellation = 
                error instanceof CancellationError || 
                (error && typeof error === 'object' && 'name' in error && error.name === "CancellationError");

              if (isCancellation) {
                logger.info("ui", "Cancellation detected, intercepting and hiding response panel");
                
                const currentChat = chatManager.getCurrentChat();
                if (currentChat) {
                  const messagesToRemove = currentChat.messages.length - userMessageIndex;
                  logger.debug("ui", `Removing ${messagesToRemove} messages from history (undo)`);
                  for (let i = 0; i < messagesToRemove; i++) {
                    chatManager.removeLastMessage();
                  }
                }
                currentInput = null;
                break;
              }
              logger.error("ui", `Error in onMessage: ${error instanceof Error ? error.message : String(error)}`);
              throw error;
            }
          }
        }
        break;

      case "select":
        const chatId = await rofiSelectChat(chatManager);
        if (chatId === "__new__") {
          chatManager.createChat();
        } else if (chatId) {
          chatManager.loadChat(chatId);
        }
        break;

      case "settings":
        const { rofiSettings } = await import("./settings");
        await rofiSettings();
        break;

      case "new":
        chatManager.createChat();
        break;
    }
  }
}

export async function rofiInput(prompt: string = "Lumina"): Promise<string> {
  return rofiSimpleInput(prompt, "");
}
