import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname } from "path";

const SRC_DIR = join(process.cwd(), "src");
const LOCALES_FILE = join(SRC_DIR, "locales/dictionary.json");
const EXCLUDED_FILES = ["locales/dictionary.json", "utils/i18n.ts"];

const collectedStrings = new Set<string>();

function getFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function refactorFile(filePath: string) {
  const relativePath = relative(SRC_DIR, filePath);
  if (EXCLUDED_FILES.includes(relativePath)) return;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let modified = false;

  const newLines = lines.map(line => {
    // Skip technical lines
    if (line.includes("import ") || line.includes("require(")) return line;

    let nl = line;

    // 1. Logger: logger.info("module", "message")
    // Note: We use a non-greedy .*? and avoid matching quotes inside the string
    nl = nl.replace(/(logger\.(?:info|warn|error|fatal|debug)\s*\(\s*(['"])(.*?)\2\s*,\s*)(['"])(.*?)\4/g, (match, prefix, q1, mod, q2, text) => {
      // Avoid replacing if it's a technical string or very short
      if (text.length > 2 && !/^[a-z_]+$/.test(text)) {
        collectedStrings.add(text);
        modified = true;
        return `${prefix}t(${q2}${text}${q2})`;
      }
      return match;
    });

    // 2. Console: console.log("message")
    nl = nl.replace(/(console\.(?:log|warn|error)\s*\(\s*)(['"])(.*?)\2/g, (match, prefix, q, text) => {
      if (text.length > 2 && !/^[a-z_]+$/.test(text)) {
        collectedStrings.add(text);
        modified = true;
        return `${prefix}t(${q}${text}${q})`;
      }
      return match;
    });

    // 3. rofiConfirm: rofiConfirm("title", "msg")
    nl = nl.replace(/(rofiConfirm\s*\(\s*)(['"])(.*?)\2\s*,\s*(['"])(.*?)\4/g, (match, prefix, q1, title, q2, msg) => {
      let m = match;
      if (title.length > 2) {
        collectedStrings.add(title);
        m = m.replace(`${q1}${title}${q1}`, `t(${q1}${title}${q1})`);
        modified = true;
      }
      if (msg.length > 2) {
        collectedStrings.add(msg);
        m = m.replace(`${q2}${msg}${q2}`, `t(${q2}${msg}${q2})`);
        modified = true;
      }
      return m;
    });

    // 4. Assignments of clearly Indonesian strings (contain spaces and common Indo words)
    // This is more aggressive but still limited to assignments
    const indoKeywords = ["tidak", "ditemukan", "berhasil", "gagal", "perintah", "hapus", "meluncurkan", "dibatalkan"];
    nl = nl.replace(/(\b[a-zA-Z0-9_]+\s*=\s*)(['"])(.*?)\2/g, (match, prefix, q, text) => {
      if (text.includes(" ") && indoKeywords.some(k => text.toLowerCase().includes(k))) {
        collectedStrings.add(text);
        modified = true;
        return `${prefix}t(${q}${text}${q})`;
      }
      return match;
    });

    return nl;
  });

  if (modified) {
    let finalContent = newLines.join("\n");
    if (!finalContent.includes("import { t }")) {
      const utilsDir = join(SRC_DIR, "utils");
      let relPath = relative(dirname(filePath), utilsDir);
      if (relPath === "") relPath = "./i18n";
      else if (!relPath.startsWith(".")) relPath = "./" + relPath;
      if (relPath.endsWith("/utils")) relPath = relPath;
      
      const importLine = `import { t } from "${relPath}";\n`;
      finalContent = importLine + finalContent;
    }
    writeFileSync(filePath, finalContent, "utf-8");
    console.log(`Refactored: ${relativePath}`);
  }
}

console.log("Starting Safe i18n Refactoring...");
getFiles(SRC_DIR).forEach(refactorFile);

const existingLocales = JSON.parse(readFileSync(LOCALES_FILE, "utf-8"));
collectedStrings.forEach(s => {
  if (!existingLocales[s]) {
    existingLocales[s] = s;
  }
});
writeFileSync(LOCALES_FILE, JSON.stringify(existingLocales, null, 2), "utf-8");
console.log(`Done! ${collectedStrings.size} strings collected.`);
