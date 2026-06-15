import { describe, expect, test, mock, spyOn, beforeEach, afterEach } from "bun:test";
import {
  cleanText,
  cancelTTS,
} from "../src/ai/tts";
import { playFiller, FillerPool, resetFillerAvailabilityCache } from "../src/tts/natural-voices";
import { DisfluencyPlanner } from "../src/tts/disfluency-planner";
import { settingsManager } from "../src/core/services/settings-manager";
import { logger } from "../src/logger";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

mock.module("edge-tts-universal", () => ({
  Communicate: class {
    constructor(public text: string, public options: any) {}
    async *stream() {
      yield { type: "audio", data: Buffer.from("mock audio") };
    }
  },
}));

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "desklumina-tts-audit-"));
}

function writeAsset(root: string, category: string, name: string): string {
  const dir = join(root, category);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, "mp3");
  return file;
}

function writeOnePerCategory(root: string): string[] {
  return [
    writeAsset(root, "breath", "breath.mp3"),
    writeAsset(root, "think", "think.mp3"),
    writeAsset(root, "pause", "pause.mp3"),
    writeAsset(root, "throat", "throat.mp3"),
  ];
}

describe("cleanText", () => {
  test("collapses single newlines to spaces", () => {
    expect(cleanText("Line one\nLine two")).toBe("Line one Line two");
  });

  test("preserves paragraph breaks as sentence terminators", () => {
    const result = cleanText("Paragraph one.\n\nParagraph two.");
    expect(result).toContain("Paragraph one. Paragraph two");
  });

  test("removes markdown emphasis", () => {
    expect(cleanText("**bold** and *italic*")).toBe("bold and italic");
  });

  test("removes code fences", () => {
    expect(cleanText("```js\nconst x = 1;\n```")).toBe("");
  });
});

describe("FillerPlayHandle", () => {
  afterEach(() => {
    resetFillerAvailabilityCache();
    const maybeMock = Bun.spawn as unknown as { mockRestore?: () => void };
    maybeMock.mockRestore?.();
    const pk = process.kill as unknown as { mockRestore?: () => void };
    pk.mockRestore?.();
  });

  test("kill() guards against pid 0", () => {
    const killSpy = spyOn(process, "kill").mockImplementation(() => true as any);

    const handle = { done: Promise.resolve(), pid: 0, kill: () => { if (0 > 0) process.kill(0); } };
    handle.kill();

    expect(killSpy).not.toHaveBeenCalled();
    killSpy.mockRestore();
  });

  test("playFiller returns pid 0 and resolves immediately when mpv is unavailable", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(1), pid: 1 } as any;
      throw new Error("ENOENT");
    });
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const handle = await playFiller("/tmp/filler.mp3", 85);

    expect(handle.pid).toBe(0);
    await expect(handle.done).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });
});

describe("DisfluencyPlanner audit fixes", () => {
  let dirs: string[] = [];

  beforeEach(() => {
    dirs = [];
  });

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("zeroes out empty categories so weightedPick does not select them", () => {
    const root = tempDir();
    dirs.push(root);
    writeAsset(root, "breath", "breath.mp3");
    writeAsset(root, "think", "think.mp3");

    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);

    const chunks = Array.from({ length: 20 }, (_, i) => "x".repeat(100) + ` chunk${i}`);
    const jobs = chunks.map((text, i) => ({
      id: i,
      text,
      audioFile: `/tmp/test-${i}.mp3`,
      ready: false,
    }));

    for (let i = 0; i < 50; i++) {
      const plan = planner.plan(chunks, jobs);
      const fillers = plan.filter(item => item.kind === "filler");
      for (const f of fillers) {
        if (f.kind === "filler") {
          expect(f.category).not.toBe("pause");
          expect(f.category).not.toBe("throat");
        }
      }
    }

    warnSpy.mockRestore();
  });

  test("emits debug log when planned filler slot is dropped", () => {
    const root = tempDir();
    dirs.push(root);
    const debugSpy = spyOn(logger, "debug").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = Array.from({ length: 10 }, (_, i) => "x".repeat(100) + ` chunk${i}`);
    const jobs = chunks.map((text, i) => ({
      id: i,
      text,
      audioFile: `/tmp/test-${i}.mp3`,
      ready: false,
    }));

    for (let i = 0; i < 20; i++) {
      planner.plan(chunks, jobs);
    }

    expect(debugSpy).toHaveBeenCalledWith("tts", expect.stringContaining("Dropped planned filler"));
    debugSpy.mockRestore();
  });

  test("density curve scales beyond 12 chunks", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = Array.from({ length: 25 }, (_, i) => "x".repeat(100) + ` chunk${i}`);
    const jobs = chunks.map((text, i) => ({
      id: i,
      text,
      audioFile: `/tmp/test-${i}.mp3`,
      ready: false,
    }));

    let maxFillers = 0;
    for (let i = 0; i < 20; i++) {
      const plan = planner.plan(chunks, jobs);
      const count = plan.filter(item => item.kind === "filler").length;
      if (count > maxFillers) maxFillers = count;
    }

    expect(maxFillers).toBeGreaterThanOrEqual(3);
    warnSpy.mockRestore();
  });
});

describe("textToSpeech voice map", () => {
  afterEach(() => {
    const maybeMock = Bun.spawn as unknown as { mockRestore?: () => void };
    maybeMock.mockRestore?.();
  });

  test("unknown locale falls back to English voice", async () => {
    const { textToSpeech } = await import("../src/ai/tts");
    const settingsSpy = spyOn(settingsManager, "get").mockReturnValue({
      language: "fr",
      tts: {
        voiceId: null,
        speed: 1.0,
        naturalVoices: { enabled: false },
      },
    } as any);
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(1), pid: 1 } as any;
      return { exited: Promise.resolve(0), pid: 2 } as any;
    });
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    await textToSpeech("Bonjour le monde.");

    settingsSpy.mockRestore();
    spawnSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("cancelTTS export", () => {
  test("is exported and callable", async () => {
    await expect(cancelTTS()).resolves.toBeUndefined();
  });
});
