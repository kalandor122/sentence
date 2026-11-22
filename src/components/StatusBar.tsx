import { Check, Code2, Minus, Plus } from "lucide-react";

interface StatusBarProps {
  words: number;
  pages: number;
  mode: string;
  branch: string;
  zoom: number;
  compileState: "idle" | "compiling" | "success" | "error";
  onZoomChange: (zoom: number) => void;
}

export default function StatusBar({
  words,
  pages,
  mode,
  branch,
  zoom,
  compileState,
  onZoomChange,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>{words.toLocaleString()} words</span>
      <span>{pages} {pages === 1 ? "page" : "pages"}</span>
      <span>English (US)</span>
      <span className={`compile-status ${compileState}`}>
        {compileState === "compiling" ? "Typesetting" : compileState === "success" ? <><Check size={12} /> PDF up to date</> : compileState === "error" ? "Compilation error" : "PDF not built"}
      </span>
      <div className="status-spacer" />
      <span className="status-mode"><Code2 size={12} /> {mode}</span>
      <span>{branch}</span>
      <div className="zoom-control" aria-label="Zoom">
        <button type="button" onClick={() => onZoomChange(Math.max(70, zoom - 10))} aria-label="Zoom out"><Minus size={12} /></button>
        <span>{zoom}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(150, zoom + 10))} aria-label="Zoom in"><Plus size={12} /></button>
      </div>
    </footer>
  );
}
