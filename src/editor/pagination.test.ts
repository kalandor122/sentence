import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import {
  pageBoundaryWithin,
  pageBreakFill,
  pageCountFromBottom,
  pageGeometry,
  pageLineGaps,
  pageRowShifts,
  scrollLeftForCaret,
  scrollLeftForZoom,
  scrollTopForFit,
  scrollTopForZoom,
  scrollTopForZoomPoint,
  scrollportWidth,
  sheetScrollMax,
  zoomAnchor,
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

describe("zooming out from the end of a long document", () => {
  // qa-326: the 3,600-word probe document is 13 A4 pages. Stepping the zoom
  // down from the wheeled maximum has to clamp every step to the sheet's scaled
  // bottom, so no step leaves blank scroll below the last page.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("stops at the scaled sheet bottom on every zoom-out step", () => {
    let top = maxAt(1);
    let previous = 1;
    for (const percent of [90, 80, 70]) {
      const zoom = percent / 100;
      top = scrollTopForZoom(top, viewportHeight, paddingTop, previous, zoom, maxAt(zoom));
      expect(top).toBe(maxAt(zoom));
      // The sheet ends no higher than the pane's bottom edge, so the last page
      // is never left above the viewport.
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThanOrEqual(
        viewportHeight - paddingBottom,
      );
      previous = zoom;
    }
  });
});

describe("qa-327: zooming a long document keeps the sheet reachable", () => {
  // The 3,600-word probe document is 13 A4 pages. From the end of the document
  // three zoom-out clicks must keep the last line on screen, and wheeling to the
  // new maximum must stop at the scaled sheet bottom instead of the 100% layout.
  const pane = 950;
  const padding = 34;
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the end line on screen through every zoom-out step", () => {
    let top = 13558;
    let previous = 1;
    for (const percent of [90, 80, 70]) {
      const zoom = percent / 100;
      top = scrollTopForZoomPoint(14029, top, viewportHeight, paddingTop, previous, zoom, maxAt(zoom), 16);
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      const lineTop = paddingTop + 14029 * zoom - top;
      expect(lineTop).toBeGreaterThanOrEqual(0);
      expect(lineTop + 16 * zoom).toBeLessThanOrEqual(viewportHeight);
      previous = zoom;
    }

    // Wheeling to the bottom at 70% ends the range at the scaled sheet, so the
    // viewport is never left below the last page with blank space past it.
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - maxAt(0.7)).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("reaches both edges of the 150% sheet in the pane", () => {
    const maxScrollLeft = sheetScrollMax(padding + (794 * 150) / 100, padding, pane);
    expect(maxScrollLeft).toBe(309);
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    // The right edge is visible at the maximum and the left edge at zero.
    expect(padding + (794 * 150) / 100 - maxScrollLeft).toBeLessThanOrEqual(pane);
    expect(scrollLeftForZoom(maxScrollLeft, 1.5, 1, 0)).toBe(0);
  });
});

describe("qa-359: zooming out at the end keeps the page in the viewport", () => {
  // The 13-page probe document at 1280x800: pressing Ctrl+End stops at 13,558
  // of the 14,082 range, and three status-bar zoom-out clicks step down to 70%.
  // Each step has to hold the last line on screen, and wheeling afterwards can
  // only reach the scaled sheet bottom instead of the old 100% maximum.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the last line visible and stops the wheel at the scaled bottom", () => {
    let top = 13558;
    let previous = 1;
    for (const percent of [90, 80, 70]) {
      const zoom = percent / 100;
      top = scrollTopForZoomPoint(14029, top, viewportHeight, paddingTop, previous, zoom, maxAt(zoom), 16);
      const lineTop = paddingTop + 14029 * zoom - top;
      expect(lineTop).toBeGreaterThanOrEqual(0);
      expect(lineTop + 16 * zoom).toBeLessThanOrEqual(viewportHeight);
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      // The reader's wheel offset from 100% is clamped by the new range, so no
      // blank tail below the sheet is reachable after zooming out.
      expect(Math.min(14082, maxAt(zoom))).toBe(maxAt(zoom));
      previous = zoom;
    }
    expect(maxAt(0.7)).toBe(9702);
  });

  it("reaches both horizontal edges of the 150% sheet from the same position", () => {
    const pane = 950;
    const padding = 34;
    const sheetWidth = 794;
    const maxScrollLeft = sheetScrollMax(padding + sheetWidth * 1.5, padding, pane);
    expect(maxScrollLeft).toBe(309);
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    // The left edge is visible at zero and the right edge at the maximum.
    expect(padding + sheetWidth * 1.5 - maxScrollLeft).toBeLessThanOrEqual(pane);
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

describe("scrollLeftForCaret", () => {
  // qa-331: zooming the probe document to 150% left a caret at x=1,038 in a
  // 965px pane while scrollLeft stayed 0, so the caret was off screen and the
  // right part of every line could not be typed into or seen.
  it("brings a caret that left the pane back to its inner edge", () => {
    expect(scrollLeftForCaret(1038, 965, 0, 294)).toBe(81);
    expect(scrollLeftForCaret(3, 965, 100, 294)).toBe(95);
  });

  it("clamps to the horizontal scroll range", () => {
    expect(scrollLeftForCaret(1300, 965, 294, 294)).toBe(294);
    expect(scrollLeftForCaret(0, 965, 4, 294)).toBe(0);
  });

  it("leaves a caret that is already inside the pane alone", () => {
    expect(scrollLeftForCaret(400, 965, 0, 294)).toBe(0);
    expect(scrollLeftForCaret(794, 950, 0, 0)).toBe(0);
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

describe("zoom on a fit-scaled page", () => {
  // qa-325: in an 820x640 window the 794px sheet is fitted to 684/794 before
  // the zoom is applied, so both factors shape the reserved size. Zooming out
  // at the end has to stop at the scaled sheet bottom, and at 150% the fitted
  // page is still wider than the pane, so both of its edges stay reachable.
  const pane = 804;
  const padding = 34;
  const viewportHeight = 467;
  const paddingTop = 30;
  const paddingBottom = 80;
  const fit = 684 / 794;
  const fittedHeight = 1123 * 11 * fit;
  const fittedWidth = 794 * fit;

  it("ends the zoomed-out range at the fit-scaled sheet bottom", () => {
    const maxAt100 = sheetScrollMax(paddingTop + fittedHeight, paddingBottom, viewportHeight);
    const maxAt70 = sheetScrollMax(
      paddingTop + fittedHeight * 0.7,
      paddingBottom,
      viewportHeight,
    );
    expect(maxAt100).toBeGreaterThan(maxAt70);

    const top = scrollTopForZoom(maxAt100, viewportHeight, paddingTop, 1, 0.7, maxAt70);
    expect(top).toBe(maxAt70);
    // The range ends at the fitted sheet, leaving only its own 1px rounding.
    const tail = paddingTop + fittedHeight * 0.7 + paddingBottom - top;
    expect(tail).toBeGreaterThanOrEqual(viewportHeight);
    expect(tail).toBeLessThan(viewportHeight + 1);
  });

  it("reaches both edges of the fit-scaled page at 150%", () => {
    const maxAt150 = sheetScrollMax(padding + fittedWidth * 1.5, padding, pane);
    const maxAt70 = sheetScrollMax(padding + fittedWidth * 0.7, padding, pane);
    expect(maxAt150).toBeGreaterThan(0);
    expect(maxAt70).toBe(0);

    // The left edge is visible at 0 and the right edge at the maximum.
    expect(padding + fittedWidth * 1.5 - maxAt150).toBeLessThanOrEqual(pane);
    expect(scrollLeftForZoom(0, 1, 1.5, maxAt150)).toBe(0);
    expect(scrollLeftForZoom(maxAt150, 1.5, 0.7, maxAt70)).toBe(0);
  });
});

describe("zoom keeps a page wider than the pane reachable at both edges", () => {
  // qa-324: the 150% sheet is 1,191px wide in a 950px pane with 34px of side
  // padding. Reserving the scaled width on the stage makes the range cover the
  // whole page (309px) instead of the 121px the centred, unscaled stage used to
  // leave, and zooming back out from the right edge returns the page to the
  // pane instead of stranding the reader sideways.
  const pane = 950;
  const padding = 34;
  const sheetAt150 = (794 * 150) / 100;

  it("reaches the right edge at 150% and returns to the pane at 70%", () => {
    const maxAt150 = sheetScrollMax(padding + sheetAt150, padding, pane);
    const maxAt70 = sheetScrollMax(padding + (794 * 70) / 100, padding, pane);
    expect(maxAt150).toBe(309);
    expect(maxAt150).toBeGreaterThan(121);
    expect(maxAt70).toBe(0);

    // The left edge is visible at 0 and the right edge at the maximum.
    expect(padding + sheetAt150 - maxAt150).toBeLessThanOrEqual(pane);

    expect(scrollLeftForZoom(maxAt150, 1.5, 0.7, maxAt70)).toBe(0);
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

  // qa-357: wheeling to the very bottom stops on the blank margin below the
  // last block, so the zoom correction had no anchor on screen and centred on
  // the blank tail, leaving the whole document above the viewport. Pinning the
  // last block brings its text back to the top of the viewport.
  it("pins a block the reader had scrolled past when asked to", () => {
    const target = scrollTopForZoomPoint(14000, 21200, 627, 30, 1.5, 0.7, 10489, 50, true);
    expect(target).toBeCloseTo(9830, 6);
    expect(30 + 14000 * 0.7 - target).toBeCloseTo(0, 6);
    expect(30 + (14000 + 50) * 0.7 - target).toBeLessThanOrEqual(627);
    // Without the pin the same point still falls back to the centre.
    expect(scrollTopForZoomPoint(14000, 21200, 627, 30, 1.5, 0.7, 10489, 50)).toBe(
      scrollTopForZoom(21200, 627, 30, 1.5, 0.7, 10489),
    );
  });

  it("pins an end block taller than the viewport to its top", () => {
    const target = scrollTopForZoomPoint(12000, 20000, 627, 30, 1.5, 0.7, 20000, 1200, true);
    expect(30 + 12000 * 0.7 - target).toBeCloseTo(0, 6);
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

  it("pulls a line that only straddles the viewport edge fully into view", () => {
    // At 100% the line top sits 630px down a 627px viewport, so its foot is cut
    // off. Zooming out has to hold that line instead of snapping to the centre,
    // and lift it just enough that its scaled box ends at the viewport bottom.
    const target = scrollTopForZoomPoint(14000, 13400, 627, 30, 1, 0.7, 9702, 16);
    const top = 30 + 14000 * 0.7 - target;
    expect(top).toBeCloseTo(627 - 16 * 0.7, 6);
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

describe("qa-329: the probe zoom sequence stays on the sheet", () => {
  // qa-329 repeated the qa-322..327 report: the workflow is the 3,600-word probe
  // document at 1280x800, where Ctrl+End sits at 13,558 and three zoom-out clicks
  // reach 70%. The fix has two halves, so both are pinned here: the stage has to
  // reserve the fit- and zoom-scaled sheet (otherwise the transform leaves the
  // range at the 100% layout), and every zoom step has to clamp to that range.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the sheet under the viewport from the end through zooming out and back in", () => {
    let zoom = 1;
    let top = 13558;
    for (const next of [0.9, 0.8, 0.7]) {
      top = scrollTopForZoomPoint(
        14029,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        16,
      );
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(0);
    }

    // Wheeling to the new maximum stops at the scaled sheet, so the only blank
    // space left past the last page is the scroller's own padding.
    top = maxAt(0.7);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - top).toBeCloseTo(viewportHeight, 0);

    // Zooming back in from that bottom keeps the viewport on the sheet at every
    // step instead of scrolling past the scaled end.
    for (const next of [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5]) {
      top = scrollTopForZoom(top, viewportHeight, paddingTop, zoom, next, maxAt(next));
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(0);
    }
    expect(paddingTop + sheetHeight * 1.5 - top).toBeGreaterThan(
      viewportHeight - paddingBottom,
    );
  });

  it("reserves the scaled sheet in the stage that defines the scroll range", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const stage = (/\.paper-stage\s*\{([^}]*)\}/.exec(css)?.[1] ?? "").replace(/\s+/g, " ");
    // The sheet is only transformed, which does not change layout, so both axes
    // of the stage have to include the fit and zoom factors.
    expect(stage).toContain("var(--paper-fit-scale, 1) * var(--editor-zoom, 1)");
    expect(stage).toContain(
      "height: calc( var(--paper-height, 1053px) * var(--sentence-page-count, 1) * var(--paper-fit-scale, 1) * var(--editor-zoom, 1) );",
    );
  });

  it("keeps the whole 150% page reachable sideways", () => {
    const pane = 950;
    const padding = 34;
    const widthAt = (zoom: number) => 794 * zoom;
    const maxLeftAt = (zoom: number) =>
      sheetScrollMax(padding + widthAt(zoom), padding, pane);
    expect(maxLeftAt(1)).toBe(0);
    expect(maxLeftAt(1.5)).toBe(309);
    // The left edge is visible at the start and the right edge at the maximum.
    expect(scrollLeftForZoom(0, 1, 1.5, maxLeftAt(1.5))).toBe(0);
    expect(padding + widthAt(1.5) - maxLeftAt(1.5)).toBeLessThanOrEqual(pane);
    expect(scrollLeftForZoom(maxLeftAt(1.5), 1.5, 0.7, maxLeftAt(0.7))).toBe(0);
  });
});

describe("qa-330: the zoomed-out end of a long document stays on the sheet", () => {
  // qa-330 repeated the same probe report at 1280x800: Ctrl+End sits at 13,558
  // of a 14,082 maximum, three zoom-out clicks reach 70%, and wheeling to the
  // new maximum has to stop at the scaled sheet rather than the 100% range.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the last line in the viewport through every zoom-out click", () => {
    let top = 13558;
    let zoom = 1;
    for (const percent of [90, 80, 70]) {
      const next = percent / 100;
      top = scrollTopForZoomPoint(
        14029,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        16,
      );
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      const lineTop = paddingTop + 14029 * zoom - top;
      expect(lineTop).toBeGreaterThanOrEqual(0);
      expect(lineTop + 16 * zoom).toBeLessThanOrEqual(viewportHeight);
    }
  });

  it("ends a wheel to the maximum at the sheet's scaled bottom", () => {
    const maxAt100 = maxAt(1);
    expect(maxAt100).toBe(14082);
    const top = scrollTopForZoom(maxAt100, viewportHeight, paddingTop, 1, 0.7, maxAt(0.7));
    expect(top).toBe(9702);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - top).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("reaches both edges of the 150% page from either scroll position", () => {
    const pane = 950;
    const padding = 34;
    const maxScrollLeft = sheetScrollMax(padding + (794 * 150) / 100, padding, pane);
    expect(maxScrollLeft).toBe(309);
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    expect(padding + (794 * 150) / 100 - maxScrollLeft).toBeLessThanOrEqual(pane);
  });
});

describe("qa-332: zooming out at the end holds the reading line and the sheet", () => {
  // The probe document at 1280x800 sits at 13,558 of a 14,082 maximum after
  // Ctrl+End. Each of the three zoom-out clicks has to hold the end line at the
  // same screen position (it was at y=501) while the sheet's scaled bottom stays
  // below the pane, so neither the document above the page nor blank scroll past
  // it can appear. Wheeling to the new maximum still ends at the page's bottom.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const lineHeight = 16;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("holds the end line on screen without lifting the page off the viewport", () => {
    let top = 13558;
    let zoom = 1;
    for (const percent of [90, 80, 70]) {
      const next = percent / 100;
      top = scrollTopForZoomPoint(
        endLine,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        lineHeight,
      );
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      // The same reading position: the end line keeps its pre-zoom screen top.
      expect(paddingTop + endLine * zoom - top).toBeCloseTo(501, 6);
      expect(paddingTop + (endLine + lineHeight) * zoom - top).toBeLessThanOrEqual(
        viewportHeight,
      );
      // Only the scroller's own bottom padding may sit below the scaled page.
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(
        viewportHeight - paddingBottom,
      );
    }

    // Wheeling to the 70% maximum leaves exactly the page plus its padding.
    expect(maxAt(0.7)).toBe(9702);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - maxAt(0.7)).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("keeps both horizontal edges reachable after following the caret in", () => {
    const pane = 950;
    const padding = 34;
    const maxScrollLeft = sheetScrollMax(padding + (794 * 150) / 100, padding, pane);
    // The caret correction can move the page sideways when zooming in; both
    // ends of the range still have to expose the page's edges.
    const caretOffset = scrollLeftForCaret(1038, pane, 0, maxScrollLeft);
    expect(caretOffset).toBeGreaterThan(0);
    expect(caretOffset).toBeLessThanOrEqual(maxScrollLeft);
    expect(padding + (794 * 150) / 100 - maxScrollLeft).toBeLessThanOrEqual(pane);
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
  });
});

describe("qa-333: a pane rescale keeps the reading position on the scaled sheet", () => {
  // Opening the inspector narrows the editor from a 950px pane to 608px and
  // scales the 13-page probe sheet to 0.615. The scroll range shrinks with that
  // scale, so the offset has to follow it: otherwise closing the panel leaves
  // the reader thousands of pixels above the page they were reading.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const inspectorFit = 488 / 794;
  const maxAt = (fit: number) =>
    sheetScrollMax(paddingTop + sheetHeight * fit, paddingBottom, viewportHeight);

  it("follows the sheet when a side panel narrows the pane", () => {
    const top = scrollTopForFit(13558, paddingTop, 1, inspectorFit, maxAt(inspectorFit));
    expect(top).toBeLessThanOrEqual(maxAt(inspectorFit));
    // The end line keeps its place on the page instead of leaving the viewport.
    const lineTop = paddingTop + endLine * inspectorFit - top;
    expect(lineTop).toBeGreaterThanOrEqual(0);
    expect(lineTop + 16).toBeLessThanOrEqual(viewportHeight);
  });

  it("holds the end of the page when the panel closes again", () => {
    const top = scrollTopForFit(
      maxAt(inspectorFit),
      paddingTop,
      inspectorFit,
      1,
      maxAt(1),
    );
    expect(top).toBeLessThanOrEqual(maxAt(1));
    const lineTop = paddingTop + endLine - top;
    expect(lineTop).toBeGreaterThanOrEqual(0);
    expect(lineTop + 16).toBeLessThanOrEqual(viewportHeight);
  });

  it("keeps a reader at the top of the sheet at the top", () => {
    expect(scrollTopForFit(0, paddingTop, 1, 0.6, maxAt(0.6))).toBeLessThan(paddingTop);
    expect(scrollTopForFit(0, paddingTop, 0.6, 1, maxAt(1))).toBe(0);
    expect(scrollTopForFit(0, paddingTop, 1, 1.5, maxAt(1.5))).toBe(0);
  });
});

describe("qa-334: the whole probe zoom trace stays on the sheet", () => {
  // The 3,600-word probe document at 1280x800 is 13 A4 pages with a 627px
  // editor viewport. Its finding walks the complete sequence: Ctrl+End at
  // 13,558 of a 14,082 maximum, three zoom-out clicks to 70%, a wheel to the new
  // maximum and then a zoom in to 150% (where the page is wider than the pane).
  // The three clicks, the wheeled end and the zoomed-in page all have to keep
  // the sheet under the viewport, the end line readable and both horizontal
  // edges reachable.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const lineHeight = 16;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);
  const endLineBottom = (zoom: number, top: number) =>
    paddingTop + (endLine + lineHeight) * zoom - top;

  it("ends the wheeled range at the scaled page after the zoom-out clicks", () => {
    let top = 13558;
    let zoom = 1;
    for (const percent of [90, 80, 70]) {
      const next = percent / 100;
      top = scrollTopForZoomPoint(
        endLine,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        lineHeight,
      );
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      // The sheet stays under the viewport through every click.
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(
        viewportHeight - paddingBottom,
      );
      expect(endLineBottom(zoom, top)).toBeLessThanOrEqual(viewportHeight);
    }

    // Wheeling to the maximum stops at the scaled page: the end line remains
    // readable and only the scroller's own padding sits below the sheet.
    top = maxAt(0.7);
    expect(top).toBe(9702);
    expect(paddingTop + endLine * 0.7 - top).toBeGreaterThanOrEqual(0);
    expect(endLineBottom(0.7, top)).toBeLessThanOrEqual(viewportHeight);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - top).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("zooms back in from the wheeled end without leaving the sheet", () => {
    const wheeled = maxAt(0.7);
    const lineTop = paddingTop + endLine * 0.7 - wheeled;
    const top = scrollTopForZoomPoint(
      endLine,
      wheeled,
      viewportHeight,
      paddingTop,
      0.7,
      1.5,
      maxAt(1.5),
      lineHeight,
    );
    expect(top).toBeLessThanOrEqual(maxAt(1.5));
    // The end line keeps its screen position and the page still fills the pane.
    expect(paddingTop + endLine * 1.5 - top).toBeCloseTo(lineTop, 6);
    expect(endLineBottom(1.5, top)).toBeLessThanOrEqual(viewportHeight);
    expect(paddingTop + sheetHeight * 1.5 - top).toBeGreaterThan(
      viewportHeight - paddingBottom,
    );
  });

  it("keeps both edges of the 150% page reachable from either end", () => {
    const pane = 950;
    const padding = 34;
    const width = 794 * 1.5;
    const maxScrollLeft = sheetScrollMax(padding + width, padding, pane);
    expect(maxScrollLeft).toBe(309);
    // The left edge is on screen at the start and the right edge at the end.
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    expect(padding + width - maxScrollLeft).toBeLessThanOrEqual(pane);
    // Zooming back out puts a page that fits the pane back at its left edge.
    expect(
      scrollLeftForZoom(
        maxScrollLeft,
        1.5,
        0.7,
        sheetScrollMax(padding + 794 * 0.7, padding, pane),
      ),
    ).toBe(0);
  });

  it("measures the horizontal range against the scrollport, gutter included", () => {
    const pane = 950;
    const gutter = 15;
    const padding = 34;
    const width = 794 * 1.5;
    // `scrollbar-gutter: stable` takes the last gutter-width out of clientWidth
    // and out of the browser's horizontal maximum, so a clientWidth range would
    // promise 15px the browser refuses to scroll. The page's right edge still
    // has to fit inside the pane at the offset that is really reachable.
    const viewport = scrollportWidth(pane, pane + gutter);
    expect(viewport).toBe(965);
    const maxScrollLeft = sheetScrollMax(padding + width, padding, viewport);
    expect(maxScrollLeft).toBe(294);
    expect(maxScrollLeft).toBeLessThan(309);
    expect(padding + width - maxScrollLeft).toBeLessThanOrEqual(pane);
    // Without a reserved gutter both widths agree and nothing changes.
    expect(scrollportWidth(pane, pane)).toBe(pane);
  });

  it("reserves the scaled sheet without letting the backdrop widen the range", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const stage = (/\.paper-stage\s*\{([^}]*)\}/.exec(css)?.[1] ?? "").replace(/\s+/g, " ");
    const stack = (/\.paper-stack\s*\{([^}]*)\}/.exec(css)?.[1] ?? "").replace(/\s+/g, " ");
    // The stage is the scroll geometry, so it has to reserve the sheet at both
    // scales, and the absolute backdrop only applies the zoom on top of the
    // fitted width. A backdrop that scaled the fit a second time would stick
    // out past the page and inflate the horizontal range again.
    expect(stage).toContain(
      "width: max( 100%, calc(var(--paper-width, 794px) * var(--paper-fit-scale, 1) * var(--editor-zoom, 1)) );",
    );
    expect(stack).toContain(
      "width: calc(var(--paper-width, 794px) * var(--paper-fit-scale, 1));",
    );
    expect(stack).toContain("transform: translateX(-50%) scale(var(--editor-zoom));");
  });
});

describe("qa-335: switching zoom at the wheeled end stays on the sheet", () => {
  // The probe continues past qa-334: after wheeling to the 70% maximum it zooms
  // to 150%, wheels to that maximum and zooms back out to 70%. Every step has
  // to keep the scaled page inside the scroll range, and the 150% page must be
  // reachable from both of its horizontal edges.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const lineHeight = 16;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the page under the viewport through the wheel and zoom-out", () => {
    const wheeled70 = maxAt(0.7);
    const at150 = scrollTopForZoomPoint(
      endLine,
      wheeled70,
      viewportHeight,
      paddingTop,
      0.7,
      1.5,
      maxAt(1.5),
      lineHeight,
    );
    expect(at150).toBeLessThanOrEqual(maxAt(1.5));
    expect(paddingTop + sheetHeight * 1.5 - at150).toBeGreaterThan(
      viewportHeight - paddingBottom,
    );

    // Wheeled to the 150% maximum only the scroller padding sits below the page.
    const wheeled150 = maxAt(1.5);
    const below150 = paddingTop + sheetHeight * 1.5 + paddingBottom - wheeled150;
    expect(below150).toBeGreaterThanOrEqual(viewportHeight);
    expect(below150).toBeLessThan(viewportHeight + 1);

    // The end line is above the viewport there, so the fallback anchors on the
    // centre and the 70% maximum still ends exactly at the scaled page.
    const back70 = scrollTopForZoom(
      wheeled150,
      viewportHeight,
      paddingTop,
      1.5,
      0.7,
      maxAt(0.7),
    );
    expect(back70).toBe(wheeled70);
    const below70 = paddingTop + sheetHeight * 0.7 + paddingBottom - back70;
    expect(below70).toBeGreaterThanOrEqual(viewportHeight);
    expect(below70).toBeLessThan(viewportHeight + 1);
  });

  it("reaches both horizontal edges of the 150% page", () => {
    const pane = 950;
    const padding = 34;
    const width = 794 * 1.5;
    const maxScrollLeft = sheetScrollMax(padding + width, padding, pane);
    expect(maxScrollLeft).toBeGreaterThan(0);
    // At the left end the page's left edge has its gutter on screen, and at the
    // right end the whole page fits up to the right gutter.
    expect(padding).toBeLessThan(pane);
    const rightEdgeAtEnd = padding + width - maxScrollLeft;
    expect(rightEdgeAtEnd).toBeGreaterThan(0);
    expect(rightEdgeAtEnd).toBeLessThanOrEqual(pane);
    expect(scrollLeftForZoom(maxScrollLeft, 1.5, 0.7, 0)).toBe(0);
  });
});

describe("qa-336: the probe's zoom stage keeps the scaled sheet in range", () => {
  // qa-336 repeated the long-document report at 1280x800: Ctrl+End lands at
  // 13,558 of a 14,082 maximum, three zoom-out clicks reach 70% and keep the
  // end line readable, a wheel to the 70% maximum stops at the scaled page, and
  // the 150% sheet -- where the caret correction scrolls 92px sideways -- has
  // both edges reachable before zooming back to 100%.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const lineHeight = 16;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("holds the sheet under the viewport from the end through the wheel", () => {
    let top = 13558;
    let zoom = 1;
    for (const percent of [90, 80, 70]) {
      const next = percent / 100;
      top = scrollTopForZoomPoint(
        endLine,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        lineHeight,
      );
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      // The scaled bottom never rises above the pane, so no part of the sheet
      // can be left entirely above the visible area after a zoom-out click.
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(
        viewportHeight - paddingBottom,
      );
      expect(paddingTop + (endLine + lineHeight) * zoom - top).toBeLessThanOrEqual(
        viewportHeight,
      );
    }

    // Wheeling to the 70% maximum ends the range at the scaled page: only the
    // scroller's own bottom padding is left below the last line.
    top = maxAt(0.7);
    const below = paddingTop + sheetHeight * 0.7 + paddingBottom - top;
    expect(below).toBeGreaterThanOrEqual(viewportHeight);
    expect(below).toBeLessThan(viewportHeight + 1);
  });

  it("keeps both horizontal edges reachable around the caret correction", () => {
    const pane = 950;
    const padding = 34;
    const width = 794 * 1.5;
    const maxScrollLeft = sheetScrollMax(padding + width, padding, pane);
    // The caret near the right margin pulls the 150% page 92px to the left, but
    // the pane still has enough range to bring the left edge back into view.
    const caretOffset = scrollLeftForCaret(1038, pane, 0, maxScrollLeft);
    expect(caretOffset).toBeGreaterThan(0);
    expect(caretOffset).toBeLessThanOrEqual(maxScrollLeft);
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    expect(padding + width - maxScrollLeft).toBeLessThanOrEqual(pane);
    // Zooming back out to a page that fits the pane returns it to the left edge.
    expect(
      scrollLeftForZoom(caretOffset, 1.5, 1, sheetScrollMax(padding + 794, padding, pane)),
    ).toBe(0);
  });
});

describe("qa-348: zooming to the end with focus outside the page keeps the text in view", () => {
  // Focus in the Split source pane leaves the visual page without a caret in
  // the document. At the wheeled end the blank tail of the last page fills the
  // lower viewport, so centre anchoring scales the last block off the top while
  // the blank tail stays below: the reader zooms and sees no text at all. The
  // last block is the reading position in that case, so it becomes the anchor.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endBlock = { top: 14030, height: 126 };
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("anchors on the last block when the caret is outside the viewport", () => {
    const caret = { top: 5000, height: 25 };
    expect(zoomAnchor(caret, endBlock, maxAt(1), viewportHeight, paddingTop, 1)).toBe(endBlock);
  });

  it("keeps the last block on screen when zooming in from the wheeled end", () => {
    const anchor = zoomAnchor(null, endBlock, maxAt(1), viewportHeight, paddingTop, 1);
    expect(anchor).not.toBeNull();
    const top = scrollTopForZoomPoint(
      anchor!.top,
      maxAt(1),
      viewportHeight,
      paddingTop,
      1,
      1.5,
      maxAt(1.5),
      anchor!.height,
    );
    const blockTop = paddingTop + endBlock.top * 1.5 - top;
    const blockBottom = blockTop + endBlock.height * 1.5;
    expect(blockTop).toBeGreaterThanOrEqual(0);
    expect(blockBottom).toBeLessThanOrEqual(viewportHeight);
    // Centre anchoring (the fallback when there is no usable anchor) would have
    // left the block above the viewport at 150%.
    const centred = scrollTopForZoom(maxAt(1), viewportHeight, paddingTop, 1, 1.5, maxAt(1.5));
    expect(paddingTop + endBlock.top * 1.5 - centred).toBeLessThan(0);
  });

  it("still prefers a caret that is on screen", () => {
    const caret = { top: 14029, height: 25 };
    expect(zoomAnchor(caret, endBlock, maxAt(1), viewportHeight, paddingTop, 1)).toBe(caret);
  });

  it("falls back to centre anchoring when neither point is on screen", () => {
    const caret = { top: 5000, height: 25 };
    const farEnd = { top: 13000, height: 126 };
    const anchor = zoomAnchor(caret, farEnd, maxAt(1), viewportHeight, paddingTop, 1);
    expect(anchor).toBe(caret);
    expect(
      scrollTopForZoomPoint(
        anchor!.top,
        maxAt(1),
        viewportHeight,
        paddingTop,
        1,
        0.7,
        maxAt(0.7),
        anchor!.height,
      ),
    ).toBe(scrollTopForZoom(maxAt(1), viewportHeight, paddingTop, 1, 0.7, maxAt(0.7)));
  });
});

describe("qa-349: zooming in at the start with focus outside the page keeps the top in view", () => {
  // Focus in the Split source pane leaves the visual page without a caret in
  // the document. At the top of a long document the last block is far below the
  // viewport, so centre anchoring makes a zoom-in scroll the page top under the
  // toolbar (at 70% to 150% the sheet starts 298px above the viewport). The top
  // edge of the sheet is the reading position in that case, so it becomes the
  // anchor and the zoom grows the page downwards from there.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const pageStart = { top: 0, height: 1 };
  const endBlock = { top: 14030, height: 126 };
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("anchors on the sheet top when the viewport is at the start", () => {
    expect(
      zoomAnchor(null, endBlock, 0, viewportHeight, paddingTop, 0.7, pageStart),
    ).toBe(pageStart);
    // A caret in the page still wins, and a short document keeps its top when
    // both the top edge and the last block are on screen.
    const caret = { top: 150, height: 16 };
    expect(
      zoomAnchor(caret, endBlock, 0, viewportHeight, paddingTop, 0.7, pageStart),
    ).toBe(caret);
    const shortStart = { top: 800, height: 126 };
    expect(
      zoomAnchor(null, shortStart, 0, viewportHeight, paddingTop, 0.7, pageStart),
    ).toBe(pageStart);
  });

  it("keeps the top of the sheet fixed when zooming in from the start", () => {
    const anchor = zoomAnchor(null, endBlock, 0, viewportHeight, paddingTop, 0.7, pageStart);
    expect(anchor).toBe(pageStart);
    const top = scrollTopForZoomPoint(
      anchor!.top,
      0,
      viewportHeight,
      paddingTop,
      0.7,
      1.5,
      maxAt(1.5),
      anchor!.height,
    );
    expect(top).toBe(0);
    expect(paddingTop + 0 * 1.5 - top).toBe(paddingTop);
    // Centre anchoring from the same top scrolls the sheet 298px above the
    // viewport, which is what hid the first page.
    const centred = scrollTopForZoom(0, viewportHeight, paddingTop, 0.7, 1.5, maxAt(1.5));
    expect(paddingTop - centred).toBeLessThan(0);
  });

  it("still falls back to centre anchoring away from the start and end", () => {
    const midScroll = 5000;
    const caret = { top: 5000, height: 16 };
    expect(
      zoomAnchor(caret, endBlock, midScroll, viewportHeight, paddingTop, 1, pageStart),
    ).toBe(caret);
    expect(
      zoomAnchor(null, endBlock, midScroll, viewportHeight, paddingTop, 1, pageStart),
    ).toBeNull();
  });
});

describe("qa-375: a fit-scaled sheet stays whole through a zoom", () => {
  // At 1024x768 the pane is 728px wide, so the 794px sheet is fitted to 0.766.
  // The reported failure combined that fit scale with the zoom: the range kept
  // the 100% layout while the transform scaled the sheet, leaving blank scroll
  // below the page and, at 150%, a page wider than the pane with no travel to
  // its left edge.
  const fit = 608 / 794;
  const pane = 728;
  const gutter = 15;
  const padding = 34;
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetWidth = 794;
  const sheetHeight = 1123 * 13;
  const maxTopAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * fit * zoom, paddingBottom, viewportHeight);
  const maxLeftAt = (zoom: number) =>
    sheetScrollMax(
      padding + sheetWidth * fit * zoom,
      padding,
      scrollportWidth(pane, pane + gutter),
    );

  it("stops every zoom-out at the fitted sheet bottom", () => {
    let top = maxTopAt(1);
    let zoom = 1;
    for (const next of [0.9, 0.8, 0.7]) {
      top = scrollTopForZoom(top, viewportHeight, paddingTop, zoom, next, maxTopAt(next));
      zoom = next;
      // Only the scroller's own bottom padding sits below the fitted sheet.
      expect(paddingTop + sheetHeight * fit * zoom - top).toBeGreaterThan(
        viewportHeight - paddingBottom,
      );
      expect(top).toBeLessThanOrEqual(maxTopAt(zoom));
    }
    expect(top).toBe(maxTopAt(0.7));
    expect(paddingTop + sheetHeight * fit * 0.7 + paddingBottom - top).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("keeps both edges of the wider 150% page reachable", () => {
    const maxLeft = maxLeftAt(1.5);
    expect(maxLeft).toBeGreaterThan(0);
    // At the left end the fitted page starts inside the pane's padding, and at
    // the right end its edge is inside the scrollport (gutter included).
    expect(scrollLeftForZoom(0, 1, 1.5, maxLeft)).toBe(0);
    expect(padding + sheetWidth * fit * 1.5 - maxLeft).toBeLessThanOrEqual(pane);
    // Following the caret sideways must not consume the range needed to bring
    // the opposite edge back into view.
    const caretOffset = scrollLeftForCaret(pane - 4, pane, 0, maxLeft);
    expect(caretOffset).toBeGreaterThan(0);
    expect(caretOffset).toBeLessThan(maxLeft);
    expect(scrollLeftForZoom(caretOffset, 1.5, 1, maxLeftAt(1))).toBe(0);
  });
});

describe("qa-377: the end of a 13-page sheet stays reachable through the zoom", () => {
  // The long-document probe at 1280x800: 13 pages (a 14,599px sheet), Ctrl+End
  // stops at 13,558 of the 14,082 range, and three zoom-out clicks reach 70%.
  // The scroll range then has to end at the scaled sheet, the last line has to
  // stay on screen, and at 150% the gutter-aware range has to expose both edges
  // of the sheet that is wider than the 950px pane.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const lineHeight = 16;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the sheet and its last line in the viewport across the clicks", () => {
    let top = 13558;
    let zoom = 1;
    for (const percent of [90, 80, 70]) {
      const next = percent / 100;
      top = scrollTopForZoomPoint(
        endLine,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        lineHeight,
      );
      zoom = next;
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      const lineTop = paddingTop + endLine * zoom - top;
      expect(lineTop).toBeGreaterThanOrEqual(0);
      expect(lineTop + lineHeight * zoom).toBeLessThanOrEqual(viewportHeight);
      // No part of the sheet can be left entirely above the visible area.
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(
        viewportHeight - paddingBottom,
      );
    }
    // Wheeling to the 70% maximum stops at the scaled sheet bottom, so only the
    // scroller's own bottom padding sits below the page.
    expect(maxAt(0.7)).toBe(9702);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - maxAt(0.7)).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("reaches both edges of the 150% sheet in the reserved-gutter pane", () => {
    const pane = 950;
    const gutter = 15;
    const padding = 34;
    const sheetWidth = (794 * 150) / 100;
    const scrollport = scrollportWidth(pane, pane + gutter);
    const maxScrollLeft = sheetScrollMax(padding + sheetWidth, padding, scrollport);
    expect(scrollport).toBe(965);
    // The range is measured against the scrollport, not the narrower client
    // width, so the last 15px the browser accepts are reachable.
    expect(maxScrollLeft).toBe(294);
    // The left edge is visible at the start and the right edge at the maximum.
    expect(scrollLeftForZoom(0, 1, 1.5, maxScrollLeft)).toBe(0);
    expect(padding + sheetWidth - maxScrollLeft).toBeLessThanOrEqual(pane);
    expect(scrollLeftForZoom(maxScrollLeft, 1.5, 1, 0)).toBe(0);
  });
});

describe("qa-392: the probe's zoom-out-at-the-end trace ends at the scaled sheet", () => {
  // The long-document probe at 1280x800: a 13-page (14,599px) sheet, Ctrl+End
  // at 13,558 of the 14,082 range, three zoom-out clicks to 70%, then a wheel to
  // the maximum. Scaling the sheet with a transform used to leave the scroll
  // geometry at 100%, so the clicks kept 13,558 and the sheet moved 3,309px
  // above the viewport; the same layout gave the 150% page only 121px of
  // horizontal range, less than the 241px it overflows the pane by.
  const viewportHeight = 627;
  const paddingTop = 30;
  const paddingBottom = 80;
  const sheetHeight = 1123 * 13;
  const endLine = 14029;
  const lineHeight = 16;
  const maxAt = (zoom: number) =>
    sheetScrollMax(paddingTop + sheetHeight * zoom, paddingBottom, viewportHeight);

  it("keeps the reading line and the page in view on every click", () => {
    let top = 13558;
    let zoom = 1;
    for (const percent of [90, 80, 70]) {
      const next = percent / 100;
      top = scrollTopForZoomPoint(
        endLine,
        top,
        viewportHeight,
        paddingTop,
        zoom,
        next,
        maxAt(next),
        lineHeight,
      );
      zoom = next;
      // The offset follows the scaled range instead of staying at 100%.
      expect(top).toBeLessThanOrEqual(maxAt(zoom));
      // The last line the reader was on stays on screen.
      const lineBottom = paddingTop + (endLine + lineHeight) * zoom - top;
      expect(lineBottom).toBeGreaterThan(lineHeight * zoom);
      expect(lineBottom).toBeLessThanOrEqual(viewportHeight);
      // The page still reaches below the visible area, never above it.
      expect(paddingTop + sheetHeight * zoom - top).toBeGreaterThan(
        viewportHeight - paddingBottom,
      );
    }
    // Wheeling to the 70% maximum stops at the scaled sheet bottom, so only the
    // scroller's own padding is left below the last page.
    expect(maxAt(0.7)).toBe(9702);
    expect(paddingTop + sheetHeight * 0.7 + paddingBottom - maxAt(0.7)).toBeCloseTo(
      viewportHeight,
      0,
    );
  });

  it("reaches both edges of the 150% page in the 950px pane", () => {
    const pane = 950;
    const gutter = 15;
    const padding = 34;
    const sheetWidth = (794 * 150) / 100;
    const maxScrollLeft = sheetScrollMax(
      padding + sheetWidth,
      padding,
      scrollportWidth(pane, pane + gutter),
    );
    // The range now covers the pane's overflow instead of stopping 120px short.
    expect(maxScrollLeft).toBe(294);
    expect(maxScrollLeft).toBeGreaterThan(sheetWidth - pane);
    // The left edge is inside the pane at zero and the right edge at the maximum.
    expect(padding + sheetWidth - maxScrollLeft).toBeLessThanOrEqual(pane);
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
