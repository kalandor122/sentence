import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { pageBreakFill, pageCountFromBottom, pageGeometry } from "./pagination";

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

describe("pageBreakFill", () => {
  it("starts the following block at the next page's top margin", () => {
    const geometry = pageGeometry(DEFAULT_SETTINGS);
    const top = geometry.margin + 200;
    const height = 148;
    const fill = pageBreakFill(top, height, geometry);
    expect(top + fill + height).toBe(geometry.height + geometry.margin);
  });
});
