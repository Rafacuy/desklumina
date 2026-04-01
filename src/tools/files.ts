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
  logger.info("files", `Operation: ${operation}`);

  try {
    const allArgs = parseArgs(operation.trim());
    const cmd = allArgs[0];
    const args = allArgs.slice(1).map(expandPath);

    const ops: Record<string, () => Promise<string>> = {
      create_dir: async () => {
        if (!args[0]) return "❌ Path not found";
        const result = await execute(`mkdir -p "${args[0]}"`);
        if (result.exitCode !== 0) return `❌ Failed: ${result.stderr}`;
        return `✓ Folder "${args[0]}" created`;
      },
      delete: async () => {
        if (!args[0]) return "❌ Path not found";
        if (args[0] === "/" || args[0] === expandPath("~")) {
          return "❌ Dangerous operation cancelled (root or home)";
        }

        if (isDangerousPath(args[0])) {
          const confirmed = await rofiConfirm(
            "Delete Operation",
            `Path: ${args[0]}\n\nThis is a critical system path!`,
            "critical"
          );

          if (!confirmed) {
            return "❌ Operation cancelled by user";
          }
        }

        const result = await execute(`rm -rf "${args[0]}"`);
        if (result.exitCode !== 0) return `❌ Failed: ${result.stderr}`;
        return `✓ "${args[0]}" deleted`;
      },
      move: async () => {
        if (args.length < 2) return "❌ Source and destination required";
        const src = args[0];
        const dest = args[1];
        if (!src || !dest) return "❌ Incomplete path";
        if (isDangerousPath(src) || isDangerousPath(dest)) {
          const confirmed = await rofiConfirm(
            "Move Operation",
            `From: ${src}\nTo: ${dest}\n\nInvolves critical system path!`,
            "high"
          );

          if (!confirmed) {
            return "❌ Operation cancelled by user";
          }
        }

        const result = await execute(`mv "${src}" "${dest}"`);
        if (result.exitCode !== 0) return `❌ Failed: ${result.stderr}`;
        return `✓ Moved to "${dest}"`;
      },
      copy: async () => {
        if (args.length < 2) return "❌ Source and destination required";
        const result = await execute(`cp -r "${args[0]}" "${args[1]}"`);
        if (result.exitCode !== 0) return `❌ Failed: ${result.stderr}`;
        return `✓ Copied to "${args[1]}"`;
      },
      list: async () => {
        const path = args[0] || ".";
        const result = await execute(`ls -la "${path}"`);
        if (result.exitCode !== 0) return `❌ Failed: ${result.stderr}`;
        return result.stdout;
      },
      read: async () => {
        if (!args[0]) return "❌ Path not found";
        try {
          const file = Bun.file(args[0]);
          if (!(await file.exists())) return "❌ File not found";
          return await file.text();
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          logger.error("files", `Read failed: ${err.message}`, err);
          return `❌ Failed to read: ${err.message}`;
        }
      },
      write: async () => {
        if (args.length < 2) return "❌ Path and content required";
        const path = args[0];
        if (!path) return "❌ Path not found";
        const content = allArgs.slice(2).join(" ");
        try {
          await Bun.write(path as string, content);
          return `✓ File "${path}" written`;
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          logger.error("files", `Write failed: ${err.message}`, err);
          return `❌ Failed to write: ${err.message}`;
        }
      },
      find: async () => {
        if (args.length < 2) return "❌ Path and pattern required";
        const result = await execute(`find "${args[0]}" -name "*${allArgs[2]}*"`);
        if (result.exitCode !== 0) return `❌ Failed: ${result.stderr}`;
        return result.stdout || "No results";
      },
    };

    const handler = cmd ? ops[cmd] : undefined;
    if (handler) {
      return await handler();
    }
    
    const result = await execute(operation);
    return result.stdout || result.stderr || "Done";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("files", `File operation failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}

