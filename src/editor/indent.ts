import type { Editor } from "@tiptap/react";

// Indentation reuses the structures LaTeX already understands: nested list
// items and quote environments. Tables and verbatim blocks keep their own
// layout and must not be wrapped or lifted.
export function changeIndent(editor: Editor, outdent: boolean): boolean {
  if (!editor.isEditable || editor.isActive("table") || editor.isActive("codeBlock")) return false;
  const chain = editor.chain().focus();
  if (editor.isActive("listItem")) {
    if (outdent) chain.liftListItem("listItem").run();
    else chain.sinkListItem("listItem").run();
  } else if (outdent) {
    chain.lift("blockquote").run();
  } else {
    chain.wrapIn("blockquote").run();
  }
  return true;
}
