import { logger } from "../logger";
import { t, tf } from "../utils/i18n";
import type { ToolExecutionResult, FileMatch } from "../types";
import { join, basename } from "path";

type MusicAction =
  | { kind: "search"; query: string }
  | { kind: "play"; target: string }
  | { kind: "playlist"; name: string }
  | { kind: "ls"; type: "music" | "playlists" }
  | { kind: "queue" }
  | { kind: "status" }
  | { kind: "error"; message: string; stderr: string };

function buildResult(
  normalizedArg: string,
  message: string,
  success: boolean,
  init: Partial<ToolExecutionResult> = {}
): ToolExecutionResult {
  return {
    tool: "music",
    result: message,
    success,
    normalizedArg,
    ...init,
  };
}

async function spawnSafe(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode ?? 0 };
}

async function checkAvailability(cmd: string): Promise<boolean> {
  const proc = Bun.spawn(["which", cmd], { stdout: "ignore", stderr: "ignore" });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

function normalizeQuery(query: string): string {
  return query
    .replace(/^(please|tolong|putar|play|search|find|cari|song|lagu|music|musik)\s+/gi, "")
    .replace(/\s+(song|lagu|music|musik)$/gi, "")
    .trim();
}

function parseAction(arg: string): MusicAction {
  const trimmed = arg.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const cmd = parts[0]?.toLowerCase();

  if (!cmd) {
    return { kind: "status" };
  }

  if (cmd === "search") {
    const query = normalizeQuery(parts.slice(1).join(" "));
    if (!query) return { kind: "error", message: t("tool.result.invalid_request"), stderr: "Missing query" };
    return { kind: "search", query };
  }

  if (cmd === "play") {
    const target = normalizeQuery(parts.slice(1).join(" "));
    if (!target) return { kind: "error", message: t("tool.result.invalid_request"), stderr: "Missing target" };
    return { kind: "play", target };
  }

  if (cmd === "playlist") {
    const name = parts.slice(1).join(" ");
    if (!name) return { kind: "error", message: t("tool.result.invalid_request"), stderr: "Missing name" };
    return { kind: "playlist", name };
  }

  if (cmd === "ls" || cmd === "list") {
    const type = parts[1]?.toLowerCase() === "playlists" ? "playlists" : "music";
    return { kind: "ls", type };
  }

  if (cmd === "queue") {
    return { kind: "queue" };
  }

  if (cmd === "status" || cmd === "now") {
    return { kind: "status" };
  }

  if (cmd === "update") {
    return { kind: "ls", type: "music" }; // Trigger update before ls
  }

  return { kind: "error", message: `❌ Unknown music action: ${cmd}`, stderr: "Unknown action" };
}

export async function music(arg: string): Promise<ToolExecutionResult> {
  logger.info("music", `Executing action: ${arg}`);

  const action = parseAction(arg);
  if (action.kind === "error") {
    return buildResult(arg, action.message, false, { stderr: action.stderr, exitCode: 2 });
  }

  // Validate availability
  const hasMpc = await checkAvailability("mpc");
  if (!hasMpc) {
    return buildResult(arg, tf("error.with_message", { message: "'mpc' is not installed" }), false, {
      stderr: "mpc missing",
      exitCode: 127,
    });
  }

  const hasNcmpcpp = await checkAvailability("ncmpcpp");

  try {
    switch (action.kind) {
      case "status": {
        let display = "";
        if (hasNcmpcpp) {
          const res = await spawnSafe(["ncmpcpp", "--current-song"]);
          display = res.stdout || t("tool.result.no_song");
        } else {
          const res = await spawnSafe(["mpc", "current"]);
          display = res.stdout || t("tool.result.no_song");
        }
        const statusRes = await spawnSafe(["mpc", "status"]);
        return buildResult(arg, `${display}\n\n${statusRes.stdout}`, true, {
          command: "mpc status",
          stdout: statusRes.stdout,
        });
      }

      case "search": {
        const res = await spawnSafe(["mpc", "search", "any", action.query]);
        if (res.exitCode !== 0) {
          return buildResult(arg, tf("error.with_message", { message: res.stderr }), false, { stderr: res.stderr, exitCode: res.exitCode });
        }
        const files = res.stdout.split("\n").filter(Boolean);
        if (files.length === 0) {
          return buildResult(arg, t("tool.result.no_matches"), true, { status: "empty" });
        }
        const fileMatches: FileMatch[] = files.slice(0, 50).map(f => ({
          path: f,
          name: basename(f),
          directory: "",
          type: "file",
          hidden: false
        }));
        return buildResult(arg, tf("tool.result.tracks_found", { count: files.length }) + `\n${files.slice(0, 10).join("\n")}${files.length > 10 ? "\n..." : ""}`, true, {
          files: fileMatches,
          summary: { totalMatches: files.length, returnedMatches: fileMatches.length }
        });
      }

      case "play": {
        // If it's a number, play that position in queue. Otherwise search and play first match.
        if (/^\d+$/.test(action.target)) {
          const res = await spawnSafe(["mpc", "play", action.target]);
          return buildResult(arg, res.stdout || t("tool.result.playing_track"), res.exitCode === 0, {
            command: `mpc play ${action.target}`,
            exitCode: res.exitCode,
            stderr: res.stderr
          });
        } else {
          // Search and play first
          const searchRes = await spawnSafe(["mpc", "search", "any", action.target]);
          const firstFile = searchRes.stdout.split("\n")[0];
          if (!firstFile) {
             return buildResult(arg, tf("error.with_message", { message: "Track not found" }), false, { stderr: "Track not found", exitCode: 404 });
          }
          await spawnSafe(["mpc", "clear"]);
          await spawnSafe(["mpc", "add", firstFile]);
          const playRes = await spawnSafe(["mpc", "play"]);
          return buildResult(arg, tf("tool.result.playing", { name: firstFile }), playRes.exitCode === 0, {
            command: `mpc add "${firstFile}" && mpc play`,
            exitCode: playRes.exitCode,
            stderr: playRes.stderr
          });
        }
      }

      case "playlist": {
        const res = await spawnSafe(["mpc", "clear"]);
        const loadRes = await spawnSafe(["mpc", "load", action.name]);
        if (loadRes.exitCode !== 0) {
          return buildResult(arg, tf("error.with_message", { message: loadRes.stderr }), false, {
            stderr: loadRes.stderr,
            exitCode: loadRes.exitCode
          });
        }
        const playRes = await spawnSafe(["mpc", "play"]);
        return buildResult(arg, tf("tool.result.playing_playlist", { name: action.name }), playRes.exitCode === 0, {
          command: `mpc load "${action.name}" && mpc play`,
          exitCode: playRes.exitCode,
          stderr: playRes.stderr
        });
      }

      case "ls": {
        if (arg.includes("update")) {
          await spawnSafe(["mpc", "update"]);
        }
        if (action.type === "playlists") {
          const res = await spawnSafe(["mpc", "lsplaylists"]);
          return buildResult(arg, res.stdout || t("tool.result.no_playlists"), true);
        } else {
          const res = await spawnSafe(["mpc", "ls"]);
          return buildResult(arg, res.stdout || t("tool.result.library_empty"), true);
        }
      }

      case "queue": {
        const res = await spawnSafe(["mpc", "playlist"]);
        const currentRes = await spawnSafe(["mpc", "current"]);
        const message = `${t("tool.result.current_queue")}\n${res.stdout || "(empty)"}\n\n${t("tool.result.now_playing")} ${currentRes.stdout || "None"}`;
        return buildResult(arg, message, true, { stdout: res.stdout });
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("music", `Operation failed: ${err.message}`, err);
    return buildResult(arg, `❌ Error: ${err.message}`, false, { stderr: err.message, exitCode: 1 });
  }
}
