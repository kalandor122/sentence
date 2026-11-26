import { mergeAttributes, type Editor } from "@tiptap/core";
import { Table, TableView } from "@tiptap/extension-table";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { TableMap, addRow, deleteColumn, deleteRow, isInTable, selectedRect } from "@tiptap/pm/tables";
import type { TableRect } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import { focusBeforeEditor } from "./focus";

function captionText(node: { attrs?: Record<string, unknown> }): string {
  const value = node.attrs?.caption;
  return typeof value === "string" ? value : "";
}

// The resizable table's node view builds its own <table>, so the visible
// caption has to be added there. It is not editor content: the toolbar field is
// the only place to change it, which keeps it out of the table's rows.
class CaptionTableView extends TableView {
  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    view?: EditorView,
    HTMLAttributes?: Record<string, unknown>,
  ) {
    super(node, cellMinWidth, view, HTMLAttributes);
    const text = captionText(node);
    if (!text) return;
    const caption = document.createElement("caption");
    caption.className = "table-caption";
    caption.contentEditable = "false";
    caption.textContent = text;
    // Column resizing reads the table's first child as the colgroup, so the
    // caption goes after it. caption-side: top still paints it above the rows,
    // and the exported HTML keeps the caption first.
    this.table.insertBefore(caption, this.colgroup.nextSibling);
  }
}

function selectionInTable(tr: Transaction): boolean {
  const { $from } = tr.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.tableRole === "table") return true;
  }
  return false;
}

// Removing the row or column that holds the caret maps the selection out of
// the table, which lands typing after it and hides the table toolbar. Keep the
// caret in the nearest remaining cell instead.
function keepSelectionInTable(tr: Transaction, rect: TableRect, row: number, column: number): void {
  if (selectionInTable(tr)) return;
  const table = tr.doc.nodeAt(rect.tableStart - 1);
  if (!table) return;
  const map = TableMap.get(table);
  const target = map.positionAt(
    Math.min(Math.max(row, 0), map.height - 1),
    Math.min(Math.max(column, 0), map.width - 1),
    table,
  );
  tr.setSelection(TextSelection.near(tr.doc.resolve(rect.tableStart + target + 1), 1));
}

// Handing focus to the next control outside the page drops the keys that
// follow, so Tab out of the last cell keeps the caret in the text flow
// instead: the block after the table, or a new paragraph when the table ends
// its parent.
function leaveTableForward(editor: Editor): boolean {
  const { state, view } = editor;
  const { $from } = state.selection;
  let depth = $from.depth;
  while (depth > 0 && $from.node(depth).type.spec.tableRole !== "table") depth -= 1;
  if (depth === 0) return false;
  const after = $from.after(depth);
  const tr = state.tr;
  if (!tr.doc.nodeAt(after)) tr.insert(after, state.schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.near(tr.doc.resolve(after), 1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

// Tables carry their caption as a node attribute so it survives the visual/LaTeX
// round trip without becoming a paragraph inside the table.
export const CaptionTable = Table.extend({
  addNodeView() {
    return ({ node, view, HTMLAttributes }) =>
      new CaptionTableView(
        node,
        this.options.cellMinWidth,
        view,
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      );
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) =>
          element.querySelector(":scope > caption")?.textContent ??
          element.getAttribute("data-caption") ??
          "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
      // A table label is the target of a \ref, so it has to stay on the node.
      // Without it the editor schema drops the attribute it was given and the
      // next LaTeX export leaves the reference pointing at nothing.
      label: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes) => (attributes.label ? { "data-label": attributes.label } : {}),
      },
    };
  },

  // The caption is visible in the page as well as exported as \caption, the
  // same way a figure shows its caption under the image.
  renderHTML({ node, HTMLAttributes }) {
    const caption = captionText(node);
    return [
      "table",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ...(caption ? ([["caption", {}, caption]] as DOMOutputSpec[]) : []),
      ["tbody", 0],
    ];
  },

  // Tiptap appends a row when Tab is pressed in the last cell. Tab is focus
  // navigation here too: walk the cells and then step out after the table
  // instead of changing the table structure.
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => {
        if (!isInTable(this.editor.state)) return false;
        if (this.editor.commands.goToNextCell()) return true;
        return leaveTableForward(this.editor);
      },
      "Shift-Tab": () => {
        if (!isInTable(this.editor.state)) return false;
        if (this.editor.commands.goToPreviousCell()) return true;
        return focusBeforeEditor(this.editor);
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      // A header row only counts in row 1: the LaTeX export and import keep the
      // header position there, and only there. That leaves nothing above the
      // header, so adding a row "above" it can only push the header down to row
      // 2 and then get moved back by the next source round trip. Report the
      // command as unavailable there so the toolbar disables it instead of
      // inserting the row somewhere the button does not say.
      addRowBefore: () => ({ state, dispatch }) => {
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        const headerRow = rect.table.firstChild?.firstChild?.type.name === "tableHeader";
        if (rect.top === 0 && headerRow) return false;
        if (dispatch) dispatch(addRow(state.tr, rect, rect.top));
        return true;
      },

      // prosemirror-tables reports these as available even when the selection
      // spans every row or column, and then leaves the table untouched. Report
      // them as unavailable instead so the toolbar can disable them at 1x1.
      deleteRow: () => ({ state, tr, dispatch }) => {
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        if (rect.top === 0 && rect.bottom === rect.map.height) return false;
        if (!deleteRow(state, dispatch)) return false;
        if (dispatch) keepSelectionInTable(tr, rect, rect.top, rect.left);
        return true;
      },

      deleteColumn: () => ({ state, tr, dispatch }) => {
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        if (rect.left === 0 && rect.right === rect.map.width) return false;
        if (!deleteColumn(state, dispatch)) return false;
        if (dispatch) keepSelectionInTable(tr, rect, rect.top, rect.left);
        return true;
      },
    };
  },
});
