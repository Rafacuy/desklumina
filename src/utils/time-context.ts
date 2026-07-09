export type TimeBracket =
  | "early morning"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "late night";

/**
 * Returns a coarse label for the given hour (0-23, local time).
 */
export function getTimeBracket(hour: number): TimeBracket {
  if (hour >= 4 && hour < 7) return "early morning";
  if (hour >= 7 && hour < 11) return "morning";
  if (hour >= 11 && hour < 15) return "afternoon";
  if (hour >= 15 && hour < 19) return "evening";
  if (hour >= 19 && hour < 23) return "night";
  return "late night";
}

/**
 * Returns a single-line metadata string to inject into the system prompt.
 * Format is fixed and must not be changed (downstream tests may regex-match it).
 * Example: "Local time: 23:51 (late night)"
 */
export function getTimeContextLine(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const bracket = getTimeBracket(date.getHours());
  return `Local time: ${hh}:${mm} (${bracket})`;
}
