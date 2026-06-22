import { escapeHtml } from "../../utils/formatting/format";
import type { SettingKey } from "../../constants/settings-keys";
import type { ColorTokens } from "./tokens";
import { sectionHeader } from "./section";

export type RowDepth = 0 | 1 | 2;
type I18nFn = (key: string) => string;

export interface SectionRow {
  type: "section";
  label: string;
}

export interface NavRow {
  type: "nav";
  icon: string;
  label: string;
  value?: string;
  panel: string;
  key?: SettingKey;
  depth?: RowDepth;
}

export interface ToggleRow {
  type: "toggle";
  icon: string;
  label: string;
  key: SettingKey;
  value: boolean;
  depth?: RowDepth;
}

export type SettingsRow = SectionRow | NavRow | ToggleRow;

const EN_SPACE = "\u2002";

function indentForDepth(depth: RowDepth): string {
  if (depth === 1) return EN_SPACE.repeat(3);
  if (depth === 2) return EN_SPACE.repeat(5);
  return "";
}

function wrapSubRow(baseMarkup: string, depth: RowDepth): string {
  if (depth === 0) return baseMarkup;
  return `${indentForDepth(depth)}<span alpha="80%">${baseMarkup}</span>`;
}

export function renderTogglePill(on: boolean, colors: ColorTokens, t: I18nFn): string {
  const label = t(on ? "common.on" : "common.off");
  if (on) {
    return (
      `<span size="small" weight="bold" ` +
      `foreground="${colors.pillOnFg}" ` +
      `background="${colors.pillOnBg}"> ${label} </span>`
    );
  }

  return (
    `<span size="small" weight="bold" ` +
    `foreground="${colors.pillOffFg}" ` +
    `background="${colors.pillOffBg}"> ${label} </span>`
  );
}

/**
 * Fallback pill variant when span rendering is unreliable.
 *
 * Kept for environments where the Rofi theme does not enable markup rows or
 * where the background attribute is ignored
 */
export function renderBracketTogglePill(on: boolean, colors: ColorTokens, t: I18nFn): string {
  const label = t(on ? "common.on" : "common.off");
  if (on) {
    return `<span foreground="${colors.pillOnFg}" weight="bold">[${label}]</span>`;
  }
  return `<span foreground="${colors.pillOffFg}">[${label}]</span>`;
}

export function renderNavRow(row: NavRow, colors: ColorTokens): string {
  const valueSpan = row.value
    ? ` <span alpha="65%">${escapeHtml(String(row.value))}</span>`
    : "";

  const base =
    `${escapeHtml(row.icon)}  ${escapeHtml(row.label)}${valueSpan}  ` +
    `<span alpha="50%">›</span>`;

  return wrapSubRow(base, row.depth ?? 0);
}

export function renderToggleRow(row: ToggleRow, colors: ColorTokens, t: I18nFn): string {
  const base =
    `${escapeHtml(row.icon)}  ${escapeHtml(row.label)}  ` +
    `${renderTogglePill(row.value, colors, t)}`;

  return wrapSubRow(base, row.depth ?? 0);
}

export function renderRow(row: SettingsRow, colors: ColorTokens, t: I18nFn): string {
  switch (row.type) {
    case "section":
      return sectionHeader(row.label);
    case "nav":
      return renderNavRow(row, colors);
    case "toggle":
      return renderToggleRow(row, colors, t);
    default:
      return "";
  }
}
