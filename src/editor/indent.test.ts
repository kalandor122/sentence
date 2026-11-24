// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { changeIndent } from "./indent";

function paragraphEditor() {
  const editor = new Editor({ extensions: [StarterKit], content: "<p>Alpha beta</p>" });
  editor.commands.setTextSelection(1);
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
