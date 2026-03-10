import { logger } from "../logger";
import { settingsManager } from "../core/settings-manager";
import { Communicate } from "edge-tts-universal";
import { spawn } from "bun";

export async function textToSpeech(text: string): Promise<void> {
  const settings = settingsManager.get();
  const voice = settings.tts.voiceId || "id-ID-GadisNeural";
  const speed = settings.tts.speed || 1.0;

  const cleanText = text
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

  if (!cleanText || cleanText.length < 3) {
    logger.warn("tts", "Text too short or empty, skipping TTS");
    return;
  }

  logger.info("tts", `Starting TTS for: "${cleanText.substring(0, 50)}..."`);

  // Run in parallel without blocking
  (async () => {
    try {
      const rate = speed === 1.0 ? "+0%" : `${speed > 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%`;
      logger.info("tts", `Using voice: ${voice}, rate: ${rate}`);
      
      const communicate = new Communicate(cleanText, { voice, rate });

      const audioFile = `/tmp/lumina-tts-${Date.now()}.mp3`;
      const chunks: Buffer[] = [];

      logger.info("tts", "Streaming audio from Edge TTS...");
      
      for await (const chunk of communicate.stream()) {
        if (chunk.type === "audio" && chunk.data) {
          chunks.push(chunk.data);
        }
      }

      if (chunks.length === 0) {
        throw new Error("No audio data received from TTS service");
      }

      logger.info("tts", `Received ${chunks.length} audio chunks, writing to ${audioFile}...`);
      await Bun.write(audioFile, Buffer.concat(chunks));

      const file = Bun.file(audioFile);
      const exists = await file.exists();
      if (!exists) {
        throw new Error("Audio file was not created");
      }
      logger.info("tts", `Audio file size: ${file.size} bytes`);

      // Try mpv first, fallback to paplay
      logger.info("tts", "Playing audio with mpv...");
      const mpvProc = spawn(["mpv", "--no-terminal", "--really-quiet", audioFile], {
        stdout: "ignore",
        stderr: "ignore",
      });

      const exitCode = await mpvProc.exited;
      logger.info("tts", `mpv exited with code: ${exitCode}`);

      if (exitCode !== 0) {
        logger.warn("tts", "mpv failed, trying paplay fallback...");
        const paplayProc = spawn(["paplay", audioFile], {
          stdout: "ignore",
          stderr: "ignore",
        });
        await paplayProc.exited;
        logger.info("tts", "paplay playback complete");
      } else {
        logger.info("tts", "Audio playback complete");
      }

      // Cleanup after delay
      setTimeout(() => {
        Bun.spawn(["rm", "-f", audioFile], { detached: true });
      }, 30000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("tts", `Failed: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        logger.error("tts", `Stack: ${error.stack}`);
      }
    }
  })();
}
