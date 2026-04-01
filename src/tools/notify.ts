import { execute } from "./terminal";
import { logger } from "../logger";

export async function notify(args: string): Promise<string> {
  logger.info("notify", `Notification: ${args}`);

  try {
    const parts = args.split("|");
    const title = parts[0] || "Lumina";
    const body = parts[1] || "";
    const urgency = parts[2] || "normal";

    const result = await execute(`dunstify -u ${urgency} -i lumina "${title}" "${body}"`);
    
    if (result.exitCode !== 0) {
      logger.warn("notify", `Notification failed: ${result.stderr}`);
      return `❌ Error: ${result.stderr || "Failed to send notification"}`;
    }
    
    return "✓ Notification sent";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("notify", `Notification failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}
