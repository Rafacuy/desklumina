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
const CACHE_TTL_MS = 30000;

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

Live system context:
${systemContext}

Response: EITHER a JSON tool call in \`\`\`json blocks OR a brief text reply. Never both.

Tools:
- app <alias>
- terminal <command>
- file <op> (read|write|list|find|create_dir|delete|move|copy|search_name|search_path|search_pattern|preview|history)
- music {"action":"play"|"resume"|"pause"|"stop"|"next"|"prev"|"volume_up"|"volume_down"}
- clipboard get|list|clear|set <text>
- notify <title>|<body>|<low|normal|critical>

Rules:
- If a tool fails, correct args and retry. Do not repeat invalid calls.
- Use strict JSON for tool arguments.
- Keep replies natural but concise.

Examples:
${examples}`;
}
