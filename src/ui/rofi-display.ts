import { spawn } from "bun";
import { getThemePath } from "./theme-cache";
import { escapeHtml } from "../utils/formatting/format";
import { markdownToPango } from "../utils/formatting/pango";
import { t } from "../utils/localization/i18n";
import { randomLoader, randomLoaderImage } from "./loader";

function escapeRasiString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function rofiDisplay(message: string): Promise<void> {
  const cleanMessage = message
    .replace(/^\s+·\s.+$/gm, "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();

  const formattedMessage = `<b>󱜙 ${escapeHtml(t("common.lumina"))}</b>\n${"─".repeat(40)}\n\n${markdownToPango(cleanMessage)}`;
  const proc = spawn([
    "rofi", "-e", formattedMessage,
    "-markup",
    "-theme", getThemePath(),
    "-theme-str", `
      window {
        width: 500px;
        height: 400px;
        border-radius: 18px;
        border: 1px;
        border-color: @border-subtle;
        background-color: @bg;
      }
      mainbox {
        children: [textbox];
        padding: 24px;
        background-color: transparent;
      }
      textbox {
        background-color: transparent;
        text-color: @text-primary;
        font: "JetBrainsMono Nerd Font 10";
        expand: true;
        vertical-align: 0.5;
        horizontal-align: 0.5;
        padding: 0;
        margin: 0;
        wrap: true;
      }
    `
  ], {
    stdio: ["ignore", "ignore", "ignore"],
  });

  await proc.exited;
}   

export function spawnLoaderOverlay(): ReturnType<typeof spawn> {
  const loaderImage = randomLoaderImage();
  const loaderTheme = loaderImage
    ? `
      window {
        location: southeast;
        anchor: southeast;
        width: 360px;
        border-radius: 0px;
        border: 0px;
        background-color: transparent;
        x-offset: -15px;
        y-offset: -15px;
      }
      mainbox {
        orientation: vertical;
        children: [icon-loader, loader-frame];
        padding: 0px;
        spacing: 0px;
        background-color: transparent;
      }
      icon-loader {
        filename: "${escapeRasiString(loaderImage)}";
        width: 200px;
        size: 200px;
        expand: false;
        horizontal-align: 0.5;
        vertical-align: 1.0;
        margin: 0px;
        padding: 0px;
        border: 0px;
        background-color: transparent;
      }
      loader-frame {
        orientation: vertical;
        children: [message];
        padding: 0px;
        spacing: 0px;
        margin: 0px;
        border: 1px;
        border-radius: 20px;
        border-color: @border-subtle;
        background-color: @bg;
      }
      inputbar {
        enabled: false;
      }
      listview {
        enabled: false;
      }
      message {
        padding: 14px 20px;
        border: 0px;
        border-radius: 0px;
        background-color: transparent;
      }
      textbox {
        text-color: @accent-color;
        font: "JetBrainsMono Nerd Font Medium 10";
        horizontal-align: 0.5;
        vertical-align: 0.5;
        wrap: false;
      }
    `
    : `
      window {
        location: southeast;
        anchor: southeast;
        width: 360px;
        height: 52px;
        border-radius: 20px;
        border: 1px;
        border-color: @border-subtle;
        background-color: @bg;
        x-offset: -15px;
        y-offset: -15px;
      }
      mainbox {
        children: [message];
        padding: 0px;
        spacing: 0px;
      }
      inputbar {
        enabled: false;
      }
      listview {
        enabled: false;
      }
      message {
        padding: 14px 20px;
        background-color: transparent;
      }
      textbox {
        text-color: @accent-color;
        font: "JetBrainsMono Nerd Font Medium 10";
        horizontal-align: 0.5;
        vertical-align: 0.5;
        wrap: false;
      }
    `;

  const proc = spawn([
    "rofi", "-dmenu",
    "-theme", getThemePath(),
    "-theme-str", loaderTheme,
    "-mesg", escapeHtml(randomLoader()),
  ], { stdin: "pipe", stdout: "pipe" });
  proc.stdin.end();
  return proc;
}