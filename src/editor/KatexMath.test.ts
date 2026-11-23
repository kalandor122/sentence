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

  it("accepts valid LaTeX", () => {
    expect(latexHasError("\\frac{a}{b}", false)).toBe(false);
    expect(latexHasError("\\color{#cc0000}x", false)).toBe(false);
    expect(latexHasError("", false)).toBe(false);
  });
});
