import { describe, expect, it } from "vitest";
import { latexHasError } from "./KatexMath";

describe("latexHasError", () => {
  it("flags commands KaTeX renders in its error colour", () => {
    expect(latexHasError("\\badcommand{x}", false)).toBe(true);
    expect(latexHasError("\\unknown{}", false)).toBe(true);
  });

  it("still flags malformed input", () => {
    expect(latexHasError("\\frac{", false)).toBe(true);
    expect(latexHasError("x^{", true)).toBe(true);
  });

  it("flags a blank line, which ends the paragraph before the formula closes", () => {
    expect(latexHasError("a\n\nb", false)).toBe(true);
    expect(latexHasError("a\r\n  \r\nb", true)).toBe(true);
    expect(latexHasError("a\nb", false)).toBe(false);
  });

  it("accepts valid LaTeX", () => {
    expect(latexHasError("\\frac{a}{b}", false)).toBe(false);
    expect(latexHasError("\\color{#cc0000}x", false)).toBe(false);
    expect(latexHasError("", false)).toBe(false);
  });
});
