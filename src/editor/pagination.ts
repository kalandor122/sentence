import type { ProjectSettings } from "../lib/types";

export interface PageGeometry {
  width: number;
  height: number;
  margin: number;
  contentHeight: number;
  fontSize: number;
}

// CSS pixels at 96 dpi, matching the sizes used by documentToLatex.
const PAPER: Record<ProjectSettings["paperSize"], { width: number; height: number }> = {
  a4paper: {
    width: Math.round((210 / 25.4) * 96),
    height: Math.round((297 / 25.4) * 96),
  },
  letterpaper: { width: 816, height: 1056 },
};

const MARGINS: Record<ProjectSettings["margins"], number> = {
  narrow: 72, // 0.75in
  normal: 96, // 1in
  wide: 144, // 1.5in
};

const FONT_SIZES: Record<ProjectSettings["fontSize"], number> = {
  "10pt": (10 * 96) / 72,
  "11pt": (11 * 96) / 72,
  "12pt": 16,
};

export function pageGeometry(settings: ProjectSettings): PageGeometry {
  const paper = PAPER[settings.paperSize];
  const margin = MARGINS[settings.margins];
  return {
    width: paper.width,
    height: paper.height,
    margin,
    contentHeight: paper.height - 2 * margin,
    fontSize: FONT_SIZES[settings.fontSize],
  };
}

// Page boundaries sit at whole multiples of the sheet height, measured from the
// top of the sheet. `bottom` is the same measurement used for the visible rules.
export function pageCountFromBottom(bottom: number, geometry: PageGeometry): number {
  return Math.floor(Math.max(0, bottom - 1) / geometry.height) + 1;
}

// An explicit break fills the rest of its page so the following block starts at
// the top margin of the next one. `top` and `height` are unscaled layout pixels.
export function pageBreakFill(top: number, height: number, geometry: PageGeometry): number {
  const pageIndex = Math.max(0, Math.floor(top / geometry.height));
  const nextPageTop = (pageIndex + 1) * geometry.height + geometry.margin;
  return Math.max(0, Math.round(nextPageTop - top - height));
}
