import { join } from "path";

/**
 * Expand tilde (~) to home directory
 */
export function expandTilde(path: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    return join(home, path.slice(1));
  }
  return path;
}

/**
 * Normalize path separators
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Z]:\\/i.test(path);
}

/**
 * Get parent directory of a path
 */
export function getParentDir(path: string): string {
  const parts = normalizePath(path).split("/");
  parts.pop();
  return parts.join("/") || "/";
}
