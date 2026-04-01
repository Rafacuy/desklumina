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
        return result.stdout || "Clipboard is empty";
      },
      list: async () => {
        const result = await execute("clipcatctl list");
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return result.stdout || "No history";
      },
      set: async () => {
        const result = await execute(`echo "${arg}" | clipcatctl insert`);
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return "✓ Clipboard set";
      },
      clear: async () => {
        const result = await execute("clipcatctl clear");
        if (result.exitCode !== 0) return `❌ Error: ${result.stderr}`;
        return "✓ Clipboard cleared";
      },
    };

    return (cmd && actions[cmd]) ? await actions[cmd]() : "❌ Unknown action";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("clipboard", `Clipboard operation failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}
