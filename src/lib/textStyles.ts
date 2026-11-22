// Canonical text-style tables shared by the editor marks, the ribbon UI,
// and the LaTeX serializer/parser. Keys are stored in document marks, so
// every table here must stay stable to keep saved projects readable.

export interface TextFontOption {
  key: string;
  label: string;
  css: string;
  latex: string;
}

export const TEXT_FONTS: TextFontOption[] = [
  { key: "default", label: "Default", css: "", latex: "" },
  { key: "sans", label: "Sans serif", css: '"Segoe UI", Arial, Helvetica, sans-serif', latex: "sffamily" },
  { key: "mono", label: "Typewriter", css: '"Cascadia Mono", Consolas, monospace', latex: "ttfamily" },
  { key: "times", label: "Times New Roman", css: '"Times New Roman", Times, serif', latex: "sentenceTimes" },
  { key: "arial", label: "Arial", css: "Arial, Helvetica, sans-serif", latex: "sentenceArial" },
  { key: "courier", label: "Courier New", css: '"Courier New", Courier, monospace', latex: "sentenceCourier" },
  { key: "palatino", label: "Palatino Linotype", css: '"Palatino Linotype", "Book Antiqua", Palatino, serif', latex: "sentencePalatino" },
];

export interface TextSizeOption {
  key: string;
  label: string;
  px: string;
}

export const TEXT_SIZES: TextSizeOption[] = [
  { key: "normal", label: "11 (Normal)", px: "16px" },
  { key: "tiny", label: "8", px: "10px" },
  { key: "small", label: "10", px: "13px" },
  { key: "large", label: "14", px: "19px" },
  { key: "Large", label: "18", px: "23px" },
  { key: "LARGE", label: "20", px: "28px" },
  { key: "huge", label: "24", px: "32px" },
  { key: "Huge", label: "28", px: "37px" },
];

export interface TextColorOption {
  key: string;
  label: string;
  latex: string;
}

export const TEXT_COLORS: TextColorOption[] = [
  { key: "#000000", label: "Black", latex: "black" },
  { key: "#595959", label: "Dark gray", latex: "darkgray" },
  { key: "#c00000", label: "Dark red", latex: "red" },
  { key: "#e36c0a", label: "Orange", latex: "orange" },
  { key: "#1f7a1f", label: "Green", latex: "green" },
  { key: "#1f4fc4", label: "Blue", latex: "blue" },
  { key: "#7030a0", label: "Purple", latex: "purple" },
  { key: "#c026d3", label: "Magenta", latex: "magenta" },
  { key: "#006666", label: "Teal", latex: "teal" },
];

export const HIGHLIGHT_COLORS: TextColorOption[] = [
  { key: "#fff3a3", label: "Yellow", latex: "yellow" },
  { key: "#b6e39a", label: "Green", latex: "green" },
  { key: "#8fd6f2", label: "Cyan", latex: "cyan" },
  { key: "#f2a8f2", label: "Magenta", latex: "magenta" },
  { key: "#ffd9a0", label: "Orange", latex: "orange" },
  { key: "#ffb0c0", label: "Pink", latex: "pink" },
];

export const FONT_CSS: Record<string, string> = Object.fromEntries(
  TEXT_FONTS.map((font) => [font.key, font.css]),
);

export const FONT_BY_LATEX: Record<string, string> = Object.fromEntries(
  TEXT_FONTS.filter((font) => font.key !== "default").map((font) => [font.latex, font.key]),
);

export const SIZE_PX: Record<string, string> = Object.fromEntries(
  TEXT_SIZES.map((size) => [size.key, size.px]),
);

export const COLOR_BY_LATEX: Record<string, string> = Object.fromEntries(
  TEXT_COLORS.map((color) => [color.latex, color.key]),
);

export const HIGHLIGHT_BY_LATEX: Record<string, string> = Object.fromEntries(
  HIGHLIGHT_COLORS.map((color) => [color.latex, color.key]),
);

export function fontLatex(key: string): string | null {
  return TEXT_FONTS.find((font) => font.key === key)?.latex ?? null;
}

export function colorLatex(hex: string): string | null {
  return TEXT_COLORS.find((color) => color.key === hex)?.latex ?? null;
}

export function highlightLatex(hex: string): string | null {
  return HIGHLIGHT_COLORS.find((color) => color.key === hex)?.latex ?? null;
}
