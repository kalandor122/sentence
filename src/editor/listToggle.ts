import type { Editor } from "@tiptap/core";
import { AllSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

function isAllSelected(editor: Editor): boolean {
  const { state } = editor;
  return (
    state.selection instanceof AllSelection ||
    (state.selection.from <= 0 && state.selection.to >= state.doc.content.size)
  );
}

// editor.isActive() only looks around the selection head, which sits at the
// document start for an AllSelection, so a fully selected list reads as
// inactive. Check the document itself instead.
function documentHasList(editor: Editor, listType: "bulletList" | "orderedList"): boolean {
  let found = false;
  editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node) => {
    if (found) return false;
    if (node.type.name === listType) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

export function isListActive(editor: Editor, listType: "bulletList" | "orderedList"): boolean {
  return editor.isActive(listType) || (isAllSelected(editor) && documentHasList(editor, listType));
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

function isListNode(node: ProseMirrorNode): boolean {
  return node.type.name === "bulletList" || node.type.name === "orderedList";
}

// Retag list nodes (including nested sublists) without touching their items,
// so a full-document toggle converts lists in place instead of wrapping every
// selected block - including paragraphs and nested lists - in a new list.
function convertList(node: ProseMirrorNode, listType: "bulletList" | "orderedList"): ProseMirrorNode {
  const type = isListNode(node) ? node.type.schema.nodes[listType] : node.type;
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    children.push(isListNode(child) || child.type.name === "listItem" ? convertList(child, listType) : child);
  });
  return type.create(node.attrs, children, node.marks);
}

/**
 * Toggle a list type. When the entire document is selected, ProseMirror's
 * default toggle wraps every selected block in a new list, which nests existing
 * lists under the first paragraph and can append an empty item. Instead handle
 * the selected lists directly: unwrap lists that already have the target type
 * and retag lists of the other type in place, leaving ordinary blocks alone.
 */
export function toggleList(editor: Editor, listType: "bulletList" | "orderedList"): boolean {
  if (isAllSelected(editor)) {
    const { state, view } = editor;
    const blocks: ProseMirrorNode[] = [];
    let changed = false;
    state.doc.forEach((node) => {
      if (node.type.name === listType) {
        changed = true;
        blocks.push(...unwrapList(node, listType));
      } else if (isListNode(node)) {
        changed = true;
        blocks.push(convertList(node, listType));
      } else {
        blocks.push(node);
      }
    });
    if (changed) {
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
