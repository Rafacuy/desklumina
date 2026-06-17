import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  handleFileManagement,
  parseFileManagementCommand,
  parseQuotedArgs,
  resetHistoryCache,
} from "../src/tools/frameworks/file-management";

const XDG_STATE_HOME = process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
const historyPath = join(XDG_STATE_HOME, "desklumina", "file-search-history.json");
const tempDir = join(process.cwd(), "tmp-file-management-tests");

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function mockSpawnResult(stdout: string, stderr = "", exitCode = 0) {
  return {
    stdout: streamFromText(stdout),
    stderr: streamFromText(stderr),
    exited: Promise.resolve(exitCode),
  } as any;
}

describe("Advanced File Management", () => {
  let spawnSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
    if (existsSync(historyPath)) rmSync(historyPath, { force: true });
    resetHistoryCache();
  });

  afterEach(() => {
    spawnSpy?.mockRestore();
    spawnSpy = null;
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(historyPath, { force: true });
    resetHistoryCache();
  });

  test("parses canonical search commands", () => {
    const parsed = parseFileManagementCommand(
      'search_name "report" base=~/Documents type=file ext=md,txt limit=5 preview=true'
    );
    expect(parsed).toEqual({
      action: "search_name",
      args: ["report", "base=~/Documents", "type=file", "ext=md,txt", "limit=5", "preview=true"],
    });
  });

  test("parseQuotedArgs consumes backslash escapes", () => {
    const args = parseQuotedArgs('a\\"b\\"');
    expect(args).toEqual(['a"b"']);
  });

  test("previews selected file contents", async () => {
    const filePath = join(tempDir, "note.txt");
    await Bun.write(filePath, "DeskLumina preview content");

    const result = await handleFileManagement(`preview ${filePath}`);

    expect(result?.success).toBe(true);
    expect(result?.extra?.preview?.content).toContain("DeskLumina preview content");
    expect(result?.extra?.selectedFile).toBe(filePath);
  });

  test("searches with locate, stores history, and can replay the last query", async () => {
    const target = join(tempDir, "report.md");
    await Bun.write(target, "# report");

    const locateMock = mock((args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("report")) {
        return mockSpawnResult(`${target}\n`);
      }
      return mockSpawnResult("");
    });

    spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: string[]) => locateMock(args));

    const search = await handleFileManagement(
      `search_name report base=${tempDir} type=file ext=md preview=true`
    );
    expect(search?.success).toBe(true);
    expect(search?.extra?.files?.[0]?.path).toBe(target);
    expect(search?.extra?.preview?.path).toBe(target);
    expect(search?.actions).toContain("locate:name");

    const history = await handleFileManagement("history 5");
    expect(history?.success).toBe(true);
    expect(history?.result).toContain("search_name");

    const replay = await handleFileManagement("repeat_last");
    expect(replay?.success).toBe(true);
    expect(replay?.extra?.files?.[0]?.path).toBe(target);
  });

  test("repeat_last re-quotes queries containing spaces", async () => {
    const target = join(tempDir, "my report.md");
    await Bun.write(target, "# report");

    const locateMock = mock((args: string[]) => {
      const joined = args.join(" ");
      if (joined.includes("my report")) {
        return mockSpawnResult(`${target}\n`);
      }
      return mockSpawnResult("");
    });

    spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: string[]) => locateMock(args));

    const search = await handleFileManagement(
      `search_name "my report" base=${tempDir} type=file ext=md`
    );
    expect(search?.success).toBe(true);

    const replay = await handleFileManagement("repeat_last");
    expect(replay?.success).toBe(true);
    expect(replay?.extra?.files?.[0]?.path).toBe(target);
  });

  test("filters malformed history entries", async () => {
    const valid = {
      action: "search_name",
      mode: "name",
      query: "report",
      filters: { type: "file", extensions: [], limit: 10, select: false, preview: false },
      timestamp: Date.now(),
    };
    const invalid = { action: "search_name", query: "broken" }; // missing timestamp and filters
    writeFileSync(historyPath, JSON.stringify([invalid, valid], null, 2));
    resetHistoryCache();

    const history = await handleFileManagement("history 5");
    expect(history?.success).toBe(true);
    expect(history?.result).toContain("report");
    expect(history?.result).not.toContain("broken");
    expect(history?.extra?.summary?.returnedMatches).toBe(1);
  });

  test("falls back to find when locate is unavailable", async () => {
    const whichSpy = spyOn(Bun, "which").mockReturnValue(null);
    const target = join(tempDir, "fallback.txt");
    await Bun.write(target, "find me");

    let findCalled = false;
    const spawnMock = mock((args: string[]) => {
      if (args[0] === "find") {
        findCalled = true;
        return mockSpawnResult(`${target}\n`);
      }
      return mockSpawnResult("");
    });
    spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: string[]) => spawnMock(args));

    const result = await handleFileManagement(`search_name fallback base=${tempDir} type=file`);

    expect(findCalled).toBe(true);
    expect(result?.success).toBe(true);
    expect(result?.extra?.files?.[0]?.path).toBe(target);

    whichSpy.mockRestore();
  });

  test("returns structured error when fzf selection is requested without a TTY", async () => {
    const target = join(tempDir, "select-me.txt");
    await Bun.write(target, "select me");

    const locateMock = mock((args: string[]) => {
      if (args.join(" ").includes("select-me")) {
        return mockSpawnResult(`${target}\n`);
      }
      return mockSpawnResult("");
    });
    spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: string[]) => locateMock(args));

    const originalIsTTY = process.stdin.isTTY;
    const originalOutIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, writable: true, configurable: true });

    try {
      const result = await handleFileManagement(
        `search_name select-me base=${tempDir} type=file select=true`
      );
      expect(result?.success).toBe(false);
      expect(result?.stderr?.toLowerCase()).toContain("tty");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalOutIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });
});
