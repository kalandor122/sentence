import type { Editor } from "@tiptap/core";
import { AllSelection, TextSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";

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

/**
 * Enter at the end of a list item that owns a nested sublist should add a
 * sibling item after the sublist. ProseMirror's splitListItem instead moves the
 * sublist into the new item, silently reparenting every child. A sublist
 * belongs to the item whose text introduces it, so insert the new item after
 * the whole current one and leave the trailing sublist where it is.
 */
export function splitListItemKeepingSublist(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 3) return false;
  const item = $from.node(-1);
  if (item.type.name !== "listItem") return false;
  if ($from.parentOffset !== $from.parent.content.size) return false;
  const next = item.maybeChild($from.indexAfter(-1));
  if (!next || !isListNode(next)) return false;

  const paragraph = state.schema.nodes.paragraph.create();
  const newItem = item.type.create(item.attrs, paragraph);
  const insertAt = $from.after(-1);
  const tr = state.tr.insert(insertAt, newItem);
  tr.setSelection(TextSelection.create(tr.doc, insertAt + 2));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Enter on an empty numbered item ends the numbering run in the middle of the
 * list. ProseMirror splits the list and copies the attrs, so the second half
 * silently restarts at 1 and two items carry the same number. Leave the empty
 * item behind as a paragraph and start the trailing items at the number they
 * already had. A bullet list has no numbers to keep, and an empty item at the
 * end exits through the default lift, so both are left alone.
 */
export function splitOrderedListOnEmptyItem(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 3 || $from.parent.content.size !== 0) return false;
  const item = $from.node(-1);
  const list = $from.node(-2);
  if (item.type.name !== "listItem" || item.childCount !== 1) return false;
  if (list.type.name !== "orderedList") return false;
  const index = $from.index(-2);
  const items: ProseMirrorNode[] = [];
  list.forEach((child) => items.push(child));
  if (index >= items.length - 1) return false;

  const start = Number(list.attrs.start ?? 1);
  const blocks: ProseMirrorNode[] = [];
  const listPos = $from.before(-2);
  let paragraphPos = listPos;
  if (index > 0) {
    const before = list.type.create(list.attrs, items.slice(0, index));
    blocks.push(before);
    paragraphPos += before.nodeSize;
  }
  blocks.push($from.parent.type.create($from.parent.attrs));
  blocks.push(
    list.type.create(
      { ...list.attrs, start: (Number.isSafeInteger(start) && start > 0 ? start : 1) + index },
      items.slice(index + 1),
    ),
  );

  const tr = state.tr.replaceWith(listPos, listPos + list.nodeSize, blocks);
  tr.setSelection(TextSelection.create(tr.doc, paragraphPos + 1));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

// The innermost list around the selection decides what toggling means. If it
// has the requested type the selected items lose their bullet/number; if it is
// the other type the default toggle converts it in place.
function findInnermostList(
  $pos: ResolvedPos,
  listType: "bulletList" | "orderedList",
): { node: ProseMirrorNode; depth: number } | null {
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (!isListNode(node)) continue;
    return node.type.name === listType ? { node, depth } : null;
  }
  return null;
}

/**
 * Turning a list type off for an item should remove the bullet or number, but
 * ProseMirror's liftListItem only promotes a nested item into the enclosing
 * list, so it keeps its bullet. Instead lift the selected items' content out of
 * the list ourselves, whether that list is at the top level or nested. For a
 * numbered list the trailing items also continue at the number they already
 * had, since lifting would restart them at 1.
 */
export function removeListItem(
  editor: Editor,
  listType: "bulletList" | "orderedList",
): boolean {
  if (!editor.isEditable) return false;
  const { state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return false;
  if (!editor.isActive(listType)) return false;
  const { $from, $to } = selection;
  if ($from.depth < 3) return false;
  const fromList = findInnermostList($from, listType);
  if (!fromList) return false;
  const toList = findInnermostList($to, listType);
  if (!toList || toList.depth !== fromList.depth) return false;
  if ($from.before(fromList.depth) !== $to.before(fromList.depth)) return false;

  const itemDepth = fromList.depth + 1;
  if ($from.depth < itemDepth || $to.depth < itemDepth) return false;
  if ($from.node(itemDepth).type.name !== "listItem") return false;
  if ($to.node(itemDepth).type.name !== "listItem") return false;

  const list = fromList.node;
  const items: ProseMirrorNode[] = [];
  list.forEach((child) => items.push(child));
  const fromIndex = $from.index(fromList.depth);
  const toIndex = Math.min($to.index(fromList.depth), items.length - 1);
  if (fromIndex > toIndex) return false;

  const start = Number(list.attrs.start ?? 1);
  const baseStart = Number.isSafeInteger(start) && start > 0 ? start : 1;

  const blocks: ProseMirrorNode[] = [];
  const listPos = $from.before(fromList.depth);
  if (fromIndex > 0) blocks.push(list.type.create(list.attrs, items.slice(0, fromIndex)));
  const liftedPos = listPos + (fromIndex > 0 ? blocks[0].nodeSize : 0);
  items.slice(fromIndex, toIndex + 1).forEach((item) => {
    item.forEach((child) => blocks.push(child));
  });
  if (toIndex < items.length - 1) {
    const attrs =
      listType === "orderedList"
        ? { ...list.attrs, start: baseStart + toIndex + 1 }
        : list.attrs;
    blocks.push(list.type.create(attrs, items.slice(toIndex + 1)));
  }

  const itemStart = $from.start(itemDepth);
  const offsetFrom = $from.pos - itemStart;
  const offsetTo = $to.pos - itemStart;
  const tr = state.tr.replaceWith(listPos, listPos + list.nodeSize, blocks);
  if (blocks.length > 0) {
    tr.setSelection(
      TextSelection.between(
        tr.doc.resolve(liftedPos + offsetFrom),
        tr.doc.resolve(liftedPos + offsetTo),
      ),
    );
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
  return true;
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
  if (removeListItem(editor, listType)) return true;
  const cmd = listType === "bulletList" ? "toggleBulletList" : "toggleOrderedList";
  return editor.chain().focus()[cmd]().run();
}
