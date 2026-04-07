import { t } from "../utils";
import { logger } from "../logger";
import { settingsManager } from "../core/settings-manager";
import { Communicate } from "edge-tts-universal";
import { spawn } from "bun";

interface ChunkJob {
  id: number;
  text: string;
  audioFile: string;
  ready: boolean;
  generationStart?: number;
  generationEnd?: number;
}

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

class AdaptiveChunker {
  private metrics: ChunkMetrics = {
    avgGenerationTime: 0,
    lastChunkSize: 0,
    totalProcessed: 0,
  };

  private calculatePunctuationDensity(text: string): number {
    const punctuation = text.match(/[.!?,;:]/g)?.length || 0;
    return punctuation / Math.max(text.length, 1);
  }

  private findNaturalBreak(text: string, targetPos: number): number {
    const searchWindow = 30;
    const start = Math.max(0, targetPos - searchWindow);
    const end = Math.min(text.length, targetPos + searchWindow);
    const segment = text.slice(start, end);

    const strongBreaks = ['. ', '! ', '? '];
    for (const brk of strongBreaks) {
      const pos = segment.lastIndexOf(brk, targetPos - start);
      if (pos !== -1) return start + pos + brk.length;
    }

    const weakBreaks = [', ', '; ', ': ', ' - '];
    for (const brk of weakBreaks) {
      const pos = segment.lastIndexOf(brk, targetPos - start);
      if (pos !== -1) return start + pos + brk.length;
    }

    const spacePos = segment.lastIndexOf(' ', targetPos - start);
    if (spacePos !== -1) return start + spacePos + 1;

    return targetPos;
  }

  private calculateChunkSize(isFirst: boolean, remaining: number, textDensity: number): number {
    if (isFirst) return Math.min(FIRST_CHUNK_TARGET, remaining);

    let size = BASE_CHUNK_SIZE;

    if (this.metrics.avgGenerationTime > 0 && this.metrics.totalProcessed > 0) {
      const speedFactor = this.metrics.avgGenerationTime / 1000;
      if (speedFactor < 0.8) {
        size = Math.min(size * 1.3, MAX_CHUNK_SIZE);
      } else if (speedFactor > 1.5) {
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

  updateMetrics(generationTime: number) {
    const alpha = 0.3;
    if (this.metrics.totalProcessed === 0) {
      this.metrics.avgGenerationTime = generationTime;
    } else {
      this.metrics.avgGenerationTime = 
        alpha * generationTime + (1 - alpha) * this.metrics.avgGenerationTime;
    }
    this.metrics.totalProcessed++;
  }
}

function cleanText(text: string): string {
  return text
    .replace(/```json\s*\n[\s\S]*?\n```/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
    .replace(/\{"tool":\s*"[^"]+",\s*"args":\s*"[^"]+"\}/g, "")
    .replace(/\[[\s\S]*?\{"tool"[\s\S]*?\](?!\w)/g, "")
    .replace(/[🔧📋✅❌⚠️💬📝📂✕🎵🖥️📁🔔⚙️]/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function generateAudio(text: string, voice: string, rate: string, outputFile: string): Promise<void> {
  const communicate = new Communicate(text, { voice, rate });
  const chunks: Buffer[] = [];

  for await (const chunk of communicate.stream()) {
    if (chunk.type === "audio" && chunk.data) {
      chunks.push(chunk.data);
    }
  }

  if (chunks.length === 0) throw new Error("No audio data received");
  await Bun.write(outputFile, Buffer.concat(chunks));
}

async function playAudio(file: string): Promise<boolean> {
  const mpv = spawn(["mpv", "--no-terminal", "--really-quiet", file], {
    stdout: "ignore",
    stderr: "ignore",
  });

  const exitCode = await mpv.exited;
  if (exitCode === 0) return true;

  const paplay = spawn(["paplay", file], {
    stdout: "ignore",
    stderr: "ignore",
  });

  return (await paplay.exited) === 0;
}

export async function textToSpeech(text: string): Promise<void> {
  const settings = settingsManager.get();
  const voice = settings.tts.voiceId || "id-ID-GadisNeural";
  const speed = settings.tts.speed || 1.0;
  const rate = speed === 1.0 ? "+0%" : `${speed > 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%`;

  const cleaned = cleanText(text);
  if (!cleaned || cleaned.length < 3) {
    logger.warn("tts", t("Text too short or empty, skipping TTS"));
    return;
  }

  (async () => {
    try {
      const chunker = new AdaptiveChunker();
      const chunks = chunker.chunk(cleaned);
      
      const jobs: ChunkJob[] = chunks.map((chunk, i) => ({
        id: i,
        text: chunk,
        audioFile: `/tmp/lumina-tts-${Date.now()}-${i}.mp3`,
        ready: false,
      }));

      const firstChunkLen = chunks[0]?.length ?? 0;
      logger.info("tts", `Adaptive chunking: ${jobs.length} chunks (first: ${firstChunkLen} chars)`);

      const generateQueue = [...jobs];
      let generating = 0;
      let nextPlay = 0;

      const startGeneration = async (job: ChunkJob) => {
        generating++;
        job.generationStart = Date.now();
        try {
          await generateAudio(job.text, voice, rate, job.audioFile);
          job.generationEnd = Date.now();
          job.ready = true;
          
          const duration = job.generationEnd - job.generationStart;
          chunker.updateMetrics(duration);
          
          if (job.id === 0) {
            logger.info("tts", `First chunk ready in ${duration}ms`);
          }
        } catch (err) {
          logger.error("tts", `Chunk ${job.id} failed: ${err}`);
        } finally {
          generating--;
        }
      };

      const processPlayback = async () => {
        while (nextPlay < jobs.length) {
          const job = jobs[nextPlay];
          if (!job) break;
          
          while (!job.ready) {
            await Bun.sleep(50);
          }

          await playAudio(job.audioFile);
          nextPlay++;

          setTimeout(() => {
            Bun.spawn(["rm", "-f", job.audioFile], { detached: true });
          }, 5000);
        }
      };

      const playbackPromise = processPlayback();

      while (generateQueue.length > 0 || generating > 0) {
        while (generating < MAX_PARALLEL && generateQueue.length > 0) {
          const job = generateQueue.shift()!;
          startGeneration(job);
        }
        await Bun.sleep(100);
      }

      await playbackPromise;
      logger.info("tts", t("Playback complete"));

    } catch (error) {
      logger.error("tts", `Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();
}
