// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { isListActive, toggleList } from "./listToggle";

function createEditor(content: string): Editor {
  return new Editor({ extensions: [StarterKit], content });
}

function paragraphs(...texts: string[]) {
  return texts.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));
}

function expectParagraphs(editor: Editor, ...texts: string[]) {
  const blocks = (editor.getJSON().content ?? []).filter((node) => node.type !== "paragraph" || node.content?.length);
  expect(blocks).toEqual(paragraphs(...texts));
}

describe("toggleList", () => {
  it("converts a fully selected bullet list to paragraphs", () => {
    const editor = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    editor.commands.selectAll();
    expect(isListActive(editor, "bulletList")).toBe(true);
    expect(toggleList(editor, "bulletList")).toBe(true);
    expectParagraphs(editor, "one", "two");
    editor.destroy();
  });

  it("converts a fully selected numbered list to paragraphs", () => {
    const editor = createEditor("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    editor.commands.selectAll();
    expect(isListActive(editor, "orderedList")).toBe(true);
    expect(toggleList(editor, "orderedList")).toBe(true);
    expectParagraphs(editor, "one", "two");
    editor.destroy();
  });

  it("keeps ordinary blocks while unwrapping the selected list", () => {
    const editor = createEditor("<p>intro</p><ul><li><p>one</p></li></ul>");
    editor.commands.selectAll();
    expect(toggleList(editor, "bulletList")).toBe(true);
    expectParagraphs(editor, "intro", "one");
    editor.destroy();
  });
});
