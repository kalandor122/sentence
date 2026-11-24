import type { Editor } from "@tiptap/react";

// Indentation reuses the structures LaTeX already understands: nested list
// items and quote environments. Tables and verbatim blocks keep their own
// layout and must not be wrapped or lifted. A block that is already indented
// stays put: wrapping it again would nest one quote inside the next.
export function changeIndent(editor: Editor, outdent: boolean): boolean {
  if (!editor.isEditable || editor.isActive("table") || editor.isActive("codeBlock")) return false;
  const chain = editor.chain().focus();
  if (editor.isActive("listItem")) {
    return outdent ? chain.liftListItem("listItem").run() : chain.sinkListItem("listItem").run();
  }
  if (outdent) return editor.isActive("blockquote") ? chain.lift("blockquote").run() : false;
  if (editor.isActive("blockquote")) return false;
  return chain.wrapIn("blockquote").run();
}

// Tab is the list key, so a caret inside a list item always consumes it. The
// first item has no previous sibling to nest under: sinking then fails, and
// letting the key through would move focus off the page mid-edit instead of
// leaving the item where it is.
export function nestListItem(editor: Editor, outdent: boolean): boolean {
  if (!editor.isEditable || !editor.isActive("listItem")) return false;
  changeIndent(editor, outdent);
  return true;
}
