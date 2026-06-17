import { t, tf } from "../../utils/localization/i18n";
import { homedir } from "os";
import { env } from "process";
import { basename, dirname, extname, join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { mkdir, readdir, stat, open } from "fs/promises";
import { logger } from "../../logger";
import { expandTilde } from "../../utils/system/path";
import {
  atomicWriteFile,
  buildResult,
  humanSize,
  mapWithConcurrency,
  quoteToken,
  spawnSafe,
  STAT_CONCURRENCY,
  validateNullBytes,
} from "./file-shared";
import type { FileMatch, FilePreview, ToolExecutionResult, ToolExecutionSummary } from "../../types";

const XDG_STATE_HOME = env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
const HISTORY_DIR = join(XDG_STATE_HOME, "desklumina");
const HISTORY_PATH = join(HISTORY_DIR, "file-search-history.json");
const HISTORY_LIMIT = 25;
const HISTORY_FLUSH_DELAY_MS = 2_000;
const DEFAULT_LIMIT = 25;
const PREVIEW_BYTE_LIMIT = 8192;
const PREVIEW_ENTRY_LIMIT = 20;

type SearchMode = "name" | "path" | "pattern";
type MatchType = "file" | "directory" | "any";

interface SearchFilters {
  base?: string;
  type: MatchType;
  extensions: string[];
  hidden?: boolean;
  limit: number;
  select: boolean;
  preview: boolean;
}

interface SearchRequest {
  action: "search_name" | "search_path" | "search_pattern";
  mode: SearchMode;
  query: string;
  filters: SearchFilters;
}

interface HistoryEntry {
  action: string;
  mode?: SearchMode;
  query?: string;
  filters?: SearchFilters;
  selectedFile?: string;
  resultCount?: number;
  timestamp: number;
}

type ParsedFileCommand =
  | { action: "search_name" | "search_path" | "search_pattern"; args: string[] }
  | { action: "preview"; args: string[] }
  | { action: "history"; args: string[] }
  | { action: "repeat_last"; args: string[] }
  | { action: "legacy_find"; args: string[] };

const MODE_TO_ACTION: Record<SearchMode, SearchRequest["action"]> = {
  name: "search_name",
  path: "search_path",
  pattern: "search_pattern",
};

let historyCache: HistoryEntry[] | null = null;
let historyDirty = false;
let historyFlushTimer: ReturnType<typeof setTimeout> | null = null;

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function parseNumber(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Split a command string into tokens, respecting double quotes and backslash
 * escapes. Used by both the file tool and the file-management search layer.
 */
export function parseQuotedArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "\\" && i + 1 < input.length) {
      current += input[++i];
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
}

function isValidSearchFilters(value: unknown): value is SearchFilters {
  if (!value || typeof value !== "object") return false;
  const f = value as Partial<SearchFilters>;
  if (f.base !== undefined && typeof f.base !== "string") return false;
  if (!["file", "directory", "any"].includes(f.type ?? "any")) return false;
  if (!Array.isArray(f.extensions)) return false;
  if (f.hidden !== undefined && typeof f.hidden !== "boolean") return false;
  if (typeof f.limit !== "number" || f.limit <= 0) return false;
  if (typeof f.select !== "boolean") return false;
  if (typeof f.preview !== "boolean") return false;
  return true;
}

function isValidHistoryEntry(entry: unknown): entry is HistoryEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Partial<HistoryEntry>;
  if (typeof e.timestamp !== "number" || !Number.isFinite(e.timestamp)) return false;
  if (typeof e.action !== "string" || e.action.length === 0) return false;
  if (e.mode !== undefined && !["name", "path", "pattern"].includes(e.mode)) return false;
  if (e.query !== undefined && typeof e.query !== "string") return false;
  if (e.filters !== undefined && !isValidSearchFilters(e.filters)) return false;
  if (e.selectedFile !== undefined && typeof e.selectedFile !== "string") return false;
  if (e.resultCount !== undefined && typeof e.resultCount !== "number") return false;
  return true;
}

async function readHistoryFromDisk(): Promise<HistoryEntry[]> {
  try {
    const file = Bun.file(HISTORY_PATH);
    if (!(await file.exists())) {
      return [];
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHistoryEntry);
  } catch (error) {
    logger.warn("file-management", `Failed to read history: ${String(error)}`);
    return [];
  }
}

async function writeHistoryToDisk(entries: HistoryEntry[]): Promise<void> {
  await mkdir(HISTORY_DIR, { recursive: true });
  await atomicWriteFile(HISTORY_PATH, JSON.stringify(entries.slice(0, HISTORY_LIMIT), null, 2));
}

async function loadHistory(): Promise<HistoryEntry[]> {
  if (historyCache) return historyCache;
  historyCache = await readHistoryFromDisk();
  historyDirty = false;
  return historyCache;
}

async function persistHistory(): Promise<void> {
  if (!historyDirty || !historyCache) return;
  await writeHistoryToDisk(historyCache);
  historyDirty = false;
}

function scheduleHistoryFlush(): void {
  if (historyFlushTimer) return;
  historyFlushTimer = setTimeout(() => {
    historyFlushTimer = null;
    persistHistory().catch((error) => {
      logger.warn("file-management", `Failed to flush history: ${String(error)}`);
    });
  }, HISTORY_FLUSH_DELAY_MS);
}

async function addHistory(entry: HistoryEntry): Promise<void> {
  const entries = await loadHistory();
  entries.unshift(entry);
  historyCache = entries.slice(0, HISTORY_LIMIT);
  historyDirty = true;
  scheduleHistoryFlush();
}

/**
 * Reset the in-memory history cache. Intended for tests that manipulate the
 *history file directly.
 */
export function resetHistoryCache(): void {
  historyCache = null;
  historyDirty = false;
  if (historyFlushTimer) {
    clearTimeout(historyFlushTimer);
    historyFlushTimer = null;
  }
}

process.on("beforeExit", () => {
  if (historyDirty && historyCache) {
    try {
      mkdirSync(HISTORY_DIR, { recursive: true });
      writeFileSync(HISTORY_PATH, JSON.stringify(historyCache.slice(0, HISTORY_LIMIT), null, 2));
      historyDirty = false;
    } catch {
      // besteffort synchronous persistence
    }
  }
});

function historySummary(entry: HistoryEntry): string {
  const query = entry.query ? `"${entry.query}"` : "n/a";
  const resultCount = entry.resultCount ?? 0;
  const selected = entry.selectedFile ? ` -> ${entry.selectedFile}` : "";
  return `${new Date(entry.timestamp).toISOString()} ${entry.action} ${query} (${resultCount})${selected}`;
}

function parseSearchRequest(
  command: Extract<ParsedFileCommand, { action: "search_name" | "search_path" | "search_pattern" }>
): SearchRequest | { error: string } {
  const [query, ...rest] = command.args;
  if (!query) {
    return { error: t("tool.result.invalid_request") };
  }

  const filters: SearchFilters = {
    type: "any",
    extensions: [],
    limit: DEFAULT_LIMIT,
    select: false,
    preview: false,
  };

  for (const token of rest) {
    const [rawKey, ...rawValueParts] = token.split("=");
    const rawValue = rawValueParts.join("=");
    if (!rawKey || rawValue === "") {
      return { error: `Invalid filter token: ${token}` };
    }

    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim().replace(/^"(.*)"$/, "$1");

    if (key === "base") {
      try {
        filters.base = expandTilde(value);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: `Path expansion failed for base: ${message}` };
      }
      continue;
    }

    if (key === "type") {
      const normalized = value.toLowerCase();
      if (normalized !== "file" && normalized !== "directory" && normalized !== "any") {
        return { error: `Invalid type filter: ${value}` };
      }
      filters.type = normalized;
      continue;
    }

    if (key === "ext") {
      filters.extensions = value
        .split(",")
        .map((part) => part.trim().replace(/^\./, "").toLowerCase())
        .filter(Boolean);
      continue;
    }

    if (key === "hidden") {
      const parsed = parseBoolean(value);
      if (parsed === undefined) return { error: `Invalid hidden filter: ${value}` };
      filters.hidden = parsed;
      continue;
    }

    if (key === "limit") {
      const parsed = parseNumber(value);
      if (parsed === null) return { error: `Invalid limit filter: ${value}` };
      filters.limit = Math.min(parsed, 200);
      continue;
    }

    if (key === "select") {
      const parsed = parseBoolean(value);
      if (parsed === undefined) return { error: `Invalid select filter: ${value}` };
      filters.select = parsed;
      continue;
    }

    if (key === "preview") {
      const parsed = parseBoolean(value);
      if (parsed === undefined) return { error: `Invalid preview filter: ${value}` };
      filters.preview = parsed;
      continue;
    }

    return { error: `Unknown filter: ${key}` };
  }

  return {
    action: MODE_TO_ACTION[command.action === "search_name" ? "name" : command.action === "search_path" ? "path" : "pattern"],
    mode: command.action === "search_name" ? "name" : command.action === "search_path" ? "path" : "pattern",
    query,
    filters,
  };
}

/**
 * Determine the match type from filesystem stats
 */
function detectType(stats?: Awaited<ReturnType<typeof stat>>): FileMatch["type"] {
  if (!stats) return "missing";
  if (stats.isDirectory()) return "directory";
  return "file";
}

async function runLocate(request: SearchRequest): Promise<string[]> {
  const args = ["locate", "-i", "-l", String(Math.max(request.filters.limit * 5, 100))];
  if (request.mode === "name") {
    args.push("-b");
  }
  if (request.mode === "pattern") {
    args.push("--regex", request.query);
  } else {
    args.push(request.query);
  }

  const result = await spawnSafe(args, { timeoutMs: 30_000 });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || "locate search failed");
  }

  return stdoutLines(result.stdout);
}

async function findFallbackSearch(request: SearchRequest): Promise<string[]> {
  const base = request.filters.base || ".";
  const query = request.query;
  const limit = Math.max(request.filters.limit * 5, 100);

  const args: string[] =
    request.mode === "pattern"
      ? ["find", base, "-maxdepth", "5", "-regextype", "posix-extended", "-regex", query, "-print"]
      : ["find", base, "-maxdepth", "5", "-iname", `*${query}*`, "-print"];

  const result = await spawnSafe(args, { timeoutMs: 60_000 });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || "find fallback failed");
  }
  return stdoutLines(result.stdout).slice(0, limit);
}

async function locateSearch(request: SearchRequest): Promise<string[]> {
  if (!Bun.which("locate")) {
    return findFallbackSearch(request);
  }
  try {
    return await runLocate(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isMissing =
      message.toLowerCase().includes("executable not found") ||
      message.toLowerCase().includes("no such file");
    if (isMissing) {
      return findFallbackSearch(request);
    }
    throw error;
  }
}

function stdoutLines(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function buildMatch(path: string): Promise<FileMatch | null> {
  try {
    const stats = await stat(path);
    const name = basename(path);
    const type = detectType(stats);
    return {
      path,
      name,
      directory: dirname(path),
      type,
      extension: type === "file" ? extname(name).replace(/^\./, "").toLowerCase() || undefined : undefined,
      hidden: name.startsWith("."),
      size: stats.isFile() ? stats.size : undefined,
    };
  } catch {
    return {
      path,
      name: basename(path),
      directory: dirname(path),
      type: "missing",
      hidden: basename(path).startsWith("."),
    };
  }
}

function matchesFilters(match: FileMatch, request: SearchRequest): boolean {
  const { filters, mode, query } = request;
  const queryValue = query.toLowerCase();
  const pathValue = match.path.toLowerCase();
  const nameValue = match.name.toLowerCase();

  if (mode === "name" && !nameValue.includes(queryValue)) {
    return false;
  }

  if (mode === "path" && !pathValue.includes(queryValue)) {
    return false;
  }

  if (filters.base) {
    const base = filters.base.toLowerCase();
    if (!(pathValue === base || pathValue.startsWith(`${base}/`))) {
      return false;
    }
  }

  if (filters.type !== "any" && match.type !== filters.type) {
    return false;
  }

  if (filters.extensions.length > 0) {
    if (!match.extension || !filters.extensions.includes(match.extension)) {
      return false;
    }
  }

  if (filters.hidden !== undefined && match.hidden !== filters.hidden) {
    return false;
  }

  return true;
}

async function previewPath(targetPath: string): Promise<FilePreview> {
  let path: string;
  try {
    path = expandTilde(targetPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      path: targetPath,
      type: "missing",
      unavailableReason: message,
    };
  }

  try {
    const stats = await stat(path);
    if (stats.isDirectory()) {
      const entries = await readdir(path);
      return {
        path,
        type: "directory",
        entries: entries.slice(0, PREVIEW_ENTRY_LIMIT),
        truncated: entries.length > PREVIEW_ENTRY_LIMIT,
      };
    }

    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(PREVIEW_BYTE_LIMIT);
      const { bytesRead } = await handle.read(buffer, 0, PREVIEW_BYTE_LIMIT, 0);
      const slice = buffer.subarray(0, bytesRead);
      const totalSize = (await handle.stat()).size;
      if (slice.includes(0)) {
        return {
          path,
          type: "file",
          unavailableReason: "Binary file preview unavailable",
          truncated: totalSize > PREVIEW_BYTE_LIMIT,
        };
      }

      return {
        path,
        type: "file",
        content: slice.toString("utf8"),
        truncated: totalSize > PREVIEW_BYTE_LIMIT,
      };
    } finally {
      await handle.close();
    }
  } catch {
    return {
      path,
      type: "missing",
      unavailableReason: "Path not found",
    };
  }
}

function formatPreview(preview: FilePreview): string {
  if (preview.type === "missing") {
    return `${t("tool.result.preview_unavailable")}: ${preview.unavailableReason || "missing path"}`;
  }

  if (preview.type === "directory") {
    const entries = preview.entries && preview.entries.length > 0 ? preview.entries.join("\n") : "(empty directory)";
    const suffix = preview.truncated ? "\n..." : "";
    return `${t("tool.result.preview")}: ${preview.path}\n${entries}${suffix}`;
  }

  if (preview.unavailableReason) {
    return `${t("tool.result.preview_unavailable")}: ${preview.unavailableReason}`;
  }

  return preview.content || "";
}

function formatMatches(matches: FileMatch[]): string {
  if (matches.length === 0) return t("tool.result.no_matches");
  return matches
    .map((match, index) => {
      const size = typeof match.size === "number" ? ` (${humanSize(match.size)})` : "";
      return `${index + 1}. [${match.type}] ${match.path}${size}`;
    })
    .join("\n");
}

async function selectWithFzf(matches: FileMatch[]): Promise<{ selected: string | null; error?: string }> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return { selected: null, error: "Interactive selection requires a terminal TTY" };
  }

  const proc = Bun.spawn(
    [
      "fzf",
      "--ansi",
      "--prompt",
      "DeskLumina Files> ",
      "--preview-window",
      "right:60%",
      "--preview",
      "bash -c 'if [ -d \"$1\" ]; then ls -la \"$1\" | head -n 40; else head -n 80 \"$1\" 2>/dev/null; fi' _ {}",
    ],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  proc.stdin.write(matches.map((match) => match.path).join("\n"));
  proc.stdin.end();

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    if (exitCode === 130) {
      return { selected: null };
    }
    return { selected: null, error: stderr.trim() || "fzf selection failed" };
  }

  return { selected: stdout.trim() || null };
}


/**
 * Parse a file-management command string into a structured command object.
 * Returns null for commands that do not belong to the advanced file-management
 * layer (e.g. basic `create_dir`, `read`, `write`).
 */
export function parseFileManagementCommand(operation: string): ParsedFileCommand | null {
  const args = parseQuotedArgs(operation.trim());
  const action = args[0]?.toLowerCase();
  const rest = args.slice(1);

  if (!action) return null;
  if (action === "search_name" || action === "search_path" || action === "search_pattern") {
    return { action, args: rest };
  }
  if (action === "preview" || action === "history" || action === "repeat_last") {
    return { action, args: rest };
  }
  if (action === "find") {
    return { action: "legacy_find", args: rest };
  }
  return null;
}

/**
 * Execute file-management operation such as search, preview,
 * history, or repeat_last. Returns null if the operation does not match this
 * layer, allowing callers to fall back to basic file operations
 */
export async function handleFileManagement(operation: string): Promise<ToolExecutionResult | null> {
  const nullByteError = validateNullBytes(parseQuotedArgs(operation.trim()), operation);
  if (nullByteError) {
    return nullByteError;
  }

  const parsed = parseFileManagementCommand(operation);
  if (!parsed) {
    return null;
  }

  if (parsed.action === "history") {
    const limit = parsed.args[0] ? parseNumber(parsed.args[0]) ?? 10 : 10;
    const history = await loadHistory();
    const files: FileMatch[] = history.slice(0, limit).map((entry) => ({
      path: entry.selectedFile || entry.query || entry.action,
      name: entry.action,
      directory: entry.filters?.base || "",
      type: entry.selectedFile ? "file" : "missing",
      hidden: false,
    }));
    return buildResult(
      `history ${limit}`,
      history.slice(0, limit).map(historySummary).join("\n") || t("tool.result.history_empty"),
      true,
      {
        status: "history_ready",
        actions: ["read_history"],
        extra: {
          files,
          summary: { returnedMatches: Math.min(history.length, limit) },
        },
      }
    );
  }

  if (parsed.action === "repeat_last") {
    const history = await loadHistory();
    const lastSearch = history.find((entry) => entry.mode && entry.query && entry.filters);
    if (!lastSearch || !lastSearch.mode || !lastSearch.query || !lastSearch.filters) {
      return buildResult("repeat_last", t("tool.result.history_empty"), false, {
        status: "history_empty",
        stderr: "No previous file search available",
        exitCode: 404,
      });
    }

    const action = MODE_TO_ACTION[lastSearch.mode];
    const tokens = [action, quoteToken(lastSearch.query)];
    if (lastSearch.filters.base) tokens.push(`base=${quoteToken(lastSearch.filters.base)}`);
    if (lastSearch.filters.type !== "any") tokens.push(`type=${lastSearch.filters.type}`);
    if (lastSearch.filters.extensions.length > 0) tokens.push(`ext=${lastSearch.filters.extensions.join(",")}`);
    if (lastSearch.filters.hidden !== undefined) tokens.push(`hidden=${String(lastSearch.filters.hidden)}`);
    tokens.push(`limit=${lastSearch.filters.limit}`);
    if (lastSearch.filters.select) tokens.push("select=true");
    if (lastSearch.filters.preview) tokens.push("preview=true");

    const replayResult = await handleFileManagement(tokens.join(" "));
    if (replayResult && !replayResult.success) {
      replayResult.stderr = replayResult.stderr
        ? `History replay failed: ${replayResult.stderr}`
        : "History replay failed";
    }
    return replayResult;
  }

  if (parsed.action === "preview") {
    const target = parsed.args[0];
    if (!target) {
      return buildResult("preview", t("tool.result.invalid_request"), false, {
        status: "invalid_request",
        stderr: "Preview path required",
        exitCode: 2,
      });
    }

    const preview = await previewPath(target);
    const success = preview.type !== "missing";
    return buildResult(
      `preview ${preview.path}`,
      formatPreview(preview),
      success,
      {
        status: success ? "preview_ready" : "preview_unavailable",
        actions: ["preview"],
        extra: {
          preview,
          selectedFile: preview.path,
          summary: { returnedMatches: success ? 1 : 0 },
        },
        stderr: success ? undefined : preview.unavailableReason,
        exitCode: success ? 0 : 404,
      }
    );
  }

  let request: SearchRequest | { error: string };
  if (parsed.action === "legacy_find") {
    let base: string;
    try {
      base = expandTilde(parsed.args[0] || ".");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildResult(operation.trim(), t("tool.result.invalid_request"), false, {
        status: "invalid_request",
        stderr: `Path expansion failed for base: ${message}`,
        exitCode: 2,
      });
    }
    request = parseSearchRequest({
      action: "search_name",
      args: [parsed.args[1] || "", `base=${base}`],
    });
  } else {
    request = parseSearchRequest(parsed);
  }

  if ("error" in request) {
    return buildResult(operation.trim(), t("tool.result.invalid_request"), false, {
      status: "invalid_request",
      stderr: request.error,
      exitCode: 2,
    });
  }

  const locateResults = await locateSearch(request);
  const matches = (await mapWithConcurrency(locateResults, buildMatch, STAT_CONCURRENCY))
    .filter((match): match is FileMatch => match !== null)
    .filter((match) => matchesFilters(match, request))
    .slice(0, request.filters.limit);

  const actions = [`locate:${request.mode}`, "filter_results"];
  let selectedFile: string | undefined;
  let preview: FilePreview | undefined;

  if (request.filters.select && matches.length > 0) {
    const selection = await selectWithFzf(matches);
    if (selection.error) {
      return buildResult(operation.trim(), tf("error.with_message", { message: selection.error }), false, {
        status: "selection_unavailable",
        stderr: selection.error,
        exitCode: 2,
      });
    }
    selectedFile = selection.selected || undefined;
    actions.push("fzf_select");
  }

  if (request.filters.preview) {
    const previewTarget = selectedFile || matches[0]?.path;
    if (previewTarget) {
      preview = await previewPath(previewTarget);
      actions.push("preview");
    }
  }

  const summary: ToolExecutionSummary = {
    mode: request.mode,
    query: request.query,
    totalMatches: locateResults.length,
    filteredMatches: matches.length,
    returnedMatches: matches.length,
  };

  await addHistory({
    action: request.action,
    mode: request.mode,
    query: request.query,
    filters: request.filters,
    selectedFile,
    resultCount: matches.length,
    timestamp: Date.now(),
  });

  const lines = [`${t("common.results")}:`, formatMatches(matches)];

  if (selectedFile) {
    lines.push(tf("tool.result.selected", { path: selectedFile }));
  }

  if (preview) {
    lines.push(`${t("tool.result.preview_ready")}:`);
    lines.push(formatPreview(preview));
  }

  return buildResult(
    operation.trim(),
    lines.join("\n"),
    matches.length > 0,
    {
      status: matches.length > 0 ? "search_complete" : "no_matches",
      actions,
      extra: {
        files: matches,
        selectedFile,
        preview,
        summary,
      },
      stdout: lines.join("\n"),
      stderr: matches.length > 0 ? undefined : "No files matched the request",
      exitCode: matches.length > 0 ? 0 : 404,
    }
  );
}
