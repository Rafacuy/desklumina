import { execute } from "./terminal";
import { logger } from "../logger";

function expandPath(path: string): string {
  return path.replace(/^~/, process.env.HOME || "");
}

export async function fileOp(operation: string): Promise<string> {
  logger.info("files", `Operation: ${operation}`);

  const parts = operation.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1).map(expandPath);

  const ops: Record<string, () => Promise<string>> = {
    create_dir: async () => {
      await execute(`mkdir -p "${args[0]}"`);
      return `Folder ${args[0]} dibuat`;
    },
    delete: async () => {
      if (args[0] === "/" || args[0] === expandPath("~")) {
        return "❌ Operasi berbahaya dibatalkan";
      }
      await execute(`rm -rf "${args[0]}"`);
      return `${args[0]} dihapus`;
    },
    move: async () => {
      await execute(`mv "${args[0]}" "${args[1]}"`);
      return `Dipindah ke ${args[1]}`;
    },
    copy: async () => {
      await execute(`cp -r "${args[0]}" "${args[1]}"`);
      return `Disalin ke ${args[1]}`;
    },
    list: async () => {
      const result = await execute(`ls -la "${args[0] || "."}"`);
      return result.stdout;
    },
    read: async () => {
      const file = Bun.file(args[0]);
      return await file.text();
    },
    write: async () => {
      await Bun.write(args[0], args.slice(1).join(" "));
      return `File ${args[0]} ditulis`;
    },
    find: async () => {
      const result = await execute(`find "${args[0]}" -name "*${args[1]}*"`);
      return result.stdout;
    },
  };

  return ops[cmd] ? await ops[cmd]() : await execute(operation);
}
