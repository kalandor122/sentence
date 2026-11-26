// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { resetEditorHistory } from "./history";

describe("resetEditorHistory", () => {
  it("drops every undo step without changing the document", () => {
    const editor = new Editor({ extensions: [StarterKit], content: "<p>Before</p>" });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(" after");
    expect(editor.can().undo()).toBe(true);

    const text = editor.getText();
    resetEditorHistory(editor);

    expect(editor.can().undo()).toBe(false);
    expect(editor.can().redo()).toBe(false);
    expect(editor.getText()).toBe(text);
    editor.commands.undo();
    expect(editor.getText()).toBe(text);
    editor.destroy();
  });
});
