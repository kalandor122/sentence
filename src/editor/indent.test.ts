// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { changeIndent, nestListItem } from "./indent";

function paragraphEditor() {
  const editor = new Editor({ extensions: [StarterKit], content: "<p>Alpha beta</p>" });
  editor.commands.setTextSelection(1);
  return editor;
}

function listEditor(html: string, caret: number) {
  const editor = new Editor({ extensions: [StarterKit], content: html });
  editor.commands.setTextSelection(caret);
  return editor;
}

// Caret at the end of the given text, found by content so the tests do not
// depend on hand-counted positions.
function selectEnd(editor: Editor, text: string) {
  let pos = -1;
  editor.state.doc.descendants((node, offset) => {
    if (pos < 0 && node.isText && node.text === text) pos = offset + node.nodeSize - 1;
    return pos < 0;
  });
  editor.commands.setTextSelection(pos);
}

describe("changeIndent", () => {
  it("indents a paragraph once and never nests quote inside quote", () => {
    const editor = paragraphEditor();
    expect(changeIndent(editor, false)).toBe(true);
    const once = editor.getHTML();
    expect(once.match(/<blockquote>/g)).toHaveLength(1);
    expect(changeIndent(editor, false)).toBe(false);
    expect(editor.getHTML()).toBe(once);
    editor.destroy();
  });

  it("outdents a quoted paragraph and stops at the margin", () => {
    const editor = paragraphEditor();
    expect(changeIndent(editor, false)).toBe(true);
    expect(changeIndent(editor, true)).toBe(true);
    expect(editor.isActive("blockquote")).toBe(false);
    expect(editor.state.doc.firstChild?.textContent).toBe("Alpha beta");
    expect(changeIndent(editor, true)).toBe(false);
    editor.destroy();
  });
});

describe("nestListItem", () => {
  it("nests a later item under its previous sibling", () => {
    const editor = listEditor("<ul><li><p>First</p></li><li><p>Second</p></li></ul>", 12);
    expect(nestListItem(editor, false)).toBe(true);
    expect(editor.getHTML()).toContain("<li><p>First</p><ul><li><p>Second</p></li></ul></li>");
    editor.destroy();
  });

  it("keeps the key checked on a first item that has nowhere to nest", () => {
    const editor = listEditor("<ul><li><p>Only</p></li></ul>", 3);
    const before = editor.getHTML();
    expect(nestListItem(editor, false)).toBe(true);
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it("nests up to the fourth level LaTeX can write", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content:
        "<ol><li><p>L1</p><ol><li><p>L2</p><ol><li><p>A</p></li><li><p>L3</p></li></ol></li></ol></li></ol>",
    });
    selectEnd(editor, "L3");
    expect(nestListItem(editor, false)).toBe(true);
    expect(editor.getHTML()).toContain(
      "<li><p>A</p><ol><li><p>L3</p></li></ol></li>",
    );
    editor.destroy();
  });

  it("refuses a fifth level and leaves the fourth in place", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content:
        "<ol><li><p>L1</p><ol><li><p>L2</p><ol><li><p>L3</p><ol><li><p>L4a</p></li><li><p>L4b</p></li></ol></li></ol></li></ol></li></ol>",
    });
    selectEnd(editor, "L4b");
    const before = editor.getHTML();
    expect(nestListItem(editor, false)).toBe(true);
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it("refuses to sink a parent whose sublist already reaches the fourth level", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content:
        "<ol><li><p>L1</p><ol><li><p>L2</p><ol><li><p>A</p></li><li><p>L3</p><ol><li><p>L4a</p></li><li><p>L4b</p></li></ol></li></ol></li></ol></li></ol>",
    });
    selectEnd(editor, "L3");
    const before = editor.getHTML();
    expect(nestListItem(editor, false)).toBe(true);
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it("leaves the key alone outside lists", () => {
    const editor = paragraphEditor();
    expect(nestListItem(editor, false)).toBe(false);
    editor.destroy();
  });

  it("outdents only the middle item and leaves its siblings in the sublist", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content:
        "<ul><li><p>outer</p><ul><li><p>child one</p></li><li><p>child two</p></li><li><p>child three</p></li></ul></li></ul>",
    });
    selectEnd(editor, "child two");
    expect(nestListItem(editor, true)).toBe(true);
    expect(editor.getHTML()).toContain(
      "<li><p>outer</p><ul><li><p>child one</p></li><li><p>child three</p></li></ul></li><li><p>child two</p></li>",
    );
    expect(editor.state.selection.$from.parent.textContent).toBe("child two");
    editor.destroy();
  });

  it("outdents the first item without taking the rest of the sublist", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content:
        "<ul><li><p>outer</p><ul><li><p>child one</p></li><li><p>child two</p></li><li><p>child three</p></li></ul></li></ul>",
    });
    selectEnd(editor, "child one");
    expect(nestListItem(editor, true)).toBe(true);
    expect(editor.getHTML()).toContain(
      "<li><p>outer</p><ul><li><p>child two</p></li><li><p>child three</p></li></ul></li><li><p>child one</p></li>",
    );
    editor.destroy();
  });

  it("keeps a numbered sublist together when outdenting an item", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content:
        "<ol><li><p>outer</p><ol><li><p>child one</p></li><li><p>child two</p></li><li><p>child three</p></li></ol></li></ol>",
    });
    selectEnd(editor, "child two");
    expect(nestListItem(editor, true)).toBe(true);
    expect(editor.getHTML()).toContain(
      "<li><p>outer</p><ol><li><p>child one</p></li><li><p>child three</p></li></ol></li><li><p>child two</p></li>",
    );
    editor.destroy();
  });
});
