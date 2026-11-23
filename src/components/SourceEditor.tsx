import { useEffect, useMemo, useRef, type RefObject } from "react";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  activeLine?: number;
  readOnly?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

interface HistoryEntry {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
}

interface PendingEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
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
  const initialValue = useRef(value);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n").length, [value]);
  const history = useRef<{ entries: HistoryEntry[]; index: number }>({
    entries: [{ value: initialValue.current, selectionStart: 0, selectionEnd: 0, inputType: "external" }],
    index: 0,
  });
  const pending = useRef<PendingEdit | null>(null);
  const onChangeRef = useRef(onChange);
  const actions = useRef({ undo: () => {}, redo: () => {} });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const resetHistory = (nextValue: string, selectionStart: number, selectionEnd: number) => {
    history.current = {
      entries: [{ value: nextValue, selectionStart, selectionEnd, inputType: "external" }],
      index: 0,
    };
  };

  const applyEntry = (index: number) => {
    const node = textarea.current;
    const entry = history.current.entries[index];
    if (!node || !entry) return;
    history.current.index = index;
    node.value = entry.value;
    node.setSelectionRange(entry.selectionStart, entry.selectionEnd);
    onChangeRef.current(entry.value);
  };

  const undo = () => {
    if (readOnly) return;
    if (history.current.index > 0) applyEntry(history.current.index - 1);
  };

  const redo = () => {
    if (readOnly) return;
    if (history.current.index < history.current.entries.length - 1) applyEntry(history.current.index + 1);
  };

  actions.current.undo = undo;
  actions.current.redo = redo;

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    const onBeforeInput = (event: Event) => {
      if (readOnly) return;
      const inputType = (event as InputEvent).inputType;
      if (inputType === "historyUndo" || inputType === "historyRedo") {
        event.preventDefault();
        if (inputType === "historyUndo") actions.current.undo();
        else actions.current.redo();
        return;
      }
      pending.current = {
        value: node.value,
        selectionStart: node.selectionStart,
        selectionEnd: node.selectionEnd,
        inputType,
      };
    };
    const onInput = () => {
      const edit = pending.current;
      pending.current = null;
      if (!edit || edit.value === node.value) return;
      const current = history.current;
      if (current.index < current.entries.length - 1) {
        current.entries = current.entries.slice(0, current.index + 1);
      }
      const previous = current.entries[current.index];
      const entry: HistoryEntry = {
        value: node.value,
        selectionStart: node.selectionStart,
        selectionEnd: node.selectionEnd,
        inputType: edit.inputType,
      };
      const collapsed = edit.selectionStart === edit.selectionEnd;
      const coalesce = collapsed && previous && previous.inputType === edit.inputType && (
        edit.inputType === "insertText"
          ? edit.selectionEnd === previous.selectionEnd
          : edit.inputType === "deleteContentBackward" || edit.inputType === "deleteContentForward"
            ? edit.selectionStart === previous.selectionStart
            : false
      );
      if (coalesce) {
        current.entries[current.index] = entry;
      } else {
        // Undo should return the caret to where this edit began, not to where
        // the previous history entry happened to leave it.
        if (previous && previous.value === edit.value) {
          previous.selectionStart = edit.selectionStart;
          previous.selectionEnd = edit.selectionEnd;
        }
        current.entries.push(entry);
      }
      current.index = current.entries.length - 1;
    };
    node.addEventListener("beforeinput", onBeforeInput);
    node.addEventListener("input", onInput);
    return () => {
      node.removeEventListener("beforeinput", onBeforeInput);
      node.removeEventListener("input", onInput);
    };
  }, [textarea, readOnly]);

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    if (node.value !== value) {
      const start = Math.min(node.selectionStart, value.length);
      const end = Math.min(node.selectionEnd, value.length);
      node.value = value;
      node.setSelectionRange(start, end);
      resetHistory(value, start, end);
    }
    if (!activeLine) return;
    const starts = value.split("\n").slice(0, activeLine - 1).map((line) => line.length + 1);
    const offset = starts.reduce((sum, length) => sum + length, 0);
    node.focus();
    node.setSelectionRange(offset, offset + (value.split("\n")[activeLine - 1]?.length ?? 0));
    const lineHeight = 22;
    node.scrollTop = Math.max(0, (activeLine - 3) * lineHeight);
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
        defaultValue={initialValue.current}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey) || event.altKey || readOnly) return;
          const key = event.key.toLowerCase();
          if (key === "z" && !event.shiftKey) {
            event.preventDefault();
            undo();
          } else if ((key === "z" && event.shiftKey) || key === "y") {
            event.preventDefault();
            redo();
          }
        }}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
        }}
      />
    </div>
  );
}
