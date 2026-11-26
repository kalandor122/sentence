import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import {
  pageBoundaryWithin,
  pageBreakFill,
  pageCountFromBottom,
  pageGeometry,
  pageLineGaps,
  pageRowShifts,
  scrollTopForZoom,
  scrollTopForZoomPoint,
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
