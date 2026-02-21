import { env } from "../config/env";
import { logger } from "../logger";
import { parseSSE } from "./stream";

export class GroqAPIError extends Error {
  constructor(public statusCode: number, public body: string) {
    super(`Groq API Error ${statusCode}: ${body}`);
  }
}

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function* streamGroq(messages: Message[]): AsyncGenerator<string> {
  logger.info("groq", `Mengirim request ke Groq dengan model ${env.MODEL_NAME}`);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.MODEL_NAME,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error("groq", `API error: ${response.status} - ${body}`);
    throw new GroqAPIError(response.status, body);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  yield* parseSSE(response.body);
}
