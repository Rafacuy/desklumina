import { logger } from "../logger";
import { analyzeCommand, rofiConfirm } from "../security";

export async function execute(
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  logger.info("terminal", `Eksekusi: ${command}`);

  // Analisis keamanan perintah
  const analysis = analyzeCommand(command);

  if (analysis.isDangerous) {
    const severity = analysis.highestSeverity as
      | "critical"
      | "high"
      | "medium";

    logger.warn(
      "terminal",
      `Perintah berbahaya terdeteksi [${severity}]: ${analysis.summary}`
    );

    const confirmed = await rofiConfirm(
      "Perintah Berbahaya Terdeteksi",
      `Perintah: ${command}\n\nAlasan: ${analysis.summary}`,
      severity
    );

    if (!confirmed) {
      logger.info("terminal", "Perintah dibatalkan oleh pengguna");
      return {
        stdout: "",
        stderr: "Operasi dibatalkan oleh pengguna",
        exitCode: 1,
      };
    }

    logger.info("terminal", "Perintah berbahaya disetujui pengguna");
  }

  const proc = Bun.spawn(["bash", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeout = setTimeout(() => {
    proc.kill();
    logger.error("terminal", `Timeout: ${command}`);
  }, 30000);

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  clearTimeout(timeout);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    logger.error("terminal", `Exit ${exitCode}: ${stderr}`);
  }

  return { stdout, stderr, exitCode };
}
