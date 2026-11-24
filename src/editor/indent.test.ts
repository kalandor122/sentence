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

  it("leaves the key alone outside lists", () => {
    const editor = paragraphEditor();
    expect(nestListItem(editor, false)).toBe(false);
    editor.destroy();
  });
});
