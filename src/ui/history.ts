import { join } from "path";
import type { ChatManager } from "../core/services/chat-manager";
import { t } from "../utils/localization/i18n";
import { escapeHtml } from "../utils/formatting/format";
import { rofiMenu } from "./rofi";
import { rofiConversationView } from "./conversation-view";

const HISTORY_THEME_PATH = join(Bun.env.HOME!, ".config/desklumina/src/ui/themes/history.rasi");

export interface HistoryViewResult {
  action: "select" | "settings" | "exit" | "send" | "view" | "hide";
  input?: string;
  historyIndex?: number;
}

const IDX_SELECT_CHAT = 0;
const IDX_SETTINGS = 1;
const IDX_EXIT = 2;
const IDX_SEPARATOR = 3;
const MENU_ROW_COUNT = IDX_SEPARATOR + 1;

const COLOR_ACCENT = "#7060CA";       // ≈ @accent          - Select Chat
const COLOR_SECONDARY = "#7F776F";    // ≈ @text-secondary  - Settings
const COLOR_ERROR = "#E4A7A1";        // ≈ @error           - Exit
const COLOR_MUTED = "#A79F96";        // ≈ @text-muted      - chevron / separator
const COLOR_TEXT = "#2E2A26";         // ≈ @text-primary    - menu labels

// Nerd Font glyphs (code-point escapes cuz glyphs are easy to mistype)
const ICON_SELECT_CHAT = "\u{F075}"; // nf-fa-comment    - chat
const ICON_SETTINGS = "\u{F013}";    // nf-fa-cog        - settings
const ICON_EXIT = "\u{F011}";        // nf-fa-power_off  - exit

export async function rofiHistoryView(chatManager: ChatManager, initialInput?: string): Promise<HistoryViewResult> {
  while (true) {
    const rows: string[] = [];

    // Menu
    rows.push(
      `<span foreground="${COLOR_ACCENT}">${ICON_SELECT_CHAT}</span>  ` +
      `<span foreground="${COLOR_TEXT}">${escapeHtml(t("ui.select_chat"))}</span>  ` +
      `<span foreground="${COLOR_MUTED}" alpha="50%">›</span>`
    );
    rows.push(
      `<span foreground="${COLOR_SECONDARY}">${ICON_SETTINGS}</span>  ` +
      `<span foreground="${COLOR_TEXT}">${escapeHtml(t("ui.settings.title"))}</span>  ` +
      `<span foreground="${COLOR_MUTED}" alpha="50%">›</span>`
    );
    rows.push(
      `<span foreground="${COLOR_ERROR}">${ICON_EXIT}</span>  ` +
      `<span foreground="${COLOR_TEXT}">${escapeHtml(t("common.exit"))}</span>`
    );

    const sepLabel = escapeHtml(t("ui.conversation"));
    rows.push(
      `<span foreground="${COLOR_MUTED}">${"─".repeat(6)} </span>` +
      `<span weight="bold" foreground="${COLOR_MUTED}" size="smaller">${sepLabel}</span>` +
      `<span foreground="${COLOR_MUTED}"> ${"─".repeat(20)}</span>`
    );

    const { lines: historyLines, messageIndices } = chatManager.getHistoryPangoLinesWithMapping();
    if (historyLines.length === 0) {
      rows.push(`<span foreground="${COLOR_MUTED}" style="italic">${escapeHtml(t("ui.empty_history"))}</span>`);
    } else {
      rows.push(...historyLines);
    }

    const placeholder = t("ui.type_message");
    const hints = `↵ ${t("common.select")} · Esc ${t("common.exit")} · Tab ${t("common.hide")}`;

    const result = await rofiMenu(
      rows.join("\n"),
      t("common.lumina"),
      "",
      placeholder,
      hints,
      "",
      false,
      /* isMarkupRows */ true,
      {
        themePath: HISTORY_THEME_PATH,
        selectedRow: historyLines.length > 0 ? MENU_ROW_COUNT : IDX_SELECT_CHAT,
        filter: initialInput
      }
    );

    initialInput = undefined; // only apply filter on the first render

    const selection = resolveHistorySelection(result.output, result.code, rows);

    // Open viewer on select; re-render on close so Esc feels like "back"
    if (selection.action === "view") {
      const historyIndex = selection.historyIndex ?? -1;
      if (historyIndex >= 0 && historyIndex < historyLines.length) {
        let msgIdx = messageIndices[historyIndex];
        if (msgIdx !== undefined) {
          const messages = chatManager.getCurrentChat()?.messages;
          while (
            msgIdx !== undefined &&
            msgIdx > 0 &&
            messages?.[msgIdx]?.role === "tool"
          ) {
            msgIdx--;
          }
          if (messages?.[msgIdx]?.role !== "tool") {
            await rofiConversationView(chatManager, msgIdx);
          }
        }
      }
      continue; // re-render so Esc doesnt exit the whole thing
    }

    return selection;
  }
}

export function resolveHistorySelection(
  output: string | null,
  code: number,
  rows: string[]
): HistoryViewResult {
  if (code === 10) {
    // Tab to back to input box
    if (!output || rows.includes(output)) {
      return { action: "hide" };
    }
    return { action: "hide", input: output || undefined };
  }

  if (!output) {
    return { action: "exit" };
  }

  const asIndex = rows.indexOf(output);

  if (asIndex !== -1) {
    if (asIndex === IDX_SELECT_CHAT) return { action: "select" };
    if (asIndex === IDX_SETTINGS) return { action: "settings" };
    if (asIndex === IDX_EXIT || asIndex === IDX_SEPARATOR) return { action: "exit" };
    if (asIndex >= 0 && asIndex < rows.length) {
      return { action: "view", historyIndex: asIndex - MENU_ROW_COUNT };
    }
    return { action: "exit" };
  }

  return { action: "send", input: output };
}
