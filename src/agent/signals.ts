import type { TerminalSignal } from "./types";

export function detectTerminalSignal(text: string): TerminalSignal {
  if (text.includes("[[DONE]]")) return { type: "DONE" };
  if (text.includes("[[FAIL:")) return { type: "FAIL", reason: extractReason(text, "FAIL") };
  return { type: "NONE" };
}

export function extractReason(text: string, marker: string): string {
  const markerStart = text.indexOf(`[[${marker}:`);
  if (markerStart < 0) return "Unknown reason";
  const start = markerStart + marker.length + 3;
  const end = text.indexOf("]]", start);
  if (end < 0 || start >= end) return "Unknown reason";
  return text.slice(start, end).trim();
}

export function stripMarkers(text: string): string {
  return text
    .replace(/\[\[DONE\]\]/g, "")
    .replace(/\[\[FAIL:.*?\]\]/g, "")
    .trim();
}

export function stripMarkersForDisplay(text: string): string {
  return text
    .replace(/\[\[DONE\]\]/g, "")
    .replace(/\[\[FAIL:.*?\]\]/g, "")
    .trim();
}
