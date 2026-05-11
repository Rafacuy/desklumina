import { logger } from "../logger";

export interface StreamChunk {
  content?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            const usage = parsed.usage;

            if (content) yield { content };
            if (usage) yield { usage };
          } catch (err) {
            logger.warn("stream", `Failed to parse SSE chunk: ${data.slice(0, 200)}`);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
