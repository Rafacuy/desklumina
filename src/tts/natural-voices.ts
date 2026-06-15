import { readdirSync, promises as fsPromises } from "fs";
import { join, resolve } from "path";
import { logger } from "../logger";

export type FillerCategory = "breath" | "think" | "pause" | "throat";

export interface FillerWeights {
  breath: number;
  think: number;
  pause: number;
  throat: number;
}

interface FillerPickContext {
  gapMs: number;
  chunkIndex: number;
  isFirstGap: boolean;
}

/**
 * Number of recently-played files tracked for anti-repeat purposes.
 * Exported so DisfluencyPlanner can keep its rolling window in sync.
 */
export const LAST_PLAYED_WINDOW = 3;

/**
 * Multiplier applied to the weight of any category that has been used recently
 */
export const RECENT_PENALTY = 0.30;

const CATEGORIES: FillerCategory[] = ["breath", "think", "pause", "throat"];
const CATEGORY_DIRS: Record<FillerCategory, string> = {
  breath: "breath",
  think: "think",
  pause: "pause",
  throat: "throat",
};

const SUPPORTED_EXTENSIONS = [".mp3", ".opus", ".wav"];

export interface FillerPlayHandle {
  done: Promise<void>;
  pid: number;
  kill(): void;
}

class FillerPlayHandleImpl implements FillerPlayHandle {
  constructor(
    readonly done: Promise<void>,
    readonly pid: number,
  ) {}

  kill(): void {
    if (this.pid > 0) {
      try {
        process.kill(this.pid);
      } catch {
        //ignore
      }
    }
  }
}

export class FillerPool {
  private readonly assets: Map<FillerCategory, string[]>;
  private readonly baseWeights: FillerWeights;

  private readonly fileToCategory: Map<string, FillerCategory>;

  private lastPlayed: string[];
  private sessionFirstGapDone: boolean;

  constructor(assets: Map<FillerCategory, string[]>);
  /**
   * @deprecated Prefer `FillerPool.fromDirectory(assetsDir)` for non-blocking
   * initialization. Retained for tests and backwards compatibility.
   */
  constructor(assetsDir: string);
  constructor(assetsDirOrMap: string | Map<FillerCategory, string[]>) {
    if (typeof assetsDirOrMap === "string") {
      this.assets = this.resolveAssetsSync(assetsDirOrMap);
    } else {
      this.assets = assetsDirOrMap;
    }

    this.baseWeights = { breath: 0.40, think: 0.35, pause: 0.15, throat: 0.10 };
    this.lastPlayed = [];
    this.sessionFirstGapDone = false;

    this.fileToCategory = new Map();
    for (const [category, files] of this.assets) {
      for (const file of files) {
        this.fileToCategory.set(file, category);
      }
    }

    if (this.assets.size === 0) {
      logger.warn("natural-voices", "Asset pool is empty — filler injection disabled");
    }
  }

  static async fromDirectory(assetsDir: string): Promise<FillerPool> {
    const assets = await resolveAssetsAsync(assetsDir);
    return new FillerPool(assets);
  }

  get firstGapHandled(): boolean {
    return this.sessionFirstGapDone;
  }

  /**
   * Mark the session's first gap as handled. Used by the playback orchestrator
   * when a plan-based filler occupies the first transition, because planning
   * uses `mutateState: false` and therefore does not update this flag itself.
   */
  markFirstGapHandled(): void {
    this.sessionFirstGapDone = true;
  }

  /**
   * Returns the number of assets available for a category (0 if none)
   */
  categoryCount(category: FillerCategory): number {
    return this.assets.get(category)?.length ?? 0;
  }

  pick(ctx: FillerPickContext): string | null {
    if (this.assets.size === 0) return null;

    const weights = this.adjustWeights(ctx);
    const category = this.weightedCategoryPick(weights);
    if (!category) return null;

    let candidate = this.randomFromCategory(category);
    if (!candidate) return null;

    if (this.isRepeat(candidate)) {
      const retry = this.randomFromCategory(category);
      if (retry && !this.isRepeat(retry)) {
        candidate = retry;
      } else {
        // Both in-category options are repeats; try an alternate category.
        // Zero out the current category so it cannot win again.
        const alternateWeights = { ...weights, [category]: 0 };
        const alternateCategory = this.weightedCategoryPick(this.normalizeWeights(alternateWeights));
        const alternate = alternateCategory ? this.randomFromCategory(alternateCategory) : null;
        if (alternate && !this.isRepeat(alternate)) {
          candidate = alternate;
        }
        // If even the alternate is a repeat, accept candidate as-is
        // another retry risks an infinite loop on tiny asset pools.
      }
    }

    this.recordPlayed(candidate);
    if (ctx.isFirstGap) this.sessionFirstGapDone = true;

    return candidate;
  }

  pickByCategory(category: FillerCategory, avoid?: string[], mutateState: boolean = true): string | null {
    if (this.assets.size === 0) return null;

    const files = this.assets.get(category);
    if (!files || files.length === 0) return null;

    const avoidSet = new Set(avoid ?? []);
    const candidates = files.filter(f => !avoidSet.has(f));
    if (candidates.length === 0) return null;

    let candidate = candidates[Math.floor(Math.random() * candidates.length)]!;

    if (this.isRepeat(candidate)) {
      const nonRepeat = candidates.filter(f => !this.isRepeat(f));
      if (nonRepeat.length > 0) {
        candidate = nonRepeat[Math.floor(Math.random() * nonRepeat.length)]!;
      }
    }

    if (mutateState) {
      this.recordPlayed(candidate);
    }
    return candidate;
  }

  categoryOf(file: string): FillerCategory | undefined {
    return this.fileToCategory.get(file);
  }

  private resolveAssetsSync(assetsDir: string): Map<FillerCategory, string[]> {
    const assets = new Map<FillerCategory, string[]>();
    const root = resolve(assetsDir);

    for (const category of CATEGORIES) {
      const dir = join(root, CATEGORY_DIRS[category]);
      try {
        const files = readdirSync(dir)
          .sort()
          .filter(file => {
            const lower = file.toLowerCase();
            return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
          })
          .map(file => join(dir, file));

        if (files.length > 0) {
          assets.set(category, files);
        }
      } catch {
        logger.warn("natural-voices", `Category directory not found: ${dir}`);
      }
    }

    return assets;
  }

  private adjustWeights(ctx: FillerPickContext): FillerWeights {
    const weights: FillerWeights = { ...this.baseWeights };

    if (ctx.isFirstGap) {
      weights.throat += 0.10;
      weights.breath -= 0.10;
    }

    if (ctx.gapMs > 2000) {
      weights.breath += 0.15;
      weights.pause -= 0.10;
      weights.throat -= 0.05;
    }

    if (ctx.gapMs < 500) {
      weights.pause += 0.15;
      weights.breath -= 0.10;
      weights.throat -= 0.05;
    }

    for (const category of this.recentCategories()) {
      weights[category] *= RECENT_PENALTY;
    }

    return this.normalizeWeights(weights);
  }

  private weightedCategoryPick(weights: FillerWeights): FillerCategory | null {
    let total = 0;
    for (const category of CATEGORIES) {
      if ((this.assets.get(category)?.length ?? 0) > 0) {
        total += weights[category];
      }
    }

    if (total <= 0) return null;

    let roll = Math.random() * total;
    for (const category of CATEGORIES) {
      if ((this.assets.get(category)?.length ?? 0) === 0) continue;
      roll -= weights[category];
      if (roll <= 0) return category;
    }

    return null;
  }

  private randomFromCategory(category: FillerCategory): string | null {
    const files = this.assets.get(category);
    if (!files || files.length === 0) return null;

    return files[Math.floor(Math.random() * files.length)] ?? null;
  }

  private isRepeat(candidate: string): boolean {
    return this.lastPlayed.includes(candidate);
  }

  private recordPlayed(path: string): void {
    this.lastPlayed.push(path);
    if (this.lastPlayed.length > LAST_PLAYED_WINDOW) {
      this.lastPlayed.shift();
    }
  }

  private recentCategories(): Set<FillerCategory> {
    const categories = new Set<FillerCategory>();
    for (const file of this.lastPlayed) {
      const cat = this.fileToCategory.get(file);
      if (cat) categories.add(cat);
    }
    return categories;
  }

  private normalizeWeights(weights: FillerWeights): FillerWeights {
    const clamped: FillerWeights = {
      breath: Math.max(0, Math.min(1, weights.breath)),
      think: Math.max(0, Math.min(1, weights.think)),
      pause: Math.max(0, Math.min(1, weights.pause)),
      throat: Math.max(0, Math.min(1, weights.throat)),
    };

    const total = clamped.breath + clamped.think + clamped.pause + clamped.throat;
    if (total <= 0) {
      return { breath: 0, think: 0, pause: 0, throat: 0 };
    }

    return {
      breath: clamped.breath / total,
      think: clamped.think / total,
      pause: clamped.pause / total,
      throat: clamped.throat / total,
    };
  }
}

async function hasCommand(command: string): Promise<boolean> {
  const proc = Bun.spawn(["bash", "-lc", `command -v ${command}`], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await proc.exited) === 0;
}

let mpvAvailable: boolean | undefined;

export function resetFillerAvailabilityCache(): void {
  mpvAvailable = undefined;
}

export async function playFiller(file: string, volume: number): Promise<FillerPlayHandle> {
  if (mpvAvailable === undefined) {
    mpvAvailable = await hasCommand("mpv");
  }
  if (!mpvAvailable) {
    logger.warn("natural-voices", "mpv not available for filler playback");
    return new FillerPlayHandleImpl(Promise.resolve(), 0);
  }

  try {
    const mpv = Bun.spawn(["mpv", "--no-terminal", "--really-quiet", `--volume=${volume}`, file], {
      stdout: "ignore",
      stderr: "ignore",
    });

    const done = mpv.exited
      .then(code => {
        if (code !== 0) {
          logger.warn("natural-voices", `mpv exited non-zero for filler ${file}: ${code}`);
        }
      })
      .catch(error => {
        logger.warn("natural-voices", `mpv filler playback failed: ${error instanceof Error ? error.message : String(error)}`);
      });

    return new FillerPlayHandleImpl(done, mpv.pid ?? 0);
  } catch (error) {
    logger.warn("natural-voices", `mpv not available for filler playback: ${error instanceof Error ? error.message : String(error)}`);
    return new FillerPlayHandleImpl(Promise.resolve(), 0);
  }
}

async function resolveAssetsAsync(assetsDir: string): Promise<Map<FillerCategory, string[]>> {
  const assets = new Map<FillerCategory, string[]>();
  const root = resolve(assetsDir);

  for (const category of CATEGORIES) {
    const dir = join(root, CATEGORY_DIRS[category]);
    try {
      const entries = await fsPromises.readdir(dir);
      const files = entries
        .sort()
        .filter(file => {
          const lower = file.toLowerCase();
          return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
        })
        .map(file => join(dir, file));

      if (files.length > 0) {
        assets.set(category, files);
      }
    } catch {
      logger.warn("natural-voices", `Category directory not found: ${dir}`);
    }
  }

  return assets;
}
