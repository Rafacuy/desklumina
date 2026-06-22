import { spawn } from "bun";

export type ColorScheme = "light" | "dark";

export interface ColorTokens {
  /** Main row labels */
  textPrimary: string;
  /** Values, sub-row labels */
  textSecondary: string;
  /** Section lines, hints */
  textMuted: string;
  /** Selected row accent bar */
  accentPurple: string;
  /** pill background */
  pillOnBg: string;
  /** pill text */
  pillOnFg: string;
  /** pill background */
  pillOffBg: string;
  /** pill text */
  pillOffFg: string;
}

const LIGHT_TOKENS: ColorTokens = {
  textPrimary: "#1a1a1a",
  textSecondary: "#6b6b6b",
  textMuted: "#a0a0a0",
  accentPurple: "#7F77DD",
  pillOnBg: "#d4f0e0",
  pillOnFg: "#1a6b3a",
  pillOffBg: "#e8e8e8",
  pillOffFg: "#888888",
};

const DARK_TOKENS: ColorTokens = {
  textPrimary: "#e8e8e8",
  textSecondary: "#888888",
  textMuted: "#555555",
  accentPurple: "#9F97ED",
  pillOnBg: "#1a3d2b",
  pillOnFg: "#4dbb7a",
  pillOffBg: "#2a2a2a",
  pillOffFg: "#666666",
};

export function getColorTokens(scheme: ColorScheme): ColorTokens {
  return scheme === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
}

async function gsettingsValue(schema: string, key: string): Promise<string | null> {
  try {
    const proc = spawn(["gsettings", "get", schema, key], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code === 0) {
      return output.trim();
    }
  } catch {
    // gsettings unavailable; fall through to defaults
  }
  return null;
}

/**
 * Resolve the active color scheme at runtime.
 *
 * First tries `org.gnome.desktop.interface color-scheme`, then falls back
 * to inspecting the GTK theme name.
 *
 * Defaults to light when neither source is available.
 */
export async function resolveColorScheme(): Promise<ColorScheme> {
  const colorScheme = await gsettingsValue("org.gnome.desktop.interface", "color-scheme");
  if (colorScheme) {
    const normalized = colorScheme.toLowerCase();
    if (normalized.includes("dark")) return "dark";
    if (normalized.includes("light")) return "light";
  }

  const gtkTheme = await gsettingsValue("org.gnome.desktop.interface", "gtk-theme");
  if (gtkTheme && gtkTheme.toLowerCase().includes("dark")) {
    return "dark";
  }

  return "light";
}
