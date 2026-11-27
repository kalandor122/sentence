// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { tocEntries, tocTitle, setTocTitle, setGeneratedToc, setTocDocumentClass } from "./TocBlock";
import { HeadingLabel, MathInline, TableOfContents } from "./extensions";

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

  it("keeps inline math in a heading, the way the PDF contents prints it", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel, MathInline],
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              { type: "text", text: "The " },
              { type: "mathInline", attrs: { latex: "x^2" } },
              { type: "text", text: " model" },
            ],
          },
        ],
      },
    });
    expect(tocEntries(editor)).toEqual([{ level: 2, number: "0.1", text: "The x^2 model" }]);
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

  it("numbers report sections under the chapter counter, the way the PDF contents prints them", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel, TableOfContents],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Drafting with constraints" }],
          },
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Details" }] },
        ],
      },
    });
    setTocDocumentClass(editor, "report");
    expect(tocEntries(editor)).toEqual([
      { level: 1, number: "0.1", text: "Introduction" },
      { level: 2, number: "0.1.1", text: "Drafting with constraints" },
      { level: 3, number: "0.1.1.1", text: "Details" },
    ]);
    setTocDocumentClass(editor, "article");
    expect(tocEntries(editor).map((entry) => entry.number)).toEqual(["1", "1.1", "1.1.1"]);
    editor.destroy();
  });

  it("opens a placed contents on a new page where the class does", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel, TableOfContents],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
          { type: "toc" },
        ],
      },
    });
    expect(editor.view.dom.querySelectorAll(".generated-toc-break")).toHaveLength(0);
    setTocDocumentClass(editor, "report");
    // \tableofcontents in report and book uses \chapter*, which starts a page.
    expect(editor.view.dom.querySelectorAll(".generated-toc-break")).toHaveLength(1);
    setTocDocumentClass(editor, "article");
    expect(editor.view.dom.querySelectorAll(".generated-toc-break")).toHaveLength(0);
    editor.destroy();
  });

  it("draws the generated contents without adding a document node", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel, TableOfContents],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
          { type: "paragraph", content: [{ type: "text", text: "Body." }] },
        ],
      },
    });
    expect(editor.view.dom.querySelector("[data-toc]")).toBeNull();
    setGeneratedToc(editor, true);
    const generated = editor.view.dom.querySelector("[data-toc]");
    expect(generated).not.toBeNull();
    expect(generated?.textContent).toContain("1Introduction");
    // A decoration represents the contents page; the document itself still
    // exports exactly the nodes the user placed.
    expect(editor.getJSON().content?.some((node) => node.type === "toc")).not.toBe(true);
    setGeneratedToc(editor, false);
    expect(editor.view.dom.querySelector("[data-toc]")).toBeNull();
    editor.destroy();
  });

  it("puts the generated contents after a heading that repeats the title", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel, TableOfContents],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
          { type: "paragraph", content: [{ type: "text", text: "Body." }] },
        ],
      },
    });
    setTocTitle(editor, "Introduction");
    setGeneratedToc(editor, true);
    const generated = editor.view.dom.querySelector("[data-toc]");
    expect(generated?.previousElementSibling?.tagName).toBe("H1");
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
