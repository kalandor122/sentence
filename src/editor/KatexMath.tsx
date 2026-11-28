import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

// KaTeX colours unrecognised commands with errorColor without emitting a
// katex-error span. Render with a sentinel to detect those cases too.
const ERROR_SENTINEL = "__sentence_katex_error__";

// An align/gather body is only valid inside its own environment, so wrap it
// before handing it to KaTeX as well. \label is a cross-reference target for
// the LaTeX compiler, which KaTeX does not implement, so it stays in the
// stored source but is dropped from the render.
function mathSource(latex: string, environment: string): string {
  const source = latex.replace(/\\label\s*\{[^{}]*\}/g, "").trim();
  if (!source || !environment) return source;
  return `\\begin{${environment}}${source}\\end{${environment}}`;
}

export function renderLatex(latex: string, displayMode: boolean, environment = ""): string {
  const source = mathSource(latex, environment);
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

// Math mode cannot cross a paragraph break: the blank line ends the paragraph
// before the closing delimiter, so the formula would not compile.
export function latexHasBlankLine(latex: string, environment = ""): boolean {
  return /\r?\n[ \t]*\r?\n/.test(mathSource(latex, environment));
}

// An inline formula is exported as \(...\) on one line, so an unescaped % that
// reaches the end of the source comments out the closing delimiter and the
// formula never ends. A comment that stops at a line break is harmless.
export function latexHasUnclosedComment(latex: string): boolean {
  const source = mathSource(latex, "");
  const lastLine = source.slice(source.lastIndexOf("\n") + 1);
  for (let index = 0; index < lastLine.length; index++) {
    if (lastLine[index] !== "%") continue;
    let backslashes = 0;
    for (let before = index - 1; before >= 0 && lastLine[before] === "\\"; before--) backslashes++;
    if (backslashes % 2 === 0) return true;
  }
  return false;
}

export function latexHasError(latex: string, displayMode: boolean, environment = ""): boolean {
  const source = mathSource(latex, environment);
  if (!source) return false;
  if (latexHasBlankLine(latex, environment)) return true;
  if (!displayMode && latexHasUnclosedComment(latex)) return true;
  try {
    const html = katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: false,
      errorColor: ERROR_SENTINEL,
    });
    return html.includes(ERROR_SENTINEL);
  } catch {
    return true;
  }
}

function KatexNodeView({ node }: NodeViewProps) {
  const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
  const displayMode = node.type.name === "mathBlock";
  const numbered = node.attrs.numbered === true;
  const environment = typeof node.attrs.environment === "string" ? node.attrs.environment : "";
  const textAlign =
    displayMode && typeof node.attrs.textAlign === "string" ? node.attrs.textAlign : "";
  const html = useMemo(
    () => renderLatex(latex, displayMode, environment),
    [environment, latex, displayMode],
  );
  return (
    <NodeViewWrapper
      as={displayMode ? "div" : "span"}
      className={displayMode ? "math-block" : "math-inline"}
      data-math-block={displayMode ? "" : undefined}
      data-math-inline={displayMode ? undefined : ""}
      data-latex={latex}
      data-numbered={displayMode ? (numbered ? "true" : "false") : undefined}
      data-math-environment={environment || undefined}
      data-math-align={textAlign || undefined}
      title={latex}
      style={textAlign ? { textAlign } : undefined}
    >
      <span className="katex-output" contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
}

export function katexNodeView() {
  return ReactNodeViewRenderer(KatexNodeView);
}
