import {
  CheckCircle2,
  Circle,
  Clipboard,
  FileArchive,
  FolderOpen,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import type { ArxivPackageResult, ProjectSettings } from "../lib/types";
import Modal from "./Modal";

interface ArxivExportDialogProps {
  open: boolean;
  settings: ProjectSettings;
  hasCitations: boolean;
  busy: boolean;
  error: string | null;
  result: ArxivPackageResult | null;
  onClose: () => void;
  onOpenProperties: () => void;
  onExport: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArxivExportDialog({
  open,
  settings,
  hasCitations,
  busy,
  error,
  result,
  onClose,
  onOpenProperties,
  onExport,
}: ArxivExportDialogProps) {
  const [copied, setCopied] = useState(false);
  const checks = [
    { label: "Paper title", ready: Boolean(settings.title.trim()) },
    { label: "Author list", ready: Boolean(settings.author.trim()) },
    { label: "Abstract", ready: Boolean(settings.abstract.trim()) },
    { label: "Primary arXiv category", ready: Boolean(settings.primaryCategory.trim()) },
  ];
  const ready = checks.every((check) => check.ready);

  return (
    <Modal
      open={open}
      title="arXiv submission package"
      description="Build a self-contained source archive with the LaTeX manuscript, bibliography, figures, and compiled PDF."
      wide
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onOpenProperties}>Edit paper properties</button>
          <button className="primary-button" type="button" disabled={busy || !ready} onClick={onExport}>
            {busy ? <LoaderCircle className="spin" size={15} /> : <FileArchive size={15} />}
            {busy ? "Compiling and packaging" : "Build and export ZIP"}
          </button>
        </>
      }
    >
      <div className="arxiv-checks">
        {checks.map((check) => (
          <span key={check.label} className={check.ready ? "ready" : "missing"}>
            {check.ready ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {check.label}
          </span>
        ))}
      </div>

      <div className="arxiv-package-note">
        <FileArchive size={15} />
        <span>
          Package contents: <code>document.tex</code>, compiled PDF
          {hasCitations ? ", BibTeX sources and .bbl" : ""}, and arXiv-compatible figures.
        </span>
      </div>

      {!ready ? (
        <div className="arxiv-guidance">
          Complete the missing fields before exporting. The primary category is written into the TeX source as submission metadata.
        </div>
      ) : null}

      {error ? (
        <div className="auth-message">
          <TriangleAlert size={14} />
          <span style={{ whiteSpace: "pre-wrap" }}>{error}</span>
        </div>
      ) : null}

      {result ? (
        <section className="arxiv-result">
          <header>
            <div>
              <span className="eyebrow">Package ready</span>
              <strong>{result.path.split(/[\\/]/).pop()}</strong>
              <small>{formatBytes(result.totalBytes)} · {result.files.length} files</small>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(result.path);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Clipboard size={14} />
              {copied ? "Path copied" : "Copy path"}
            </button>
          </header>
          <div className="arxiv-file-list">
            {result.files.map((file) => <code key={file}>{file}</code>)}
          </div>
          {result.warnings.length > 0 ? (
            <div className="arxiv-warnings">
              {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : (
            <p className="arxiv-clean"><CheckCircle2 size={14} /> No packaging warnings.</p>
          )}
          <button className="secondary-button" type="button" onClick={onClose}>
            <FolderOpen size={14} /> Done
          </button>
        </section>
      ) : null}
    </Modal>
  );
}
