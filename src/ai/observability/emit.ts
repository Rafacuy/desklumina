import { enqueueGeneralLogLine } from "../../logger";
import { colorEnabledForStream } from "./ansi";
import type { AiOrchestrationEvent } from "./events";
import { formatOrchestrationEvent } from "./format";
import { sanitizeOrchestrationValue } from "./sanitize";

function resolveLogMode(): "pretty" | "json" {
  const v = (Bun.env.DESKLUMINA_AI_LOG ?? "pretty").toLowerCase();
  return v === "json" ? "json" : "pretty";
}

export function emitOrchestrationLog(event: AiOrchestrationEvent, options?: { now?: Date }): void {
  const now = options?.now ?? new Date();
  const mode = resolveLogMode();
  const useStdout = event.severity !== "warn" && event.severity !== "error";
  const colorEnabled = colorEnabledForStream(useStdout);
  const { console: consoleLine, file } = formatOrchestrationEvent(event, { now, colorEnabled, mode }, sanitizeOrchestrationValue);
  enqueueGeneralLogLine(file);
  if (useStdout) {
    Bun.stdout.write(`${consoleLine}\n`);
  } else {
    Bun.stderr.write(`${consoleLine}\n`);
  }
}
