// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { tocEntries } from "./TocBlock";
import { HeadingLabel } from "./extensions";

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
});
