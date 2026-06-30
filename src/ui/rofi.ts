import { spawn } from "bun";
import type { ChatManager, Chat } from "../core/services/chat-manager";
import { t } from "../utils/localization/i18n";
import { CancellationError, ChatRequestError } from "../types";
import { logger } from "../logger";
import { escapeHtml } from "../utils/formatting/format";
import {
  classifyError,
  buildRawErrorString,
  truncateRawPreview,
  CATEGORY_I18N_KEYS,
} from "./error-classify";
import { copyRawErrorToClipboard } from "../utils/system/clipboard-raw";
import { formatRofiResponse } from "../utils/formatting/table-formatter";
import { getThemePathWithOverride } from "./theme-cache";
import { rofiDisplay, spawnLoaderOverlay } from "./rofi-display";
import { isTTSPlaying, cancelTTS } from "../ai";

const STREAM_BATCH_MS = 50;
const MAX_LISTVIEW_LINES = 12;
const WRAP_WIDTH = 50;
const MUTED_COLOR = "#A79F96";
const TTS_CANCEL_COLOR = "#e05252";
const TTS_BUTTON_GLYPH = "■";

let activeMenuProc: ReturnType<typeof spawn> | null = null;
let responsePanelAutoDismissed = false;

// static theme fragments - avoid re-allocating each spawn
const STATIC_LISTVIEW_DISABLED = "listview { enabled: false; } mainbox { children: [inputbar, message]; }";
const STATIC_INPUTBAR_ONLY = "listview { enabled: false; } mainbox { children: [inputbar]; }";

function escapeRasiString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function rofiChatInput(
  chatManager: ChatManager,
  prompt: string = "Lumina",
  initialInput?: string
): Promise<{ action: "send" | "history" | "exit"; input?: string }> {
  void chatManager;   //not used here but kept for symmetry (caller expects it)
  const hints = `${t("common.send")} · Esc ${t("common.exit")} · Tab ${t("ui.history_action")} [${t("common.expand")}]`;

  const result = await rofiMenu(
    "",
    prompt,
    STATIC_LISTVIEW_DISABLED,
    t("ui.type_message"),
    hints,
    "",
    false,
    false,
    { filter: initialInput }
  );

  if (result.code === 10) { // TAB pressed -> open History view
    return { action: "history" };
  }

  if (!result.output || result.code !== 0) {
    return { action: "exit" };
  }

  return { action: "send", input: result.output };
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
 * Generic Rofi menu helper.
 * `kbCustom1` defaults to `"Tab"`; pass a value to override.
 * `kbCustom2` is only passed through when explicitly set.
 */
export interface RofiMenuOptions {
  kbCustom1?: string;
  kbCustom2?: string;
  /** dmenu output format, e.g. "i" for selected index*/
  format?: string;
  /** Pre-select a specific row by index */
  selectedRow?: number;
  /** Path to a custom theme file for this invocation */
  themePath?: string;
  /** Pass `-no-fixed-num-lines` when false */
  fixedNumLines?: boolean;
  /** Initial filter text to pre-fill the input */
  filter?: string;
}

export async function rofiMenu(
  items: string,
  prompt: string = "Lumina",
  themeOverride: string = "",
  placeholder: string = "",
  hints: string = "",
  message: string = "",
  isMessagePango: boolean = false,
  isMarkupRows: boolean = false,
  options?: RofiMenuOptions
): Promise<{ output: string | null; code: number }> {
  const args = [
    "rofi",
    "-dmenu",
    "-i",
    "-p", prompt,
    "-theme", options?.themePath ?? getThemePathWithOverride(),
    "-kb-mode-next", "",
    "-kb-row-tab", "",
    "-kb-element-next", "",
    "-kb-custom-1", options?.kbCustom1 ?? "Tab"
  ];

  if (options?.kbCustom2 !== undefined) {
    args.push("-kb-custom-2", options.kbCustom2);
  }

  if (options?.format !== undefined) {
    args.push("-format", options.format);
  }

  if (options?.selectedRow !== undefined) {
    args.push("-selected-row", String(options.selectedRow));
  }

  if (options?.fixedNumLines === false) {
    args.push("-no-fixed-num-lines");
  }
  
  if (options?.filter !== undefined) {
    args.push("-filter", options.filter);
  }

  if (isMarkupRows) {
    args.push("-markup-rows");
  }
  if (isMessagePango) {
    args.push("-markup");
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

  activeMenuProc = proc;
  proc.exited.finally(() => {
    if (activeMenuProc === proc) activeMenuProc = null;
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

export function dismissResponsePanel(): void {
  if (activeMenuProc) {
    responsePanelAutoDismissed = true;
    try { activeMenuProc.kill(); } catch {}
  }
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
): Promise<{ action: "reply" | "expand" | "cancel_tts" | "tts_complete" | "exit"; input?: string }> {
  responsePanelAutoDismissed = false;
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

  const ttsActive = isTTSPlaying();
  const ttsButtonTheme = ttsActive
    ? `configuration { kb-custom-2: ""; }
       inputbar {
         children: [prompt, entry, button];
       }
       button {
         action: "kb-custom-2";
          content: "${TTS_BUTTON_GLYPH}";
         cursor: pointer;
         text-color: ${TTS_CANCEL_COLOR};
         font: "JetBrainsMono Nerd Font Medium 10";
         padding: 0px 8px;
         expand: false;
         background-color: transparent;
         border-radius: 4px;
       }`
    : "";

  const ttsHint = ttsActive ? ` <span foreground="${MUTED_COLOR}" size="small">󰕾 ${escapeHtml(t("ui.panel.tts_reading"))}</span>` : "";
  const formattedMessage = `<b>󱜙 ${escapeHtml(t("common.lumina"))}</b>${ttsHint}\n\n${displayLines.join('\n')}${hintText ? '\n' + hintText : ''}`;

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
    ${ttsButtonTheme}
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

  if (result.code === 11) {
    await cancelTTS();
    return { action: "cancel_tts" };
  }

  if (responsePanelAutoDismissed) {
    responsePanelAutoDismissed = false;
    return { action: "tts_complete" };
  }

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

// Configured colors, for the error UI
const ERROR_TITLE_COLOR = "#962626";
const ERROR_SUGGESTION_COLOR = "#000000";
const ERROR_RAW_COLOR = "#2E2A2658";
const ERROR_KEYHINT_COLOR = "#50697a";

interface ErrorPanelResult {
  action: "retry" | "copy" | "reply" | "exit";
  input?: string;
}

/**
 * Show a Rofi error panel for a failed chat request.
 *
 * Alt+R (kb-custom-1, exit 10) retries.
 * Alt+C (kb-custom-2, exit 11) copies the raw error to the clipboard
 * and re-renders the same panel so the user can retry or copy again.
 */
export async function rofiErrorPanel(originalError: unknown): Promise<ErrorPanelResult> {
  //Category doesnt change across copy re-renders (its stable)
  const category = classifyError(originalError);
  const rawError = buildRawErrorString(originalError);
  const keys = CATEGORY_I18N_KEYS[category]!;
  const title = t(keys.title);
  const suggestion = t(keys.suggestion);
  const preview = truncateRawPreview(rawError);
  const retryLabel = t("error.keyhint.retry");
  const copyLabel = t("error.keyhint.copy");

  const formattedMessage = [
    `<span foreground="${ERROR_TITLE_COLOR}" weight="bold">⚠  ${escapeHtml(title)}</span>`,
    `<span foreground="${ERROR_SUGGESTION_COLOR}">   ${escapeHtml(suggestion)}</span>`,
    ``,
    `<span font_family="JetBrainsMono Nerd Font" foreground="${ERROR_RAW_COLOR}" size="small">   ${escapeHtml(preview)}</span>`,
    ``,
    `<span foreground="${ERROR_KEYHINT_COLOR}">  ALT+R  ${escapeHtml(retryLabel)}      ALT+C  ${escapeHtml(copyLabel)}</span>`,
  ].join("\n");

  const themeOverride = `
    window {
      width: 540px;
      height: 280px;
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
      padding: 24px 24px 16px 24px;
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
      placeholder: "${escapeRasiString(t("ui.type_reply"))}";
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

  while (true) {
    const result = await rofiMenu(
      "",
      t("common.lumina"),
      themeOverride,
      t("ui.type_reply"),
      "",
      formattedMessage,
      true,
      false,
      { kbCustom1: "Alt+r", kbCustom2: "Alt+c" }
    );

    if (result.code === 10) {
      return { action: "retry" };
    }

    if (result.code === 11) {
      const ok = await copyRawErrorToClipboard(rawError);
      if (ok) {
        logger.info("ui", "Error copied to clipboard (Alt+C)");
      }
      continue;
    }

    if (result.code === 0 && result.output) {
      return { action: "reply", input: result.output };
    }

    return { action: "exit" };
  }
}

export async function rofiChatLoop(
  chatManager: ChatManager,
  onMessage: (message: string) => Promise<string>
): Promise<void> {
  let pendingInput: string | undefined = undefined;

  while (true) {
    const result = await rofiChatInput(chatManager, "Lumina", pendingInput);
    pendingInput = undefined;

    switch (result.action) {
      case "exit":
        return;

      case "history": {
        //history handles select/settings/exit on its own
        const { rofiHistoryView } = await import("./history");
        const view = await rofiHistoryView(chatManager, result.input);
        if (view.action === "select") {
          const chatId = await rofiSelectChat(chatManager);
          if (chatId === "__new__") {
            chatManager.createChat();
          } else if (chatId) {
            chatManager.loadChat(chatId);
          }
        } else if (view.action === "settings") {
          const { rofiSettings } = await import("./settings");
          await rofiSettings();
        } else if (view.action === "exit") {
          return;
        } else if (view.action === "send" && view.input) {
          await handleSendMessage(chatManager, view.input, onMessage);
        } else if (view.action === "hide") {
          pendingInput = view.input;
        }
        break;
      }

      case "send":
        if (result.input) {
          await handleSendMessage(chatManager, result.input, onMessage);
        }
        break;
    }
  }
}

//drives a single message thru the send/retry flow
async function handleSendMessage(
  chatManager: ChatManager,
  initialInput: string,
  onMessage: (message: string) => Promise<string>
): Promise<void> {
  let currentInput: string | null = initialInput;

  while (currentInput) {
    const userMessageIndex = chatManager.getCurrentChat()?.messages.length || 0;
    let loadingProc: ReturnType<typeof spawn> | null = null;
    try {
      loadingProc = spawnLoaderOverlay();

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
          } else if (panelResult.action === "cancel_tts" || panelResult.action === "tts_complete") {
            showResponse = true;
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
      if (loadingProc) {
        loadingProc.kill();
        await loadingProc.exited.catch(() => {});
      }

      if (error instanceof ChatRequestError) {
        let activeError: unknown = error.originalError;

        // lumina.chat() already appended the user msg so we undo that here
        const rollbackMessages = () => {
          const currentChat = chatManager.getCurrentChat();
          if (currentChat) {
            const messagesToRemove = currentChat.messages.length - userMessageIndex;
            for (let i = 0; i < messagesToRemove; i++) {
              chatManager.removeLastMessage();
            }
          }
        };
        rollbackMessages();

        let continueErrorLoop = true;
        while (continueErrorLoop) {
          const panelResult = await rofiErrorPanel(activeError);
          if (panelResult.action === "retry") {
            if (!currentInput) {
              continueErrorLoop = false;
              break;
            }
            const retryInput = currentInput;
            try {
              loadingProc = spawnLoaderOverlay();

              const retryResponse = await onMessage(retryInput);

              if (loadingProc) {
                loadingProc.kill();
                await loadingProc.exited.catch(() => {});
              }

              if (retryResponse && retryResponse !== "Done.") {
                let showResponse = true;
                let fullResponse = retryResponse;
                while (showResponse) {
                  const rp = await rofiResponsePanel(fullResponse);
                  if (rp.action === "expand") {
                    await rofiExpandedResponse(fullResponse);
                  } else if (rp.action === "cancel_tts" || rp.action === "tts_complete") {
                    showResponse = true;
                  } else if (rp.action === "reply" && rp.input) {
                    currentInput = rp.input;
                    showResponse = false;
                  } else {
                    currentInput = null;
                    showResponse = false;
                  }
                }
              } else {
                currentInput = null;
              }
              continueErrorLoop = false;
            } catch (retryError) {
              if (loadingProc) {
                loadingProc.kill();
                await loadingProc.exited.catch(() => {});
              }
              if (retryError instanceof ChatRequestError) {
                rollbackMessages();
                activeError = retryError.originalError;
                continue;
              }
              if (retryError instanceof CancellationError) {
                currentInput = null;
                continueErrorLoop = false;
                break;
              }
              logger.error("ui", `Retry error: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
              throw retryError;
            }
          } else if (panelResult.action === "reply" && panelResult.input) {
            currentInput = panelResult.input;
            continueErrorLoop = false;
          } else {
            currentInput = null;
            continueErrorLoop = false;
          }
        }
        continue;
      }

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

export async function rofiInput(prompt: string = "Lumina"): Promise<string> {
  return rofiSimpleInput(prompt, "");
}
