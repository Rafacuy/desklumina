import id from "../../locales/id.json";
import en from "../../locales/en.json";
import ja from "../../locales/ja.json";

type LocaleTree = Record<string, unknown>;

const locales: Record<string, LocaleTree> = {
  id: id as LocaleTree,
  en: en as LocaleTree,
  ja: ja as LocaleTree,
};

let currentLang = "id";

function resolvePath(tree: unknown, key: string): string | undefined {
  if (!key) return undefined;
  const parts = key.split(".").filter(Boolean);
  let cur: unknown = tree;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return undefined;
    }
    const rec = cur as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(rec, p)) return undefined;
    cur = rec[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export const t = (key: string): string => {
  if (!key) return key;
  const dictionary = locales[currentLang];
  const resolved = dictionary ? resolvePath(dictionary, key) : undefined;

  if (resolved === undefined) {
    if (Bun.env.NODE_ENV !== "production") {
      // console.warn(`[i18n] Missing key: "${key}" for locale: "${currentLang}"`);
    }
    return key;
  }

  return resolved;
};

export const tf = (
  key: string,
  vars: Record<string, string | number>,
): string => {
  const template = t(key);
  return template.replace(/\{([^}]+)\}/g, (match, varName: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, varName)) {
      return String(vars[varName]);
    }
    return match;
  });
};

export const setLang = (lang: string) => {
  if (locales[lang]) {
    currentLang = lang;
  }
};

export const getLang = () => currentLang;
