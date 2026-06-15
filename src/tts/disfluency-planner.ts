import type { FillerCategory } from "./natural-voices";
import type { FillerPool } from "./natural-voices";
import { LAST_PLAYED_WINDOW, RECENT_PENALTY } from "./natural-voices";
import { logger } from "../logger";

export interface ChunkJob {
  id: number;
  text: string;
  audioFile: string;
  ready: boolean;
  error?: boolean;
  generationStart?: number;
  generationEnd?: number;
}

export type PlaybackItem =
  | { kind: "chunk"; job: ChunkJob }
  | { kind: "filler"; file: string; category: FillerCategory };

export type PlaybackPlan = PlaybackItem[];

export interface DensityCurve {
  for(chunkCount: number): [min: number, max: number];
}

export class DefaultDensityCurve implements DensityCurve {
  for(n: number): [number, number] {
    if (n <= 1) return [0, 0];
    if (n <= 4) return [0, 1];
    if (n === 5) return [0, 2];
    if (n <= 8) return [1, 2];
    if (n <= 12) return [1, 3];
    if (n <= 20) return [2, 4];
    return [3, 5];
  }
}

export interface CategoryBias {
  first?: Partial<Record<FillerCategory, number>>;
  middle?: Partial<Record<FillerCategory, number>>;
  last?: Partial<Record<FillerCategory, number>>;
}

export interface PlannerConfig {
  densityCurve?: DensityCurve;
  categoryBias?: CategoryBias;
  minChunkLengthForFiller?: number;
  /**
   * Minimum number of chunk-gaps between two consecutive fillers.
   * Prevents back-to-back filler injection which sounds unnatural.
   * Default: 2 (at least one gap separating every pair of fillers).
   */
  minFillerSpacing?: number;
}

const CATEGORIES: FillerCategory[] = ["breath", "think", "pause", "throat"];

const DEFAULT_CATEGORY_BIAS: CategoryBias = {
  first: { throat: 1.5, breath: 1.3, think: 0.8, pause: 0.8 },
  middle: { think: 1.4, breath: 1.2, throat: 0.8, pause: 0.9 },
  last: { pause: 1.5, breath: 1.3, think: 0.8, throat: 0.8 },
};

export class DisfluencyPlanner {
  private readonly pool: FillerPool;
  private readonly densityCurve: DensityCurve;
  private readonly categoryBias: CategoryBias;
  private readonly minChunkLengthForFiller: number;
  private readonly minFillerSpacing: number;

  constructor(pool: FillerPool, config?: PlannerConfig) {
    this.pool = pool;
    this.densityCurve = config?.densityCurve ?? new DefaultDensityCurve();
    this.categoryBias = config?.categoryBias ?? DEFAULT_CATEGORY_BIAS;
    this.minChunkLengthForFiller = config?.minChunkLengthForFiller ?? 60;
    this.minFillerSpacing = config?.minFillerSpacing ?? 2;
  }

  plan(chunks: string[], jobs: ChunkJob[]): PlaybackPlan {
    const n = chunks.length;
    const transitions = n - 1;

    if (transitions === 0) {
      return jobs.map(j => ({ kind: "chunk" as const, job: j }));
    }

    const [minF, maxF] = this.densityCurve.for(n);
    const fillerCount = this.randomInt(minF, maxF + 1);

    if (fillerCount === 0) {
      return jobs.map(j => ({ kind: "chunk" as const, job: j }));
    }

    const eligiblePositions = this.getEligiblePositions(chunks, transitions);

    // Falls back to sampleWithoutReplacement when minFillerSpacing <= 1.
    const positions =
      this.minFillerSpacing >= 2
        ? this.sampleWithMinSpacing(eligiblePositions, fillerCount, this.minFillerSpacing)
        : this.sampleWithoutReplacement(eligiblePositions, fillerCount);

    positions.sort((a, b) => a - b);

    const plan: PlaybackPlan = [];

    // Capped at LAST_PLAYED_WINDOW so tiny asset pools do not exhaust.
    const recentFiles: string[] = [];
    const recentPlanCategories: FillerCategory[] = [];

    const positionSet = new Set(positions);

    for (let i = 0; i < n; i++) {
      plan.push({ kind: "chunk", job: jobs[i]! });

      if (positionSet.has(i)) {
        const category = this.pickCategory(i, n, recentPlanCategories);
        const file = this.pool.pickByCategory(category, recentFiles, false);
        if (file !== null) {
          plan.push({ kind: "filler", file, category });

          recentFiles.push(file);
          if (recentFiles.length > LAST_PLAYED_WINDOW) {
            recentFiles.shift();
          }

          // Rolling window of recent planned categories, mirroring
          // pool.recentCategories() so pickCategory can apply the same penalty.
          recentPlanCategories.push(category);
          if (recentPlanCategories.length > LAST_PLAYED_WINDOW) {
            recentPlanCategories.shift();
          }
        } else {
          logger.debug("tts", `Dropped planned filler at transition ${i}: no available asset`);
        }
      }
    }

    return plan;
  }

  private getEligiblePositions(chunks: string[], transitions: number): number[] {
    const eligible: number[] = [];
    for (let i = 0; i < transitions; i++) {
      const prevChunk = chunks[i]!;
      // Gate only on the chunk that was just spoken. A pause after a short
      // chunk sounds wrong regardless of what follows.
      if (prevChunk.length >= this.minChunkLengthForFiller) {
        eligible.push(i);
      }
    }
    return eligible;
  }

  private pickCategory(
    positionIndex: number,
    totalChunks: number,
    recentPlanCategories: FillerCategory[],
  ): FillerCategory {
    const transitions = totalChunks - 1;
    let biasSet: Partial<Record<FillerCategory, number>>;

    if (positionIndex === 0) {
      biasSet = this.categoryBias.first ?? {};
    } else if (positionIndex >= transitions - 1) {
      // >= rather than ===: the "last" bias should apply to the final eligible
      // slot even when the absolute last transition is ineligible.
      biasSet = this.categoryBias.last ?? {};
    } else {
      biasSet = this.categoryBias.middle ?? {};
    }

    const recentCatSet = new Set(recentPlanCategories);

    const baseWeight = 1.0;
    const weights: Record<FillerCategory, number> = {
      breath: baseWeight * (biasSet.breath ?? 1.0),
      think: baseWeight * (biasSet.think ?? 1.0),
      pause: baseWeight * (biasSet.pause ?? 1.0),
      throat: baseWeight * (biasSet.throat ?? 1.0),
    };

    // Zero out categories with no assets so they cannot be selected.
    for (const cat of CATEGORIES) {
      if (this.pool.categoryCount(cat) === 0) {
        weights[cat] = 0;
      }
    }

    for (const cat of recentCatSet) {
      weights[cat] *= RECENT_PENALTY;
    }

    return this.weightedPick(weights);
  }

  private weightedPick(weights: Record<FillerCategory, number>): FillerCategory {
    let total = 0;
    for (const cat of CATEGORIES) {
      total += weights[cat];
    }

    if (total <= 0) {
      const available = CATEGORIES.filter(cat => this.pool.categoryCount(cat) > 0);
      if (available.length === 0) return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]!;
      return available[Math.floor(Math.random() * available.length)]!;
    }

    let roll = Math.random() * total;
    for (const cat of CATEGORIES) {
      roll -= weights[cat]!;
      if (roll <= 0) return cat;
    }

    return CATEGORIES[CATEGORIES.length - 1]!;
  }

  /**
   * Sample `count` positions from `pool` such that no two selected positions
   * are within `minGap` of each other. Used by the main plan() call to
   * prevent back-to-back fillers, which sound unnatural.
   *
   * Algorithm: shuffle eligible positions, then greedily accept each
   * candidate only if it is at least minGap away from already-accepted
   * positions. Returns fewer than `count` if the spacing constraint makes
   * it impossible to fill the requested amount.
   */
  private sampleWithMinSpacing(pool: number[], count: number, minGap: number): number[] {
    if (pool.length === 0 || count <= 0) return [];

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    const selected: number[] = [];
    for (const candidate of shuffled) {
      if (selected.length >= count) break;
      const tooClose = selected.some(s => Math.abs(candidate - s) < minGap);
      if (!tooClose) {
        selected.push(candidate);
      }
    }

    return selected;
  }

  private sampleWithoutReplacement(pool: number[], count: number): number[] {
    if (count >= pool.length) return [...pool];

    const available = [...pool];
    const selected: number[] = [];

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * available.length);
      selected.push(available[idx]!);
      available.splice(idx, 1);
    }

    return selected;
  }

  private randomInt(min: number, maxExclusive: number): number {
    const range = maxExclusive - min;
    if (range <= 0) return min;
    return min + Math.floor(Math.random() * range);
  }
}
