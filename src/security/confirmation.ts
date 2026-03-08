import { spawn } from "bun";
import { logger } from "../logger";

const THEME_PATH = `${process.env.HOME}/.config/bspwm/agent/src/ui/themes/lumina.rasi`;

type Severity = "critical" | "high" | "medium";
type AlertSeverity = "info" | "warning" | "error";

/**
 * Show confirmation dialog using Rofi
 */
export async function rofiConfirm(
  title: string,
  message: string,
  severity: Severity = "high"
): Promise<boolean> {
  const severityIcon =
    severity === "critical" ? "⛔" : severity === "high" ? "⚠️" : "⚡";
  const severityLabel = severity.toUpperCase();

  const mesg = [
    `${severityIcon} <b>${title}</b>`,
    ``,
    `${message}`,
    ``,
    `Tingkat: <b>${severityLabel}</b>`,
  ].join("\n");

  const options = ["✓ Lanjutkan", "✕ Batalkan"];

  const themeOverride = [
    "window { width: 420px; }",
    "listview { lines: 2; }",
    'message { padding: 10px 14px; background-color: #ffffff; font: "JetBrainsMono Nerd Font 9"; }',
  ].join(" ");

  const proc = spawn(
    [
      "rofi",
      "-dmenu",
      "-p",
      `${severityIcon} Konfirmasi`,
      "-mesg",
      mesg,
      "-markup-rows",
      "-theme",
      THEME_PATH,
      "-theme-str",
      themeOverride,
      "-i",
      "-no-custom",
    ],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  proc.stdin.write(options.join("\n"));
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const result = output.trim();

  logger.info("security", `Konfirmasi: "${title}" → Respon: "${result}"`);

  return result === "✓ Lanjutkan";
}

/**
 * Show alert dialog using Rofi
 */
export async function rofiAlert(
  title: string,
  message: string,
  severity: AlertSeverity = "info"
): Promise<void> {
  const severityIcon =
    severity === "error" ? "❌" : severity === "warning" ? "⚠️" : "ℹ️";

  const fullMessage = `${severityIcon} ${title}\n\n${message}`;

  const proc = spawn(
    [
      "rofi",
      "-e",
      fullMessage,
      "-theme",
      THEME_PATH,
      "-theme-str",
      "window { width: 400px; }",
    ],
    {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    }
  );

  await proc.exited;
}

/**
 * Alias for rofiConfirm for backward compatibility
 */
export async function confirmDangerousCommand(
  title: string,
  message: string,
  severity: Severity
): Promise<boolean> {
  return rofiConfirm(title, message, severity);
}
