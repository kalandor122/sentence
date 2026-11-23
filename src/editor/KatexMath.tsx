import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

export function renderLatex(latex: string, displayMode: boolean): string {
  const source = latex.trim();
  if (!source) return "";
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    const escaped = source.replace(/[<>&]/g, (character) =>
      character === "<" ? "&lt;" : character === ">" ? "&gt;" : "&amp;",
    );
    return `<span class="katex-error">${escaped}</span>`;
  }
}

function KatexNodeView({ node }: NodeViewProps) {
  const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
  const displayMode = node.type.name === "mathBlock";
  const numbered = node.attrs.numbered === true;
  const html = useMemo(() => renderLatex(latex, displayMode), [latex, displayMode]);
  return (
    <NodeViewWrapper
      as={displayMode ? "div" : "span"}
      className={displayMode ? "math-block" : "math-inline"}
      data-math-block={displayMode ? "" : undefined}
      data-math-inline={displayMode ? undefined : ""}
      data-latex={latex}
      data-numbered={displayMode ? (numbered ? "true" : "false") : undefined}
      title={latex}
    >
      <span className="katex-output" contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
}

export function katexNodeView() {
  return ReactNodeViewRenderer(KatexNodeView);
}
