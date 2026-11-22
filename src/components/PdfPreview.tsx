import { Download, ExternalLink, FileText, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { CompileResult } from "../lib/types";

interface PdfPreviewProps {
  compileResult: CompileResult | null;
  compiling: boolean;
  onCompile: () => void;
  onExport: () => void;
}

function base64ToBlobUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export default function PdfPreview({
  compileResult,
  compiling,
  onCompile,
  onExport,
}: PdfPreviewProps) {
  const pdfUrl = useMemo(
    () => (compileResult?.pdfBase64 ? base64ToBlobUrl(compileResult.pdfBase64) : null),
    [compileResult?.pdfBase64],
  );

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (compiling) {
    return (
      <section className="preview-state">
        <LoaderCircle className="spin" size={30} />
        <h2>Typesetting your document</h2>
        <p>The first build may download LaTeX packages. Future builds use the local cache.</p>
      </section>
    );
  }

  if (!pdfUrl) {
    const errors = compileResult?.diagnostics.filter((item) => item.severity === "error") ?? [];
    return (
      <section className="preview-state">
        {errors.length > 0 ? <TriangleAlert size={30} /> : <FileText size={30} />}
        <h2>{errors.length > 0 ? "The document needs attention" : "Preview is ready"}</h2>
        <p>
          {errors[0]?.message ??
            "Compile to inspect the exact PDF that Sentence produces from your LaTeX source."}
        </p>
        <button className="primary-button" type="button" onClick={onCompile}>
          Compile document
        </button>
      </section>
    );
  }

  return (
    <section className="pdf-preview-pane">
      <div className="preview-toolbar">
        <span>
          PDF preview
          {compileResult ? <small>{compileResult.durationMs} ms</small> : null}
        </span>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onExport} title="Export PDF">
            <Download size={16} />
          </button>
          <a className="icon-button" href={pdfUrl} target="_blank" rel="noreferrer" title="Open PDF">
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
      <iframe title="Compiled PDF preview" src={pdfUrl} />
    </section>
  );
}
