export interface StreamParser<TEvent = unknown> {
  parse(
    stream: ReadableStream<Uint8Array>,
    options: { provider: string; signal?: AbortSignal }
  ): AsyncGenerator<TEvent>;
}
