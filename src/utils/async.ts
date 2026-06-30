/**
 * Race a promise vs a timer
 * throws on timeout/abort and cleaned up after itself.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("ABORTED"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}
