import { execute } from "./terminal";
import { logger } from "../logger";

export async function media(action: string): Promise<string> {
  logger.info("media", `Action: ${action}`);

  const parts = action.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts[1];

  const actions: Record<string, string> = {
    play: "mpc play",
    pause: "mpc pause",
    toggle: "mpc toggle",
    next: "mpc next",
    prev: "mpc prev",
    stop: "mpc stop",
    volume: `mpc volume ${arg}`,
    current: "mpc current",
    queue: "mpc playlist",
    search: `mpc search any "${parts.slice(1).join(" ")}"`,
  };

  const command = actions[cmd] || action;
  const result = await execute(command);
  return result.stdout || "Selesai";
}
