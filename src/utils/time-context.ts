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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function relativeDayLabel(date: Date): string {
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(today)) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1) return `in ${diffDays} days`;
  return `${-diffDays} days ago`;
}

/**
 * Returns a single-line date metadata string to inject into the system prompt,
 * helping the model resolve relative phrases like "last week" or "tomorrow".
 * Example: "Local date: Wednesday, July 8, 2026 (today)"
 */
export function getDateContextLine(date: Date = new Date()): string {
  const weekday = WEEKDAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  return `Local date: ${weekday}, ${month} ${date.getDate()}, ${date.getFullYear()} (${relativeDayLabel(date)})`;
}
