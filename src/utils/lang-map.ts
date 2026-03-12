export const langMap: Record<string, string> = {
  id: "Indonesian",
  en: "English",
  es: "Spanish",
  jp: "Japanese",
  kr: "Korean",
};

export function getLangName(lang: string): string {
  return langMap[lang] || "Indonesian";
}
