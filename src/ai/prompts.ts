import { logger } from "../logger";
import { getLang, getLangName } from "../utils";

async function runProbe(command: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["bash", "-lc", command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = (await new Response(proc.stdout).text()).trim();
    const stderr = (await new Response(proc.stderr).text()).trim();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      logger.debug("prompts", `Probe failed: ${command} -> ${stderr}`);
      return null;
    }

    return stdout || null;
  } catch (error) {
    logger.debug("prompts", `Probe error: ${command} -> ${String(error)}`);
    return null;
  }
}

let cachedContext: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 3000;

export async function getSystemContext(): Promise<string> {
  const now = Date.now();
  if (cachedContext && now - cachedAt < CACHE_TTL_MS) {
    return cachedContext;
  }

  const [volume, track, activeWindow] = await Promise.all([
    runProbe("pactl get-sink-volume @DEFAULT_SINK@ | head -n 1 | sed -E 's/.* ([0-9]+%) .*/\\1/'"),
    runProbe("playerctl metadata --format '{{status}} :: {{artist}} - {{title}}' 2>/dev/null || mpc current"),
    runProbe("xdotool getactivewindow getwindowname 2>/dev/null || wmctrl -lp | awk '$1 {print substr($0, index($0,$5))}' | head -n 1"),
  ]);

  cachedContext = [
    `Volume: ${volume || "Unavailable"}`,
    `Current track: ${track || "Unavailable"}`,
    `Active window: ${activeWindow || "Unavailable"}`,
  ].join("\n");

  cachedAt = now;
  return cachedContext;
}

/** @internal - For testing only */
export function _resetPromptCache() {
  cachedContext = null;
  cachedAt = 0;
}

const EXAMPLES = {
  id: `User: "buka telegram"
\`\`\`json
{"tool":"app","args":"telegram"}
\`\`\`

User: "set volume ke 30"
\`\`\`json
{"tool":"media","args":"volume 30"}
\`\`\`

User: "volume naik"
\`\`\`json
{"tool":"media","args":"volume +10"}
\`\`\`

User: "putar playlist chill"
\`\`\`json
{"tool":"music","args":"playlist chill"}
\`\`\``,
  en: `User: "open telegram"
\`\`\`json
{"tool":"app","args":"telegram"}
\`\`\`

User: "set volume to 30"
\`\`\`json
{"tool":"media","args":"volume 30"}
\`\`\`

User: "volume up"
\`\`\`json
{"tool":"media","args":"volume +10"}
\`\`\`

User: "play chill playlist"
\`\`\`json
{"tool":"music","args":"playlist chill"}
\`\`\``,
  ja: `User: "telegramを開いて"
\`\`\`json
{"tool":"app","args":"telegram"}
\`\`\`

User: "音量を30にして"
\`\`\`json
{"tool":"media","args":"volume 30"}
\`\`\`

User: "音量を上げて"
\`\`\`json
{"tool":"media","args":"volume +10"}
\`\`\`

User: "チルなプレイリストを再生して"
\`\`\`json
{"tool":"music","args":"playlist chill"}
\`\`\``,
};

export async function buildSystemPrompt(): Promise<string> {
  const currentLang = getLang() as "id" | "en" | "ja";
  const langName = getLangName(currentLang);
  const examples = EXAMPLES[currentLang] || EXAMPLES.en;
  const systemContext = await getSystemContext();

  return `You are Lumina, a Linux desktop assistant.

Always respect the latest user message.
If the user asks for an action and a matching tool exists, emit a tool call.
Do not rely on side effects or prior hidden state.
When a previous tool result reports a failure, correct the tool choice or args and retry with valid JSON.

Live system context:
${systemContext}

Response rules:
1. EITHER: Reply with a JSON markdown block ONLY (if tools are needed).
2. OR: Reply with a brief text message (if no tool is needed).
3. NO mixed outputs (text + JSON).
4. Tool JSON must use exactly: {"tool":"name","args":"value"}
5. Never invent a tool name outside: app, terminal, file, media, music, clipboard, notify.

Strict tool definitions:
- app args: a configured app alias only. If no alias fits, use terminal instead.
- terminal args: a shell command string.
- file args: one of
  create_dir <path>
  delete <path>
  move <source> <destination>
  copy <source> <destination>
  list <path>
  read <path>
  write <path> <content>
  find <path> <pattern>
  preview <path>
  history [limit]
  repeat_last
  search_name <query> [base=<path>] [type=file|directory|any] [ext=csv] [hidden=true|false] [limit=1-200] [select=true|false] [preview=true|false]
  search_path <query> [base=<path>] [type=file|directory|any] [ext=csv] [hidden=true|false] [limit=1-200] [select=true|false] [preview=true|false]
  search_pattern <regex> [base=<path>] [type=file|directory|any] [ext=csv] [hidden=true|false] [limit=1-200] [select=true|false] [preview=true|false]
  Use search_name when matching file or folder names.
  Use search_path when matching a known path fragment.
  Use search_pattern for explicit regex-style patterns only.
  Use key=value filters only. Do not invent flags or prose.
- media args: pause | toggle | stop | next | prev | volume <0-100 | +N | -N>
  Use ONLY for volume and basic playback control.
- music args: search <query> | play <track|index> | playlist <name> | ls music|playlists | queue | status | update
  Use for all library actions and starting playback. Use search before play if unsure.
  Music rules:
  - If user says 'play' -> music play <query>
  - If user says 'find/search' -> music search <query>
  - NEVER invent file names.
  - ONLY ONE tool call per request.
- clipboard args: get | list | clear | set <text>
- notify args: <title>|<body>|<low|normal|critical>

Tool correction rules:
- If a tool result says invalid args, produce corrected args only.
- If app/file rejects the action, do not repeat the same invalid call.
- Keep tool args deterministic and machine-parseable.

Examples:
${examples}`;
}
