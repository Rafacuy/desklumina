export function createStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

export function createMockFetch(response: Response): typeof fetch {
  return async () => response;
}

export function createMockFetchSequence(responses: Response[]): typeof fetch {
  let index = 0;
  return async () => {
    const response = responses[index] ?? responses[responses.length - 1];
    index++;
    return response;
  };
}
