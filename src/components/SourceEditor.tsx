import { useEffect, useMemo, useRef, type RefObject } from "react";
import { focusAfterElement } from "../editor/focus";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  activeLine?: number;
  readOnly?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  // One stack per file: document.tex and references.bib share this textarea, so
  // the stack of the file that was left behind must survive the tab switch.
  historyRef?: RefObject<Record<string, SourceHistory | null>>;
  historyKey?: string;
  undoBoundary?: number;
}

interface HistoryEntry {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
}

export interface SourceHistory {
  entries: HistoryEntry[];
  index: number;
  selectionStart: number;
  selectionEnd: number;
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
  historyRef,
  historyKey = "document.tex",
  undoBoundary,
}: SourceEditorProps) {
  const localTextarea = useRef<HTMLTextAreaElement>(null);
  const textarea = textareaRef ?? localTextarea;
  const initialValue = useRef(value);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n").length, [value]);
  // The source column unmounts when the view switches to visual or split, so a
  // stack kept only in this component would be dropped on the way back. Restore
  // the saved one (and the caret) when the text it edits is still the same.
  const initial = useRef<{ history: { entries: HistoryEntry[]; index: number }; selection: { start: number; end: number } | null }>(null);
  if (initial.current === null) {
    const saved = historyRef?.current?.[historyKey] ?? null;
    initial.current = saved && saved.entries[saved.index]?.value === value
      ? {
        history: { entries: saved.entries.map((entry) => ({ ...entry })), index: saved.index },
        selection: {
          start: Math.min(saved.selectionStart, value.length),
          end: Math.min(saved.selectionEnd, value.length),
        },
      }
      : {
        history: {
          entries: [{ value: initialValue.current, selectionStart: 0, selectionEnd: 0, inputType: "external" }],
          index: 0,
        },
        selection: null,
      };
  }
  const history = useRef(initial.current.history);
  const historyKeyRef = useRef(historyKey);
  const caret = useRef({ start: initial.current.selection?.start ?? 0, end: initial.current.selection?.end ?? 0 });
  const restoredSelection = useRef(initial.current.selection);
  const pending = useRef<PendingEdit | null>(null);
  // Applying the draft leaves the textarea's text in place, so a keystroke
  // after Apply would otherwise look like a continuation of the edit that was
  // just committed and one undo would remove both. Blurring the textarea (the
  // Apply button, another view) or moving through the history ends the run.
  const boundary = useRef(true);
  const onChangeRef = useRef(onChange);
  const actions = useRef({ undo: () => {}, redo: () => {} });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // A commit happened in the app (Apply, autosave): never fold the next edit
    // into the entry that was just applied.
    boundary.current = true;
  }, [undoBoundary]);

  useEffect(() => () => {
    if (historyRef) {
      historyRef.current[historyKeyRef.current] = {
        entries: history.current.entries.map((entry) => ({ ...entry })),
        index: history.current.index,
        selectionStart: caret.current.start,
        selectionEnd: caret.current.end,
      };
    }
  }, [historyRef]);

  const resetHistory = (nextValue: string, selectionStart: number, selectionEnd: number) => {
    history.current = {
      entries: [{ value: nextValue, selectionStart, selectionEnd, inputType: "external" }],
      index: 0,
    };
    boundary.current = true;
  };

  const applyEntry = (index: number) => {
    const node = textarea.current;
    const entry = history.current.entries[index];
    if (!node || !entry) return;
    history.current.index = index;
    boundary.current = true;
    node.value = entry.value;
    node.setSelectionRange(entry.selectionStart, entry.selectionEnd);
    caret.current = { start: entry.selectionStart, end: entry.selectionEnd };
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
      caret.current = { start: node.selectionStart, end: node.selectionEnd };
      if (!edit) {
        // The text was replaced without a beforeinput of our own (paste via the
        // DOM, autofill, script): that is not an edit step, so start over.
        resetHistory(node.value, node.selectionStart, node.selectionEnd);
        return;
      }
      if (edit.value === node.value) return;
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
      const coalesce = !boundary.current && collapsed && previous && previous.inputType === edit.inputType && (
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
      boundary.current = false;
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
    if (historyKeyRef.current !== historyKey) {
      // Switching file tabs swaps the text without an edit, so keep the stack
      // of the file being left and bring back the other file's own stack.
      if (historyRef) {
        historyRef.current[historyKeyRef.current] = {
          entries: history.current.entries.map((entry) => ({ ...entry })),
          index: history.current.index,
          selectionStart: node.selectionStart,
          selectionEnd: node.selectionEnd,
        };
      }
      const saved = historyRef?.current?.[historyKey] ?? null;
      const entry = saved?.entries[saved.index];
      const restored = saved && entry && entry.value === value ? saved : null;
      historyKeyRef.current = historyKey;
      const start = Math.min(restored?.selectionStart ?? node.selectionStart, value.length);
      const end = Math.min(restored?.selectionEnd ?? node.selectionEnd, value.length);
      node.value = value;
      node.setSelectionRange(start, end);
      caret.current = { start, end };
      restoredSelection.current = null;
      boundary.current = true;
      history.current = restored
        ? { entries: restored.entries.map((item) => ({ ...item })), index: restored.index }
        : { entries: [{ value, selectionStart: start, selectionEnd: end, inputType: "external" }], index: 0 };
    } else if (node.value !== value) {
      const start = Math.min(node.selectionStart, value.length);
      const end = Math.min(node.selectionEnd, value.length);
      node.value = value;
      node.setSelectionRange(start, end);
      caret.current = { start, end };
      restoredSelection.current = null;
      resetHistory(value, start, end);
    } else if (restoredSelection.current) {
      // Coming back from another view: put the caret where it was left so the
      // next keystroke (or undo) continues in place instead of at the start.
      const { start, end } = restoredSelection.current;
      restoredSelection.current = null;
      node.setSelectionRange(start, end);
    }
    if (!activeLine) return;
    const starts = value.split("\n").slice(0, activeLine - 1).map((line) => line.length + 1);
    const offset = starts.reduce((sum, length) => sum + length, 0);
    const length = value.split("\n")[activeLine - 1]?.length ?? 0;
    node.focus();
    node.setSelectionRange(offset, offset + length);
    caret.current = { start: offset, end: offset + length };
    const lineHeight = 22;
    node.scrollTop = Math.max(0, (activeLine - 3) * lineHeight);
  }, [activeLine, historyKey, value]);

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
        onSelect={(event) => {
          const node = event.currentTarget;
          caret.current = { start: node.selectionStart, end: node.selectionEnd };
        }}
        onBlur={() => {
          boundary.current = true;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (focusAfterElement(event.currentTarget)) event.preventDefault();
            return;
          }
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
