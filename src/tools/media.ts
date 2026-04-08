import { execute } from "./terminal";
import { logger } from "../logger";
import type { ToolExecutionResult } from "../types";

type MediaAction =
  | { kind: "simple"; normalizedArg: string; command: string }
  | { kind: "volume"; normalizedArg: string; command: string }
  | { kind: "search"; normalizedArg: string; command: string }
  | { kind: "error"; normalizedArg: string; message: string; stderr: string; exitCode: number };

function buildResult(
  normalizedArg: string,
  message: string,
  success: boolean,
  command?: string,
  stdout?: string,
  stderr?: string,
  exitCode?: number
): ToolExecutionResult {
  return {
    tool: "media",
    result: message,
    success,
    normalizedArg,
    command,
    stdout,
    stderr,
    exitCode,
  };
}

function normalizeVolumeArg(value: string): string | null {
  if (/^[+-]\d{1,3}$/.test(value)) {
    return value;
  }

  if (/^\d{1,3}$/.test(value)) {
    const amount = Number(value);
    if (amount >= 0 && amount <= 100) {
      return String(amount);
    }
  }

  return null;
}

function parseVolume(action: string, parts: string[]): MediaAction {
  const lowerAction = action.toLowerCase().trim();

  if (/^(volume|set volume)(\s+to)?\s+\d{1,3}$/.test(lowerAction)) {
    const candidate = normalizeVolumeArg(parts[parts.length - 1] || "");
    if (candidate) {
      return {
        kind: "volume",
        normalizedArg: `volume ${candidate}`,
        command: `mpc volume ${candidate}`,
      };
    }
  }

  if (/(volume|sound).*(up|increase|raise|louder)/.test(lowerAction)) {
    return {
      kind: "volume",
      normalizedArg: "volume +10",
      command: "mpc volume +10",
    };
  }

  if (/(volume|sound).*(down|decrease|lower|quieter)/.test(lowerAction)) {
    return {
      kind: "volume",
      normalizedArg: "volume -10",
      command: "mpc volume -10",
    };
  }

  if (parts[0]?.toLowerCase() === "volume") {
    const candidate = normalizeVolumeArg(parts[1] || "");
    if (candidate) {
      return {
        kind: "volume",
        normalizedArg: `volume ${candidate}`,
        command: `mpc volume ${candidate}`,
      };
    }
  }

  return {
    kind: "error",
    normalizedArg: action.trim(),
    message: "❌ Invalid volume format. Use volume <0-100 | +N | -N>.",
    stderr: "Invalid volume format",
    exitCode: 2,
  };
}

function normalizeAction(action: string): MediaAction {
  const trimmed = action.trim();
  const lower = trimmed.toLowerCase();
  const parts = lower.split(/\s+/).filter(Boolean);
  const first = parts[0];

  if (!first) {
    return {
      kind: "error",
      normalizedArg: "",
      message: "❌ Media action is required.",
      stderr: "Missing media action",
      exitCode: 2,
    };
  }

  const simpleMap: Record<string, string> = {
    play: "mpc play",
    pause: "mpc pause",
    toggle: "mpc toggle",
    stop: "mpc stop",
    next: "mpc next",
    prev: "mpc prev",
    previous: "mpc prev",
    current: "mpc current",
    now: "mpc current",
    queue: "mpc playlist",
    playlist: "mpc playlist",
  };

  if (first === "volume" || lower.startsWith("set volume") || /(volume|sound).*(up|down|increase|decrease|raise|lower|louder|quieter)/.test(lower)) {
    return parseVolume(trimmed, parts);
  }

  if (first === "search") {
    const query = trimmed.slice("search".length).trim();
    if (!query) {
      return {
        kind: "error",
        normalizedArg: trimmed,
        message: "❌ Search requires a query.",
        stderr: "Missing media search query",
        exitCode: 2,
      };
    }

    const escapedQuery = query.replace(/"/g, '\\"');
    return {
      kind: "search",
      normalizedArg: `search ${query}`,
      command: `mpc search any "${escapedQuery}"`,
    };
  }

  const command = simpleMap[first];
  if (command) {
    return {
      kind: "simple",
      normalizedArg: first === "now" ? "current" : first === "playlist" ? "queue" : first,
      command,
    };
  }

  return {
    kind: "error",
    normalizedArg: trimmed,
    message: "❌ Unknown media action. Supported actions: play, pause, toggle, stop, next, prev, current, queue, search, volume <0-100 | +N | -N>.",
    stderr: "Unknown media action",
    exitCode: 2,
  };
}

export async function media(action: string): Promise<ToolExecutionResult> {
  logger.info("media", `Action: ${action}`);

  try {
    const normalized = normalizeAction(action);
    if (normalized.kind === "error") {
      logger.warn("media", normalized.stderr);
      return buildResult(
        normalized.normalizedArg,
        normalized.message,
        false,
        undefined,
        undefined,
        normalized.stderr,
        normalized.exitCode
      );
    }

    logger.info("media", `Normalized "${action}" -> "${normalized.normalizedArg}"`);
    const commandResult = await execute(normalized.command);

    if (commandResult.exitCode !== 0) {
      const errorMessage = `❌ Error: ${commandResult.stderr || "Command failed"}`;
      logger.warn("media", `Command failed: ${normalized.command} -> ${commandResult.stderr}`);
      return buildResult(
        normalized.normalizedArg,
        errorMessage,
        false,
        normalized.command,
        commandResult.stdout,
        commandResult.stderr,
        commandResult.exitCode
      );
    }

    const output = commandResult.stdout?.trim() || "✓ Done";
    return buildResult(
      normalized.normalizedArg,
      output,
      true,
      normalized.command,
      commandResult.stdout,
      commandResult.stderr,
      0
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("media", `Media operation failed: ${err.message}`, err);
    return buildResult(action.trim(), `❌ Error: ${err.message}`, false, undefined, undefined, err.message, 1);
  }
}
