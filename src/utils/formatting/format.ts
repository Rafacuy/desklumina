import { t, tf } from "../localization/i18n";

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format date to relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return t("format.just_now");
  if (diffMins < 60) return tf("format.minutes_ago", { count: diffMins });
  if (diffHours < 24) return tf("format.hours_ago", { count: diffHours });
  if (diffDays < 7) return tf("format.days_ago", { count: diffDays });

  return date.toLocaleDateString();
}

/**
 * Truncate text with ellipsis (Unicode-safe)
 */
export function truncate(text: string, length: number): string {
  const chars = Array.from(text);
  if (chars.length <= length) return text;
  return chars.slice(0, length).join("") + "...";
}

/**
 * Remove music extensions and paths
 */
const AUDIO_EXT_RE = /\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i;

export function cleanTrackTitle(title: string | null): string | null {
  if (!title) return title;
  let cleaned = title.includes("/") ? title.split("/").pop()! : title;
  cleaned = cleaned.replace(AUDIO_EXT_RE, "");
  return cleaned || title;
}

/**
 * Escape special characters for display in Pango/HTML markup.
 * Uses a negative lookahead to avoid double-escaping common entities.
 */
export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
