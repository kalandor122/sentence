import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns3,
  Merge,
  Rows3,
  Split,
  Table2,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import IconButton from "./IconButton";

interface TableToolbarProps {
  editor: Editor | null;
}

type CellAlign = "left" | "center" | "right";

interface TableActionProps {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

function TableAction({ label, icon, disabled, active, onClick }: TableActionProps) {
  return (
    <button
      type="button"
      className="table-toolbar-action"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor selection while a ribbon control is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function TableToolbar({ editor }: TableToolbarProps) {
  if (!editor || !editor.isEditable || !editor.isActive("table")) return null;

  const { $from } = editor.state.selection;
  let table: ReturnType<typeof $from.node> | null = null;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      table = node;
      break;
    }
  }
  const headerRow = table?.firstChild?.firstChild?.type.name === "tableHeader";
  const cellAttributes = editor.getAttributes(editor.isActive("tableHeader") ? "tableHeader" : "tableCell");
  const align: CellAlign =
    cellAttributes.align === "center" || cellAttributes.align === "right" ? cellAttributes.align : "left";
  const currentCaption = editor.getAttributes("table").caption;
  const caption = typeof currentCaption === "string" ? currentCaption : "";

  return (
    <div className="table-toolbar" role="toolbar" aria-label="Table tools">
      <span className="table-toolbar-title" aria-hidden="true">Table</span>
      <div className="table-toolbar-group" role="group" aria-label="Rows">
        <TableAction label="Add row above" icon={<Rows3 size={14} />} disabled={!editor.can().addRowBefore()} onClick={() => editor.chain().focus().addRowBefore().run()} />
        <TableAction label="Add row below" icon={<Rows3 size={14} />} disabled={!editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()} />
        <TableAction label="Delete row" icon={<Rows3 size={14} />} disabled={!editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()} />
      </div>
      <div className="table-toolbar-group" role="group" aria-label="Columns">
        <TableAction label="Add column left" icon={<Columns3 size={14} />} disabled={!editor.can().addColumnBefore()} onClick={() => editor.chain().focus().addColumnBefore().run()} />
        <TableAction label="Add column right" icon={<Columns3 size={14} />} disabled={!editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()} />
        <TableAction label="Delete column" icon={<Columns3 size={14} />} disabled={!editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()} />
      </div>
      <div className="table-toolbar-group" role="group" aria-label="Table structure">
        <TableAction label="Header row" icon={<Table2 size={14} />} active={headerRow} onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
        <TableAction label="Merge cells" icon={<Merge size={14} />} disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()} />
        <TableAction label="Split cell" icon={<Split size={14} />} disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()} />
      </div>
      <div className="table-toolbar-group" role="group" aria-label="Cell alignment">
        <IconButton label="Align cell left" compact active={align === "left"} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setCellAttribute("align", "left").run()}>
          <AlignLeft size={15} />
        </IconButton>
        <IconButton label="Align cell center" compact active={align === "center"} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setCellAttribute("align", "center").run()}>
          <AlignCenter size={15} />
        </IconButton>
        <IconButton label="Align cell right" compact active={align === "right"} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setCellAttribute("align", "right").run()}>
          <AlignRight size={15} />
        </IconButton>
      </div>
      <div className="table-toolbar-group" role="group" aria-label="Table options">
        <label className="table-toolbar-caption">
          Caption
          <input
            aria-label="Table caption"
            value={caption}
            placeholder="Optional caption"
            onChange={(event) => editor.commands.updateAttributes("table", { caption: event.target.value })}
          />
        </label>
        <IconButton label="Delete table" compact className="danger" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}
