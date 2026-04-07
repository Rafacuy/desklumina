import id from "../locales/id.json";
import en from "../locales/en.json";

const locales: Record<string, any> = {
  id,
  en,
};

// Default language
let currentLang = "id";

/**
 * Intelligent translation function
 * Returns the translated text if found, otherwise returns the original text.
 */
export const t = (text: string): string => {
  if (!text) return text;
  const dictionary = locales[currentLang];
  if (!dictionary) return text;
  return dictionary[text] ?? text;
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

/**
 * Set current language
 */
export const setLang = (lang: string) => {
  if (locales[lang]) {
    currentLang = lang;
  }
};

/**
 * Get current language
 */
export const getLang = () => currentLang;
