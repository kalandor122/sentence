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

// The first page boundary that falls strictly inside a block, measured in
// unbounded sheet coordinates. Returns null when the block stays on one page.
export function pageBoundaryWithin(
  top: number,
  bottom: number,
  geometry: PageGeometry,
): number | null {
  const boundary = (Math.floor(Math.max(0, top) / geometry.height) + 1) * geometry.height;
  return boundary < bottom ? boundary : null;
}

export interface LineSpan {
  top: number;
  bottom: number;
}

export interface LineGap {
  line: number;
  height: number;
}

// A block taller than a page cannot move as a whole, so its lines are split at
// the page edges instead. The line that would cross a page's bottom margin
// starts at the top margin of the next page; the rule then falls in the blank
// gap between the two pages instead of across a line. The last boundary is
// checked even when it lies past the block, since a block can also end inside a
// page's bottom margin without reaching the next page edge. `top` and `bottom`
// are unscaled sheet coordinates of the block.
export function pageLineGaps(
  lines: LineSpan[],
  top: number,
  bottom: number,
  geometry: PageGeometry,
): LineGap[] {
  const gaps: LineGap[] = [];
  let shift = 0;
  let index = 0;
  for (
    let boundary = Math.ceil(Math.max(0, top) / geometry.height) * geometry.height;
    boundary - geometry.margin < bottom + shift && index < lines.length;
    boundary += geometry.height
  ) {
    const contentBottom = boundary - geometry.margin;
    while (index < lines.length && lines[index].bottom + shift <= contentBottom) {
      index += 1;
    }
    if (index >= lines.length) break;
    const height = Math.round(boundary + geometry.margin - lines[index].top - shift);
    if (height <= 0) continue;
    gaps.push({ line: index, height });
    shift += height;
  }
  return gaps;
}

export interface RowShift {
  row: number;
  shift: number;
}

// A table taller than a page is split between rows: the row that would cross a
// page's bottom margin starts at the top margin of the next page, so the rule
// falls in blank cell space instead of across the row's text. The
// shift is padding inside the row's cells, so the row keeps its place in the
// model and the text after it moves with it. `rows` are unscaled sheet
// coordinates of the row border boxes.
export function pageRowShifts(rows: LineSpan[], geometry: PageGeometry): RowShift[] {
  const shifts: RowShift[] = [];
  let shift = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const top = rows[index].top + shift;
    const bottom = rows[index].bottom + shift;
    // A row taller than the text area cannot fit any page, so shifting it
    // would only repeat on every pass.
    if (bottom - top > geometry.contentHeight) continue;
    const pageTop = Math.floor(Math.max(0, top) / geometry.height) * geometry.height;
    const topMargin = pageTop + geometry.margin;
    const bottomMargin = pageTop + geometry.height - geometry.margin;
    let needed = 0;
    if (top < topMargin) needed = topMargin - top;
    else if (bottom > bottomMargin) needed = pageTop + geometry.height + geometry.margin - top;
    if (needed <= 0.5) continue;
    const height = Math.ceil(needed);
    shifts.push({ row: index, shift: height });
    shift += height;
  }
  return shifts;
}

// An explicit break fills the rest of its page so the following block starts at
// the top margin of the next one. `top` and `height` are unscaled layout pixels.
export function pageBreakFill(top: number, height: number, geometry: PageGeometry): number {
  const pageIndex = Math.max(0, Math.floor(top / geometry.height));
  const nextPageTop = (pageIndex + 1) * geometry.height + geometry.margin;
  return Math.max(0, Math.round(nextPageTop - top - height));
}

// The sheet is scaled from its top, so changing the zoom has to rescale the
// scroll offset with it: the document point under the viewport centre stays
// there instead of drifting, and the new offset is clamped to the scaled scroll
// range so zooming out at the end cannot leave the viewport past the sheet.
export function scrollTopForZoom(
  scrollTop: number,
  viewportHeight: number,
  paddingTop: number,
  previousZoom: number,
  zoom: number,
  maxScrollTop: number,
): number {
  const anchor = (scrollTop + viewportHeight / 2 - paddingTop) / previousZoom;
  const target = paddingTop + anchor * zoom - viewportHeight / 2;
  return Math.max(0, Math.min(maxScrollTop, target));
}
