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

// The scroll range on one axis has to end at the scaled edge of the sheet, not
// at whatever size the stage reserved while the page layout was still settling.
// `sheetEnd` and `paddingEnd` are measured in the scroller's content
// coordinates, so a zoom correction can never leave blank space past the page.
// A scaled edge is often fractional, and rounding it up would put the maximum
// a fraction of a pixel past the page, so the range is rounded down instead.
export function sheetScrollMax(
  sheetEnd: number,
  paddingEnd: number,
  viewportSize: number,
): number {
  return Math.max(0, Math.floor(sheetEnd + paddingEnd - viewportSize));
}

// A zoomed-in sheet can be wider than the pane, so the horizontal offset has to
// be rescaled with it too. Keeping the offset proportional holds the part of the
// page being read in view instead of snapping back to the left edge, while a
// page that is not scrolled (or no longer wider than the pane) stays left-aligned.
export function scrollLeftForZoom(
  scrollLeft: number,
  previousZoom: number,
  zoom: number,
  maxScrollLeft: number,
): number {
  if (scrollLeft <= 0) return 0;
  return Math.max(0, Math.min(maxScrollLeft, scrollLeft * (zoom / previousZoom)));
}

// The pane can also rescale the sheet without the zoom changing (a side panel
// opening or closing). That changes the scroll range the same way, so the offset
// has to follow it, but it holds the document point at the top of the viewport
// rather than its centre: a reader at the start of the page must stay there when
// the pane widens instead of being scrolled down by half a viewport.
export function scrollTopForFit(
  scrollTop: number,
  paddingTop: number,
  previousFit: number,
  fit: number,
  maxScrollTop: number,
): number {
  const target = paddingTop + (scrollTop - paddingTop) * (fit / previousFit);
  return Math.max(0, Math.min(maxScrollTop, target));
}

// Zooming in grows the page around its centre, so a caret that sits near a
// line's right margin can leave the pane even though the vertical correction
// keeps its line on screen. That leaves the reader typing at a caret they cannot
// see. `caretLeft` is the caret's screen position after the offset has already
// been rescaled: when it falls outside the pane, move just enough to bring it
// back inside (or to the edge when the page cannot scroll any further).
export function scrollLeftForCaret(
  caretLeft: number,
  viewportWidth: number,
  scrollLeft: number,
  maxScrollLeft: number,
  edge = 8,
): number {
  if (caretLeft > viewportWidth - edge) {
    return Math.min(maxScrollLeft, scrollLeft + caretLeft - (viewportWidth - edge));
  }
  if (caretLeft < edge) {
    return Math.min(maxScrollLeft, Math.max(0, scrollLeft + caretLeft - edge));
  }
  return scrollLeft;
}

export interface ZoomPoint {
  top: number;
  height: number;
}

// The caret is the natural reading anchor, but focus can sit outside the page
// (the source pane in Split mode, a dialog or the toolbar) while the visual
// page is scrolled to its end. Centring the zoom there pushes the last block
// off the top of the viewport while the blank tail of the last page stays
// below it, so the reader sees no text at all. The same happens at the start of
// a long document: centring on a zoom-in scrolls the page top under the
// toolbar. Prefer whichever point is on screen before the zoom: the caret, the
// top edge of the sheet when the reader is at the start, then the last block
// when the reader is at the end. `null` means none of them is visible and the
// caller should fall back to centre anchoring.
export function zoomAnchor(
  caret: ZoomPoint | null,
  endBlock: ZoomPoint | null,
  scrollTop: number,
  viewportHeight: number,
  paddingTop: number,
  previousZoom: number,
  pageStart: ZoomPoint | null = null,
): ZoomPoint | null {
  const onScreen = (point: ZoomPoint) => {
    const top = paddingTop + point.top * previousZoom - scrollTop;
    return top + point.height * previousZoom > 0 && top < viewportHeight;
  };
  if (caret && onScreen(caret)) return caret;
  if (pageStart && onScreen(pageStart)) return pageStart;
  if (endBlock && onScreen(endBlock)) return endBlock;
  return caret;
}

// Centre-anchoring alone loses the caret when it sits below the middle of the
// viewport (at the end of a document, for example): scaling its distance from
// the centre can push it off-screen. When the caret was visible before the
// zoom, hold its exact screen position instead and fall back to the viewport
// centre only when it was already out of view. A line that only straddles the
// edge still counts as visible, and the held position is pulled inside when its
// scaled box would cross the foot of the viewport, so zooming never leaves the
// line the reader was on clipped. `pointTop` is the caret's unscaled document
// offset from the top of the sheet, and `pointHeight` its line box; a box taller
// than the viewport cannot fit, so it stops with its top at the viewport top.
// `pin` anchors even when the box was completely out of view, which is what
// keeps the last block reachable when the reader zoomed while sitting below it
// in the blank bottom margin of the final page.
export function scrollTopForZoomPoint(
  pointTop: number,
  scrollTop: number,
  viewportHeight: number,
  paddingTop: number,
  previousZoom: number,
  zoom: number,
  maxScrollTop: number,
  pointHeight = 0,
  pin = false,
): number {
  const previousScreen = pointTop * previousZoom + paddingTop - scrollTop;
  const edge = pointHeight * previousZoom;
  if (!pin && (previousScreen < -edge || previousScreen > viewportHeight + edge)) {
    return scrollTopForZoom(scrollTop, viewportHeight, paddingTop, previousZoom, zoom, maxScrollTop);
  }
  const screen = Math.max(
    0,
    Math.min(previousScreen, viewportHeight - pointHeight * zoom),
  );
  const target = paddingTop + pointTop * zoom - screen;
  return Math.max(0, Math.min(maxScrollTop, target));
}
