import { execute } from "./terminal";
import { logger } from "../logger";

export async function notify(args: string): Promise<string> {
  logger.info("notify", `Notifikasi: ${args}`);

  const parts = args.split("|");
  const title = parts[0] || "Lumina";
  const body = parts[1] || "";
  const urgency = parts[2] || "normal";

  await execute(`dunstify -u ${urgency} -i lumina "${title}" "${body}"`);
  return "Notifikasi dikirim";
}
