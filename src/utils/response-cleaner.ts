/**
 * Utility for cleaning AI assistant responses
 */

/**
 * Clean assistant response by removing tool calls, JSON blocks, and other metadata
 */
export function cleanAssistantResponse(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove terminal markers
  cleaned = cleaned
    .replace(/\[\[DONE\]\]/g, "")
    .replace(/\[\[FAIL:.*?\]\]/g, "");

  // 2. Remove markdown tool calls (lenient: optional json tag, optional newlines)
  cleaned = cleaned.replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, (match, content) => {
    // Only remove if it looks like a tool call to avoid removing random code/text blocks
    if (content.includes('"tool"') || content.includes('"args"')) {
      return "";
    }
    return match;
  });

  // 3. Remove raw JSON tool calls (when not in code blocks)
  // We use a similar heuristic to the planner
  cleaned = cleaned.replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, (match) => {
    if (match.includes('"tool"') && (match.includes('"args"') || match.includes('"action"'))) {
      return "";
    }
    return match;
  });

  return cleaned
    .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
    .replace(/\n?Status:\s.*?(?=\n\n|$)/gis, "")
    .replace(/\n?Summary:\s.*?(?=\n|$)/gis, "")
    .replace(/\n?Actions:\s.*?(?=\n|$)/gis, "")
    .replace(/\n?Results:\s*\n(?:\d+\.\s[a-zA-Z0-9._\-\/ ]+\n?)+/gis, "")
    .replace(/^\s+·\s.+$/gm, "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();
}
