import dictionary from "../locales/dictionary.json";

const locales: Record<string, any> = {
  id: dictionary,
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
