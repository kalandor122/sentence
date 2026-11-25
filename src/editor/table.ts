import { Table } from "@tiptap/extension-table";
import { addRow, deleteColumn, deleteRow, isInTable, selectedRect } from "@tiptap/pm/tables";
import { focusAfterEditor, focusBeforeEditor } from "./focus";

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
      deleteRow: () => ({ state, dispatch }) => {
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        if (rect.top === 0 && rect.bottom === rect.map.height) return false;
        return deleteRow(state, dispatch);
      },

      deleteColumn: () => ({ state, dispatch }) => {
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        if (rect.left === 0 && rect.right === rect.map.width) return false;
        return deleteColumn(state, dispatch);
      },
    };
  },
});
