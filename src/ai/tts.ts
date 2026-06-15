import { t } from "../utils";
import { logger } from "../logger";
import { settingsManager } from "../core/services/settings-manager";
import { Communicate } from "edge-tts-universal";
import { randomUUID } from "crypto";
import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { FillerPool, playFiller, type FillerPlayHandle } from "../tts/natural-voices";
import { DisfluencyPlanner, type PlaybackPlan, type ChunkJob } from "../tts/disfluency-planner";
import { AsyncMutex } from "../utils/async-mutex";
import type { NaturalVoiceSettings } from "../types/settings";
export type { ChunkJob } from "../tts/disfluency-planner";

interface ChunkMetrics {
  avgGenerationTime: number;
  lastChunkSize: number;
  totalProcessed: number;
}

const MAX_PARALLEL = 3;
const FIRST_CHUNK_TARGET = 60;
const MIN_CHUNK_SIZE = 40;
const MAX_CHUNK_SIZE = 220;
const BASE_CHUNK_SIZE = 120;

// Voice map for default voices. New languages are a one-line addition and
// unsupported locales fall back to English instead of Indonesian.
const DEFAULT_VOICE_MAP: Record<string, string> = {
  ja: "ja-JP-NanamiNeural",
  en: "en-US-AvaNeural",
  id: "id-ID-GadisNeural",
};
const DEFAULT_VOICE_FALLBACK = "en-US-AvaNeural";

class AdaptiveChunker {
  private metrics: ChunkMetrics = {
    avgGenerationTime: 0,
    lastChunkSize: 0,
    totalProcessed: 0,
  };

  private calculatePunctuationDensity(text: string): number {
    const punctuation = text.match(/[.!?,;:。、！？]/g)?.length || 0;
    return punctuation / Math.max(text.length, 1);
  }

  private findNaturalBreak(text: string, targetPos: number): number {
    const searchWindow = 30;
    const start = Math.max(0, targetPos - searchWindow);
    const end = Math.min(text.length, targetPos + searchWindow);
    const segment = text.slice(start, end);

    const strongBreaks = [". ", "! ", "? ", "。 ", "！ ", "？ ", "。", "！", "？"];
    for (const brk of strongBreaks) {
      const pos = segment.lastIndexOf(brk, targetPos - start);
      if (pos !== -1) return start + pos + brk.length;
    }

    const weakBreaks = [", ", "; ", ": ", " - ", "、 ", "、"];
    for (const brk of weakBreaks) {
      const pos = segment.lastIndexOf(brk, targetPos - start);
      if (pos !== -1) return start + pos + brk.length;
    }

    const spacePos = segment.lastIndexOf(" ", targetPos - start);
    if (spacePos !== -1) return start + spacePos + 1;

    return targetPos;
  }

  private calculateChunkSize(isFirst: boolean, remaining: number, textDensity: number): number {
    if (isFirst) return Math.min(FIRST_CHUNK_TARGET, remaining);

    let size = BASE_CHUNK_SIZE;

    if (this.metrics.avgGenerationTime > 0 && this.metrics.totalProcessed > 0 && this.metrics.lastChunkSize > 0) {
      const speedFactor = this.metrics.avgGenerationTime / this.metrics.lastChunkSize;
      if (speedFactor < 8) {
        size = Math.min(size * 1.3, MAX_CHUNK_SIZE);
      } else if (speedFactor > 15) {
        size = Math.max(size * 0.7, MIN_CHUNK_SIZE);
      }
    }

    if (textDensity > 0.08) {
      size *= 0.85;
    } else if (textDensity < 0.03) {
      size *= 1.15;
    }

    if (remaining < size * 1.5) {
      size = Math.max(remaining, MIN_CHUNK_SIZE);
    }

    return Math.floor(Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, size)));
  }

  chunk(text: string): string[] {
    const chunks: string[] = [];
    let position = 0;
    let isFirst = true;

    while (position < text.length) {
      const remaining = text.length - position;
      const density = this.calculatePunctuationDensity(text.slice(position, position + 200));
      const targetSize = this.calculateChunkSize(isFirst, remaining, density);

      let breakPoint = Math.min(position + targetSize, text.length);

      if (breakPoint < text.length) {
        breakPoint = this.findNaturalBreak(text, breakPoint);
      }

      const chunk = text.slice(position, breakPoint).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
        this.metrics.lastChunkSize = chunk.length;
      }

      position = breakPoint;
      isFirst = false;
    }

    return chunks.length > 0 ? chunks : [text];
  }

  updateMetrics(generationTime: number, chunkSize: number) {
    const alpha = 0.3;
    if (this.metrics.totalProcessed === 0) {
      this.metrics.avgGenerationTime = generationTime;
    } else {
      this.metrics.avgGenerationTime =
        alpha * generationTime + (1 - alpha) * this.metrics.avgGenerationTime;
    }
    this.metrics.totalProcessed++;
    this.metrics.lastChunkSize = chunkSize;
  }
}

export function cleanText(text: string): string {
  return text
    .replace(/```json\s*\n[\s\S]*?\n```/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
    .replace(/\{"tool":\s*"[^"]+",\s*"args":\s*"[^"]+"\}/g, "")
    .replace(/\[[\s\S]*?\{"tool"[\s\S]*?\](?!\w)/g, "")
    .replace(/[🔧📋✅❌⚠️💬📝📂✕🎵🖥️📁🔔⚙️]/g, "")
    // Broader emoji coverage: BMP symbols, regional indicators, ZWJ sequences.
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{1F1E0}-\u{1F1FF}]{2}|\u200D[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    // Preserve paragraph boundaries: blank-line breaks become sentence
    // terminators, single line breaks become spaces.
    .replace(/([.!?])\s*\n\s*\n\s*/g, "$1 ")
    .replace(/\s*\n\s*\n\s*/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function generateAudio(
  text: string,
  voice: string,
  rate: string,
  outputFile: string,
  session?: PlaybackSession,
): Promise<void> {
  const communicate = new Communicate(text, { voice, rate });
  const chunks: Buffer[] = [];

  for await (const chunk of communicate.stream()) {
    if (session?.isCancelled()) {
      throw new Error("Generation cancelled");
    }
    if (chunk.type === "audio" && chunk.data) {
      chunks.push(chunk.data);
    }
  }

  if (session?.isCancelled()) {
    throw new Error("Generation cancelled");
  }

  if (chunks.length === 0) throw new Error("No audio data received");
  await Bun.write(outputFile, Buffer.concat(chunks));
}

const commandAvailability = new Map<string, boolean>();

export function resetCommandAvailabilityCache(): void {
  commandAvailability.clear();
}

async function hasCommand(command: string): Promise<boolean> {
  const cached = commandAvailability.get(command);
  if (cached !== undefined) return cached;

  const proc = Bun.spawn(["bash", "-lc", `command -v ${command}`], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const result = (await proc.exited) === 0;
  commandAvailability.set(command, result);
  return result;
}

async function playAudio(file: string, volume: number, session?: PlaybackSession): Promise<boolean> {
  if (session?.isCancelled()) return false;

  if (await hasCommand("mpv")) {
    if (session?.isCancelled()) return false;
    const mpv = Bun.spawn(["mpv", "--no-terminal", "--really-quiet", `--volume=${volume}`, file], {
      stdout: "ignore",
      stderr: "ignore",
    });

    session?.registerProcess(mpv);

    const code = await mpv.exited;
    if (session?.isCancelled()) return false;
    if (code === 0) {
      return true;
    }
  }

  if (session?.isCancelled()) return false;
  logger.warn("tts", "mpv not available or playback failed, falling back to SoX 'play'");

  if (await hasCommand("play")) {
    if (session?.isCancelled()) return false;
    const soxPlay = Bun.spawn(["play", "-q", "-v", `${volume / 100}`, file], {
      stdout: "ignore",
      stderr: "ignore",
    });

    session?.registerProcess(soxPlay);

    const code = await soxPlay.exited;
    if (session?.isCancelled()) return false;
    return code === 0;
  }

  logger.warn("tts", "No supported TTS playback backend found (mpv/play)");
  return false;
}

class PlaybackSession {
  readonly id: string;
  private cancelled = false;
  private activeProcesses = new Set<any>();
  private resolveCleanup: (() => void) | null = null;
  private cleanupPromise: Promise<void>;

  constructor(id: string) {
    this.id = id;
    this.cleanupPromise = new Promise<void>((resolve) => {
      this.resolveCleanup = resolve;
    });
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  registerProcess(proc: any) {
    if (this.cancelled) {
      try {
        proc.kill?.();
        if (proc.pid > 0) {
          process.kill(proc.pid);
        }
      } catch {}
      return;
    }
    this.activeProcesses.add(proc);

    const exitPromise = proc.exited || proc.done;
    if (exitPromise && typeof exitPromise.finally === "function") {
      exitPromise.finally(() => {
        this.activeProcesses.delete(proc);
      });
    }
  }

  cancel(): Promise<void> {
    if (this.cancelled) return this.cleanupPromise;
    this.cancelled = true;
    logger.info("tts", `Cancelling TTS session ${this.id}`);

    for (const proc of this.activeProcesses) {
      try {
        proc.kill?.();
        if (proc.pid > 0) {
          process.kill(proc.pid);
        }
      } catch (err) {
        // ignore
      }
    }
    this.activeProcesses.clear();
    this.resolveCleanup?.();
    this.resolveCleanup = null;
    return this.cleanupPromise;
  }

  finish() {
    this.resolveCleanup?.();
    this.resolveCleanup = null;
  }
}

let activeSession: PlaybackSession | null = null;
const sessionMutex = new AsyncMutex();

export async function cancelTTS(): Promise<void> {
  await sessionMutex.runExclusive(async () => {
    if (activeSession) {
      await activeSession.cancel();
      activeSession = null;
    }
  });
}

export async function textToSpeech(text: string): Promise<void> {
  const settings = settingsManager.get();
  const lang = settings.language;
  const defaultVoice = DEFAULT_VOICE_MAP[lang] ?? DEFAULT_VOICE_FALLBACK;
  const voice = settings.tts.voiceId || defaultVoice;
  const speed = settings.tts.speed || 1.0;
  const rate = speed === 1.0 ? "+0%" : `${speed > 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%`;

  const cleaned = cleanText(text);
  if (!cleaned || cleaned.length < 3) {
    logger.warn("tts", "Text too short or empty, skipping TTS");
    return;
  }

  const sessionId = randomUUID();
  const session = new PlaybackSession(sessionId);

  await sessionMutex.runExclusive(async () => {
    if (activeSession) {
      const cleanup = activeSession.cancel();
      await cleanup;
    }
    activeSession = session;
  });

  if (session.isCancelled()) return;

  const tmpDir = join(homedir(), ".config/desklumina/tmp");
  if (!existsSync(tmpDir)) {
    try {
      mkdirSync(tmpDir, { recursive: true });
    } catch (err) {
      logger.error("tts", `Failed to create temp directory: ${err}`);
      return;
    }
  }

  if (session.isCancelled()) return;

  const nvSettings = settings.tts.naturalVoices;
  const naturalVoicesEnabled = nvSettings?.enabled !== false;
  const assetsDir = nvSettings?.assetsDir
    ? nvSettings.assetsDir
    : join(homedir(), ".config/desklumina/assets/natural-voices");

  let fillerPool: FillerPool | null = null;
  if (naturalVoicesEnabled) {
    try {
      fillerPool = await FillerPool.fromDirectory(assetsDir);
    } catch (error) {
      logger.warn("natural-voices", `Natural voices disabled after initialization failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (session.isCancelled()) return;

  const chunker = new AdaptiveChunker();
  const chunks = chunker.chunk(cleaned);

  const jobs: ChunkJob[] = chunks.map((chunk, i) => ({
    id: i,
    text: chunk,
    audioFile: join(tmpDir, `tts-${randomUUID()}-${i}.mp3`),
    ready: false,
    error: false,
  }));

  try {
    const firstChunkLen = chunks[0]?.length ?? 0;
    logger.info("tts", `Adaptive chunking: ${jobs.length} chunks (first: ${firstChunkLen} chars)`);

    const generateQueue = [...jobs];
    let generating = 0;
    let nextPlay = 0;
    const generationErrors: Error[] = [];

    const startGeneration = async (job: ChunkJob) => {
      if (session.isCancelled()) return;
      generating++;
      job.generationStart = Date.now();
      try {
        if (session.isCancelled()) return;
        await generateAudio(job.text, voice, rate, job.audioFile, session);
        if (session.isCancelled()) return;
        job.generationEnd = Date.now();

        const duration = job.generationEnd - job.generationStart;
        chunker.updateMetrics(duration, job.text.length);

        if (job.id === 0) {
          logger.info("tts", `First chunk ready in ${duration}ms`);
        }
      } catch (err) {
        if (session.isCancelled()) return;
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error("tts", `Chunk ${job.id} failed: ${error.message}`);
        job.error = true;
        generationErrors.push(error);
      } finally {
        job.ready = true;
        generating--;
      }
    };

    const disfluencyEnabled = nvSettings?.disfluency?.enabled === true;

    let playbackPlan: PlaybackPlan | null = null;
    if (disfluencyEnabled && fillerPool) {
      const densityCurveOverride = nvSettings?.disfluency?.densityCurve;
      let sortedEntries: [number, [number, number]][] | null = null;
      if (densityCurveOverride) {
        sortedEntries = Object.entries(densityCurveOverride)
          .map(([key, value]) => [Number(key), value] as [number, [number, number]])
          .filter(([key]) => !isNaN(key))
          .sort((a, b) => a[0] - b[0]);
      }

      const planner = new DisfluencyPlanner(fillerPool, {
        densityCurve: sortedEntries
          ? {
              for(n: number): [number, number] {
                for (const [threshold, value] of sortedEntries!) {
                  if (n <= threshold) return value;
                }
                return [3, 5];
              },
            }
          : undefined,
        categoryBias: nvSettings?.disfluency?.categoryBias,
        // Enforce minimum gap between consecutive fillers; falls back to the
        // planner default of 2.
        minFillerSpacing: nvSettings?.disfluency?.minFillerSpacing,
      });
      playbackPlan = planner.plan(chunks, jobs);
      logger.info("tts", `DHE plan: ${playbackPlan.filter(i => i.kind === "filler").length} fillers across ${jobs.length} chunks`);
    }

    if (session.isCancelled()) return;

    const fillerVolume = nvSettings?.volume ?? 100;
    const latencyMaskingEnabled = nvSettings?.latencyMasking?.enabled !== false;
    const deadlineMs = nvSettings?.latencyMasking?.deadlineMs
      ?? nvSettings?.thresholdMs
      ?? 400;
    const MAX_FILLER_OVERHANG_MS = nvSettings?.maxOverhangMs ?? 500;

    const awaitJobWithFillerMasking = async (
      job: ChunkJob,
      isFirstGap: boolean,
      suppress: boolean,
    ): Promise<void> => {
      const gapStart = Date.now();
      let fillerHandle: FillerPlayHandle | null = null;

      while (!job.ready) {
        if (session.isCancelled()) return;
        const elapsed = Date.now() - gapStart;

        if (!suppress && !fillerHandle && elapsed >= deadlineMs) {
          const fallbackFile = fillerPool?.pick({
            gapMs: elapsed,
            chunkIndex: job.id,
            isFirstGap,
          });
          if (fallbackFile) {
            if (session.isCancelled()) return;
            const handle = await playFiller(fallbackFile, fillerVolume);
            fillerHandle = handle;
            session.registerProcess(handle);
            logger.info("tts", `Latency masking filler for chunk ${job.id}: ${fallbackFile} (gap: ${elapsed}ms)`);
          }
        }

        await Bun.sleep(50);
      }

      if (session.isCancelled()) return;

      if (fillerHandle) {
        const overhangResult = await Promise.race([
          fillerHandle.done.then(() => "done" as const),
          Bun.sleep(MAX_FILLER_OVERHANG_MS).then(() => "cut" as const),
        ]);

        if (session.isCancelled()) return;

        if (overhangResult === "cut") {
          fillerHandle.kill();
          logger.info("tts", `Filler overhang cut for chunk ${job.id} after ${MAX_FILLER_OVERHANG_MS}ms`);
        }
      }
    };

    const processPlayback = async () => {
      if (playbackPlan) {
        let suppressLatencyMasking = false;

        for (const item of playbackPlan) {
          if (session.isCancelled()) return;

          if (item.kind === "filler") {
            const fillerHandle = await playFiller(item.file, fillerVolume);
            session.registerProcess(fillerHandle);
            await fillerHandle.done;
            suppressLatencyMasking = true;

            if (fillerPool && !fillerPool.firstGapHandled) {
              fillerPool.markFirstGapHandled();
            }
            continue;
          }

          const job = item.job;
          if (job.ready) {
            if (session.isCancelled()) return;
            if (!job.error) {
              await playAudio(job.audioFile, fillerVolume, session);
            } else {
              logger.warn("tts", `Skipping playback for chunk ${job.id} due to generation error`);
            }
            suppressLatencyMasking = false;
            continue;
          }

          if (!fillerPool || !latencyMaskingEnabled) {
            while (!job.ready) {
              if (session.isCancelled()) return;
              await Bun.sleep(50);
            }
          } else {
            const isFirstGap = !fillerPool.firstGapHandled;
            await awaitJobWithFillerMasking(job, isFirstGap, suppressLatencyMasking);
          }

          if (session.isCancelled()) return;

          if (!job.error) {
            await playAudio(job.audioFile, fillerVolume, session);
          } else {
            logger.warn("tts", `Skipping playback for chunk ${job.id} due to generation error`);
          }

          suppressLatencyMasking = false;
        }
        return;
      }

      while (nextPlay < jobs.length) {
        if (session.isCancelled()) return;
        const job = jobs[nextPlay];
        if (!job) break;

        if (!fillerPool) {
          while (!job.ready) {
            if (session.isCancelled()) return;
            await Bun.sleep(50);
          }
        } else {
          const isFirstGap = !fillerPool.firstGapHandled;
          await awaitJobWithFillerMasking(job, isFirstGap, false);
        }

        if (session.isCancelled()) return;

        if (!job.error) {
          await playAudio(job.audioFile, fillerVolume, session);
        } else {
          logger.warn("tts", `Skipping playback for chunk ${job.id} due to generation error`);
        }

        nextPlay++;
      }
    };

    const playbackPromise = processPlayback();

    while (generateQueue.length > 0 || generating > 0) {
      if (session.isCancelled()) break;
      while (generating < MAX_PARALLEL && generateQueue.length > 0) {
        if (session.isCancelled()) break;
        const job = generateQueue.shift()!;
        startGeneration(job);
      }
      await Bun.sleep(100);
    }

    await playbackPromise;
    if (session.isCancelled()) return;
    logger.info("tts", "Playback complete");

    if (generationErrors.length > 0) {
      throw generationErrors[0];
    }
  } catch (error) {
    if (session.isCancelled()) return;
    logger.error("tts", `Failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    session.finish();
    for (const job of jobs) {
      try {
        if (existsSync(job.audioFile)) {
          unlinkSync(job.audioFile);
        }
      } catch (err) {
        logger.warn("tts", `Failed to cleanup temp file ${job.audioFile}: ${err}`);
      }
    }
  }
}
