import { ProviderParseError } from "../errors";
import type { StreamParser } from "./parser";

export interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
}

export class SSEStreamParser implements StreamParser<SSEEvent> {
  async *parse(
    stream: ReadableStream<Uint8Array>,
    options: { provider: string; signal?: AbortSignal }
  ): AsyncGenerator<SSEEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readEvent = (rawEvent: string): SSEEvent | null => {
      const data: string[] = [];
      let event: string | undefined;
      let id: string | undefined;

      for (const line of rawEvent.split(/\r?\n/)) {
        if (!line || line.startsWith(":")) continue;
        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");

        if (field === "data") data.push(value);
        if (field === "event") event = value;
        if (field === "id") id = value;
      }

      if (data.length === 0) return null;
      return { data: data.join("\n"), event, id };
    };

    try {
      while (!options.signal?.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const event = readEvent(rawEvent);
          if (event) yield event;
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const event = readEvent(buffer);
        if (event) yield event;
      }
    } catch (error) {
      throw new ProviderParseError({
        provider: options.provider,
        message: "Failed to read provider SSE stream",
        cause: error,
      });
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Stream reader cancel failure is non-critical
      } finally {
        reader.releaseLock();
      }
    }
  }
}

// Keep the function export for backward compatibility during refactoring
export async function* parseSSEEvents(
  stream: ReadableStream<Uint8Array>,
  options: { provider: string; signal?: AbortSignal }
): AsyncGenerator<SSEEvent> {
  const parser = new SSEStreamParser();
  yield* parser.parse(stream, options);
}
