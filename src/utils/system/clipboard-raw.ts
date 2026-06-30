import { logger } from "../../logger";

export function resolveClipboardBinary(): "clipcatctl" | "wl-copy" | "xclip" | null {
  const isWayland =
    !!Bun.env.WAYLAND_DISPLAY ||
    Bun.env.XDG_SESSION_TYPE === "wayland";

  if (Bun.which("clipcatctl")) return "clipcatctl";
  if (isWayland && Bun.which("wl-copy")) return "wl-copy";
  if (Bun.which("xclip")) return "xclip";
  if (isWayland && Bun.which("xclip")) return "xclip";
  if (!isWayland && Bun.which("wl-copy")) return "wl-copy";
  return null;
}

export async function copyRawErrorToClipboard(text: string): Promise<boolean> {
  const binary = resolveClipboardBinary();
  if (!binary) {
    logger.warn("ui", "Clipboard copy skipped: no clipboard utility found");
    return false;
  }

  if (binary === "clipcatctl") {
    try {
      const proc = Bun.spawn(["clipcatctl", "insert", text], {
        stdout: "ignore",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        logger.warn(
          "ui",
          `Clipboard copy failed (${binary} exited ${exitCode}): ${stderr.trim()}`
        );
        return false;
      }
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn("ui", `Clipboard copy failed (${binary}): ${msg}`);
      return false;
    }
  }

  const args = binary === "wl-copy" ? ["wl-copy"] : ["xclip", "-selection", "clipboard"];

  try {
    const proc = Bun.spawn(args, {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "pipe",
    });

    proc.stdin.write(new TextEncoder().encode(text));
    proc.stdin.end();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      logger.warn(
        "ui",
        `Clipboard copy failed (${binary} exited ${exitCode}): ${stderr.trim()}`
      );
      return false;
    }
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn("ui", `Clipboard copy failed (${binary}): ${msg}`);
    return false;
  }
}
