// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CommentMark, HeadingLabel, MathBlock } from "./extensions";

describe("HeadingLabel", () => {
  it("keeps a starred heading unnumbered through the editor", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel],
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, unnumbered: true },
            content: [{ type: "text", text: "ZXSTAR SECTION" }],
          },
          { type: "paragraph", content: [{ type: "text", text: "ZXSTAR BODY" }] },
        ],
      },
    });
    const heading = editor.getJSON().content?.[0];
    expect(heading?.attrs?.unnumbered).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain("data-unnumbered");

    const reloaded = new Editor({ extensions: [StarterKit, HeadingLabel], content: html });
    expect(reloaded.getJSON().content?.[0]?.attrs?.unnumbered).toBe(true);
    editor.destroy();
    reloaded.destroy();
  });

  it("keeps a heading short title through the editor", () => {
    const editor = new Editor({
      extensions: [StarterKit, HeadingLabel],
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, shortTitle: "ZXSHORT" },
            content: [{ type: "text", text: "ZXOPT FULL TITLE" }],
          },
        ],
      },
    });
    expect(editor.getJSON().content?.[0]?.attrs?.shortTitle).toBe("ZXSHORT");
    const html = editor.getHTML();
    expect(html).toContain('data-short-title="ZXSHORT"');

    const reloaded = new Editor({ extensions: [StarterKit, HeadingLabel], content: html });
    expect(reloaded.getJSON().content?.[0]?.attrs?.shortTitle).toBe("ZXSHORT");
    editor.destroy();
    reloaded.destroy();
  });
});

describe("MathBlock", () => {
  it("keeps an align environment through the editor", () => {
    const editor = new Editor({
      extensions: [StarterKit, MathBlock],
      content: {
        type: "doc",
        content: [
          {
            type: "mathBlock",
            attrs: { latex: "a &= b \\\\ c &= d", environment: "align" },
          },
        ],
      },
    });
    expect(editor.getJSON().content?.[0]?.attrs?.environment).toBe("align");
    const html = editor.getHTML();
    expect(html).toContain('data-math-environment="align"');

    const reloaded = new Editor({ extensions: [StarterKit, MathBlock], content: html });
    expect(reloaded.getJSON().content?.[0]?.attrs?.environment).toBe("align");
    editor.destroy();
    reloaded.destroy();
  });
});

describe("CommentMark", () => {
  it("keeps overlapping comment marks on the same text", () => {
    const editor = new Editor({
      extensions: [StarterKit, CommentMark],
      content: "<p>Alpha beta gamma delta</p>",
    });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.addComment("first");
    editor.commands.setTextSelection({ from: 1, to: 12 });
    editor.commands.addComment("second");

    const ids: string[] = [];
    editor.state.doc.descendants((node) => {
      for (const mark of node.marks) {
        if (mark.type.name === "comment") ids.push(mark.attrs.markId as string);
      }
    });
    expect(ids).toEqual(["first", "second", "second"]);

    const html = document.createElement("div");
    html.innerHTML = editor.getHTML();
    const highlights = Array.from(html.querySelectorAll("[data-comment-id]"));
    expect(highlights.some((element) => element.getAttribute("data-comment-id") === "first")).toBe(true);
    expect(highlights.some((element) => element.getAttribute("data-comment-id") === "second")).toBe(true);

    const reloaded = new Editor({ extensions: [StarterKit, CommentMark], content: editor.getJSON() });
    const reloadedIds: string[] = [];
    reloaded.state.doc.descendants((node) => {
      for (const mark of node.marks) {
        if (mark.type.name === "comment") reloadedIds.push(mark.attrs.markId as string);
      }
    });
    expect(reloadedIds).toEqual(["first", "second", "second"]);
    editor.destroy();
    reloaded.destroy();
  });
});
