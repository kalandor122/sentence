// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { isListActive, splitListItemKeepingSublist, toggleList } from "./listToggle";

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

// StarterKit's trailing-node extension appends an empty paragraph when the
// document ends with a list; ignore it when comparing the converted blocks.
function getHTML(editor: Editor): string {
  return editor.getHTML().replace(/<p><\/p>$/, "");
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

  it("converts a fully selected bullet list to a numbered list", () => {
    const editor = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    editor.commands.selectAll();
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    editor.destroy();
  });

  it("converts a fully selected numbered list to a bulleted list", () => {
    const editor = createEditor("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    editor.commands.selectAll();
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    editor.destroy();
  });

  it("converts the selected list in place and leaves other blocks alone", () => {
    const editor = createEditor(
      "<p>intro</p><ul><li><p>one</p></li><li><p>two</p></li></ul><p>outro</p>",
    );
    editor.commands.selectAll();
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<p>intro</p><ol><li><p>one</p></li><li><p>two</p></li></ol><p>outro</p>",
    );
    editor.destroy();
  });

  it("keeps nested sublists when converting the whole document", () => {
    const editor = createEditor(
      "<p>intro</p><ul><li><p>one</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    editor.commands.selectAll();
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<p>intro</p><ol><li><p>one</p><ol><li><p>child</p></li></ol></li></ol>",
    );
    editor.destroy();
  });
});

describe("splitListItemKeepingSublist", () => {
  it("adds a sibling after the sublist instead of adopting it", () => {
    const editor = createEditor(
      "<ul><li><p>parent</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    // End of the "parent" text, before its nested list.
    editor.commands.setTextSelection(9);
    expect(splitListItemKeepingSublist(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>parent</p><ul><li><p>child</p></li></ul></li><li><p></p></li></ul>",
    );
    const { $from } = editor.state.selection;
    expect($from.parent.type.name).toBe("paragraph");
    expect($from.parent.content.size).toBe(0);
    editor.destroy();
  });

  it("leaves ordinary splits and non-list text to the default Enter", () => {
    const midItem = createEditor(
      "<ul><li><p>parent</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    midItem.commands.setTextSelection(5);
    expect(splitListItemKeepingSublist(midItem)).toBe(false);
    midItem.destroy();

    const paragraph = createEditor("<p>outside</p>");
    paragraph.commands.setTextSelection(7);
    expect(splitListItemKeepingSublist(paragraph)).toBe(false);
    paragraph.destroy();
  });
});
