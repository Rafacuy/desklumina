import { dirname, join, resolve } from "path";
import { rename, unlink } from "fs/promises";
import { expandTilde } from "../../utils/system/path";
import type { ToolExecutionResult } from "../../types";

/**
 * Default timeout for spawned child processes 
 */
export const SPAWN_TIMEOUT_MS = 30_000;

/**
 * Maximum number of concurrent filesystem stat operations
 */
export const STAT_CONCURRENCY = 50;

/**
 * Maximum number of bytes the read operation will load into memory
 */
export const MAX_READ_BYTES = 524_288; // 512 KiB

export const DANGEROUS_PATHS = [
  "/",
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/lib",
  "/proc",
  "/root",
  "/run",
  "/sbin",
  "/sys",
  "/usr",
  "/var",
];

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Build a consistent ToolExecutionResult for file tools
 */
export function buildResult(
  normalizedArg: string,
  message: string,
  success: boolean,
  init: Partial<ToolExecutionResult> = {}
): ToolExecutionResult {
  return {
    tool: "file",
    result: message,
    success,
    normalizedArg,
    ...init,
  };
}

/**
 * Check whether a path matches a known dangerous system location.
 * The path is expanded before comparison so that `~` resolves correctly.
 */
export function isDangerousPath(path: string): boolean {
  const expandedPath = resolve(expandTilde(path));
  return DANGEROUS_PATHS.some((entry) => {
    if (expandedPath === entry) return true;
    if (entry === "/") return false;
    return expandedPath.startsWith(`${entry}/`);
  });
}

/**
 * Validate that a list of strings does not contain null bytes.
 *Returns a structured error result if a null byte is found
 */
export function validateNullBytes(
  args: string[],
  operation: string
): ToolExecutionResult | null {
  if (args.some((arg) => arg.includes("\0"))) {
    return buildResult(
      operation.trim(),
      "Invalid file request",
      false,
      {
        stderr: "Null byte in path or argument",
        exitCode: 2,
      }
    );
  }
  return null;
}

/**
 * Spawn a command safely with an optional timeout,
 * Rejects if a null byte is present in any argument.
 */
export async function spawnSafe(
  args: string[],
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<SpawnResult> {
  if (args.length === 0) {
    throw new Error("spawnSafe called with empty argument list");
  }
  if (args.some((arg) => arg.includes("\0"))) {
    throw new Error("Null byte in command argument");
  }

  const timeoutMs = options.timeoutMs ?? SPAWN_TIMEOUT_MS;
  const controller = new AbortController();
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
    signal: controller.signal,
  });

  try {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    if (controller.signal.aborted && proc.killed) {
      throw new Error(`Command timed out after ${timeoutMs}ms`);
    }

    return { stdout, stderr, exitCode };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Format a byte count as a human-readable string.
 */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

/**
 * Map over an array with a bounded number of concurrent promises
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Quote a token for safe reconstruction of a command string.
 * Only adds surrounding quotes when the value contains whitespace
 */
export function quoteToken(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  if (/\s/.test(value)) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Write content to a temporary file in the target directory and atomically
 * rename it to the final path. 
 * The temporary file is removed on failure.
 */
export async function atomicWriteFile(path: string, content: string | Buffer): Promise<void> {
  const dir = dirname(path);
  const tmpPath = join(dir, `.${Bun.randomUUIDv7()}.tmp`);
  try {
    await Bun.write(tmpPath, content);
    await rename(tmpPath, path);
  } catch (error) {
    try {
      await unlink(tmpPath);
    } catch {
      //best-effort cleanup
    }
    throw error;
  }
}
