import { useEffect, useMemo, useRef, type RefObject } from "react";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  activeLine?: number;
  readOnly?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function SourceEditor({
  value,
  onChange,
  activeLine,
  readOnly = false,
  textareaRef,
}: SourceEditorProps) {
  const localTextarea = useRef<HTMLTextAreaElement>(null);
  const textarea = textareaRef ?? localTextarea;
  const gutter = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n").length, [value]);

  useEffect(() => {
    if (!activeLine || !textarea.current) return;
    const starts = value.split("\n").slice(0, activeLine - 1).map((line) => line.length + 1);
    const offset = starts.reduce((sum, length) => sum + length, 0);
    textarea.current.focus();
    textarea.current.setSelectionRange(offset, offset + (value.split("\n")[activeLine - 1]?.length ?? 0));
    const lineHeight = 22;
    textarea.current.scrollTop = Math.max(0, (activeLine - 3) * lineHeight);
  }, [activeLine, value]);

  return (
    <div className="source-editor">
      <div className="source-gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className={activeLine === index + 1 ? "active" : ""}>
            {index + 1}
          </span>
        ))}
      </div>
      <textarea
        ref={textarea}
        aria-label="LaTeX source"
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
        }}
      />
    </div>
  );
}
