import { ArrowUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { paragraphSpacingAt, setParagraphSpacing } from "../editor/paragraphSpacing";

/**
 * Word's Paragraph → Spacing, for the paragraphs the cursor touches.
 * A compact popover so the ribbon does not overflow at 1280px.
 */
export default function ParagraphSpacingControl({
  editor,
  editorVersion,
}: {
  editor: Editor | null;
  editorVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Reflect the caret's paragraph whenever the selection moves.
  useEffect(() => {
    if (!editor || !open) return;
    const current = paragraphSpacingAt(editor);
    setBefore(current.before);
    setAfter(current.after);
  }, [editor, editorVersion, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || button.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const clamp = (value: number) => Math.max(0, Math.min(96, value));

  return (
    <div className="spacing-control" ref={panel}>
      <button
        ref={button}
        type="button"
        className="ribbon-icon-button"
        aria-label="Paragraph spacing"
        title="Paragraph spacing"
        aria-expanded={open}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 230) });
          setOpen((current) => !current);
        }}
        disabled={!editor}
      >
        <ArrowUpDown size={15} />
      </button>
      {open
        ? createPortal(
            <div
              className="spacing-panel"
              role="dialog"
              aria-label="Paragraph spacing"
              ref={panel}
              style={{ position: "fixed", top: anchor.top, left: anchor.left }}
            >
          <strong>This paragraph</strong>
          <label>
            <span>Before (pt)</span>
            <input
              type="number"
              min={0}
              max={96}
              step={1}
              value={before}
              onChange={(event) => {
                const value = clamp(Number(event.target.value) || 0);
                setBefore(value);
                setParagraphSpacing(editor, { spaceBefore: value || null });
              }}
            />
          </label>
          <label>
            <span>After (pt)</span>
            <input
              type="number"
              min={0}
              max={96}
              step={1}
              value={after}
              onChange={(event) => {
                const value = clamp(Number(event.target.value) || 0);
                setAfter(value);
                setParagraphSpacing(editor, { spaceAfter: value || null });
              }}
            />
          </label>
              <p className="spacing-hint">
                Applies to every paragraph you have selected. Adjacent spacing collapses, like Word.
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
