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

  const [volume, playerctlStatus, mpcStatus, activePlayers, currentTrack, activeWindow] = await Promise.all([
    runProbe("pactl get-sink-volume @DEFAULT_SINK@ | head -n 1 | sed -E 's/.* ([0-9]+%) .*/\\1/'"),
    runProbe("playerctl status 2>/dev/null"),
    runProbe("mpc status '%state%' 2>/dev/null"),
    runProbe("playerctl --list-all 2>/dev/null"),
    runProbe("playerctl metadata --format '{{artist}} - {{title}}' 2>/dev/null || mpc current"),
    runProbe("xdotool getactivewindow getwindowname 2>/dev/null || wmctrl -lp | awk '$1 {print substr($0, index($0,$5))}' | head -n 1"),
  ]);

  const mediaState = playerctlStatus || mpcStatus || "Stopped";
  const players = activePlayers ? activePlayers.split("\n").join(", ") : "None";

  cachedContext = [
    `Volume: ${volume || "Unavailable"}`,
    `Media State: ${mediaState}`,
    `Active Players: ${players}`,
    `Current Track: ${currentTrack || "None"}`,
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
  id: `User: "putar musiknya"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"play\\"}"}
\`\`\`

User: "lanjutkan"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"resume\\"}"}
\`\`\`

User: "skip lagu ini"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"next\\"}"}
\`\`\`

User: "terlalu kencang"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"volume_down\\"}"}
\`\`\``,
  en: `User: "play some music"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"play\\"}"}
\`\`\`

User: "continue playback"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"resume\\"}"}
\`\`\`

User: "skip this"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"next\\"}"}
\`\`\`

User: "turn it up"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"volume_up\\"}"}
\`\`\``,
  ja: `User: "音楽を再生して"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"play\\"}"}
\`\`\`

User: "再生を再開して"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"resume\\"}"}
\`\`\`

User: "次へ"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"next\\"}"}
\`\`\`

User: "音を大きくして"
\`\`\`json
{"tool":"music","args":"{\\"action\\":\\"volume_up\\"}"}
\`\`\``,
};

export async function buildSystemPrompt(): Promise<string> {
  const currentLang = getLang() as "id" | "en" | "ja";
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
5. Never invent a tool name outside: app, terminal, file, music, clipboard, notify.

Strict tool definitions:
- app args: a configured app alias only. If no alias fits, use terminal instead.
- terminal args: a shell command string.
- file args: create_dir, delete, move, copy, list, read, write, find, preview, history, search_name, search_path, search_pattern.
- music args: ALWAYS a JSON string: {"action": "play"|"resume"|"pause"|"stop"|"next"|"prev"|"volume_up"|"volume_down"}
  Rules for music inference:
  - Detect intent: "skip/next" -> next, "back/prev" -> prev, "stop/shut up" -> stop, "louder/up" -> volume_up, "quieter/down" -> volume_down.
  - State-awareness: Use "Media State" from context.
    - If state is "Paused", map "play/continue" to "resume".
    - If state is "Stopped" or "None", map "play/resume" to "play".
    - If user is ambiguous ("play"), check if a track is currently loaded.
  - DO NOT support search, playlists, or any other music actions.
- clipboard args: get | list | clear | set <text>
- notify args: <title>|<body>|<low|normal|critical>

Tool correction rules:
- If a tool result says invalid args, produce corrected args only.
- If app/file rejects the action, do not repeat the same invalid call.
- Keep tool args deterministic and machine-parseable.

Examples:
${examples}`;
}
