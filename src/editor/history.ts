import type { Editor } from "@tiptap/core";

// The history plugin keeps its stacks in a private state field with no public
// reset. Replacing that field's value with a fresh one is the only way to drop
// the steps a review decision must not undo: accepting or rejecting a change is
// not a document edit, so the typing behind it must not come back through
// Ctrl+Z. Other plugins keep their state.
export function resetEditorHistory(editor: Editor): void {
  if (editor.isDestroyed) return;
  const history = editor.state.plugins.find((candidate) => {
    const key = candidate.spec.key as { key?: unknown } | undefined;
    return typeof key?.key === "string" && key.key.startsWith("history$");
  });
  const field = history?.spec.state;
  const key = (history?.spec.key as { key?: string } | undefined)?.key;
  if (!key || !field) return;
  const fresh = field.init(editor.state, editor.state);
  editor.view.dispatch(
    editor.state.tr
      .setMeta(key, { historyState: fresh })
      .setMeta("addToHistory", false),
  );
}
