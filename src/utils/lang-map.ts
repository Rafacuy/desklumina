export const langMap: Record<string, string> = {
  id: "Indonesian",
  en: "English",
  es: "Spanish",
  ja: "Japanese",
  ko: "Korean",
};

export function getLangName(lang: string): string {
  return langMap[lang] || "Indonesian";
}
