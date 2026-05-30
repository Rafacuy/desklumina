import { logger } from "../logger";
import { t, tf } from "../utils/i18n";
import type { ToolExecutionResult, TrackInfo } from "../types";

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
 * Music Intent
 */
interface MusicIntent {
  action: MediaAction;
  backend?: string;
}

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

    // Only trim trailing newlines to preserve tabs/internal whitespace
    const cleanedStdout = stdout.replace(/\r?\n$/, "");
    const cleanedStderr = stderr.replace(/\r?\n$/, "");
    const message = cleanedStdout.trim() || (exitCode === 0 ? t("tool.result.done") : cleanedStderr.trim());

    return {
      success: exitCode === 0,
      message,
      command,
      stdout,
      stderr,
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
    const trimmed = rawArg.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.current === true) {
          let backendsToQuery: ("mpc" | "playerctl")[] = ["mpc", "playerctl"];

          if (parsed.backends !== undefined) {
            if (Array.isArray(parsed.backends)) {
              if (parsed.backends.includes("all")) {
                backendsToQuery = ["mpc", "playerctl"];
              } else if (parsed.backends.every((b: any) => b === "mpc" || b === "playerctl")) {
                backendsToQuery = parsed.backends;
              } else {
                return {
                  tool: "music",
                  result: "❌ Malformed backends value",
                  success: false,
                  normalizedArg: rawArg,
                  stderr: "Malformed backends value",
                  exitCode: 2,
                };
              }
            } else {
              return {
                tool: "music",
                result: "❌ Malformed backends value",
                success: false,
                normalizedArg: rawArg,
                stderr: "Malformed backends value",
                exitCode: 2,
              };
            }
          } else {
            // Check if there are keys other than "current"
            const allowedKeys = new Set(["current", "backends"]);
            const hasInvalidKeys = Object.keys(parsed).some(k => !allowedKeys.has(k));
            if (hasInvalidKeys) {
              return {
                tool: "music",
                result: "❌ Malformed backends value",
                success: false,
                normalizedArg: rawArg,
                stderr: "Malformed input",
                exitCode: 2,
              };
            }
          }

          const tracks: TrackInfo[] = [];

          if (backendsToQuery.includes("mpc")) {
            const mpcTrack = await this.queryMPC();
            if (mpcTrack) tracks.push(mpcTrack);
          }

          if (backendsToQuery.includes("playerctl")) {
            const playerctlTracks = await this.queryPlayerctl();
            tracks.push(...playerctlTracks);
          }

          let activePrimaryBackend: "mpc" | "playerctl" | null = null;
          const mpcActive = tracks.some(t => t.backend === "mpc" && (t.status === "playing" || t.status === "paused"));
          const playerctlActive = tracks.some(t => t.backend === "playerctl" && (t.status === "playing" || t.status === "paused"));

          if (mpcActive) {
            activePrimaryBackend = "mpc";
          } else if (playerctlActive) {
            activePrimaryBackend = "playerctl";
          }

          const resultMessage = tracks.length > 0
            ? tf("tool.result.tracks_found", { count: tracks.length })
            : t("tool.result.no_song");

          return {
            tool: "music",
            result: resultMessage,
            success: true,
            normalizedArg: rawArg,
            extra: { tracks, activePrimaryBackend },
            exitCode: 0,
          };
        }
      } catch (e) {
        // Failed to parse or validate JSON, we let it fall through to action parsing.
      }
    }

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

    if (intent.backend) {
      const target = this.backends.find(b => b.name === intent.backend);
      if (!target) {
        return {
          tool: "music",
          result: `❌ Unknown backend name: ${intent.backend}`,
          success: false,
          normalizedArg: action,
          command: "",
          stderr: "Unknown backend name",
          exitCode: 2,
        };
      }
      if (!(await target.isAvailable())) {
        return {
          tool: "music",
          result: `❌ Backend not available: ${intent.backend}`,
          success: false,
          normalizedArg: action,
          command: "",
          stderr: "Explicit backend unavailable",
          exitCode: 1,
        };
      }
      const result = await target.execute(action);
      return {
        tool: "music",
        result: result.success ? result.message : `❌ ${result.message}`,
        success: result.success,
        normalizedArg: action,
        command: result.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        resolvedBackend: intent.backend as "mpc" | "playerctl",
      };
    }

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
            resolvedBackend: backend.name as "mpc" | "playerctl",
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
      command: lastError?.command || this.displayCommand(action),
      stderr: lastError?.stderr || "No backends available",
      exitCode: lastError?.exitCode || 1,
    };
  }

  private displayCommand(action: MediaAction): string {
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

    return ["mpc", ...actionMap[action]].join(" ");
  }

  /**
   * Resolves raw input into a strict MediaAction intent,
   * Supports both JSON {"action": "...", "backend": "..."} and natural language strings
   */
  private resolveIntent(arg: string): MusicIntent | null {
    const trimmed = arg.trim();

    // try parsing as structured JSON
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.action === "string") {
          const action = this.normalizeAction(parsed.action);
          if (action) {
            const intent: MusicIntent = { action };
            if (parsed.backend) {
              intent.backend = parsed.backend;
            }
            return intent;
          }
        }
      } catch (e) {
        logger.debug("music", "Failed to parse arg as JSON, falling back to string mapping");
      }
    }

    // Fallback to robust string mapping (Resiliency Layer)
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

  private async queryMPC(): Promise<TrackInfo | null> {
    if (!(await commandExists("mpc"))) return null;

    const statusRes = await runCommand(["mpc", "status"]);
    if (!statusRes.success) return null;

    const lines = statusRes.stdout.split("\n").filter(l => l.trim());
    const statusLine = lines[1];
    if (!statusLine) return null;

    let status: "playing" | "paused" | "stopped" = "stopped";
    if (statusLine.includes("[playing]")) status = "playing";
    else if (statusLine.includes("[paused]")) status = "paused";

    if (status === "stopped") return null;

    let elapsed: string | null = null;
    let duration: string | null = null;
    const timeMatch = statusLine.match(/(\d+:\d+)\/(\d+:\d+)/);
    if (timeMatch) {
      elapsed = timeMatch[1] ?? null;
      duration = timeMatch[2] ?? null;
    }

    return {
      backend: "mpc",
      player: "mpd",
      status,
      title: lines[0]?.trim() || null,
      artist: null,
      album: null,
      duration,
      elapsed,
    };
  }

  private async queryPlayerctl(): Promise<TrackInfo[]> {
    if (!(await commandExists("playerctl"))) return [];

    const listRes = await runCommand(["playerctl", "-l"]);
    if (!listRes.success || !listRes.stdout.trim()) return [];

    const players = listRes.stdout.trim().split("\n").map(p => p.trim()).filter(Boolean);
    const tracks: TrackInfo[] = [];

    const formatTime = (usStr: string) => {
        const us = parseInt(usStr, 10);
        if (isNaN(us)) return null;
        const secs = Math.floor(us / 1000000);
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    for (const player of players) {
      const metaRes = await runCommand([
        "playerctl",
        "-p",
        player,
        "metadata",
        "--format",
        "{{status}}\\t{{title}}\\t{{artist}}\\t{{album}}\\t{{position}}\\t{{mpris:length}}"
      ]);

      if (metaRes.success && metaRes.stdout.trim()) {
        const rawOutput = metaRes.stdout.replace(/\r?\n$/, "");
        const parts = rawOutput.split("\t");
        const rawStatus = (parts[0] || "").toLowerCase();
        let status: "playing" | "paused" | "stopped" = "stopped";
        if (rawStatus === "playing") status = "playing";
        else if (rawStatus === "paused") status = "paused";

        tracks.push({
          backend: "playerctl",
          player,
          status,
          title: parts[1]?.trim() || null,
          artist: parts[2]?.trim() || null,
          album: parts[3]?.trim() || null,
          elapsed: parts[4] ? formatTime(parts[4]) : null,
          duration: parts[5] ? formatTime(parts[5]) : null,
        });
      }
    }
    return tracks;
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
