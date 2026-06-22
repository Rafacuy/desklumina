import type { SettingsRow } from "./rows";

export type I18nFn = (key: string) => string;

export function buildFooterHint(focusedRow: SettingsRow, t: I18nFn): string {
  let hint: string;

  if (focusedRow.type === "section") {
    hint = t("settings.hint.close");
  } else if (focusedRow.type === "toggle") {
    hint = `${t("settings.hint.toggle")}   ${t("settings.hint.close")}`;
  } else {
    hint = `${t("settings.hint.open")}   ${t("settings.hint.close")}`;
  }

  return `<span size="small" alpha="55%">${hint}</span>`;
}
