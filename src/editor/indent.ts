import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import { liftListItemKeepingSiblings } from "./listToggle";

// LaTeX defines four list levels (enumi-enumiv, itemi-itemiv) and refuses a
// fifth with "Too deeply nested.", so the source could never compile. Stop
// nesting where the exporter can still write it.
const MAX_LIST_DEPTH = 4;

function listItemDepth($pos: ResolvedPos): number {
  let depth = 0;
  for (let level = 1; level <= $pos.depth; level += 1) {
    if ($pos.node(level).type.name === "listItem") depth += 1;
  }
  return depth;
}

// Sinking an item takes its sublist along, so the items underneath decide
// whether the move stays within the levels LaTeX can nest.
function deepestNestedItem(node: ProseMirrorNode): number {
  let deepest = 0;
  node.forEach((child) => {
    const nested = deepestNestedItem(child);
    deepest = Math.max(deepest, child.type.name === "listItem" ? nested + 1 : nested);
  });
  return deepest;
}

function deepestListItem($pos: ResolvedPos): ProseMirrorNode | null {
  for (let level = $pos.depth; level >= 1; level -= 1) {
    const node = $pos.node(level);
    if (node.type.name === "listItem") return node;
  }
  return null;
}

// Indentation reuses the structures LaTeX already understands: nested list
// items and quote environments. Tables and verbatim blocks keep their own
// layout and must not be wrapped or lifted. A block that is already indented
// stays put: wrapping it again would nest one quote inside the next.
export function changeIndent(editor: Editor, outdent: boolean): boolean {
  if (!editor.isEditable || editor.isActive("table") || editor.isActive("codeBlock")) return false;
  const chain = editor.chain().focus();
  if (editor.isActive("listItem")) {
    if (outdent) {
      return liftListItemKeepingSiblings(editor) || chain.liftListItem("listItem").run();
    }
    const { $from } = editor.state.selection;
    const item = deepestListItem($from);
    if (item && listItemDepth($from) + deepestNestedItem(item) >= MAX_LIST_DEPTH) return false;
    return chain.sinkListItem("listItem").run();
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
