import { logger } from "../logger";

export async function execute(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  logger.info("terminal", `Eksekusi: ${command}`);

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
