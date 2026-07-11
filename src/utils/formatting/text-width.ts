/**
 * Unicode-aware display-width helpers.
 *
 * The old "non-Latin means width 2" trick was fine for CJK, wrong for plenty
 * of scripts that are still one monospace cell. This is closer to wcwidth.
 *
 * Still not magic: ZWJ emoji and other grapheme weirdness can be off by a cell
 * or two. If that ever matters, use a real wcwidth lib and keep these exports.
 */

// Marks and joiners that occupy no cell by themselves.
const ZERO_WIDTH_RANGES: Array<[number, number]> = [
  [0x0300, 0x036f], // Combining Diacritical Marks
  [0x0483, 0x0489], // Cyrillic combining marks
  [0x0591, 0x05bd], // Hebrew points
  [0x05bf, 0x05bf],
  [0x05c1, 0x05c2],
  [0x05c4, 0x05c5],
  [0x05c7, 0x05c7],
  [0x0610, 0x061a], // Arabic marks
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x0711, 0x0711],
  [0x0730, 0x074a],
  [0x07a6, 0x07b0],
  [0x0816, 0x0819],
  [0x081b, 0x0823],
  [0x0825, 0x0827],
  [0x0829, 0x082d],
  [0x0900, 0x0902], // Devanagari
  [0x093a, 0x093a],
  [0x093c, 0x093c],
  [0x0941, 0x0948],
  [0x094d, 0x094d],
  [0x0951, 0x0957],
  [0x0962, 0x0963],
  [0x1ab0, 0x1aff], // Combining Diacritical Marks Extended
  [0x1dc0, 0x1dff], // Combining Diacritical Marks Supplement
  [0x200b, 0x200f], // ZWSP, ZWNJ, ZWJ, LRM/RLM
  [0x2028, 0x202e],
  [0x2060, 0x2064], // Word joiner etc.
  [0x20d0, 0x20ff], // Combining Diacritical Marks for Symbols
  [0xfe00, 0xfe0f], // Variation selectors
  [0xfe20, 0xfe2f], // Combining Half Marks
  [0xfeff, 0xfeff], // BOM / zero width no-break space
];

// Wide/fullwidth stuff, plus common emoji blocks because terminals mostly do that too.
const WIDE_RANGES: Array<[number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2329, 0x232a], // Angle brackets
  [0x2e80, 0x2e99], // CJK Radicals Supplement
  [0x2e9b, 0x2ef3],
  [0x2f00, 0x2fd5], // Kangxi Radicals
  [0x2ff0, 0x2ffb], // Ideographic Description Characters
  [0x3000, 0x303e], // CJK Symbols and Punctuation
  [0x3041, 0x33ff], // Hiragana .. CJK Compatibility
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa000, 0xa4cf], // Yi Syllables / Radicals
  [0xac00, 0xd7a3], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe30, 0xfe4f], // CJK Compatibility Forms
  [0xff00, 0xff60], // Fullwidth Forms
  [0xffe0, 0xffe6],
  [0x16fe0, 0x16fe4],
  [0x17000, 0x187f7], // Tangut
  [0x18800, 0x18cd5],
  [0x1b000, 0x1b2fb], // Kana Supplement / Extended
  [0x1f200, 0x1f2ff], // Enclosed Ideographic Supplement
  [0x1f300, 0x1f64f], // Misc Symbols & Pictographs, Emoticons
  [0x1f680, 0x1f6ff], // Transport & Map
  [0x1f900, 0x1f9ff], // Supplemental Symbols and Pictographs
  [0x1fa70, 0x1faff],
  [0x20000, 0x2fffd], // CJK Unified Ideographs Extension B..
  [0x30000, 0x3fffd],
];

function inRanges(cp: number, ranges: Array<[number, number]>): boolean {
  // Tiny sorted list, so linear scan is boring and fast enough.
  for (const [start, end] of ranges) {
    if (cp < start) return false;
    if (cp <= end) return true;
  }
  return false;
}

/** Width of one Unicode code point, in monospace cells. */
export function codePointWidth(cp: number): 0 | 1 | 2 {
  if (cp === 0) return 0;
  if (inRanges(cp, ZERO_WIDTH_RANGES)) return 0;
  if (inRanges(cp, WIDE_RANGES)) return 2;
  return 1;
}

/** Strip Pango-ish tags before measuring visible text. */
export function stripTags(s: string): string {
  let out = "";
  let insideTag = false;
  for (const ch of s) {
    if (ch === "<") {
      insideTag = true;
    } else if (ch === ">") {
      insideTag = false;
    } else if (!insideTag) {
      out += ch;
    }
  }
  return out;
}

/**
 * Display width for plain text.
 * Iterates code points, not UTF-16 units, so most emoji don't get double-counted.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += codePointWidth(ch.codePointAt(0) ?? 0);
  }
  return width;
}

/** Visible width after ignoring Pango tags. */
export function visibleWidth(textWithTags: string): number {
  return displayWidth(stripTags(textWithTags));
}

// Pad with NBSP so Pango keeps table columns aligned.
//assumes wrapped cells already closed their tags; don't get clever here.
export function padVisibleWidth(textWithTags: string, targetWidth: number): string {
  const current = visibleWidth(textWithTags);
  const deficit = targetWidth - current;
  return deficit > 0 ? textWithTags + "\u00A0".repeat(deficit) : textWithTags;
}
