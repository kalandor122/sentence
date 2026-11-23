import { AllSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

function isAllSelected(editor: Editor): boolean {
  const { state } = editor;
  return (
    state.selection instanceof AllSelection ||
    (state.selection.from <= 0 && state.selection.to >= state.doc.content.size)
  );
}

function unwrapList(node: ProseMirrorNode, listType: "bulletList" | "orderedList"): ProseMirrorNode[] {
  const blocks: ProseMirrorNode[] = [];
  node.forEach((item) => {
    item.forEach((child) => {
      if (child.type.name === listType) blocks.push(...unwrapList(child, listType));
      else blocks.push(child);
    });
  });
  return blocks;
}

/**
 * Toggle a list type. When the entire document is selected and already inside
 * the target list type, ProseMirror's default toggle can append an empty item
 * instead of converting the list back to paragraphs. Unwrap the selected list
 * nodes directly so content becomes plain blocks.
 */
export function toggleList(editor: Editor, listType: "bulletList" | "orderedList"): boolean {
  if (isAllSelected(editor) && editor.isActive(listType)) {
    const { state, view } = editor;
    const blocks: ProseMirrorNode[] = [];
    let hasTarget = false;
    state.doc.forEach((node) => {
      if (node.type.name === listType) {
        hasTarget = true;
        blocks.push(...unwrapList(node, listType));
      } else {
        blocks.push(node);
      }
    });
    if (hasTarget) {
      const replacement =
        blocks.length > 0 ? blocks : [state.schema.nodes.paragraph.create()];
      view.dispatch(state.tr.replaceWith(0, state.doc.content.size, replacement).scrollIntoView());
      editor.commands.focus();
      return true;
    }
  }
  const cmd = listType === "bulletList" ? "toggleBulletList" : "toggleOrderedList";
  return editor.chain().focus()[cmd]().run();
}
