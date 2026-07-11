import { logger } from "../../logger";
import { TOOL_CONTRACTS, ToolContract } from "../../tools/contracts";
import { settingsManager } from "../../core/services/settings-manager";
import { getPersona } from "./personas";
import { getLang, getLangName } from "../../utils";
import { buildLtmContext } from "../../ltm";
import { getTimeContextLine, getDateContextLine } from "../../utils/time-context";

async function runProbe(command: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["bash", "-c", command], {
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

  const [volume, activeWindow] = await Promise.all([
    runProbe("pactl get-sink-volume @DEFAULT_SINK@ | head -n 1 | sed -E 's/.* ([0-9]+%) .*/\\1/'"),
    runProbe("xdotool getactivewindow getwindowname 2>/dev/null || wmctrl -lp | awk '$1 {print substr($0, index($0,$5))}' | head -n 1"),
  ]);

  cachedContext = [
    `Volume: ${volume || "Unavailable"}`,
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

function formatToolContract(contract: ToolContract): string {
  const sections = [
    `TOOL: ${contract.name}`,
    `${contract.description}`,
    `SCHEMA: ${contract.schema}`,
    `TYPES: ${JSON.stringify(contract.types)}`,
    `REQUIRED: ${contract.requiredArgs.join(", ")}`,
  ];

  if (contract.optionalArgs.length > 0) {
    sections.push(`OPTIONAL: ${contract.optionalArgs.join(", ")}`);
  }

  sections.push(
    `VALID FORMATS:\n${contract.validFormats.map((f) => `  - ${f}`).join("\n")}`,
    `INVALID FORMAT EXAMPLES:\n${contract.invalidFormats.map((f) => `  - ${f}`).join("\n")}`,
    `ESCAPING: ${contract.escapingRules}`,
    `QUOTING: ${contract.quotingRules}`
  );

  if (contract.pathRules) {
    sections.push(`PATH RULES:
  - Absolute: ${contract.pathRules.absolute}
  - Relative: ${contract.pathRules.relative}
  - Tilde Expansion: ${contract.pathRules.tildeExpansion}
  - Whitespace Handling: ${contract.pathRules.whitespace}
  - Normalization: ${contract.pathRules.normalization}
  - Invalid Examples: ${contract.pathRules.invalidExamples.join(", ")}`);
  }

  sections.push(`OUTPUT CONTRACT:
  - Success: ${contract.output.success}
  - Failure: ${contract.output.failure}
  - Empty: ${contract.output.empty}${contract.output.partial ? `\n  - Partial: ${contract.output.partial}` : ""}`);

  const retryLimit = contract.failure.retryLimit;
  const retryInstructions =
    retryLimit > 0
      ? `Retry up to ${retryLimit} times before escalation.`
      : "Do not retry automatically. Escalate immediately.";

  sections.push(`FAILURE CONTRACT:
  - Retriable: ${contract.failure.retriable.join(", ") || "None"}
  - Non-Retriable: ${contract.failure.nonRetriable.join(", ")}
  - Retry Limit: ${retryLimit}
  - Permission: ${contract.failure.permissionBehavior}
  - Malformed Input: ${contract.failure.malformedInputBehavior}
  - Escalation: ${retryInstructions}`);

  return sections.join("\n");
}

const IDENTITY = "You are Lumina, a deterministic Linux desktop assistant.";

const RULES_AND_ESCALATION = `EXECUTION RULES:
1. Response: EITHER a JSON tool call in \`\`\`json blocks OR a brief text reply. Never both.
2. Format: {"tool": "tool_name", "args": "arguments_string"}
3. Pathing: Always use absolute paths or ~ for home directory.
4. Concurrency: Multiple tool calls allowed in one response if independent.

FAILURE ESCALATION TREE:
- Failure 1: Inspect error message, identify syntax or path error, correct arguments, and retry according to tool contract.
- Failure 2: Verify tool contract and local file system state. If arguments are correct but tool fails, do not retry with same arguments.
- Failure 3: Stop execution. Produce a structured failure report explaining why the task cannot be completed.`;

const AGENT_PROTOCOL = `AGENT PROTOCOL:
When your task is complete and you have nothing more to do, end your response with [[DONE]].
If you cannot complete the task and further attempts would not help, end with [[FAIL: reason]].
If you need to call tools, emit them now without any terminal marker — the loop will continue.
Do not emit [[DONE]] if you have just emitted tool calls in the same response.`;

function buildContractSections(contracts: readonly ToolContract[]): { docs: string[]; anchors: string[] } {
  const docs: string[] = [];
  const anchors: string[] = [];

  for (const contract of contracts) {
    docs.push(formatToolContract(contract));

    if (contract.formatAnchors && contract.formatAnchors.length > 0) {
      const toolName = contract.name.charAt(0).toUpperCase() + contract.name.slice(1);
      const examples = contract.formatAnchors
        .map((anchor) => `\`\`\`json\n${anchor}\n\`\`\``)
        .join("\n\n");
      anchors.push(`${toolName}:\n${examples}`);
    }
  }

  return { docs, anchors };
}

export async function buildSystemPrompt(query: string = ""): Promise<string> {
  const { docs, anchors } = buildContractSections(TOOL_CONTRACTS);
  const toolContracts = docs.join("\n\n---\n\n");
  const formatExamples = `FORMAT ANCHORS:\n\n${anchors.join("\n\n")}`;

  const lang = getLang();
  const langName = getLangName(lang);

  const styleGuides: Record<string, string> = {
    pt: "For Portuguese: Use natural, modern Brazilian Portuguese (pt-BR) by default. Avoid overly formal or textbook phrasing unless the persona is very formal. Feel free to use common colloquial markers like 'tô', 'tá', 'né', 'aí', 'cara', 'bom' where appropriate for the persona to sound conversational and authentic. For casual personas, lean toward spoken Brazilian style (jeito de falar brasileiro); for formal personas, a slightly more polished tone is acceptable but avoid stiff European Portuguese constructions.",
    de: "For German: Use natural, modern German (de-DE) by default. Avoid overly formal or bureaucratic phrasing (Behördendeutsch) unless the persona is very formal. Default to 'du' over 'Sie' unless the persona calls for distance or formality. Feel free to use natural colloquial markers like 'mal', 'halt', 'doch', 'ja', 'eben', 'grad', 'ne' (for 'eine') where it fits the persona to sound authentic and relaxed. For casual personas, lean toward spoken German style (Umgangssprache); for formal personas, a slightly more polished tone is acceptable but avoid stiff textbook constructions. Compound nouns are fine, but keep sentences readable.",
    ru: "For Russian: Use natural, modern Russian (ru-RU) by default. Avoid overly formal or textbook phrasing unless the persona is very formal. Default to 'ты' over 'вы' unless the persona calls for distance or formality. Feel free to use natural conversational markers like 'ну', 'ага', 'блин', 'короче', 'ладно', 'щас' where it fits the persona to sound authentic and relaxed. For casual personas, lean toward spoken Russian style (разговорный стиль); for formal personas, a slightly more polished tone is acceptable but avoid stiff bureaucratic language (канцелярит).",
    zh: "For Chinese: Use natural, modern Mandarin Chinese (Simplified, zh-CN) by default. Avoid overly formal written style (书面语) unless the persona is very formal. Feel free to use common colloquial particles like '嘛', '呢', '吧', '啊', '啦' where appropriate for the persona to sound natural and conversational. Use Simplified Chinese characters (简体字) consistently. For casual personas, lean toward spoken-style phrasing (口语化); for formal personas, a slightly more polished tone is acceptable but avoid stiff textbook language.",
    ko: "For Korean: Use natural, modern Korean (ko-KR) by default. Use 해요체 (polite informal) as the default speech level for a friendly yet respectful tone, unless the persona calls for formal 합쇼체 or casual 반말. Feel free to use natural particles and endings like '요', '네요', '죠', '아/어' where appropriate for the persona to sound conversational and natural. Avoid overly stiff textbook Korean unless the persona is very formal.",
    fr: "For French: Use natural, conversational French (fr-FR). Default to 'tu' (informal) unless the persona explicitly calls for 'vous' (formality or distance). Keep the phrasing fluid and modern, using natural fillers like 'ben', 'ouais', 'en fait' where appropriate for the persona.",
    es: "For Spanish: Use natural, conversational Spanish (Castilian, es-ES) by default. Avoid overly stiff or textbook phrasing unless the persona is very formal. Default to 'tú' over 'usted' unless the persona calls for distance or formality. Feel free to use natural fillers like 'bueno', 'vale', 'o sea' where it fits the persona.",
    id: "For Indonesian: Use natural, modern Indonesian. Avoid overly formal 'Baku' language unless the persona is very formal. Feel free to use common particles like 'ya', 'nih', 'deh' where appropriate for the persona to sound natural.",
    ja: "For Japanese: Use appropriate politeness levels (Desu/Masu) by default, adjusted by persona. Use kanji, hiragana, and katakana naturally.",
    en: "For English: Use natural, conversational English.",
  };

  const languageDirective = `LANGUAGE:
  You must respond using ${langName} for all natural language text.
  You must stay in ${langName} unless specifically asked to translate.
  ${styleGuides[lang] || ""}`;

  const personaId = settingsManager.get().persona;
  const persona = getPersona(personaId);
  const identityWithPersona = persona.prompt
    ? `${IDENTITY}\n\n${persona.prompt}`
    : IDENTITY;

  const [ltmContext, systemContext] = await Promise.all([
    buildLtmContext(query),
    getSystemContext(),
  ]);

  const liveSystemContext = [systemContext];
  if (Bun.env.DESKLUMINA_TIME_AWARENESS !== "false") {
    liveSystemContext.push(getTimeContextLine());
    liveSystemContext.push(getDateContextLine());
  }

  return [
    identityWithPersona,
    languageDirective,
    ltmContext,
    toolContracts,
    RULES_AND_ESCALATION,
    AGENT_PROTOCOL,
    formatExamples,
    `LIVE SYSTEM CONTEXT:\n${liveSystemContext.join("\n")}`,
  ].filter(Boolean).join("\n\n");
}
