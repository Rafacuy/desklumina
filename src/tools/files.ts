import { execute } from "./terminal";
import { logger } from "../logger";
import { rofiConfirm, rofiAlert } from "../security/confirmation";

function expandPath(path: string): string {
  return path.replace(/^~/, process.env.HOME || "");
}

function isDangerousPath(path: string): boolean {
  const dangerous = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/root", "/sys", "/usr", "/var"];
  const expandedPath = expandPath(path);
  return dangerous.some(d => expandedPath === d || expandedPath.startsWith(d + "/"));
}

export async function fileOp(operation: string): Promise<string> {
  logger.info("files", `Operasi: ${operation}`);

  const parts = operation.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1).map(expandPath);

  const ops: Record<string, () => Promise<string>> = {
    create_dir: async () => {
      if (!args[0]) return "❌ Path tidak ditemukan";
      await execute(`mkdir -p "${args[0]}"`);
      return `Folder ${args[0]} dibuat`;
    },
    delete: async () => {
      if (!args[0]) return "❌ Path tidak ditemukan";
      if (args[0] === "/" || args[0] === expandPath("~")) {
        return "❌ Operasi berbahaya dibatalkan";
      }

      if (isDangerousPath(args[0])) {
        const confirmed = await rofiConfirm(
          "Operasi Penghapusan",
          `Path: ${args[0]}\n\nIni adalah path sistem yang kritis!`,
          "critical"
        );

        if (!confirmed) {
          return "❌ Operasi dibatalkan pengguna";
        }
      }

      await execute(`rm -rf "${args[0]}"`);
      return `${args[0]} dihapus`;
    },
    move: async () => {
      if (!args[0] || !args[1]) return "❌ Path tidak ditemukan";
      if (isDangerousPath(args[0]) || isDangerousPath(args[1])) {
        const confirmed = await rofiConfirm(
          "Operasi Pemindahan",
          `Dari: ${args[0]}\nKe: ${args[1]}\n\nMelibatkan path sistem kritis!`,
          "high"
        );

        if (!confirmed) {
          return "❌ Operasi dibatalkan pengguna";
        }
      }

      await execute(`mv "${args[0]}" "${args[1]}"`);
      return `Dipindah ke ${args[1]}`;
    },
    copy: async () => {
      if (!args[0] || !args[1]) return "❌ Path tidak ditemukan";
      await execute(`cp -r "${args[0]}" "${args[1]}"`);
      return `Disalin ke ${args[1]}`;
    },
    list: async () => {
      const path = args[0] || ".";
      const result = await execute(`ls -la "${path}"`);
      return result.stdout;
    },
    read: async () => {
      if (!args[0]) return "❌ Path tidak ditemukan";
      const file = Bun.file(args[0]);
      return await file.text();
    },
    write: async () => {
      if (!args[0]) return "❌ Path tidak ditemukan";
      await Bun.write(args[0], args.slice(1).join(" "));
      return `File ${args[0]} ditulis`;
    },
    find: async () => {
      if (!args[0] || !args[1]) return "❌ Path atau pattern tidak ditemukan";
      const result = await execute(`find "${args[0]}" -name "*${args[1]}*"`);
      return result.stdout;
    },
  };

  const handler = ops[cmd];
  if (handler) {
    return await handler();
  }
  
  const result = await execute(operation);
  return result.stdout || result.stderr || "Selesai";
}
