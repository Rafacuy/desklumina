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
Balas singkat lalu panggil tool.
\`\`\`json
{"tool":"app","args":"telegram"}
\`\`\`

User: "set volume ke 30"
Balas singkat lalu panggil tool.
\`\`\`json
{"tool":"media","args":"volume 30"}
\`\`\`

User: "volume naik"
Balas singkat lalu panggil tool.
\`\`\`json
{"tool":"media","args":"volume +10"}
\`\`\``,
  en: `User: "open telegram"
Reply briefly, then call the tool.
\`\`\`json
{"tool":"app","args":"telegram"}
\`\`\`

User: "set volume to 30"
Reply briefly, then call the tool.
\`\`\`json
{"tool":"media","args":"volume 30"}
\`\`\`

User: "volume up"
Reply briefly, then call the tool.
\`\`\`json
{"tool":"media","args":"volume +10"}
\`\`\``,
};

export async function buildSystemPrompt(): Promise<string> {
  const currentLang = getLang() as "id" | "en";
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
1. Write a brief ${langName} assistant reply in 1-2 sentences.
2. If using tools, include JSON inside a markdown \`\`\`json block.
3. Tool JSON must use exactly: {"tool":"name","args":"value"}
4. Never invent a tool name outside: app, terminal, file, media, clipboard, notify.
5. If no tool is needed, answer normally with no JSON.

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
- media args: one of
  play
  pause
  toggle
  stop
  next
  prev
  current
  queue
  search <query>
  volume <0-100 | +N | -N>
  Do not use "up", "down", "louder", or "quieter" in tool args.
- clipboard args: get | list | clear | set <text>
- notify args: <title>|<body>|<low|normal|critical>

Tool correction rules:
- If a tool result says invalid args, produce corrected args only.
- If app/file rejects the action, do not repeat the same invalid call.
- Keep tool args deterministic and machine-parseable.

Examples:
${examples}`;
}
