// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { tocEntries, tocTitle, setTocTitle } from "./TocBlock";
import { HeadingLabel, TableOfContents } from "./extensions";

describe("tocEntries", () => {
  it("uses an optional short title the way the PDF contents does", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel],
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, shortTitle: "Short Intro" },
            content: [{ type: "text", text: "A Very Long Section Title That Will Not Fit" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Plain Subsection" }],
          },
        ],
      },
    });
    expect(tocEntries(editor).map((entry) => entry.text)).toEqual([
      "Short Intro",
      "Plain Subsection",
    ]);
    editor.destroy();
  });

  it("omits a starred heading and does not step the section counter", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
          {
            type: "heading",
            attrs: { level: 1, unnumbered: true },
            content: [{ type: "text", text: "Unnumbered Appendix" }],
          },
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "After The Appendix" }],
          },
        ],
      },
    });
    expect(tocEntries(editor)).toEqual([
      { level: 1, number: "1", text: "Introduction" },
      { level: 1, number: "2", text: "After The Appendix" },
    ]);
    editor.destroy();
  });

  it("omits a first heading that repeats the document title", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Drafting with constraints" }],
          },
        ],
      },
    });
    // The exporter turns the repeated title into \maketitle, so the body starts
    // with the subsection: the preview shows only that, numbered the way the
    // PDF numbers it.
    expect(tocEntries(editor, "Introduction")).toEqual([
      { level: 2, number: "0.1", text: "Drafting with constraints" },
    ]);
    expect(tocEntries(editor, "Another paper").map((entry) => entry.text)).toEqual([
      "Introduction",
      "Drafting with constraints",
    ]);
    editor.destroy();
  });

  it("carries the document title in the table of contents storage", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel, TableOfContents],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
        ],
      },
    });
    expect(tocTitle(editor)).toBe("");
    setTocTitle(editor, "Introduction");
    expect(tocTitle(editor)).toBe("Introduction");
    expect(tocEntries(editor, tocTitle(editor))).toEqual([]);
    editor.destroy();
  });
});
