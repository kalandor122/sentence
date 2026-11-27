import type { Editor } from "@tiptap/core";
import { AllSelection, NodeSelection, TextSelection } from "@tiptap/pm/state";
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

// editor.isActive("bulletList") is also true for a numbered list nested inside a
// bullet list, because every enclosing list counts. Report only the innermost
// list that holds the caret so the two ribbon buttons are mutually exclusive.
// Its marker is drawn on the item's first block, so a paragraph left inside an
// item after a nested bullet was removed is not itself bulleted.
function markerListType($pos: ResolvedPos): string | null {
  for (let depth = $pos.depth - 1; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!isListNode(node)) continue;
    return $pos.index(depth + 1) === 0 ? node.type.name : null;
  }
  return null;
}

export function isListActive(editor: Editor, listType: "bulletList" | "orderedList"): boolean {
  if (isAllSelected(editor)) return documentHasList(editor, listType);
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && isListNode(selection.node)) {
    return selection.node.type.name === listType;
  }
  // A selection inside one block belongs to that block, so it is no more
  // bulleted than the same block with a collapsed caret.
  if (!selection.empty) {
    if (selection instanceof TextSelection && selection.$from.sameParent(selection.$to)) {
      return markerListType(selection.$from) === listType;
    }
    return editor.isActive(listType);
  }
  return markerListType(selection.$from) === listType;
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
 * Outdenting an item in the middle of a nested list should move only that item
 * out to the enclosing list. ProseMirror's liftListItem hands the following
 * siblings to the lifted item instead, silently nesting text it never contained.
 * Keep them in the sublist under the same parent item and let only the lifted
 * item move out, right after that parent.
 */
export function liftListItemKeepingSiblings(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 4) return false;
  const item = $from.node(-1);
  const list = $from.node(-2);
  const parentItem = $from.node(-3);
  const parentList = $from.node(-4);
  if (item.type.name !== "listItem" || parentItem.type.name !== "listItem") return false;
  if (!isListNode(list) || !isListNode(parentList)) return false;
  const index = $from.index(-2);
  const items: ProseMirrorNode[] = [];
  list.forEach((child) => items.push(child));
  if (index >= items.length - 1) return false;

  const remaining = list.type.create(
    list.attrs,
    items.filter((_, at) => at !== index),
  );
  const tr = state.tr.replaceWith($from.before(-2), $from.after(-2), remaining);
  const insertAt = tr.mapping.map($from.after(-3));
  tr.insert(insertAt, item);
  tr.setSelection(TextSelection.create(tr.doc, insertAt + $from.pos - $from.before(-1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Enter on an empty item in the middle of a nested list has nothing to split:
 * ProseMirror leaves the item in place and the fallback command tears a
 * paragraph out of the parent item, so the text typed next joins the parent
 * instead of becoming a list item. Outdent the empty item one level, exactly as
 * Enter on the empty item at the end of the same sublist does, so the new text
 * becomes a sibling of the parent item.
 */
export function liftEmptyNestedItem(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 4 || $from.parent.content.size !== 0) return false;
  const item = $from.node(-1);
  const list = $from.node(-2);
  const parentItem = $from.node(-3);
  if (item.type.name !== "listItem" || item.childCount !== 1) return false;
  if (!isListNode(list) || parentItem.type.name !== "listItem") return false;
  return liftListItemKeepingSiblings(editor) || editor.chain().liftListItem("listItem").run();
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

function listItems(list: ProseMirrorNode): ProseMirrorNode[] {
  const items: ProseMirrorNode[] = [];
  list.forEach((child) => items.push(child));
  return items;
}

// Items of a nested sublist that the selection touches, found by position
// because the selection may start in a parent item, outside the sublist.
function selectedItemRange(
  list: ProseMirrorNode,
  listPos: number,
  from: number,
  to: number,
): { first: number; last: number } | null {
  const items = listItems(list);
  let pos = listPos + 1;
  let first = -1;
  let last = -1;
  items.forEach((item, index) => {
    const end = pos + item.nodeSize;
    if (pos < to && end > from) {
      if (first < 0) first = index;
      last = index;
    }
    pos = end;
  });
  return first < 0 ? null : { first, last };
}

/**
 * Blocks for `list` with the selected items lifted out of it. Any sublist of the
 * same type inside a lifted item is lifted too when the selection reaches it, so
 * a selection that covers a parent item and its nested child removes both
 * bullets instead of leaving the child in a promoted list.
 */
function liftSelectedItems(
  list: ProseMirrorNode,
  listPos: number,
  listType: "bulletList" | "orderedList",
  range: { first: number; last: number },
  from: number,
  to: number,
): ProseMirrorNode[] {
  const items = listItems(list);
  const start = Number(list.attrs.start ?? 1);
  const baseStart = Number.isSafeInteger(start) && start > 0 ? start : 1;

  const blocks: ProseMirrorNode[] = [];
  if (range.first > 0) blocks.push(list.type.create(list.attrs, items.slice(0, range.first)));
  let itemPos = listPos + 1;
  for (let index = 0; index < range.first; index += 1) itemPos += items[index].nodeSize;
  items.slice(range.first, range.last + 1).forEach((item) => {
    let childPos = itemPos + 1;
    item.forEach((child) => {
      if (isListNode(child) && child.type.name === listType) {
        const nested = selectedItemRange(child, childPos, from, to);
        if (nested) {
          blocks.push(...liftSelectedItems(child, childPos, listType, nested, from, to));
        } else {
          blocks.push(child);
        }
      } else {
        blocks.push(child);
      }
      childPos += child.nodeSize;
    });
    itemPos += item.nodeSize;
  });
  if (range.last < items.length - 1) {
    const attrs =
      listType === "orderedList"
        ? { ...list.attrs, start: baseStart + range.last + 1 }
        : list.attrs;
    blocks.push(list.type.create(attrs, items.slice(range.last + 1)));
  }
  return blocks;
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
  const { $from, $to } = selection;
  if ($from.depth < 3) return false;
  // Removing a bullet needs the caret on the item's own marker block. A
  // paragraph left inside an item after a nested bullet was removed has no
  // marker, and stripping the enclosing item's bullet would be the wrong edit.
  if (markerListType($from) !== listType) return false;
  const fromList = findInnermostList($from, listType);
  if (!fromList) return false;
  const toList = findInnermostList($to, listType);
  if (!toList) return false;
  // A selection can span a parent item and its nested child, so the list being
  // unwrapped is the outermost of the two and both ends must sit in it.
  const listDepth = Math.min(fromList.depth, toList.depth);
  if ($from.before(listDepth) !== $to.before(listDepth)) return false;
  const list = $from.node(listDepth);
  if (!isListNode(list) || list.type.name !== listType) return false;

  const itemDepth = listDepth + 1;
  if ($from.depth < itemDepth || $to.depth < itemDepth) return false;
  if ($from.node(itemDepth).type.name !== "listItem") return false;
  if ($to.node(itemDepth).type.name !== "listItem") return false;

  const items = listItems(list);
  const fromIndex = $from.index(listDepth);
  const toIndex = Math.min($to.index(listDepth), items.length - 1);
  if (fromIndex > toIndex) return false;

  const listPos = $from.before(listDepth);
  const blocks = liftSelectedItems(
    list,
    listPos,
    listType,
    { first: fromIndex, last: toIndex },
    $from.pos,
    $to.pos,
  );
  const liftedPos = listPos + (fromIndex > 0 ? blocks[0].nodeSize : 0);

  const itemStart = $from.start(itemDepth);
  const offsetFrom = $from.pos - itemStart;
  const offsetTo = $to.pos - itemStart;
  const tr = state.tr.replaceWith(listPos, listPos + list.nodeSize, blocks);
  if (blocks.length > 0) {
    const end = tr.doc.content.size;
    tr.setSelection(
      TextSelection.between(
        tr.doc.resolve(Math.min(liftedPos + offsetFrom, end)),
        tr.doc.resolve(Math.min(liftedPos + offsetTo, end)),
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
 * A plain block left inside a list item after a nested item lost its bullet has
 * no marker of its own. Turning list formatting back on for it should make that
 * block an item again next to the sublist it was lifted out of, joined to it
 * when the sublist has the requested type. Wrapping the enclosing item instead
 * would strip the parent's bullet.
 */
function restoreListItem(
  editor: Editor,
  listType: "bulletList" | "orderedList",
): boolean {
  if (!editor.isEditable) return false;
  const { state } = editor;
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return false;
  const { $from, $to } = selection;
  // The toggle applies to this one block, so the selection must stay inside it.
  if (!$from.sameParent($to)) return false;
  if ($from.depth < 3) return false;
  const item = $from.node(-1);
  if (item.type.name !== "listItem") return false;
  const block = $from.parent;
  if (block.type.name !== "paragraph") return false;
  const index = $from.index(-1);
  if (index === 0) return false;

  const blockStart = $from.before();
  const blockEnd = $from.after();
  const contentStart = blockStart + 1;
  const fromOffset = $from.pos - contentStart;
  const toOffset = $to.pos - contentStart;
  const newItem = item.type.create(item.attrs, block);
  const next = item.maybeChild(index + 1);
  const previous = item.maybeChild(index - 1);
  let tr = state.tr.delete(blockStart, blockEnd);
  // Where the paragraph's own text now starts, relative to contentStart.
  let shift: number;
  if (next && next.type.name === listType) {
    tr.insert(blockStart + 1, newItem);
    shift = 2;
  } else if (previous && previous.type.name === listType) {
    tr.insert(blockStart - 1, newItem);
    shift = 0;
  } else {
    tr = state.tr.replaceWith(
      blockStart,
      blockEnd,
      state.schema.nodes[listType].create(null, newItem),
    );
    shift = 2;
  }
  tr.setSelection(
    TextSelection.create(tr.doc, contentStart + shift + fromOffset, contentStart + shift + toOffset),
  );
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
  return true;
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
  if (restoreListItem(editor, listType)) return true;
  const cmd = listType === "bulletList" ? "toggleBulletList" : "toggleOrderedList";
  return editor.chain().focus()[cmd]().run();
}
