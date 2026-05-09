import { logger } from "../logger";
import { t } from "../utils/i18n";
import type { ToolExecutionResult } from "../types";

/**
 * Supported Media Actions
 */
type MediaAction =
  | "play"
  | "resume"
  | "pause"
  | "stop"
  | "next"
  | "prev"
  | "volume_up"
  | "volume_down";

/**
 * Internal result for backend execution
 */
interface BackendResult {
  success: boolean;
  message: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Backend interface for media control
 */
interface MediaBackend {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  execute(action: MediaAction): Promise<BackendResult>;
}

/**
 * Helper to check if a command exists in PATH
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", cmd], { stdout: "ignore", stderr: "ignore" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

/**
 * Helper to run a command and capture output
 */
async function runCommand(args: string[]): Promise<BackendResult> {
  const command = args.join(" ");
  try {
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const trimmedStdout = stdout.trim();
    const trimmedStderr = stderr.trim();

    return {
      success: exitCode === 0,
      message: trimmedStdout || (exitCode === 0 ? t("tool.result.done") : trimmedStderr),
      command,
      stdout: trimmedStdout,
      stderr: trimmedStderr,
      exitCode: exitCode ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message,
      command,
      stdout: "",
      stderr: message,
      exitCode: 1,
    };
  }
}

/**
 * MPC/MPD Backend implementation
 */
class MPCBackend implements MediaBackend {
  readonly name = "mpc";

  async isAvailable(): Promise<boolean> {
    if (!(await commandExists("mpc"))) return false;
    // Check if MPD is actually reachable and responsive
    const res = await runCommand(["mpc", "status"]);
    return res.success;
  }

  async execute(action: MediaAction): Promise<BackendResult> {
    const actionMap: Record<MediaAction, string[]> = {
      play: ["play"],
      resume: ["play"],
      pause: ["pause"],
      stop: ["stop"],
      next: ["next"],
      prev: ["prev"],
      volume_up: ["volume", "+5"],
      volume_down: ["volume", "-5"],
    };

    return runCommand(["mpc", ...actionMap[action]]);
  }
}

/**
 * Playerctl (MPRIS) Backend implementation
 */
class PlayerctlBackend implements MediaBackend {
  readonly name = "playerctl";

  async isAvailable(): Promise<boolean> {
    if (!(await commandExists("playerctl"))) return false;
    // Check if there are any active players that playerctl can control
    const res = await runCommand(["playerctl", "status"]);
    return res.success;
  }

  async execute(action: MediaAction): Promise<BackendResult> {
    const actionMap: Record<MediaAction, string[]> = {
      play: ["play"],
      resume: ["play"],
      pause: ["pause"],
      stop: ["stop"],
      next: ["next"],
      prev: ["prev"],
      volume_up: ["volume", "0.05+"],
      volume_down: ["volume", "0.05-"],
    };

    return runCommand(["playerctl", ...actionMap[action]]);
  }
}

/**
 * Generalized Media Controller with fallback logic and intent resolution
 */
class MediaController {
  private backends: MediaBackend[];

  constructor() {
    this.backends = [new MPCBackend(), new PlayerctlBackend()];
  }

  async handle(rawArg: string): Promise<ToolExecutionResult> {
    const intent = this.resolveIntent(rawArg);
    
    if (!intent) {
      logger.warn("music", `Invalid or unsupported media action: ${rawArg}`);
      return {
        tool: "music",
        result: `❌ Unknown media action: ${rawArg}. Supported: play, resume, pause, stop, next, prev, volume up, volume down.`,
        success: false,
        normalizedArg: rawArg.trim(),
        stderr: "Unknown action",
        exitCode: 2,
      };
    }

    const action = intent.action;
    let lastError: BackendResult | null = null;

    for (const backend of this.backends) {
      logger.debug("music", `Attempting action "${action}" via backend: ${backend.name}`);
      
      if (await backend.isAvailable()) {
        const result = await backend.execute(action);
        
        if (result.success) {
          logger.info("music", `Successfully executed "${action}" via ${backend.name}`);
          return {
            tool: "music",
            result: result.message,
            success: true,
            normalizedArg: action,
            command: result.command,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          };
        }

        lastError = result;
        logger.warn("music", `${backend.name} execution failed: ${result.stderr}`);
        // Continue to fallback backend
      } else {
        logger.debug("music", `Backend ${backend.name} is not available or has no active players`);
      }
    }

    const errorMsg = lastError?.message || "No available media players found (checked: mpc, playerctl)";
    return {
      tool: "music",
      result: `❌ ${errorMsg}`,
      success: false,
      normalizedArg: action,
      stderr: lastError?.stderr || "No backends available",
      exitCode: lastError?.exitCode || 1,
    };
  }

  /**
   * Resolves raw input into a strict MediaAction intent.
   * Supports both JSON {"action": "..."} and natural language strings.
   */
  private resolveIntent(arg: string): { action: MediaAction } | null {
    const trimmed = arg.trim();

    // 1. Try parsing as structured JSON (Primary Inference Format)
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.action === "string") {
          const action = this.normalizeAction(parsed.action);
          if (action) return { action };
        }
      } catch (e) {
        logger.debug("music", "Failed to parse arg as JSON, falling back to string mapping");
      }
    }

    // 2. Fallback to robust string mapping (Resiliency Layer)
    const action = this.normalizeAction(trimmed);
    return action ? { action } : null;
  }

  private normalizeAction(input: string): MediaAction | null {
    const n = input.toLowerCase().replace(/_/g, " ").trim();
    
    // Exact mappings and common aliases
    const map: Record<string, MediaAction> = {
      "play": "play",
      "resume": "resume",
      "continue": "resume",
      "pause": "pause",
      "stop": "stop",
      "next": "next",
      "skip": "next",
      "prev": "prev",
      "previous": "prev",
      "back": "prev",
      "volume up": "volume_up",
      "vol up": "volume_up",
      "louder": "volume_up",
      "increase volume": "volume_up",
      "volume down": "volume_down",
      "vol down": "volume_down",
      "quieter": "volume_down",
      "decrease volume": "volume_down",
      "lower volume": "volume_down"
    };

    // Check direct map
    if (map[n]) return map[n];

    // Typo/Slang resilience
    if (n.includes("stop") || n.includes("shut") || n.includes("quit") || n.includes("off")) return "stop";
    if (n.includes("resume") || n.includes("continue")) return "resume";
    if (n.includes("pause") || n.includes("wait")) return "pause";
    if (n.includes("play") || n.includes("start")) return "play";
    if (n.includes("next") || n.includes("skip")) return "next";
    if (n.includes("prev") || n.includes("back")) return "prev";
    if (n.includes("up") || n.includes("loud") || n.includes("raise")) return "volume_up";
    if (n.includes("down") || n.includes("quiet") || n.includes("lower")) return "volume_down";

    return null;
  }
}

const controller = new MediaController();

/**
 * Universal media control tool.
 * Prioritizes MPC/MPD, fallbacks to playerctl (Spotify, Browsers, VLC, etc.).
 */
export async function music(arg: string): Promise<ToolExecutionResult> {
  logger.info("music", `Executing action: ${arg}`);
  return controller.handle(arg);
}
