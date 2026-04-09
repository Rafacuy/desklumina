import { homedir } from "os";
import { basename, dirname, extname, join } from "path";
import { existsSync } from "fs";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { logger } from "../logger";
import { expandTilde } from "../utils/path";
import type { FileMatch, FilePreview, ToolExecutionResult, ToolExecutionSummary } from "../types";

const HISTORY_DIR = join(homedir(), ".config/desklumina");
const HISTORY_PATH = join(HISTORY_DIR, "file-search-history.json");
const HISTORY_LIMIT = 25;
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

export function parseQuotedArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === "\"" || char === "'") && (i === 0 || input[i - 1] !== "\\")) {
      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        inQuotes = true;
        quoteChar = char;
      }
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

function parseSearchRequest(
  command: Extract<ParsedFileCommand, { action: "search_name" | "search_path" | "search_pattern" }>
): SearchRequest | { error: string } {
  const [query, ...rest] = command.args;
  if (!query) {
    return { error: "Search query required" };
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
    const value = rawValue.trim();

    if (key === "base") {
      filters.base = expandTilde(value);
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
    action: command.action,
    mode: command.action === "search_name" ? "name" : command.action === "search_path" ? "path" : "pattern",
    query,
    filters,
  };
}

function detectType(_path: string, stats?: Awaited<ReturnType<typeof stat>>): FileMatch["type"] {
  if (!stats) return "missing";
  if (stats.isDirectory()) return "directory";
  return "file";
}

async function locateSearch(request: SearchRequest): Promise<string[]> {
  const args = ["locate", "-i", "-l", String(Math.max(request.filters.limit * 5, 100))];
  if (request.mode === "name") {
    args.push("-b");
  }
  if (request.mode === "pattern") {
    args.push("--regex", request.query);
  } else {
    args.push(request.query);
  }

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const message = stderr.trim() || "locate search failed";
    throw new Error(message);
  }

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function buildMatch(path: string): Promise<FileMatch | null> {
  try {
    const stats = await stat(path);
    const name = basename(path);
    const type = detectType(path, stats);
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
  const path = expandTilde(targetPath);
  if (!existsSync(path)) {
    return {
      path,
      type: "missing",
      unavailableReason: "Path not found",
    };
  }

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

  const buffer = await readFile(path);
  const slice = buffer.subarray(0, PREVIEW_BYTE_LIMIT);
  if (slice.includes(0)) {
    return {
      path,
      type: "file",
      unavailableReason: "Binary file preview unavailable",
      truncated: buffer.length > PREVIEW_BYTE_LIMIT,
    };
  }

  return {
    path,
    type: "file",
    content: slice.toString("utf8"),
    truncated: buffer.length > PREVIEW_BYTE_LIMIT,
  };
}

function formatPreview(preview: FilePreview): string {
  if (preview.type === "missing") {
    return `Preview unavailable: ${preview.unavailableReason || "missing path"}`;
  }

  if (preview.type === "directory") {
    const entries = preview.entries && preview.entries.length > 0 ? preview.entries.join("\n") : "(empty directory)";
    const suffix = preview.truncated ? "\n..." : "";
    return `Directory preview: ${preview.path}\n${entries}${suffix}`;
  }

  if (preview.unavailableReason) {
    return `Preview unavailable: ${preview.unavailableReason}`;
  }

  return preview.content || "";
}

function formatMatches(matches: FileMatch[]): string {
  if (matches.length === 0) return "No files matched the request.";
  return matches
    .map((match, index) => {
      const size = typeof match.size === "number" ? ` (${match.size} B)` : "";
      return `${index + 1}. [${match.type}] ${match.path}${size}`;
    })
    .join("\n");
}

async function readHistory(): Promise<HistoryEntry[]> {
  try {
    const file = Bun.file(HISTORY_PATH);
    if (!(await file.exists())) {
      return [];
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed as HistoryEntry[] : [];
  } catch (error) {
    logger.warn("file-management", `Failed to read history: ${String(error)}`);
    return [];
  }
}

async function writeHistory(entries: HistoryEntry[]): Promise<void> {
  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(entries.slice(0, HISTORY_LIMIT), null, 2));
}

async function addHistory(entry: HistoryEntry): Promise<void> {
  const existing = await readHistory();
  existing.unshift(entry);
  await writeHistory(existing);
}

function historySummary(entry: HistoryEntry): string {
  const query = entry.query ? `"${entry.query}"` : "n/a";
  const resultCount = entry.resultCount ?? 0;
  const selected = entry.selectedFile ? ` -> ${entry.selectedFile}` : "";
  return `${new Date(entry.timestamp).toISOString()} ${entry.action} ${query} (${resultCount})${selected}`;
}

async function selectWithFzf(matches: FileMatch[]): Promise<string | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive selection requires a terminal TTY");
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
      "if [ -d {1} ]; then ls -la {1} | head -n 40; else head -n 80 {1} 2>/dev/null; fi",
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
      return null;
    }
    throw new Error(stderr.trim() || "fzf selection failed");
  }

  return stdout.trim() || null;
}

function formatSummary(summary: ToolExecutionSummary): string {
  const total = summary.totalMatches ?? 0;
  const filtered = summary.filteredMatches ?? 0;
  const returned = summary.returnedMatches ?? 0;
  return `mode=${summary.mode || "unknown"}, total=${total}, filtered=${filtered}, returned=${returned}`;
}

function makeResult(
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

export async function handleFileManagement(operation: string): Promise<ToolExecutionResult | null> {
  const parsed = parseFileManagementCommand(operation);
  if (!parsed) {
    return null;
  }

  if (parsed.action === "history") {
    const limit = parsed.args[0] ? parseNumber(parsed.args[0]) ?? 10 : 10;
    const history = await readHistory();
    const files: FileMatch[] = history.slice(0, limit).map((entry) => ({
      path: entry.selectedFile || entry.query || entry.action,
      name: entry.action,
      directory: entry.filters?.base || "",
      type: entry.selectedFile ? "file" : "missing",
      hidden: false,
    }));
    return makeResult(
      `history ${limit}`,
      history.slice(0, limit).map(historySummary).join("\n") || "No file search history.",
      true,
      {
        status: "history_ready",
        files,
        actions: ["read_history"],
        summary: { returnedMatches: Math.min(history.length, limit) },
      }
    );
  }

  if (parsed.action === "repeat_last") {
    const history = await readHistory();
    const lastSearch = history.find((entry) => entry.mode && entry.query && entry.filters);
    if (!lastSearch || !lastSearch.mode || !lastSearch.query || !lastSearch.filters) {
      return makeResult("repeat_last", "❌ No previous file search available", false, {
        status: "history_empty",
        stderr: "No previous file search available",
        exitCode: 404,
      });
    }

    const action = lastSearch.mode === "name" ? "search_name" : lastSearch.mode === "path" ? "search_path" : "search_pattern";
    const tokens = [action, lastSearch.query];
    if (lastSearch.filters.base) tokens.push(`base=${lastSearch.filters.base}`);
    if (lastSearch.filters.type !== "any") tokens.push(`type=${lastSearch.filters.type}`);
    if (lastSearch.filters.extensions.length > 0) tokens.push(`ext=${lastSearch.filters.extensions.join(",")}`);
    if (lastSearch.filters.hidden !== undefined) tokens.push(`hidden=${String(lastSearch.filters.hidden)}`);
    tokens.push(`limit=${lastSearch.filters.limit}`);
    if (lastSearch.filters.select) tokens.push("select=true");
    if (lastSearch.filters.preview) tokens.push("preview=true");
    return handleFileManagement(tokens.join(" "));
  }

  if (parsed.action === "preview") {
    const target = parsed.args[0];
    if (!target) {
      return makeResult("preview", "❌ Preview path required", false, {
        status: "invalid_request",
        stderr: "Preview path required",
        exitCode: 2,
      });
    }

    const preview = await previewPath(target);
    const success = preview.type !== "missing";
    return makeResult(
      `preview ${expandTilde(target)}`,
      formatPreview(preview),
      success,
      {
        status: success ? "preview_ready" : "preview_unavailable",
        preview,
        selectedFile: preview.path,
        actions: ["preview"],
        summary: { returnedMatches: success ? 1 : 0 },
        stderr: success ? undefined : preview.unavailableReason,
        exitCode: success ? 0 : 404,
      }
    );
  }

  const request =
    parsed.action === "legacy_find"
      ? parseSearchRequest({
          action: "search_name",
          args: [parsed.args[1] || "", `base=${expandTilde(parsed.args[0] || ".")}`],
        })
      : parseSearchRequest(parsed);

  if ("error" in request) {
    return makeResult(operation.trim(), `❌ ${request.error}`, false, {
      status: "invalid_request",
      stderr: request.error,
      exitCode: 2,
    });
  }

  const locateResults = await locateSearch(request);
  const matches = (await Promise.all(locateResults.map((path) => buildMatch(path))))
    .filter((match): match is FileMatch => match !== null)
    .filter((match) => matchesFilters(match, request))
    .slice(0, request.filters.limit);

  const actions = [`locate:${request.mode}`, "filter_results"];
  let selectedFile: string | undefined;
  let preview: FilePreview | undefined;

  if (request.filters.select && matches.length > 0) {
    selectedFile = await selectWithFzf(matches) || undefined;
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

  const lines = [
    `Status: ${matches.length > 0 ? "ok" : "empty"}`,
    `Summary: ${formatSummary(summary)}`,
    `Actions: ${actions.join(", ")}`,
    `Results:`,
    formatMatches(matches),
  ];

  if (selectedFile) {
    lines.push(`Selected: ${selectedFile}`);
  }

  if (preview) {
    lines.push("Preview:");
    lines.push(formatPreview(preview));
  }

  return makeResult(
    operation.trim(),
    lines.join("\n"),
    matches.length > 0,
    {
      status: matches.length > 0 ? "search_complete" : "no_matches",
      files: matches,
      selectedFile,
      preview,
      actions,
      summary,
      stdout: lines.join("\n"),
      stderr: matches.length > 0 ? undefined : "No files matched the request",
      exitCode: matches.length > 0 ? 0 : 404,
    }
  );
}
