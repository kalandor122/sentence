import { Table } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { TableMap, addRow, deleteColumn, deleteRow, isInTable, selectedRect } from "@tiptap/pm/tables";
import type { TableRect } from "@tiptap/pm/tables";
import { focusAfterEditor, focusBeforeEditor } from "./focus";

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

// Tables carry their caption as a node attribute so it survives the visual/LaTeX
// round trip without becoming a paragraph inside the table.
export const CaptionTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
    };
  },

  // Tiptap appends a row when Tab is pressed in the last cell. Tab is focus
  // navigation here too: walk the cells and then hand focus to the next
  // control instead of changing the table structure.
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => {
        if (!isInTable(this.editor.state)) return false;
        if (this.editor.commands.goToNextCell()) return true;
        return focusAfterEditor(this.editor);
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
      // header position there, and only there. Tiptap inserts a plain row above
      // row 1, which pushes the header into row 2 until the next source round
      // trip moves it back. Add the row just below the header instead so the
      // document model and its exported form stay the same.
      addRowBefore: () => ({ state, dispatch }) => {
        if (!isInTable(state)) return false;
        if (dispatch) {
          const rect = selectedRect(state);
          const headerRow = rect.table.firstChild?.firstChild?.type.name === "tableHeader";
          dispatch(addRow(state.tr, rect, rect.top === 0 && headerRow ? 1 : rect.top));
        }
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
