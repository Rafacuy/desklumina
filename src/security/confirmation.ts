import { spawn } from "bun";
import { logger } from "../logger";
import { settingsManager } from "../core/settings-manager";
import { t } from "../utils/i18n";
import { CancellationError } from "../types";

const THEME_PATH = `${process.env.HOME}/.config/desklumina/src/ui/themes/lumina.rasi`;

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
  const settings = settingsManager.get();
  
  // If dangerous command confirmation is disabled, auto-approve
  if (!settings.features.dangerousCommandConfirmation) {
    logger.info("security", `Auto-approved (feature disabled): "${title}"`);
    return true;
  }
  
  const severityIcon =
    severity === "critical" ? "󰀦" : severity === "high" ? "󱈸" : "󱐌";
  const iconColor = 
    severity === "critical" ? "#ef4444" : severity === "high" ? "#f59e0b" : "#3b82f6";
  const bgColor = 
    severity === "critical" ? "#fee2e2" : severity === "high" ? "#fef3c7" : "#dbeafe";

  const hints = `<span size='small' foreground='#94a3b8'>\n\n󰌑   ${t("Select")}  │  󱊷   ${t("Cancel")}</span>`;
  const mesg = `<span foreground='${iconColor}' size='xx-large'>${severityIcon}</span>\n<span weight='bold' size='large'>${t(title)}</span>\n\n${message}${hints}`;

  const proceedLabel = `󰄬 ${t("Proceed")}`;
  const cancelLabel = `󰅖 ${t("Cancel")}`;
  const options = [proceedLabel, cancelLabel];
 
  if (!(await Bun.which("rofi"))) {
    throw new Error(`${t("rofi is not installed")}. ${t("Please install it to use security confirmations")}.`);
  }

  const themeOverride = [
    `window { width: 500px; border: 2px; border-radius: 24px; border-color: ${iconColor}; background-color: @bg; }`,
    "mainbox { children: [message, listview]; padding: 10px; }",
    `message { padding: 40px 40px 20px 40px; background-color: ${bgColor}44; border: 0; border-radius: 16px; margin: 10px; }`,
    "textbox { horizontal-align: 0.5; text-color: @text-primary; font: 'JetBrainsMono Nerd Font 11'; }",
    "listview { lines: 2; spacing: 16px; padding: 20px 40px 30px 40px; fixed-height: true; background-color: transparent; }",
    "element { padding: 16px; border-radius: 14px; background-color: @surface; border: 1px solid; border-color: @border-subtle; }",
    `element selected { background-color: ${iconColor}; text-color: @white; border-color: ${iconColor}; }`,
    "element-text { horizontal-align: 0.5; font: 'JetBrainsMono Nerd Font Bold 11'; text-color: inherit; }",
  ].join(" ");

  const proc = spawn(
    [
      "rofi",
      "-dmenu",
      "-p",
      `${severityIcon} ${t("Confirm")}`,
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
    }
  );

  proc.stdin.write(options.join("\n"));
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const result = output.trim();

  logger.info("security", `Confirmation: "${title}" → Response: "${result}"`);

  if (result !== proceedLabel) {
    throw new CancellationError(`${t("Operation cancelled by user")}: ${title}`);
  }

  return true;
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

  const themeOverride = [
    "window { width: 440px; border: 1px; border-radius: 16px; border-color: @accent-color; }",
    "mainbox { children: [message]; }",
    "message { padding: 24px; }",
    "textbox { horizontal-align: 0.5; }",
  ].join(" ");

  const proc = spawn(
    [
      "rofi",
      "-e",
      fullMessage,
      "-theme",
      THEME_PATH,
      "-theme-str",
      themeOverride,
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
