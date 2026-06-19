import { logger } from "../../logger";

export type TerminalMode = "blocking" | "non-blocking" | "rejected";

export interface TerminalClassification {
  mode: TerminalMode;
  command: string;
  reason: string;
}

const GUI_APPS: ReadonlySet<string> = new Set([
  "alacritty", "kitty", "gnome-terminal", "konsole", "xfce4-terminal",
  "xterm", "urxvt", "rxvt", "st", "tilix", "terminator", "foot", "wezterm",
  "code", "code-insiders", "codium", "subl", "gedit", "geany", "kate",
  "gvim", "idea", "pycharm", "webstorm", "phpstorm", "clion", "android-studio",
  "firefox", "chrome", "google-chrome", "google-chrome-stable", "chromium",
  "chromium-browser", "brave", "brave-browser", "edge", "microsoft-edge",
  "opera", "vivaldi", "xdg-open",
  "mpv", "vlc", "smplayer", "totem", "rhythmbox", "spotify", "audacious",
  "thunar", "nautilus", "dolphin", "pcmanfm", "nemo", "caja",
  "telegram-desktop", "discord", "slack", "whatsapp", "thunderbird",
  "feh", "sxiv", "imv", "eog", "nomacs", "gthumb",
  "zathura", "evince", "okular", "mupdf",
  "libreoffice", "soffice",
  "pavucontrol", "blueman-manager", "nm-connection-editor", "gnome-control-center",
]);

const WRAPPERS: ReadonlySet<string> = new Set([
  "nohup", "exec", "command", "sudo", "nice", "ionice",
]);

function stripLeadingWrappers(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (WRAPPERS.has(t)) {
      i++;
      while (i < tokens.length && tokens[i]!.startsWith("-")) {
        const flag = tokens[i]!;
        i++;
        if (t === "sudo" && ["-u", "--user", "-g", "--group", "-C", "-p", "-U"].includes(flag)) {
          if (i < tokens.length && !tokens[i]!.startsWith("-")) i++;
        } else if (t === "nice" && ["-n", "--adjustment"].includes(flag)) {
          if (i < tokens.length && !tokens[i]!.startsWith("-")) i++;
        } else if (t === "ionice" && ["-c", "--class", "-n", "--classdata", "-p", "--pid", "-t"].includes(flag)) {
          if (i < tokens.length && !tokens[i]!.startsWith("-")) i++;
        }
      }
      continue;
    }
    if (t === "env") {
      i++;
      while (i < tokens.length && tokens[i]!.includes("=")) i++;
      continue;
    }
    break;
  }
  return tokens.slice(i);
}

function endsWithBackgroundMarker(command: string): boolean {
  return /&\s*$/.test(command.trim());
}

function stripBackgroundMarker(command: string): string {
  return command.replace(/\s*&\s*$/, "").trim();
}

function isInteractiveSsh(command: string): boolean {
  const trimmed = command.trim();
  if (!/^ssh\b/.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).slice(1);
  const nonFlagTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.startsWith("-")) {
      if (/[piLRDWbcFOmSoJl]/.test(t) && !t.includes("=") && i + 1 < tokens.length) {
        i++;
      }
      continue;
    }
    nonFlagTokens.push(t);
  }

  return nonFlagTokens.length <= 1;
}

function rewriteInteractiveInstaller(command: string): string | null {
  if (/\b(?:apt|apt-get)\s+install\b/.test(command) && !/(^|\s)-y\b/.test(command)) {
    return command.replace(/\b(apt|apt-get)(\s+)(install)\b/, "$1$2$3 -y");
  }
  if (/\bdnf\s+install\b/.test(command) && !/(^|\s)-y\b/.test(command)) {
    return command.replace(/\bdnf(\s+)(install)\b/, "dnf$1$2 -y");
  }
  if (/\byum\s+install\b/.test(command) && !/(^|\s)-y\b/.test(command)) {
    return command.replace(/\byum(\s+)(install)\b/, "yum$1$2 -y");
  }
  if (/\bpacman\s+(-S\w*|--sync)\b/.test(command) && !/--noconfirm\b/.test(command)) {
    return command.replace(/(\bpacman\s+)(-S\w*|--sync)\b/, "$1$2 --noconfirm");
  }
  return null;
}

export function classifyCommand(command: string): TerminalClassification {
  const trimmed = command.trim();
  if (!trimmed) {
    return { mode: "rejected", command, reason: "Empty command" };
  }

  if (isInteractiveSsh(trimmed)) {
    return {
      mode: "rejected",
      command,
      reason:
        "Interactive ssh session without a remote command would hang. Specify a remote command, e.g. ssh user@host 'ls'.",
    };
  }

  let working = trimmed;

  const background = endsWithBackgroundMarker(working);
  if (background) {
    working = stripBackgroundMarker(working);
  }

  const tokens = working.split(/\s+/);
  const stripped = stripLeadingWrappers(tokens);
  const leadingBinary = stripped[0] ?? "";
  const baseName = leadingBinary.split("/").pop() ?? "";
  const isGuiApp = baseName.length > 0 && GUI_APPS.has(baseName);

  if (background || isGuiApp) {
    const reason = background
      ? isGuiApp
        ? "trailing '&' and known GUI app"
        : "trailing '&'"
      : "known GUI application";
    return { mode: "non-blocking", command: working, reason };
  }

  const rewritten = rewriteInteractiveInstaller(working);
  if (rewritten) {
    logger.info("terminal-classify", `Rewrote interactive installer: '${working}' -> '${rewritten}'`);
    working = rewritten;
  }

  return { mode: "blocking", command: working, reason: "default blocking" };
}
