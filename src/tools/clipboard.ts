import { execute } from "./terminal";
import { logger } from "../logger";

export async function clipboard(action: string): Promise<string> {
  logger.info("clipboard", `Action: ${action}`);

  try {
    const parts = action.trim().split(/\s+/);
    const cmd = parts[0];
    const arg = parts.slice(1).join(" ");

    const actions: Record<string, () => Promise<string>> = {
      get: async () => {
        const result = await execute("clipcatctl get");
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return result.stdout || "Clipboard kosong";
      },
      list: async () => {
        const result = await execute("clipcatctl list");
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return result.stdout || "Tidak ada history";
      },
      set: async () => {
        const result = await execute(`echo "${arg}" | clipcatctl insert`);
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return "✓ Clipboard diset";
      },
      clear: async () => {
        const result = await execute("clipcatctl clear");
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return "✓ Clipboard dibersihkan";
      },
    };

    return (cmd && actions[cmd]) ? await actions[cmd]() : "❌ Action tidak dikenal";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("clipboard", `Clipboard operation failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}
