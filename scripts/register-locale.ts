#!/usr/bin/env bun
/**
 * scripts/register-locale.ts
 *
 * Interactive automation to register a new locale file into DeskLumina.
 *
 * !! IMPORTANT !!
 * If you are adding a NON-LATIN language (Cyrillic, Arabic, Thai, etc.)
 * make sure to update the tokenizer FIRST so token estimation stays accurate:
 *      -> src/core/services/token-manager.ts  (TokenManager.estimateTokens)
 *
 * The current estimator only covers CJK + Latin + Cyrillic; other scripts will be miscounted.
 *
 *
 * Trace of the codebase this script wires into:
 *   - src/utils/localization/i18n.ts        
 *   - src/utils/localization/lang-map.ts    
 *   - src/ui/settings.ts                     
 *   - src/types/settings.ts                  
 *   - src/core/services/settings-manager.ts  
 *   - src/ai/runtime/prompts.ts                
**/

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import * as readline from "readline";

const ROOT = join(import.meta.dir, "..");
const LOCALES_DIR = join(ROOT, "src", "locales");

const I18N_PATH = join(ROOT, "src/utils/localization/i18n.ts");
const LANGMAP_PATH = join(ROOT, "src/utils/localization/lang-map.ts");
const SETTINGS_UI_PATH = join(ROOT, "src/ui/settings.ts");
const SETTINGS_TYPES_PATH = join(ROOT, "src/types/settings.ts");
const SETTINGS_MGR_PATH = join(ROOT, "src/core/services/settings-manager.ts");
const PROMPTS_PATH = join(ROOT, "src/ai/runtime/prompts.ts");
const TTS_PATH = join(ROOT, "src/ai/tts.ts");

interface Entry {
  code: string;
  file: string;
  displayName: string;
  voiceId: string;
  defaultVoiceId: string;
  promptContext: string;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a)));
}

function escapeTs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function read(p: string): string {
  return readFileSync(p, "utf-8");
}

function insertAfterFirstMatch(content: string, re: RegExp, text: string): string {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]!)) {
      lines.splice(i + 1, 0, text);
      return lines.join("\n");
    }
  }
  throw new Error(`Marker not found for insertion: ${re}`);
}

function insertAfterLastMatch(content: string, re: RegExp, text: string): string {
  const lines = content.split("\n");
  let idx = -1;
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i]!)) idx = i;
  if (idx === -1) throw new Error(`Marker not found for insertion: ${re}`);
  lines.splice(idx + 1, 0, text);
  return lines.join("\n");
}

function insertAfterElseIfBlock(content: string, lang: string, text: string): string {
  const re = new RegExp(`else if \\(currentLang === "${lang}"\\) \\{`);
  const m = re.exec(content);
  if (!m) throw new Error(`Cannot find else-if block for language: ${lang}`);
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    i++;
  }
  return content.slice(0, i) + text + content.slice(i);
}

function insertAfterLangBlock(content: string, lang: string, text: string): string {
  const re = new RegExp(`else if \\(lang === "${lang}"\\) \\{`);
  const m = re.exec(content);
  if (!m) throw new Error(`Cannot find setLanguage block for language: ${lang}`);
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    i++;
  }
  return content.slice(0, i) + text + content.slice(i);
}

function addCodesToUnion(union: string, entries: Entry[]): string {
  let result = union.trim();
  for (const e of entries) {
    const quoted = `"${e.code}"`;
    if (!result.includes(quoted)) result += ` | ${quoted}`;
  }
  return result;
}

function getRegisteredCodes(): Set<string> {
  const i18n = read(I18N_PATH);
  const codes = new Set<string>();
  for (const m of i18n.matchAll(/import\s+\w+\s+from\s+"\.\.\/\.\.\/locales\/(\w+)\.json"/g)) {
    codes.add(m[1]!);
  }
  return codes;
}

function printBanners(): void {
  console.log("\nAUTOMATION SCRIPTS FOR REGISTERING LANGUAGES.");
  console.log("MAKE SURE TO VALIDATE FIRST YOUR KEYS BASED ON: en.json\n");
  console.log("!! IMPORTANT !!");
  console.log("If you are adding a NON-LATIN language (Arabic, Thai, etc.),");
  console.log("make sure to update the tokenizer FIRST so token estimation stays accurate:");
  console.log("  -> src/core/services/token-manager.ts  (TokenManager.estimateTokens)");
  console.log("The current estimator only covers CJK + Latin + Cyrillic; other scripts will be miscounted.\n");
}

async function main(): Promise<void> {
  printBanners();

  const files = readdirSync(LOCALES_DIR).filter(
    (f) => f.endsWith(".json") && f !== "dictionary.json",
  );
  const registered = getRegisteredCodes();
  const news = files.filter((f) => !registered.has(f.replace(/\.json$/, "")));

  if (news.length === 0) {
    console.log("No new locales found. Nothing to register.");
    rl.close();
    return;
  }

  console.log(`Founded ${news.length} new locale(s):`);
  news.forEach((f, i) => console.log(`${i + 1}) ${f}`));
  console.log();

  let selected: string[];
  if (news.length === 1) {
    console.log(`Founded 1 new locale (${news[0]})`);
    console.log("Registering.");
    selected = news;
  } else {
    const ans = (await ask("Want to register it all? [Y/n] ")).trim().toLowerCase();
    if (ans === "n") {
      const which = await ask("Which number? (comma-separated) ");
      const nums = which
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= news.length);
      selected = nums.map((n) => news[n - 1]!);
      if (selected.length === 0) {
        console.log("No valid selection. Exiting.");
        rl.close();
        return;
      }
    } else {
      selected = news;
    }
  }

  const entries: Entry[] = [];
  for (const file of selected) {
    const code = file.replace(/\.json$/, "");
    console.log();
    const displayName = (await ask(`(${file}) Display Name: `)).trim();
    const voiceId = (await ask(`(${file}) TTS voice key(s) (comma-separated, Enter to skip): `)).trim();
    let defaultVoiceId = "";
    if (voiceId) {
      while (!defaultVoiceId) {
        defaultVoiceId = (await ask(`(${file}) Default voice key: `)).trim();
        if (!defaultVoiceId) {
          console.log(
            `[ALERT] Default voice key is mandatory when TTS voice key(s) are provided for ${file}.`,
          );
        }
      }
    }
    const promptContext = (await ask(`(${file}) Prompt Context (required): `)).trim();
    entries.push({ code, file, displayName, voiceId, defaultVoiceId, promptContext });
  }

  // i18n.ts: import + locales map 
  let i18n = read(I18N_PATH);
  for (const e of entries) {
    i18n = insertAfterLastMatch(
      i18n,
      /import\s+.*\.\.\/\.\.\/locales\/.*\.json";/,
      `import ${e.code} from "../../locales/${e.code}.json";`,
    );
  }
  i18n = i18n.replace(
    /(const locales: Record<string, LocaleTree> = \{)([\s\S]*?)(\n\};?)/,
    (_m, open, inner, close) => {
      const adds = entries.map((e) => `\n  ${e.code}: ${e.code} as LocaleTree,`).join("");
      const normalizedClose = close.endsWith(";") ? close : `${close};`;
      return `${open}${inner}${adds}${normalizedClose}`;
    },
  );
  writeFileSync(I18N_PATH, i18n, "utf-8");

  // lang-map.ts: add new entries 
  let lm = read(LANGMAP_PATH);
  const localeCodes = new Set(files.map((f) => f.replace(/\.json$/, "")));
  const selectedCodes = new Set(entries.map((e) => e.code));
  lm = lm
    .split("\n")
    .filter((l) => {
      const dead = /^\s*(es|ko):\s/.exec(l)?.[1];
      return !dead || localeCodes.has(dead) || selectedCodes.has(dead);
    })
    .join("\n");
  for (const e of entries) {
    lm = insertAfterFirstMatch(
      lm,
      /export const langMap: Record<string, string> = \{/,
      `  ${e.code}: "${escapeTs(e.displayName)}",`,
    );
  }
  writeFileSync(LANGMAP_PATH, lm, "utf-8");

  //settings.ts: LANG_NAMES, langs[], if-branch, optional TTS else-if 
  let s = read(SETTINGS_UI_PATH);
  for (const e of entries) {
    s = insertAfterFirstMatch(
      s,
      /const LANG_NAMES: Record<string, string> = \{/,
      `  ${e.code}: "${escapeTs(e.displayName)}",`,
    );
    s = insertAfterFirstMatch(
      s,
      /\[\s*"ja",\s*".*"\s*\],/,
      `    ["${e.code}", "${escapeTs(e.displayName)}"],`,
    );
    s = insertAfterFirstMatch(
      s,
      /else if \(result\.output\.includes\("\(ja\)"\)\) settingsManager\.setLanguage\("ja"\);/,
      `    else if (result.output.includes("(${e.code})")) settingsManager.setLanguage("${e.code}");`,
    );
  }
  for (const e of entries) {
    const voices = e.voiceId
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (voices.length === 0) continue;
    const lines = voices
      .map((v) => {
        const label = v.split("-").pop()?.replace(/Neural$/i, "") ?? v;
        return `      "${escapeTs(v)} - ${escapeTs(label)}",`;
      })
      .join("\n");
    const block =
      ` else if (currentLang === "${e.code}") {\n` +
      `    voiceOptions = [\n` +
      `${lines}\n` +
      `    ].map(markActive);\n` +
      `  }`;
    s = insertAfterElseIfBlock(s, "ja", block);
  }
  writeFileSync(SETTINGS_UI_PATH, s, "utf-8");

  // types/settings.ts: language union 
  let ts = read(SETTINGS_TYPES_PATH);
  ts = ts.replace(
    /language:\s*([^;]+);/,
    (_m, union) => `language: ${addCodesToUnion(union, entries)};`,
  );
  writeFileSync(SETTINGS_TYPES_PATH, ts, "utf-8");

  // settings-manager.ts: setLanguage() union 
  let sm = read(SETTINGS_MGR_PATH);
  sm = sm.replace(
    /setLanguage\(lang:\s*([^)]*)\)/,
    (_m, union) => `setLanguage(lang: ${addCodesToUnion(union, entries)})`,
  );
  for (const e of entries) {
    const defaultVoice = e.defaultVoiceId.trim();
    if (!defaultVoice) continue;
    const branch =
      ` else if (lang === "${e.code}") {\n` +
      `      this.settings.tts.voiceId = "${escapeTs(defaultVoice)}";\n` +
      `    }`;
    sm = insertAfterLangBlock(sm, "ja", branch);
  }
  writeFileSync(SETTINGS_MGR_PATH, sm, "utf-8");

  // ai/tts.ts: DEFAULT_VOICE_MAP 
  let tts = read(TTS_PATH);
  for (const e of entries) {
    const defaultVoice = e.defaultVoiceId.trim();
    if (!defaultVoice) continue;
    tts = insertAfterFirstMatch(
      tts,
      /const DEFAULT_VOICE_MAP: Record<string, string> = \{/,
      `  ${e.code}: "${escapeTs(defaultVoice)}",`,
    );
  }
  writeFileSync(TTS_PATH, tts, "utf-8");

  // prompts.ts: styleGuides (language directive)
  let pr = read(PROMPTS_PATH);
  for (const e of entries) {
    pr = insertAfterFirstMatch(
      pr,
      /const styleGuides: Record<string, string> = \{/,
      `    ${e.code}: "${escapeTs(e.promptContext)}",`,
    );
  }
  writeFileSync(PROMPTS_PATH, pr, "utf-8");

  //summary 
  console.log("\nDone. Registered:");
  for (const e of entries) {
    console.log(
      `  - ${e.code} (${e.file}) display="${e.displayName}"` +
        `${e.voiceId ? ` tts="${e.voiceId}"` : " tts=skipped"}`,
    );
  }
  console.log("\nNext steps:");
  console.log("  1. Run `bun run lint` to verify the type unions compile.");
  console.log("  2. Manually verify key parity of each new locale against en.json.");
  console.log("  3. For non-Latin scripts, update TokenManager.estimateTokens if needed.");

  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  rl.close();
  process.exit(1);
});
