import { rgbFg } from "./ansi";
import { padRight } from "./text";

export interface ProviderTheme {
  readonly label: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const DEFAULT_THEME: ProviderTheme = { label: "UNKNOWN", r: 148, g: 163, b: 184 };

const THEMES: Readonly<Record<string, ProviderTheme>> = {
  groq: { label: "GROQ", r: 110, g: 231, b: 183 },
  openai: { label: "OPENAI", r: 125, g: 211, b: 252 },
  anthropic: { label: "ANTHROPIC", r: 216, g: 180, b: 254 },
};

export function providerTheme(providerId: string): ProviderTheme {
  const key = providerId.toLowerCase();
  return THEMES[key] ?? { ...DEFAULT_THEME, label: providerId.toUpperCase().slice(0, 10) };
}

export function formatProviderColumn(providerId: string, colorEnabled: boolean): string {
  const t = providerTheme(providerId);
  const padded = padRight(t.label, 10);
  return rgbFg(t.r, t.g, t.b, padded, colorEnabled);
}
