import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { latexHasError, renderLatex } from "../editor/KatexMath";

interface MathDialogProps {
  open: boolean;
  display: boolean;
  environment?: string;
  initialLatex?: string;
  onClose: () => void;
  onSubmit: (latex: string) => void;
}

const TEMPLATES: Array<{ label: string; snippet: string }> = [
  { label: "a⁄b", snippet: "\\frac{a}{b}" },
  { label: "√x", snippet: "\\sqrt{x}" },
  { label: "x²", snippet: "^{2}" },
  { label: "xₙ", snippet: "_{n}" },
  { label: "∫", snippet: "\\int_{a}^{b}" },
  { label: "Σ", snippet: "\\sum_{i=1}^{n}" },
  { label: "α", snippet: "\\alpha" },
  { label: "β", snippet: "\\beta" },
  { label: "π", snippet: "\\pi" },
  { label: "λ", snippet: "\\lambda" },
  { label: "∞", snippet: "\\infty" },
  { label: "≤", snippet: "\\leq" },
  { label: "≥", snippet: "\\geq" },
  { label: "≈", snippet: "\\approx" },
  { label: "×", snippet: "\\times" },
  { label: "±", snippet: "\\pm" },
];

export default function MathDialog({
  open,
  display,
  environment = "",
  initialLatex = "",
  onClose,
  onSubmit,
}: MathDialogProps) {
  const [latex, setLatex] = useState(initialLatex);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) setLatex(initialLatex);
  }, [initialLatex, open]);

  const html = useMemo(() => renderLatex(latex, display, environment), [display, environment, latex]);
  const invalid = useMemo(
    () =>
      latex.trim().length > 0 &&
      (html.includes("katex-error") || latexHasError(latex, display, environment)),
    [display, environment, html, latex],
  );
  const editing = initialLatex.trim().length > 0;

  const insertSnippet = (snippet: string) => {
    const input = inputRef.current;
    if (!input) {
      setLatex((current) => current + snippet);
      return;
    }
    const start = input.selectionStart ?? latex.length;
    const end = input.selectionEnd ?? latex.length;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + snippet.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const submit = () => {
    if (!latex.trim() || invalid) return;
    onSubmit(latex.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      title={
        display
          ? editing
            ? "Edit equation"
            : "Insert equation"
          : editing
            ? "Edit inline equation"
            : "Insert inline equation"
      }
      description="Type LaTeX and see the result. Click an equation in the document to edit it later."
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="button" disabled={!latex.trim() || invalid} onClick={submit}>
            {editing ? "Update" : "Insert"}
          </button>
        </>
      }
    >
      <div className="math-toolbar">
        {TEMPLATES.map((template) => (
          <button
            key={template.label}
            type="button"
            className="math-template"
            title={template.snippet}
            onClick={() => insertSnippet(template.snippet)}
          >
            {template.label}
          </button>
        ))}
      </div>
      <label className="dialog-field">
        <span>LaTeX source</span>
        <textarea
          ref={inputRef}
          autoFocus
          rows={3}
          value={latex}
          placeholder={"\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"}
          aria-invalid={invalid}
          onChange={(event) => setLatex(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
          }}
        />
      </label>
      <div className="math-preview">
        {html ? (
          <span className={invalid ? "math-preview-invalid" : ""} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="math-preview-empty">Preview</span>
        )}
      </div>
    </Modal>
  );
}
