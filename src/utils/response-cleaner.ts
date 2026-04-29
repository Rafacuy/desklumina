/**
 * Utility for cleaning AI assistant responses
 */

/**
 * Clean assistant response by removing tool calls, JSON blocks, and other metadata
 */
export function cleanAssistantResponse(text: string): string {
  if (!text) return "";

  return text
    .replace(/```json\s*\n[\s\S]*?\n```/g, "")
    .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
    .replace(/(^|\n)Status:\s.*?(?=\n\n|$)/gis, "")
    .replace(/(^|\n)Summary:\s.*?(?=\n|$)/gis, "")
    .replace(/(^|\n)Actions:\s.*?(?=\n|$)/gis, "")
    .replace(/(^|\n)Results:\s*\n(?:\d+\.\s.*\n?)+/gis, "\n")
    .replace(/^━+$/gm, "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();
}
