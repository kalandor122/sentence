import type { Editor } from "@tiptap/react";

interface ImageToolbarProps {
  editor: Editor | null;
}

// A figure caption is edited here while the image is selected; the same text
// is shown under the figure in the page and written as \caption in LaTeX.
export default function ImageToolbar({ editor }: ImageToolbarProps) {
  if (!editor || !editor.isEditable || !editor.isActive("image")) return null;

  const currentCaption = editor.getAttributes("image").caption;
  const caption = typeof currentCaption === "string" ? currentCaption : "";

  return (
    <div className="table-toolbar" role="toolbar" aria-label="Image tools">
      <span className="table-toolbar-title" aria-hidden="true">Image</span>
      <div className="table-toolbar-group" role="group" aria-label="Image options">
        <label className="table-toolbar-caption">
          Caption
          <input
            aria-label="Figure caption"
            value={caption}
            placeholder="Optional caption"
            onChange={(event) => editor.commands.updateAttributes("image", { caption: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
