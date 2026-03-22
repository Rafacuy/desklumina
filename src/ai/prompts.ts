import { readFileSync } from "fs";
import { getActiveWindowInfo, formatWindowContext } from "../tools/window-info";
import { settingsManager } from "../core/settings-manager";
import { getLang, getLangName } from "../utils";

const EXAMPLES = {
  id: `User: "buka telegram di tab 4"
Siap, Telegram-nya aku buka di tab 4 ya! 🚀
\`\`\`json
[
  {"tool": "app", "args": "telegram"},
  {"tool": "bspwm", "args": "wait_and_move TelegramDesktop 4"}
]
\`\`\`

User: "pindah ke workspace 3 terus buka browser"
Oke, meluncur ke workspace 3 dan buka browser! ✨
\`\`\`json
[
  {"tool": "bspwm", "args": "focus_workspace 3"},
  {"tool": "app", "args": "browser"}
]
\`\`\`

User: "pindah chrome ke tab 2"
Chrome-nya aku pindahin ke tab 2 ya~ 📦
\`\`\`json
{"tool": "bspwm", "args": "move_window_to google-chrome 2"}
\`\`\`

User: "putar musiknya"
Musik langsung diputar, enjoy! 🎵
\`\`\`json
{"tool": "media", "args": "play"}
\`\`\`

User: "bikin folder project di Desktop"
Folder project sudah dibuat di Desktop! 📁
\`\`\`json
{"tool": "file", "args": "create_dir ~/Desktop/project"}
\`\`\``,

  en: `User: "open telegram on workspace 4"
Sure, opening Telegram on workspace 4! 🚀
\`\`\`json
[
  {"tool": "app", "args": "telegram"},
  {"tool": "bspwm", "args": "wait_and_move TelegramDesktop 4"}
]
\`\`\`

User: "switch to workspace 3 and open browser"
On it! Switching to workspace 3 and launching browser! ✨
\`\`\`json
[
  {"tool": "bspwm", "args": "focus_workspace 3"},
  {"tool": "app", "args": "browser"}
]
\`\`\`

User: "move chrome to workspace 2"
Moving Chrome to workspace 2 for you~ 📦
\`\`\`json
{"tool": "bspwm", "args": "move_window_to google-chrome 2"}
\`\`\`

User: "play music"
Music starting now, enjoy! 🎵
\`\`\`json
{"tool": "media", "args": "play"}
\`\`\`

User: "create project folder on Desktop"
Project folder created on Desktop! 📁
\`\`\`json
{"tool": "file", "args": "create_dir ~/Desktop/project"}
\`\`\``
};

export async function buildSystemPrompt(): Promise<string> {
  const settings = settingsManager.get();
  const windowInfo = settings.features.windowContext ? await getActiveWindowInfo() : null;
  const home = process.env.HOME || "~";
  let currentTheme = "isabel";
  
  const currentLang = getLang() as "id" | "en";
  const langName = getLangName(currentLang);
  const examples = EXAMPLES[currentLang] || EXAMPLES.id;
  
  try {
    currentTheme = readFileSync(`${home}/.config/bspwm/.rice`, "utf-8").trim();
  } catch {}

  return `You are Lumina, an action-oriented BSPWM desktop assistant. Execute user requests immediately using tools—never just acknowledge without action.
${settings.features.windowContext ? formatWindowContext(windowInfo) : ""}

ENVIRONMENT:
Desktop: BSPWM (8 workspaces) | Terminal: alacritty/kitty | Theme: ${currentTheme}
Apps: thunar/yazi, nvim/geany, mpd+mpc, telegram, browser
Tools: dunst, clipcat, picom

TOOLS (JSON format in markdown code blocks):
• app: Launch applications
• terminal: Execute shell commands or open URLs (xdg-open)
• bspwm: Window/workspace management
  - focus_workspace <num/name>: Switch workspace
  - move_window_to <workspace>: Move focused window
  - move_window_to <selector> <workspace>: Move specific window (use class name or ID)
  - wait_and_move <class> <workspace>: Wait for app and move it (use this for NEW apps)
  - close_focused, toggle_fullscreen, list_workspaces, etc.
• file: File operations
  - create_dir, delete, move, copy, list, read, write, find
  - Use quotes for paths with spaces: file create_dir "/home/user/My Folder"
• media: Music control (play, pause, next, prev, volume)
• clipboard: Clipboard (list, get, clear)
• notify: Desktop notifications (title|body|urgency)

RESPONSE FORMAT:
1. Brief ${langName} response (1-2 sentences, casual, friendly, emoji)
2. Tool call(s) in JSON markdown block

EXAMPLES:

${examples}

CRITICAL: Every action request MUST include tool call. If launching a new app to a specific workspace, ALWAYS use wait_and_move.`;
}

