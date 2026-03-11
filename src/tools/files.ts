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

/**
 * Parse arguments that may contain spaces, optionally enclosed in quotes.
 */
function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && (i === 0 || input[i - 1] !== "\\")) {
      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        inQuotes = true;
        quoteChar = char;
      }
    } else if (char === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) args.push(current);
  return args;
}

export async function fileOp(operation: string): Promise<string> {
  logger.info("files", `Operasi: ${operation}`);

  try {
    const allArgs = parseArgs(operation.trim());
    const cmd = allArgs[0];
    const args = allArgs.slice(1).map(expandPath);

    const ops: Record<string, () => Promise<string>> = {
      create_dir: async () => {
        if (!args[0]) return "❌ Path tidak ditemukan";
        const result = await execute(`mkdir -p "${args[0]}"`);
        if (result.exitCode !== 0) return `❌ Gagal: ${result.stderr}`;
        return `✓ Folder "${args[0]}" dibuat`;
      },
      delete: async () => {
        if (!args[0]) return "❌ Path tidak ditemukan";
        if (args[0] === "/" || args[0] === expandPath("~")) {
          return "❌ Operasi berbahaya dibatalkan (root atau home)";
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

        const result = await execute(`rm -rf "${args[0]}"`);
        if (result.exitCode !== 0) return `❌ Gagal: ${result.stderr}`;
        return `✓ "${args[0]}" dihapus`;
      },
      move: async () => {
        if (args.length < 2) return "❌ Perlu asal dan tujuan";
        const src = args[0];
        const dest = args[1];
        if (!src || !dest) return "❌ Path tidak lengkap";
        if (isDangerousPath(src) || isDangerousPath(dest)) {
          const confirmed = await rofiConfirm(
            "Operasi Pemindahan",
            `Dari: ${src}\nKe: ${dest}\n\nMelibatkan path sistem kritis!`,
            "high"
          );

          if (!confirmed) {
            return "❌ Operasi dibatalkan pengguna";
          }
        }

        const result = await execute(`mv "${src}" "${dest}"`);
        if (result.exitCode !== 0) return `❌ Gagal: ${result.stderr}`;
        return `✓ Dipindah ke "${dest}"`;
      },
      copy: async () => {
        if (args.length < 2) return "❌ Perlu asal dan tujuan";
        const result = await execute(`cp -r "${args[0]}" "${args[1]}"`);
        if (result.exitCode !== 0) return `❌ Gagal: ${result.stderr}`;
        return `✓ Disalin ke "${args[1]}"`;
      },
      list: async () => {
        const path = args[0] || ".";
        const result = await execute(`ls -la "${path}"`);
        if (result.exitCode !== 0) return `❌ Gagal: ${result.stderr}`;
        return result.stdout;
      },
      read: async () => {
        if (!args[0]) return "❌ Path tidak ditemukan";
        try {
          const file = Bun.file(args[0]);
          if (!(await file.exists())) return "❌ File tidak ada";
          return await file.text();
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          logger.error("files", `Read failed: ${err.message}`, err);
          return `❌ Gagal membaca: ${err.message}`;
        }
      },
      write: async () => {
        if (args.length < 2) return "❌ Perlu path dan konten";
        const path = args[0];
        if (!path) return "❌ Path tidak ditemukan";
        const content = allArgs.slice(2).join(" ");
        try {
          await Bun.write(path as string, content);
          return `✓ File "${path}" ditulis`;
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          logger.error("files", `Write failed: ${err.message}`, err);
          return `❌ Gagal menulis: ${err.message}`;
        }
      },
      find: async () => {
        if (args.length < 2) return "❌ Perlu path dan pattern";
        const result = await execute(`find "${args[0]}" -name "*${allArgs[2]}*"`);
        if (result.exitCode !== 0) return `❌ Gagal: ${result.stderr}`;
        return result.stdout || "Tidak ada hasil";
      },
    };

    const handler = cmd ? ops[cmd] : undefined;
    if (handler) {
      return await handler();
    }
    
    const result = await execute(operation);
    return result.stdout || result.stderr || "Selesai";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("files", `File operation failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}

