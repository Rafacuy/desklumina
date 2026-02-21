import { execute } from "./terminal";
import { launch } from "./apps";
import { bspwm } from "./bspwm";
import { fileOp } from "./files";
import { media } from "./media";
import { clipboard } from "./clipboard";
import { notify } from "./notify";
import { logger } from "../logger";

type ToolHandler = (arg: string) => Promise<string>;

const tools: Record<string, ToolHandler> = {
  terminal: async (cmd) => {
    const result = await execute(cmd);
    return result.stdout || result.stderr || "Selesai";
  },
  app: async (alias) => {
    await launch(alias);
    return `${alias} diluncurkan`;
  },
  bspwm: (action) => bspwm(action),
  file: (op) => fileOp(op),
  media: (action) => media(action),
  clipboard: (action) => clipboard(action),
  notify: (args) => notify(args),
};

export async function dispatch(toolName: string, arg: string): Promise<string> {
  const handler = tools[toolName];
  if (!handler) {
    logger.warn("tools", `Tool tidak ditemukan: ${toolName}`);
    return "Tool tidak ditemukan";
  }

  try {
    return await handler(arg);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("tools", `Error di ${toolName}: ${msg}`);
    return `Error: ${msg}`;
  }
}
