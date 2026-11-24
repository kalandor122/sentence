import { Table } from "@tiptap/extension-table";
import { addRow, isInTable, selectedRect } from "@tiptap/pm/tables";

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
    };
  },
});
