import { logger } from "../logger";
import { TOOL_CONTRACTS, ToolContract } from "../tools/contracts";
import { settingsManager } from "../core/settings-manager";
import { getPersona } from "./personas";

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

function generateFormatAnchors(): string {
  const anchors = TOOL_CONTRACTS.filter((c) => c.formatAnchors && c.formatAnchors.length > 0)
    .map((c) => {
      const toolName = c.name.charAt(0).toUpperCase() + c.name.slice(1);
      const examples = c.formatAnchors?.map((a) => `\`\`\`json\n${a}\n\`\`\``).join("\n\n");
      return `${toolName}:\n${examples}`;
    })
    .join("\n\n");

  return `FORMAT ANCHORS:\n\n${anchors}`;
}

export async function buildSystemPrompt(query: string = ""): Promise<string> {
  const toolContracts = TOOL_CONTRACTS.map(formatToolContract).join("\n\n---\n\n");
  const systemContext = await getSystemContext();
  const formatExamples = generateFormatAnchors();

  const personaId = settingsManager.get().persona;
  const persona = getPersona(personaId);
  const identityWithPersona = persona.prompt
    ? `${IDENTITY}\n\n${persona.prompt}`
    : IDENTITY;

  return `${identityWithPersona}

${toolContracts}

${RULES_AND_ESCALATION}

${AGENT_PROTOCOL}

${formatExamples}

LIVE SYSTEM CONTEXT:
${systemContext}`;
}
