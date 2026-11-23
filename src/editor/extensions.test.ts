// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CommentMark } from "./extensions";

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
