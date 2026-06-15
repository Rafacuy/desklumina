import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DisfluencyPlanner, DefaultDensityCurve, type ChunkJob } from "../../src/tts/disfluency-planner";
import { FillerPool, type FillerCategory } from "../../src/tts/natural-voices";
import { logger } from "../../src/logger";
import { spyOn } from "bun:test";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "desklumina-dhe-"));
}

function writeAsset(root: string, category: string, name: string): string {
  const dir = join(root, category);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, "mp3");
  return file;
}

function writeMultiplePerCategory(root: string, count: number): void {
  for (const cat of ["breath", "think", "pause", "throat"]) {
    for (let i = 0; i < count; i++) {
      writeAsset(root, cat, `${cat}-${i}.mp3`);
    }
  }
}

function makeChunks(n: number, len: number = 100): string[] {
  return Array.from({ length: n }, (_, i) => "x".repeat(len) + ` chunk${i}`);
}

function makeJobs(chunks: string[]): ChunkJob[] {
  return chunks.map((text, i) => ({
    id: i,
    text,
    audioFile: `/tmp/test-${i}.mp3`,
    ready: false,
  }));
}

describe("DefaultDensityCurve", () => {
  const curve = new DefaultDensityCurve();

  test("N=1 returns [0,0]", () => {
    expect(curve.for(1)).toEqual([0, 0]);
  });

  test("N=2 returns [0,1]", () => {
    expect(curve.for(2)).toEqual([0, 1]);
  });

  test("N=4 returns [0,1]", () => {
    expect(curve.for(4)).toEqual([0, 1]);
  });

  test("N=5 returns [0,2]", () => {
    expect(curve.for(5)).toEqual([0, 2]);
  });

  test("N=6 returns [1,2]", () => {
    expect(curve.for(6)).toEqual([1, 2]);
  });

  test("N=8 returns [1,2]", () => {
    expect(curve.for(8)).toEqual([1, 2]);
  });

  test("N=9 returns [1,3]", () => {
    expect(curve.for(9)).toEqual([1, 3]);
  });

  test("N=12 returns [1,3]", () => {
    expect(curve.for(12)).toEqual([1, 3]);
  });

  test("N=13 returns [2,4]", () => {
    expect(curve.for(13)).toEqual([2, 4]);
  });

  test("N=20 returns [2,4]", () => {
    expect(curve.for(20)).toEqual([2, 4]);
  });

  test("N=21 returns [3,5]", () => {
    expect(curve.for(21)).toEqual([3, 5]);
  });

  test("N=100 returns [3,5]", () => {
    expect(curve.for(100)).toEqual([3, 5]);
  });
});

describe("DisfluencyPlanner", () => {
  let dirs: string[] = [];

  function cleanup() {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs = [];
  }

  test("N=1 returns only chunk items, no fillers", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 3);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(1);
    const jobs = makeJobs(chunks);

    const plan = planner.plan(chunks, jobs);

    expect(plan.length).toBe(1);
    expect(plan[0]!.kind).toBe("chunk");
    expect(plan.filter(i => i.kind === "filler").length).toBe(0);

    warnSpy.mockRestore();
    cleanup();
  });

  test("N=2 returns at most 1 filler", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 3);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(2);
    const jobs = makeJobs(chunks);

    for (let i = 0; i < 20; i++) {
      const plan = planner.plan(chunks, jobs);
      const fillers = plan.filter(item => item.kind === "filler");
      expect(fillers.length).toBeLessThanOrEqual(1);
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("filler count never exceeds max from density curve", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const curve = new DefaultDensityCurve();
    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);

    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 20]) {
      const chunks = makeChunks(n);
      const jobs = makeJobs(chunks);
      const [, maxF] = curve.for(n);

      for (let run = 0; run < 10; run++) {
        const plan = planner.plan(chunks, jobs);
        const fillerCount = plan.filter(i => i.kind === "filler").length;
        expect(fillerCount).toBeLessThanOrEqual(maxF);
      }
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("filler positions are always valid transition indices", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);

    for (const n of [3, 5, 8, 10]) {
      const chunks = makeChunks(n);
      const jobs = makeJobs(chunks);

      for (let run = 0; run < 10; run++) {
        const plan = planner.plan(chunks, jobs);
        let chunkIndex = 0;

        for (const item of plan) {
          if (item.kind === "chunk") {
            chunkIndex++;
          } else if (item.kind === "filler") {
            const transitionIndex = chunkIndex - 1;
            expect(transitionIndex).toBeGreaterThanOrEqual(0);
            expect(transitionIndex).toBeLessThan(n - 1);
          }
        }
      }
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("no two filler items occupy the same transition", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);

    for (const n of [5, 8, 10, 15]) {
      const chunks = makeChunks(n);
      const jobs = makeJobs(chunks);

      for (let run = 0; run < 10; run++) {
        const plan = planner.plan(chunks, jobs);
        const transitions: number[] = [];
        let chunkIndex = 0;

        for (const item of plan) {
          if (item.kind === "chunk") {
            chunkIndex++;
          } else if (item.kind === "filler") {
            transitions.push(chunkIndex - 1);
          }
        }

        const unique = new Set(transitions);
        expect(unique.size).toBe(transitions.length);
      }
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("calling plan() multiple times produces different plans (variance > 0)", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(10);
    const jobs = makeJobs(chunks);

    const fillerCounts = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const plan = planner.plan(chunks, jobs);
      fillerCounts.add(plan.filter(item => item.kind === "filler").length);
    }

    expect(fillerCounts.size).toBeGreaterThan(1);

    warnSpy.mockRestore();
    cleanup();
  });

  test("empty asset pool produces only chunk items", () => {
    const root = tempDir();
    dirs.push(root);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(10);
    const jobs = makeJobs(chunks);

    const plan = planner.plan(chunks, jobs);

    expect(plan.length).toBe(chunks.length);
    expect(plan.every(i => i.kind === "chunk")).toBe(true);

    warnSpy.mockRestore();
    cleanup();
  });

  test("category bias: first transition favors throat/breath over many runs", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(6);
    const jobs = makeJobs(chunks);

    const firstCategories: FillerCategory[] = [];
    for (let i = 0; i < 100; i++) {
      const plan = planner.plan(chunks, jobs);
      const firstFiller = plan.find(item => item.kind === "filler");
      if (firstFiller && firstFiller.kind === "filler") {
        firstCategories.push(firstFiller.category);
      }
    }

    const throatBreathCount = firstCategories.filter(c => c === "throat" || c === "breath").length;
    const totalCount = firstCategories.length;

    if (totalCount > 10) {
      expect(throatBreathCount / totalCount).toBeGreaterThan(0.35);
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("category bias: last transition favors pause/breath over many runs", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(6);
    const jobs = makeJobs(chunks);

    const lastCategories: FillerCategory[] = [];
    for (let i = 0; i < 100; i++) {
      const plan = planner.plan(chunks, jobs);
      const fillers = plan.filter(item => item.kind === "filler");
      const lastFiller = fillers[fillers.length - 1];
      if (lastFiller && lastFiller.kind === "filler") {
        lastCategories.push(lastFiller.category);
      }
    }

    const pauseBreathCount = lastCategories.filter(c => c === "pause" || c === "breath").length;
    const totalCount = lastCategories.length;

    if (totalCount > 10) {
      expect(pauseBreathCount / totalCount).toBeGreaterThan(0.35);
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("short chunks below minChunkLengthForFiller suppress fillers on their transitions", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool, { minChunkLengthForFiller: 60 });

    const chunks = ["short", "short", "short", "short", "short"];
    const jobs = makeJobs(chunks);

    for (let i = 0; i < 20; i++) {
      const plan = planner.plan(chunks, jobs);
      expect(plan.filter(item => item.kind === "filler").length).toBe(0);
    }

    warnSpy.mockRestore();
    cleanup();
  });

  test("plan preserves chunk order", () => {
    const root = tempDir();
    dirs.push(root);
    writeMultiplePerCategory(root, 5);
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const pool = new FillerPool(root);
    const planner = new DisfluencyPlanner(pool);
    const chunks = makeChunks(8);
    const jobs = makeJobs(chunks);

    const plan = planner.plan(chunks, jobs);
    const chunkItems = plan.filter(i => i.kind === "chunk");

    expect(chunkItems.length).toBe(chunks.length);
    for (let i = 0; i < chunks.length; i++) {
      const item = chunkItems[i]!;
      if (item.kind === "chunk") {
        expect(item.job.id).toBe(i);
      }
    }

    warnSpy.mockRestore();
    cleanup();
  });
});
