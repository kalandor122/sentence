import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import {
  pageBoundaryWithin,
  pageBreakFill,
  pageCountFromBottom,
  pageGeometry,
  pageLineGaps,
  pageRowShifts,
  scrollLeftForZoom,
  scrollTopForZoom,
  scrollTopForZoomPoint,
  sheetScrollMax,
} from "./pagination";

describe("pageGeometry", () => {
  it("reads paper size, margins and font size from settings", () => {
    const a4 = pageGeometry(DEFAULT_SETTINGS);
    expect(a4.width).toBe(794);
    expect(a4.height).toBe(1123);
    expect(a4.margin).toBe(96);
    expect(a4.contentHeight).toBe(931);
    expect(a4.fontSize).toBeCloseTo(14.67, 1);

    const letter = pageGeometry({
      ...DEFAULT_SETTINGS,
      paperSize: "letterpaper",
      margins: "narrow",
      fontSize: "12pt",
    });
    expect(letter.width).toBe(816);
    expect(letter.height).toBe(1056);
    expect(letter.margin).toBe(72);
    expect(letter.contentHeight).toBe(912);
    expect(letter.fontSize).toBe(16);
  });
});

describe("pageCountFromBottom", () => {
  it("counts pages from the same measured sheet coordinates as the rules", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    expect(pageCountFromBottom(100, geometry)).toBe(1);
    expect(pageCountFromBottom(geometry.height, geometry)).toBe(1);
    expect(pageCountFromBottom(geometry.height + 1, geometry)).toBe(2);
    expect(pageCountFromBottom(geometry.height * 2 + 50, geometry)).toBe(3);
  });
});

describe("pageBoundaryWithin", () => {
  it("finds only a boundary that cuts through the block", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    expect(pageBoundaryWithin(100, geometry.height, geometry)).toBeNull();
    expect(pageBoundaryWithin(100, geometry.height + 1, geometry)).toBe(geometry.height);
    expect(pageBoundaryWithin(geometry.height + 40, geometry.height * 2 - 10, geometry)).toBeNull();
    expect(
      pageBoundaryWithin(geometry.height + 40, geometry.height * 2 + 40, geometry),
    ).toBe(geometry.height * 2);
  });
});

describe("pageBreakFill", () => {
  it("starts the following block at the next page's top margin", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    const top = geometry.margin + 200;
    const height = 148;
    const fill = pageBreakFill(top, height, geometry);
    expect(top + fill + height).toBe(geometry.height + geometry.margin);
  });
});

describe("scrollTopForZoom", () => {
  it("keeps the point under the viewport centre while zooming out at the end", () => {
    expect(scrollTopForZoom(13558, 627, 30, 1, 0.7, 9702)).toBeCloseTo(9406, 0);
  });

  it("clamps to the scaled scroll range instead of scrolling past the sheet", () => {
    expect(scrollTopForZoom(14082, 627, 30, 1, 0.7, 9702)).toBe(9702);
    expect(scrollTopForZoom(0, 627, 30, 1, 0.7, 9702)).toBe(0);
  });

  it("holds the reading position across zoom in and back out", () => {
    const zoomedIn = scrollTopForZoom(5000, 627, 30, 1, 1.5, 30000);
    expect(zoomedIn).toBeCloseTo(7642, 0);
    expect(scrollTopForZoom(zoomedIn, 627, 30, 1.5, 1, 20000)).toBeCloseTo(5000, 6);
  });

  // qa-322: wheeling to the maximum and then zooming out used to leave 3,833px
  // of blank scroll below the sheet because the range still used the 100% layout.
  it("stops at the scaled bottom when zooming out from the end of the range", () => {
    const viewportHeight = 627;
    const paddingTop = 30;
    const paddingBottom = 80;
    const sheetHeight = 1123 * 13;
    const maxAt100 = sheetScrollMax(paddingTop + sheetHeight, paddingBottom, viewportHeight);
    const maxAt70 = sheetScrollMax(paddingTop + sheetHeight * 0.7, paddingBottom, viewportHeight);
    expect(maxAt100).toBe(14082);
    expect(maxAt70).toBe(9702);

    const top = scrollTopForZoom(maxAt100, viewportHeight, paddingTop, 1, 0.7, maxAt70);
    expect(top).toBe(maxAt70);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - top).toBeCloseTo(viewportHeight, 0);
  });
});

describe("sheetScrollMax", () => {
  // qa-312: the 13-page A4 sheet ends at 14,629px and the scroller has 30px of
  // top and 80px of bottom padding, so the zoomed-out range must stop at the
  // scaled sheet bottom instead of the 100% layout's height.
  it("ends the zoomed-out range at the scaled sheet bottom", () => {
    expect(sheetScrollMax(10249, 80, 627)).toBe(9702);
    expect(sheetScrollMax(14629, 80, 627)).toBe(14082);
  });

  it("covers a zoomed-in sheet that is wider than the pane", () => {
    // 950px pane, 1,191px sheet, 34px of padding on each side.
    expect(sheetScrollMax(1225, 34, 950)).toBe(309);
  });

  it("never scrolls past a sheet that already fits", () => {
    expect(sheetScrollMax(400, 80, 627)).toBe(0);
  });

  it("rounds a fractional scaled edge down instead of past the page", () => {
    // The 13-page sheet at 150% ends at 21,928.5px and has 80px of bottom
    // padding, so the maximum has to stop at 21,381px rather than round up.
    expect(sheetScrollMax(21928.5, 80, 627)).toBe(21381);
  });
});

describe("scrollLeftForZoom", () => {
  it("keeps a sideways-scrolled position proportional to the zoom", () => {
    expect(scrollLeftForZoom(200, 1, 1.5, 400)).toBe(300);
    expect(scrollLeftForZoom(300, 1.5, 0.7, 400)).toBeCloseTo(140, 6);
  });

  it("leaves the page at its left edge when it was not scrolled", () => {
    expect(scrollLeftForZoom(0, 1, 1.5, 400)).toBe(0);
  });

  it("clamps to the new horizontal range", () => {
    expect(scrollLeftForZoom(200, 1.5, 1, 0)).toBe(0);
    expect(scrollLeftForZoom(200, 1, 2, 300)).toBe(300);
  });

  // qa-322: at 150% the 794px sheet is 1,191px wide in a 950px pane with 34px
  // of side padding, so the range has to cover the whole page instead of the
  // 121px the transformed sheet used to add past the centred stage.
  it("reaches both edges of a page that is wider than the pane", () => {
    const sheetWidth = (794 * 150) / 100;
    const maxScrollLeft = sheetScrollMax(sheetWidth + 34, 34, 950);
    expect(maxScrollLeft).toBe(309);

    // The left edge is visible at the start of the range and the right edge at
    // the end, so no part of the sheet is clipped out of reach.
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    expect(34 + sheetWidth - maxScrollLeft).toBeLessThanOrEqual(950);
  });
});

describe("zoom keeps the scroll range on the rendered sheet", () => {
  // qa-323: a page that fits at 100% must stay inside the pane after the zoom
  // cycle, and a page that is wider at 150% has to keep both edges reachable.
  it("returns a zoomed-in page to the pane across a full horizontal cycle", () => {
    const sheetWidth = (794 * 150) / 100;
    const maxAt100 = sheetScrollMax(794 + 34, 34, 950);
    const maxAt150 = sheetScrollMax(sheetWidth + 34, 34, 950);
    expect(maxAt100).toBe(0);
    expect(maxAt150).toBe(309);

    expect(scrollLeftForZoom(0, 1, 1.5, maxAt150)).toBe(0);
    expect(scrollLeftForZoom(maxAt150, 1.5, 1, maxAt100)).toBe(0);
    expect(34 + sheetWidth - maxAt150).toBeLessThanOrEqual(950);
  });

  it("stops at the scaled bottom when the reader wheeled to the end at 150%", () => {
    const viewportHeight = 627;
    const paddingTop = 30;
    const paddingBottom = 80;
    const sheetHeight = 1123 * 13;
    const maxAt150 = sheetScrollMax(
      paddingTop + sheetHeight * 1.5,
      paddingBottom,
      viewportHeight,
    );
    const maxAt70 = sheetScrollMax(
      paddingTop + sheetHeight * 0.7,
      paddingBottom,
      viewportHeight,
    );
    expect(maxAt150).toBe(21381);
    expect(maxAt70).toBe(9702);

    const top = scrollTopForZoom(maxAt150, viewportHeight, paddingTop, 1.5, 0.7, maxAt70);
    expect(top).toBe(maxAt70);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - top).toBeCloseTo(
      viewportHeight,
      0,
    );
  });
});

describe("scrollTopForZoomPoint", () => {
  it("keeps the caret at the same screen position while zooming out at the end", () => {
    const pointTop = 14029;
    const target = scrollTopForZoomPoint(pointTop, 13558, 627, 30, 1, 0.7, 9702);
    expect(target).toBeCloseTo(9349, 0);
    expect(30 + pointTop * 0.7 - target).toBeCloseTo(501, 6);
  });

  it("falls back to the viewport centre when the caret was out of view", () => {
    expect(scrollTopForZoomPoint(0, 13558, 627, 30, 1, 0.7, 9702)).toBe(
      scrollTopForZoom(13558, 627, 30, 1, 0.7, 9702),
    );
    expect(scrollTopForZoomPoint(20000, 13558, 627, 30, 1, 0.7, 9702)).toBe(
      scrollTopForZoom(13558, 627, 30, 1, 0.7, 9702),
    );
  });

  it("clamps the target to the scaled scroll range", () => {
    expect(scrollTopForZoomPoint(14029, 13558, 627, 30, 1, 0.7, 9000)).toBe(9000);
  });

  it("keeps the end of the document on screen across the full zoom range", () => {
    const end = 14029;
    const at70 = scrollTopForZoomPoint(end, 13558, 627, 30, 1, 0.7, 9702);
    const at150 = scrollTopForZoomPoint(end, at70, 627, 30, 0.7, 1.5, 21382);
    expect(30 + end * 1.5 - at150).toBeCloseTo(501, 6);
    expect(scrollTopForZoomPoint(end, at150, 627, 30, 1.5, 1, 14082)).toBeCloseTo(13558, 6);
  });

  it("keeps the whole caret line on screen when the line grows with the zoom", () => {
    // The end line sits 611px down the 627px viewport at 100%; at 150% the
    // line grows to 24px and holding only its top would clip the bottom.
    const unclamped = scrollTopForZoomPoint(14029, 13448, 627, 30, 1, 1.5, 21382);
    expect(30 + 14029 * 1.5 - unclamped).toBeCloseTo(611, 6);
    expect(30 + (14029 + 16) * 1.5 - unclamped).toBeCloseTo(635, 6);

    const clamped = scrollTopForZoomPoint(14029, 13448, 627, 30, 1, 1.5, 21382, 16);
    expect(30 + 14029 * 1.5 - clamped).toBeCloseTo(603, 6);
    expect(30 + (14029 + 16) * 1.5 - clamped).toBeCloseTo(627, 6);
  });

  it("never scrolls a box taller than the viewport above the top", () => {
    // An 800px image at 150% is 1200px tall, so it cannot fit; the clamp stops
    // with its top at the top of the viewport instead of scrolling it away.
    const target = scrollTopForZoomPoint(500, 0, 627, 30, 1, 1.5, 20000, 800);
    expect(30 + 500 * 1.5 - target).toBeCloseTo(0, 6);
  });

  it("ignores the line height when the caret was out of view before the zoom", () => {
    expect(scrollTopForZoomPoint(0, 13558, 627, 30, 1, 0.7, 9702, 16)).toBe(
      scrollTopForZoom(13558, 627, 30, 1, 0.7, 9702),
    );
  });

  it("uses the pre-zoom offset when the new zoom clamped it before the effect ran", () => {
    // The end sat at 20925 at 150%; switching to 100% clamps the DOM offset to
    // 14082 first, but the caret's unscaled top 14029 was on screen at 148.5.
    const target = scrollTopForZoomPoint(14029, 20925, 627, 30, 1.5, 1, 14082);
    expect(30 + 14029 - target).toBeCloseTo(148.5, 6);
    expect(target).toBeCloseTo(13910.5, 6);
  });

  // qa-302: the 3,600-word probe document is 13 A4 pages tall. The stage must
  // reserve the scaled height, so the scroll range at 70% ends at the scaled
  // sheet bottom instead of the 100% layout, and the last line stays on screen.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const maxScrollAt70 = Math.round(
    paddingTop + sheetHeight * 0.7 + paddingBottom - viewportHeight,
  );

  it("ends the zoomed-out scroll range at the scaled sheet height", () => {
    expect(maxScrollAt70).toBe(9702);
    expect(maxScrollAt70).toBeLessThan(
      sheetHeight + paddingTop + paddingBottom - viewportHeight,
    );
  });

  it("keeps the end of the document in view after zooming out at the end", () => {
    const at70 = scrollTopForZoomPoint(
      14029,
      13558,
      viewportHeight,
      paddingTop,
      1,
      0.7,
      maxScrollAt70,
    );
    expect(at70).toBeLessThanOrEqual(maxScrollAt70);
    const screenTop = paddingTop + 14029 * 0.7 - at70;
    expect(screenTop).toBeGreaterThanOrEqual(0);
    expect(screenTop).toBeLessThanOrEqual(viewportHeight);

    // Zooming back to 100% returns to the reading position it started from.
    expect(
      scrollTopForZoomPoint(14029, at70, viewportHeight, paddingTop, 0.7, 1, 14082),
    ).toBeCloseTo(13558, 6);
  });
});

describe("pageLineGaps", () => {
  it("moves the line crossing a page edge to the next page's text area", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    const lines = Array.from({ length: 120 }, (_, index) => ({
      top: geometry.margin + index * 25,
      bottom: geometry.margin + index * 25 + 16,
    }));
    const gaps = pageLineGaps(
      lines,
      geometry.margin,
      geometry.margin + 120 * 25,
      geometry,
    );
    expect(gaps.length).toBeGreaterThan(1);

    let shift = 0;
    let gapIndex = 0;
    lines.forEach((line, index) => {
      if (gapIndex < gaps.length && gaps[gapIndex].line === index) {
        shift += gaps[gapIndex].height;
        gapIndex += 1;
      }
      const top = line.top + shift;
      const bottom = line.bottom + shift;
      const pageTop = Math.floor(top / geometry.height) * geometry.height;
      expect(top).toBeGreaterThanOrEqual(pageTop + geometry.margin);
      expect(bottom).toBeLessThanOrEqual(
        pageTop + geometry.height - geometry.margin,
      );
    });
    expect(gapIndex).toBe(gaps.length);
  });

  it("starts the row crossing a page edge at the next page's top margin", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    const rows = Array.from({ length: 120 }, (_, index) => ({
      top: geometry.margin + index * 36,
      bottom: geometry.margin + index * 36 + 36,
    }));
    const shifts = pageRowShifts(rows, geometry);
    expect(shifts.length).toBeGreaterThan(1);

    let shift = 0;
    let shiftIndex = 0;
    rows.forEach((row, index) => {
      if (shiftIndex < shifts.length && shifts[shiftIndex].row === index) {
        shift += shifts[shiftIndex].shift;
        shiftIndex += 1;
      }
      const top = row.top + shift;
      const bottom = row.bottom + shift;
      const pageTop = Math.floor(top / geometry.height) * geometry.height;
      expect(top).toBeGreaterThanOrEqual(pageTop + geometry.margin);
      expect(bottom).toBeLessThanOrEqual(pageTop + geometry.height - geometry.margin);
    });
    expect(shiftIndex).toBe(shifts.length);
  });

  it("moves trailing lines out of a bottom margin even before the next page edge", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    const lines = Array.from({ length: 40 }, (_, index) => ({
      top: geometry.margin + index * 25,
      bottom: geometry.margin + index * 25 + 16,
    }));
    const gaps = pageLineGaps(
      lines,
      geometry.margin,
      lines[lines.length - 1].bottom,
      geometry,
    );
    expect(gaps).toHaveLength(1);
    expect(lines[gaps[0].line].top + gaps[0].height).toBeGreaterThanOrEqual(
      geometry.height + geometry.margin,
    );
  });
});
