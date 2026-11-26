import { Check, Code2, Columns2, Minus, Monitor, Plus } from "lucide-react";
import type { EditorMode } from "../lib/types";

interface StatusBarProps {
  words: number;
  pages: number;
  mode: EditorMode;
  branch: string;
  tracking: boolean;
  zoom: number;
  compileState: "idle" | "compiling" | "success" | "error";
  onZoomChange: (zoom: number) => void;
  onModeChange: (mode: EditorMode) => void;
}

const MODES: { value: EditorMode; label: string; shortcut: string; icon: typeof Monitor }[] = [
  { value: "visual", label: "Visual", shortcut: "Control+Alt+1", icon: Monitor },
  { value: "source", label: "Source", shortcut: "Control+Alt+2", icon: Code2 },
  { value: "split", label: "Split", shortcut: "Control+Alt+3", icon: Columns2 },
];

export default function StatusBar({
  words,
  pages,
  mode,
  branch,
  tracking,
  zoom,
  compileState,
  onZoomChange,
  onModeChange,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>{words.toLocaleString()} words</span>
      <span>{pages} {pages === 1 ? "page" : "pages"}</span>
      <span>English (US)</span>
      {tracking ? (
        <span className="status-tracking" role="status" title="New edits are recorded as tracked changes">
          Track changes on
        </span>
      ) : null}
      <span className={`compile-status ${compileState}`}>
        {compileState === "compiling" ? "Typesetting" : compileState === "success" ? <><Check size={12} /> PDF up to date</> : compileState === "error" ? "Compilation error" : "PDF not built"}
      </span>
      <span className="status-hint" title="F6 moves focus into the document, Esc leaves the editing surface">F6 to the page · Esc leaves it</span>
      <div className="status-spacer" />
      <div className="status-mode" role="group" aria-label="Editor mode">
        {MODES.map(({ value, label, shortcut, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={mode === value ? "active" : ""}
            aria-pressed={mode === value}
            aria-keyshortcuts={shortcut}
            title={`${label} (${shortcut.replace("Control", "Ctrl")})`}
            onClick={() => onModeChange(value)}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
      <span>{branch}</span>
      <div className="zoom-control" aria-label="Zoom">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onZoomChange(Math.max(70, zoom - 10))}
          aria-label="Zoom out"
        >
          <Minus size={12} />
        </button>
        <span aria-live="polite">{zoom}%</span>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onZoomChange(Math.min(150, zoom + 10))}
          aria-label="Zoom in"
        >
          <Plus size={12} />
        </button>
      </div>
    </footer>
  );
}
