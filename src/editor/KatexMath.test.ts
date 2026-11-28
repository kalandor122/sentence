import { describe, expect, it } from "vitest";
import { latexHasBlankLine, latexHasError, latexHasUnclosedComment, renderLatex } from "./KatexMath";

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

  it("reports a blank line separately from other parse errors", () => {
    expect(latexHasBlankLine("a\n\nb")).toBe(true);
    expect(latexHasBlankLine("a\r\n  \r\nb", "align")).toBe(true);
    expect(latexHasBlankLine("a\nb")).toBe(false);
    expect(latexHasBlankLine("\\frac{")).toBe(false);
  });

  it("flags an unescaped percent that would comment out the closing delimiter", () => {
    expect(latexHasError("100%", false)).toBe(true);
    expect(latexHasError("100\\%", false)).toBe(false);
    expect(latexHasError("a % note\nb", false)).toBe(false);
    expect(latexHasError("a\n% note", false)).toBe(true);
    expect(latexHasUnclosedComment("100%")).toBe(true);
    expect(latexHasUnclosedComment("%")).toBe(true);
    expect(latexHasUnclosedComment("100\\%")).toBe(false);
    expect(latexHasUnclosedComment("a % note\nb")).toBe(false);
  });

  it("accepts valid LaTeX", () => {
    expect(latexHasError("\\frac{a}{b}", false)).toBe(false);
    expect(latexHasError("\\color{#cc0000}x", false)).toBe(false);
    expect(latexHasError("", false)).toBe(false);
  });

  it("ignores a \\label, which is a cross-reference target rather than math", () => {
    const labelled = "\\label{eq:energy}\nE=mc^2";
    expect(latexHasError(labelled, true)).toBe(false);
    expect(renderLatex(labelled, true)).not.toContain("katex-error");
    expect(renderLatex(labelled, true)).not.toContain("eq:energy");
  });
});
