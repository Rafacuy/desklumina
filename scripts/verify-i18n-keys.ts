import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function resolvePath(tree: unknown, key: string): string | undefined {
  if (!key) return undefined;
  const parts = key.split(".").filter(Boolean);
  let cur: unknown = tree;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    const rec = cur as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(rec, p)) return undefined;
    cur = rec[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "locales") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTsFiles(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const KEY_RE = /\b[tf]\(\s*["']([^"']+)["']\s*[),]/g;

const EXTRA_KEYS = [
  "security.dangerous_command_title",
  "tool.opening_app",
  "tool.running_terminal",
  "tool.managing_files",
  "tool.controlling_media",
  "tool.clipboard",
  "tool.sending_notification",
  "tool.executing_actions",
  "tool.managing_files",
  "tool.music_system",
  "tool.music_controlled",
  "tool.action_complete",
  "tool.app_opened",
  "tool.command_executed",
  "tool.file_op_complete",
  "tool.media_controlled",
  "tool.clipboard_updated",
  "tool.notification_sent",
  "ui.loader.thinking",
  "ui.loader.galaxy",
  "ui.loader.intelligence",
  "ui.loader.traces",
  "ui.loader.neurons",
  "ui.loader.quantum",
  "ui.loader.muscles",
  "ui.loader.cosmos",
  "ui.loader.wisdom",
  "ui.loader.brain",
];

const rootDir = join(import.meta.dir, "..");
const en = JSON.parse(readFileSync(join(rootDir, "src/locales/en.json"), "utf-8"));
const id = JSON.parse(readFileSync(join(rootDir, "src/locales/id.json"), "utf-8"));
const ja = JSON.parse(readFileSync(join(rootDir, "src/locales/ja.json"), "utf-8"));

const used = new Set<string>();
for (const file of walkTsFiles(join(rootDir, "src"))) {
  const text = readFileSync(file, "utf-8");
  let m: RegExpExecArray | null;
  KEY_RE.lastIndex = 0;
  while ((m = KEY_RE.exec(text)) !== null) {
    used.add(m[1]!);
  }
}
for (const k of EXTRA_KEYS) used.add(k);

const missing: string[] = [];
for (const key of used) {
  if (resolvePath(en, key) === undefined) missing.push(`en missing: ${key}`);
  if (resolvePath(id, key) === undefined) missing.push(`id missing: ${key}`);
  if (resolvePath(ja, key) === undefined) missing.push(`ja missing: ${key}`);
}

if (missing.length > 0) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`OK: ${used.size} distinct keys resolve in en, id, and ja`);
