import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { documentToLatex } from "./latex";
import {
  DOCUMENT_THEMES,
  THEME_SETTING_KEYS,
  activeDocumentTheme,
} from "./themes";

describe("document themes", () => {
  it("sets every layout field in each preset", () => {
    expect(DOCUMENT_THEMES.length).toBeGreaterThan(1);
    for (const theme of DOCUMENT_THEMES) {
      expect(Object.keys(theme.settings).sort()).toEqual([...THEME_SETTING_KEYS].sort());
    }
  });

  it("detects the active theme from settings values alone", () => {
    expect(activeDocumentTheme(DEFAULT_SETTINGS)?.id).toBe("classic");
    for (const theme of DOCUMENT_THEMES) {
      expect(activeDocumentTheme({ ...DEFAULT_SETTINGS, ...theme.settings })?.id).toBe(theme.id);
    }
    expect(activeDocumentTheme({ ...DEFAULT_SETTINGS, fontFamily: "times" })).toBeNull();
  });

  it("changes the LaTeX preamble when a theme is applied", () => {
    const preamble = (id: string) => {
      const theme = DOCUMENT_THEMES.find((item) => item.id === id);
      if (!theme) throw new Error(`missing theme ${id}`);
      return documentToLatex(
        { type: "doc", content: [] },
        { ...DEFAULT_SETTINGS, ...theme.settings },
      );
    };
    expect(preamble("classic")).toContain("\\documentclass[11pt,a4paper]{article}");
    expect(preamble("modern")).toMatch(/\\setmainfont\[[^\]]*\]\{texgyrepagella\}/);
    expect(preamble("modern")).toContain("\\onehalfspacing");
    expect(preamble("compact")).toContain("margin=0.75in");
  });
});
