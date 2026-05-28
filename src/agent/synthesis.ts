import { streamAI } from "../ai";
import type { AIMessage } from "../types";

export const SYNTHESIS_PROMPT = [
  "You have reached the maximum number of reasoning steps.",
  "Based on everything gathered so far, produce the best possible final answer.",
  "Do not emit any tool calls.",
  "End your response with [[DONE]].",
].join("\n");

export async function* synthesizeWithHistory(history: AIMessage[]): AsyncGenerator<string> {
  const synthesisHistory = [
    ...history,
    { role: "user" as const, content: SYNTHESIS_PROMPT },
  ];

  for await (const chunk of streamAI(synthesisHistory)) {
    yield chunk;
  }
}
