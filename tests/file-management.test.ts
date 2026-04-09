import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { handleFileManagement, parseFileManagementCommand } from "../src/tools/file-management";

const historyPath = join(homedir(), ".config/desklumina/file-search-history.json");
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
  });

  afterEach(() => {
    spawnSpy?.mockRestore();
    spawnSpy = null;
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(historyPath, { force: true });
  });

  test("parses canonical search commands", () => {
    const parsed = parseFileManagementCommand('search_name "report" base=~/Documents type=file ext=md,txt limit=5 preview=true');
    expect(parsed).toEqual({
      action: "search_name",
      args: ["report", "base=~/Documents", "type=file", "ext=md,txt", "limit=5", "preview=true"],
    });
  });

  test("previews selected file contents", async () => {
    const filePath = join(tempDir, "note.txt");
    await Bun.write(filePath, "DeskLumina preview content");

    const result = await handleFileManagement(`preview ${filePath}`);

    expect(result?.success).toBe(true);
    expect(result?.preview?.content).toContain("DeskLumina preview content");
    expect(result?.selectedFile).toBe(filePath);
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

    const search = await handleFileManagement(`search_name report base=${tempDir} type=file ext=md preview=true`);
    expect(search?.success).toBe(true);
    expect(search?.files?.[0]?.path).toBe(target);
    expect(search?.preview?.path).toBe(target);
    expect(search?.actions).toContain("locate:name");

    const history = await handleFileManagement("history 5");
    expect(history?.success).toBe(true);
    expect(history?.result).toContain("search_name");

    const replay = await handleFileManagement("repeat_last");
    expect(replay?.success).toBe(true);
    expect(replay?.files?.[0]?.path).toBe(target);
  });
});
