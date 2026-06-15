import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FillerPool, playFiller, resetFillerAvailabilityCache } from "../src/tts/natural-voices";
import { logger } from "../src/logger";
import { settingsManager } from "../src/core/services/settings-manager";
import { DEFAULT_SETTINGS, type Settings } from "../src/types";

let ttsDelayMs = 0;

mock.module("edge-tts-universal", () => ({
  Communicate: class {
    async *stream() {
      if (ttsDelayMs > 0) await Bun.sleep(ttsDelayMs);
      yield { type: "audio", data: Buffer.from([1, 2, 3]) };
    }
  },
}));

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "desklumina-natural-voices-"));
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

function withRandom(values: number[], fn: () => void): void {
  const original = Math.random;
  let index = 0;
  Math.random = () => values[index++] ?? values[values.length - 1] ?? 0;
  try {
    fn();
  } finally {
    Math.random = original;
  }
}

function settingsWithNaturalVoices(naturalVoices: Partial<Settings["tts"]["naturalVoices"]>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    tts: {
      ...DEFAULT_SETTINGS.tts,
      naturalVoices: {
        ...DEFAULT_SETTINGS.tts.naturalVoices,
        ...naturalVoices,
      },
    },
  };
}

describe("FillerPool", () => {
  let dirs: string[] = [];

  beforeEach(() => {
    dirs = [];
  });

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("empty asset dir returns null without throwing", () => {
    const root = tempDir();
    dirs.push(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);

    expect(pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: false })).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith("natural-voices", "Asset pool is empty — filler injection disabled");
    warnSpy.mockRestore();
  });

  test("single file per category is discovered and can be picked", () => {
    const root = tempDir();
    dirs.push(root);
    const files = writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);

    expect((pool as any).assets.size).toBe(4);
    const picked = pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: false });
    expect(files).toContain(picked);
    warnSpy.mockRestore();
  });

  test("opus files are discovered alongside mp3 files", () => {
    const root = tempDir();
    dirs.push(root);
    const breathOpus = writeAsset(root, "breath", "breath.opus");
    const thinkMp3 = writeAsset(root, "think", "think.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);

    expect((pool as any).assets.size).toBe(2);
    expect(pool.pickByCategory("breath")).toBe(breathOpus);
    expect(pool.pickByCategory("think")).toBe(thinkMp3);
    warnSpy.mockRestore();
  });

  test("anti-repeat chooses an alternative in the same category when available", () => {
    const root = tempDir();
    dirs.push(root);
    const first = writeAsset(root, "breath", "a.mp3");
    const second = writeAsset(root, "breath", "b.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    withRandom([0, 0, 0, 0, 0.99], () => {
      expect(pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: false })).toBe(first);
      expect(pool.pick({ gapMs: 1000, chunkIndex: 2, isFirstGap: false })).toBe(second);
    });

    warnSpy.mockRestore();
  });

  test("anti-repeat accepts repeats when only one file exists", () => {
    const root = tempDir();
    dirs.push(root);
    const only = writeAsset(root, "breath", "only.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    expect(pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: false })).toBe(only);
    expect(pool.pick({ gapMs: 1000, chunkIndex: 2, isFirstGap: false })).toBe(only);
    expect(pool.pick({ gapMs: 1000, chunkIndex: 3, isFirstGap: false })).toBe(only);
    warnSpy.mockRestore();
  });

  test("long gaps elevate breath weight and weights remain normalized", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    const weights = (pool as any).adjustWeights({ gapMs: 2500, chunkIndex: 1, isFirstGap: false });
    const total = weights.breath + weights.think + weights.pause + weights.throat;

    expect(weights.breath).toBeGreaterThan(0.40);
    expect(total).toBeCloseTo(1, 6);
    warnSpy.mockRestore();
  });

  test("first gap elevates throat weight and marks session first gap done", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    const weights = (pool as any).adjustWeights({ gapMs: 1000, chunkIndex: 1, isFirstGap: true });
    expect(weights.throat).toBeGreaterThan(0.10);
    expect((pool as any).sessionFirstGapDone).toBe(false);

    expect(pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: true })).toBeString();
    expect((pool as any).sessionFirstGapDone).toBe(true);
    warnSpy.mockRestore();
  });

  test("short gaps elevate pause weight", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    const weights = (pool as any).adjustWeights({ gapMs: 400, chunkIndex: 1, isFirstGap: false });

    expect(weights.pause).toBeGreaterThan(0.15);
    warnSpy.mockRestore();
  });

  test("recently played category is suppressed", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);
    (pool as any).lastPlayed = [(pool as any).assets.get("think")[0]];

    const weights = (pool as any).adjustWeights({ gapMs: 1000, chunkIndex: 1, isFirstGap: false });

    expect(weights.think).toBeLessThan(0.35);
    warnSpy.mockRestore();
  });

  test("missing category dirs are skipped while other categories remain available", () => {
    const root = tempDir();
    dirs.push(root);
    const think = writeAsset(root, "think", "think.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    expect((pool as any).assets.size).toBe(1);
    expect(pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: false })).toBe(think);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("later chunk gaps produce valid filler picks with no suppression", () => {
    const root = tempDir();
    dirs.push(root);
    const files = writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: true });

    for (const chunkIndex of [2, 3, 5, 8, 15]) {
      const picked = pool.pick({ gapMs: 1000, chunkIndex, isFirstGap: false });
      expect(picked).toBeString();
      expect(files).toContain(picked);
    }

    warnSpy.mockRestore();
  });

  test("firstGapHandled is false initially and true after first-gap pick", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    expect(pool.firstGapHandled).toBe(false);

    pool.pick({ gapMs: 1000, chunkIndex: 3, isFirstGap: true });
    expect(pool.firstGapHandled).toBe(true);

    pool.pick({ gapMs: 1000, chunkIndex: 7, isFirstGap: false });
    expect(pool.firstGapHandled).toBe(true);

    warnSpy.mockRestore();
  });

  test("first-gap throat boost applies to actual first gap regardless of chunk index", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    const weights = (pool as any).adjustWeights({ gapMs: 1000, chunkIndex: 5, isFirstGap: true });
    expect(weights.throat).toBeGreaterThan(0.10);

    warnSpy.mockRestore();
  });

  test("later gaps after first-gap pick still produce normalized weights without throat boost", () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    pool.pick({ gapMs: 1000, chunkIndex: 1, isFirstGap: true });

    const weights = (pool as any).adjustWeights({ gapMs: 1000, chunkIndex: 5, isFirstGap: false });
    const total = weights.breath + weights.think + weights.pause + weights.throat;
    expect(total).toBeCloseTo(1, 6);
    expect(weights.breath).toBeGreaterThan(0);
    expect(weights.think).toBeGreaterThan(0);
    expect(weights.pause).toBeGreaterThan(0);
    expect(weights.throat).toBeGreaterThan(0);

    warnSpy.mockRestore();
  });

  test("long generation delay at later chunk gets full filler eligibility", () => {
    const root = tempDir();
    dirs.push(root);
    const files = writeOnePerCategory(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    const pool = new FillerPool(root);

    pool.pick({ gapMs: 500, chunkIndex: 1, isFirstGap: true });
    pool.pick({ gapMs: 400, chunkIndex: 2, isFirstGap: false });
    pool.pick({ gapMs: 350, chunkIndex: 3, isFirstGap: false });
    pool.pick({ gapMs: 600, chunkIndex: 4, isFirstGap: false });

    const picked = pool.pick({ gapMs: 3000, chunkIndex: 5, isFirstGap: false });
    expect(picked).toBeString();
    expect(files).toContain(picked);

    const freshPool = new FillerPool(root);
    const weights = (freshPool as any).adjustWeights({ gapMs: 3000, chunkIndex: 5, isFirstGap: false });
    expect(weights.breath).toBeGreaterThan(0.40);

    warnSpy.mockRestore();
  });
});

describe("FillerPool.pickByCategory", () => {
  let dirs: string[] = [];

  beforeEach(() => {
    dirs = [];
  });

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("pickByCategory('breath') returns a file from the breath category", () => {
    const root = tempDir();
    dirs.push(root);
    const breathFile = writeAsset(root, "breath", "breath1.mp3");
    writeAsset(root, "think", "think1.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const picked = pool.pickByCategory("breath");

    expect(picked).toBe(breathFile);
    warnSpy.mockRestore();
  });

  test("pickByCategory respects the two-slot anti-repeat buffer", () => {
    const root = tempDir();
    dirs.push(root);
    const a = writeAsset(root, "breath", "a.mp3");
    const b = writeAsset(root, "breath", "b.mp3");
    const c = writeAsset(root, "breath", "c.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);

    withRandom([0, 0, 0], () => {
      const first = pool.pickByCategory("breath");
      expect(first).toBe(a);

      const second = pool.pickByCategory("breath");
      expect(second).not.toBe(a);

      const third = pool.pickByCategory("breath");
      expect(third).not.toBe(first);
      expect(third).not.toBe(second);
    });

    warnSpy.mockRestore();
  });

  test("pickByCategory with avoid list skips specified files", () => {
    const root = tempDir();
    dirs.push(root);
    const a = writeAsset(root, "breath", "a.mp3");
    const b = writeAsset(root, "breath", "b.mp3");
    const c = writeAsset(root, "breath", "c.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const picked = pool.pickByCategory("breath", [a, b]);

    expect(picked).toBe(c);
    warnSpy.mockRestore();
  });

  test("pickByCategory returns null when all files are in avoid list", () => {
    const root = tempDir();
    dirs.push(root);
    const a = writeAsset(root, "breath", "a.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const picked = pool.pickByCategory("breath", [a]);

    expect(picked).toBeNull();
    warnSpy.mockRestore();
  });

  test("pickByCategory returns null for empty category", () => {
    const root = tempDir();
    dirs.push(root);
    writeAsset(root, "think", "think1.mp3");
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const picked = pool.pickByCategory("breath");

    expect(picked).toBeNull();
    warnSpy.mockRestore();
  });

  test("pickByCategory returns null for empty asset pool", () => {
    const root = tempDir();
    dirs.push(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const picked = pool.pickByCategory("breath");

    expect(picked).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("playFiller", () => {
  afterEach(() => {
    resetFillerAvailabilityCache();
    const maybeMock = Bun.spawn as unknown as { mockRestore?: () => void };
    maybeMock.mockRestore?.();
  });

  test("returns a FillerPlayHandle with done and pid", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(0), pid: 1 } as any;
      return { exited: Promise.resolve(0), pid: 123 } as any;
    });

    const handle = await playFiller("/tmp/filler.mp3", 85);

    expect(handle.pid).toBe(123);
    expect(handle.done).toBeInstanceOf(Promise);
    await expect(handle.done).resolves.toBeUndefined();
  });

  test("done resolves on mpv non-zero exit and logs warning", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(0), pid: 1 } as any;
      return { exited: Promise.resolve(2), pid: 124 } as any;
    });
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const handle = await playFiller("/tmp/filler.mp3", 85);

    await expect(handle.done).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("natural-voices", expect.stringContaining("mpv exited non-zero"));
    warnSpy.mockRestore();
  });

  test("mpv unavailable resolves immediately", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(1), pid: 1 } as any;
      throw new Error("ENOENT");
    });
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const handle = await playFiller("/tmp/filler.mp3", 85);

    expect(handle.pid).toBe(0);
    await expect(handle.done).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("natural-voices", expect.stringContaining("mpv not available"));
    warnSpy.mockRestore();
  });
});

describe("Natural Voices TTS integration", () => {
  let dirs: string[] = [];
  let getSpy: ReturnType<typeof spyOn> | null = null;
  let infoSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    dirs = [];
    ttsDelayMs = 0;
  });

  afterEach(() => {
    getSpy?.mockRestore();
    infoSpy?.mockRestore();
    const maybeMock = Bun.spawn as unknown as { mockRestore?: () => void };
    maybeMock.mockRestore?.();
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("enabled false skips filler playback path", async () => {
    const { textToSpeech } = await import("../src/ai/tts");
    getSpy = spyOn(settingsManager, "get").mockReturnValue(settingsWithNaturalVoices({ enabled: false }));
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(0), pid: 1 } as any;
      return { exited: Promise.resolve(0), pid: 2 } as any;
    });
    const infoSpy = spyOn(logger, "info").mockImplementation(() => {});

    await expect(textToSpeech("This is a natural voices disabled smoke test.")).resolves.toBeUndefined();

    const fillerLogs = infoSpy.mock.calls.filter(call =>
      typeof call[1] === "string" &&
      (call[1].includes("Filler injected for chunk") || call[1].includes("Latency masking filler for chunk"))
    );
    expect(fillerLogs.length).toBe(0);
    infoSpy.mockRestore();
  });

  test("enabled with assets injects filler without throwing", async () => {
    const root = tempDir();
    dirs.push(root);
    writeOnePerCategory(root);
    ttsDelayMs = 80;

    const { textToSpeech } = await import("../src/ai/tts");
    getSpy = spyOn(settingsManager, "get").mockReturnValue(settingsWithNaturalVoices({
      enabled: true,
      latencyMasking: { enabled: true, deadlineMs: 1 },
      maxOverhangMs: 1,
      assetsDir: root,
    }));
    infoSpy = spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    spyOn(Bun, "spawn").mockImplementation((args: string[]) => {
      if (args[0] === "bash") return { exited: Promise.resolve(0), pid: 1 } as any;
      return { exited: Promise.resolve(0), pid: 2 } as any;
    });

    await expect(textToSpeech("This smoke test is long enough to produce a generated audio wait.")).resolves.toBeUndefined();

    expect(infoSpy).toHaveBeenCalledWith("tts", expect.stringContaining("Latency masking filler for chunk"));
    warnSpy.mockRestore();
  });
});
