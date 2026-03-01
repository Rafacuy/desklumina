import { execute } from "./terminal";
import { logger } from "../logger";

export async function clipboard(action: string): Promise<string> {
  logger.info("clipboard", `Action: ${action}`);

  const parts = action.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts.slice(1).join(" ");

  const actions: Record<string, () => Promise<string>> = {
    get: async () => {
      const result = await execute("clipcatctl get");
      return result.stdout;
    },
    list: async () => {
      const result = await execute("clipcatctl list");
      return result.stdout;
    },
    set: async () => {
      await execute(`echo "${arg}" | clipcatctl insert`);
      return "Clipboard diset";
    },
    clear: async () => {
      await execute("clipcatctl clear");
      return "Clipboard dibersihkan";
    },
  };

  return (cmd && actions[cmd]) ? await actions[cmd]() : "Action tidak dikenal";
}
