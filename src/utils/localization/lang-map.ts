export const langMap: Record<string, string> = {
  pt: "Português (Brasil)",
  de: "Deutsch",
  ru: "Русский",
  zh: "Chinese (Simplified)",
  ko: "한국어",
  fr: "Français",
  es: "Español",
  id: "Indonesian",
  en: "English",
  ja: "Japanese",
};

export function getLangName(lang: string): string {
  return langMap[lang] || "Indonesian";
}
