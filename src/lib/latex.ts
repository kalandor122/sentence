import { pageGeometry } from "../editor/pagination";
import type {
  DocumentMark,
  DocumentNode,
  ProjectSettings,
  SentenceDocument,
} from "./types";
import {
  COLOR_BY_LATEX,
  colorLatex,
  FONT_BY_LATEX,
  fontLatex,
  HIGHLIGHT_BY_LATEX,
  highlightLatex,
  SIZE_PX,
} from "./textStyles";

const SPECIAL_CHARACTERS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

// A non-breaking space is a typed `~` in LaTeX; a visible tilde stays the
// escaped `\textasciitilde{}`. The escape pass runs first so the `~` it inserts
// for a non-breaking space is not escaped again.
export function escapeLatex(value: string): string {
  return value
    .replace(/[\\&%$#_{}~^]/g, (character) => SPECIAL_CHARACTERS[character])
    .replace(/\u00a0/g, "~");
}

// An address goes into \href's first argument, which hyperref reads as a URL,
// not as running text. The text escaper's replacements for ~ ^ $ \ then end up
// inside the PDF link annotation instead of the address, so only the characters
// that would break the argument are escaped. A backslash still starts a control
// sequence; LaTeX's expandable \@backslashchar is spelled via \csname so it
// works outside \makeatletter and hyperref turns it back into one character.
const URL_ESCAPES: Record<string, string> = {
  "\\": "\\csname @backslashchar\\endcsname ",
  "&": "\\&",
  "%": "\\%",
  "#": "\\#",
  "_": "\\_",
  "{": "\\{",
  "}": "\\}",
};

function escapeLatexUrl(value: string): string {
  return value.replace(/[\\&%#_{}]/g, (character) => URL_ESCAPES[character]);
}

// Citation keys and cross-reference labels are written verbatim into a `{...}`
// argument and cannot be escaped there: a `\{` would become part of the key.
// So anything that would end the group or break the line has to be refused.
// `~` is an active character in the \csname lookup LaTeX uses for `\ref` and
// `\cite`, so it fails there even though it looks harmless.
const REFERENCE_TARGET_PATTERN = /^[^\s{},%\\#()~]+$/;

export function isLatexReferenceTarget(value: string): boolean {
  return REFERENCE_TARGET_PATTERN.test(value);
}

// One \cite may name several keys separated by commas, so a citation is valid
// when every key in the list is. An empty key still breaks the list.
export function isLatexCitationTarget(value: string): boolean {
  const keys = value.split(",").map((key) => key.trim());
  return keys.length > 0 && keys.every((key) => isLatexReferenceTarget(key));
}

export function citationKeys(value: string): string[] {
  return value
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

// Keys still arrive from imported LaTeX or a hand-edited .bib, so the exporter
// removes the characters that would break the command instead of trusting them.
export function latexReferenceTarget(value: string): string {
  return value.replace(/[\s{},%\\#()~]+/g, "");
}

// The comma is the separator between keys in a multi-key citation, so it has to
// survive the cleaning that each individual key gets.
export function latexCitationKeys(value: string): string {
  return citationKeys(value).map(latexReferenceTarget).join(",");
}

export function imageAssetPath(fileName: string): string {
  const safeName = fileName
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "");
  return `assets/images/${safeName || "image.png"}`;
}

// LaTeX addresses a graphic by its path alone, so two files that happen to
// share a name must not share a path: after a source round trip both figures
// would resolve to whichever picture was written last.
export function uniqueImageAssetPath(fileName: string, used: Iterable<string>): string {
  const taken = new Set(used);
  const candidate = imageAssetPath(fileName);
  if (!taken.has(candidate)) return candidate;
  const extension = /\.[a-z0-9]+$/i.exec(candidate)?.[0] ?? "";
  const stem = extension ? candidate.slice(0, -extension.length) : candidate;
  let suffix = 2;
  while (taken.has(`${stem}-${suffix}${extension}`)) suffix += 1;
  return `${stem}-${suffix}${extension}`;
}

function imageSourcePath(src: string, alt: string): string {
  if (!/^data:/i.test(src)) return src;
  const mime = /^data:image\/(png|jpe?g);/i.exec(src)?.[1]?.toLowerCase() ?? "png";
  const extension = mime === "jpeg" ? "jpg" : mime;
  const name = alt.trim() || "image";
  return imageAssetPath(/\.[a-z0-9]+$/i.test(name) ? name : `${name}.${extension}`);
}

function nodesContainCitations(nodes: DocumentNode[] | undefined): boolean {
  return (nodes ?? []).some(
    (node) => node.type === "citation" || nodesContainCitations(node.content),
  );
}

function containsMark(nodes: DocumentNode[] | undefined, type: string): boolean {
  return (nodes ?? []).some(
    (node) =>
      (node.marks ?? []).some((mark) => mark.type === type) ||
      containsMark(node.content, type),
  );
}

// The preview renders colour commands inside a formula, so the export has to
// load xcolor whenever one appears in math as well as in a text mark.
const MATH_COLOR_COMMAND =
  /\\(?:textcolor|colorbox|fcolorbox|color|pagecolor|definecolor)(?![a-zA-Z])/;

function nodesContainMathColor(nodes: DocumentNode[] | undefined): boolean {
  return (nodes ?? []).some((node) => {
    if (node.type === "mathInline" || node.type === "mathBlock") {
      return MATH_COLOR_COMMAND.test(attribute(node, "latex") ?? "");
    }
    return nodesContainMathColor(node.content);
  });
}

// \captionof comes from the caption package, so only a picture captioned
// inside a table cell makes the export load it.
function hasCaptionedImageInCell(nodes: DocumentNode[] | undefined): boolean {
  return (nodes ?? []).some((node) => {
    if (node.type === "table") {
      return (node.content ?? []).some((row) =>
        (row.content ?? []).some((cell) =>
          (cell.content ?? []).some(
            (child) => child.type === "image" && (attribute(child, "caption") ?? "").trim() !== "",
          ),
        ),
      );
    }
    return hasCaptionedImageInCell(node.content);
  });
}

export function hasCitations(document: SentenceDocument): boolean {
  return nodesContainCitations(document.content);
}

// LaTeX refers to images by project-relative path, which the browser cannot
// load on its own. The visual document already holds a renderable source (a
// data URL or an asset URL) for every image it shows, so carry that source
// across a source synchronization instead of replacing it with the path.
export function restoreImageSources(
  document: SentenceDocument,
  previous: SentenceDocument,
): SentenceDocument {
  const sources = new Map<
    string,
    { src: string; path: string | null; naturalWidth: number; naturalHeight: number }
  >();
  const collect = (nodes: DocumentNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "image" || node.type === "inlineImage") {
        const src = attribute(node, "src");
        const path = attribute(node, "path");
        if (src) {
          const size = naturalImageSize(node);
          for (const key of [path, src]) {
            if (key) {
              sources.set(key, {
                src,
                path,
                naturalWidth: size?.width ?? 0,
                naturalHeight: size?.height ?? 0,
              });
            }
          }
        }
      }
      collect(node.content);
    }
  };
  collect(previous.content);
  if (sources.size === 0) return document;
  const restore = (nodes: DocumentNode[]): DocumentNode[] =>
    nodes.map((node) => {
      const restored = node.content ? { ...node, content: restore(node.content) } : node;
      if (node.type !== "image" && node.type !== "inlineImage") return restored;
      const key = attribute(node, "path") ?? attribute(node, "src");
      const source = key ? sources.get(key) : undefined;
      if (!source) return restored;
      return {
        ...restored,
        attrs: {
          ...node.attrs,
          src: source.src,
          ...(source.path ? { path: source.path } : {}),
          // The size measured when the file was inserted is not in the LaTeX,
          // so a source sync has to carry it over or the figure would be
          // re-exported at a different size than the page shows.
          ...(source.naturalWidth > 0 && source.naturalHeight > 0
            ? { naturalWidth: source.naturalWidth, naturalHeight: source.naturalHeight }
            : {}),
        },
      };
    });
  return { ...document, content: restore(document.content) };
}

function plainText(nodes: DocumentNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => node.text ?? plainText(node.content))
    .join("")
    .trim();
}

// Verbatim prints what it holds: `%`, `_`, `&` and `\` are literal there, so the
// text is written as typed. Escaping it would add backslashes the PDF shows.
function verbatimText(nodes: DocumentNode[] | undefined): string {
  return (nodes ?? []).map((node) => node.text ?? verbatimText(node.content)).join("");
}

function authorToLatex(author: string): string {
  return author
    .split(/\r?\n|;/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map(escapeLatex)
    .join(" \\and ");
}

function paragraphTextToLatex(value: string): string {
  return value
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => escapeLatex(paragraph.replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .join("\n\\par\n");
}

function metadataComment(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function attribute(node: DocumentNode, name: string): string | null {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : null;
}

function applyMarks(text: string, marks: DocumentMark[] | undefined): string {
  let rendered = escapeLatex(text);
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        rendered = `\\textbf{${rendered}}`;
        break;
      case "italic":
        rendered = `\\textit{${rendered}}`;
        break;
      case "underline":
        rendered = `\\underline{${rendered}}`;
        break;
      case "strike":
        rendered = `\\sout{${rendered}}`;
        break;
      case "code":
      case "inlineCode":
        rendered = `\\texttt{${rendered}}`;
        break;
      case "superscript":
        rendered = `\\textsuperscript{${rendered}}`;
        break;
      case "subscript":
        rendered = `\\textsubscript{${rendered}}`;
        break;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
        rendered = `\\href{${escapeLatexUrl(href)}}{${rendered}}`;
        break;
      }
      case "fontFamily": {
        const family = typeof mark.attrs?.family === "string" ? mark.attrs.family : "";
        const decl = fontLatex(family);
        if (decl) rendered = `{\\${decl} ${rendered}}`;
        break;
      }
      case "fontSize": {
        const size = typeof mark.attrs?.size === "string" ? mark.attrs.size : "";
        if (size && size !== "normal" && size in SIZE_PX) {
          rendered = `{\\${size} ${rendered}}`;
        }
        break;
      }
      case "color": {
        const hex = typeof mark.attrs?.color === "string" ? mark.attrs.color : "";
        const name = colorLatex(hex);
        if (name) rendered = `{\\color{${name}} ${rendered}}`;
        break;
      }
      case "highlight": {
        const hex = typeof mark.attrs?.color === "string" ? mark.attrs.color : "";
        const name = highlightLatex(hex);
        if (name) rendered = `\\colorbox{${name}}{${rendered}}`;
        break;
      }
      default:
        break;
    }
  }
  return rendered;
}

// \footnote is a fragile command: inside a heading it also runs while the title
// is written to the .toc, where the unexpanded text breaks \@sect with an
// "extra }". \protect keeps it working in that moving argument, and the import
// below accepts the protected form so the source round-trips.
function inlineContent(
  nodes: DocumentNode[] | undefined,
  settings: ProjectSettings,
  protectFragile = false,
): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "text") {
        return applyMarks(node.text ?? "", node.marks);
      }
      if (node.type === "hardBreak") {
        return "\\\\";
      }
      if (node.type === "mathInline") {
        return `\\(${attribute(node, "latex") ?? ""}\\)`;
      }
      if (node.type === "citation") {
        return `\\cite{${latexCitationKeys(attribute(node, "key") ?? "")}}`;
      }
      if (node.type === "footnote") {
        // The note is a plain-text attribute, so inline markup it held when the
        // source was imported (for example \textit inside \footnote) is still
        // written as characters. Reading them through the inline parser keeps
        // that markup as LaTeX instead of escaping it into visible
        // \textbackslash{} command names.
        const note = inlineContent(parseInline(attribute(node, "text") ?? "").content, settings);
        return `${protectFragile ? "\\protect" : ""}\\footnote{${note}}`;
      }
      if (node.type === "crossReference") {
        return `\\ref{${latexReferenceTarget(attribute(node, "label") ?? "")}}`;
      }
      if (node.type === "inlineImage") {
        return inlineImageToLatex(node, settings, true);
      }
      return inlineContent(node.content, settings, protectFragile);
    })
    .join("");
}

// Inline images have no caption and no float, so they also work inside a
// tabular cell where a figure environment would either break or escape it.
// A block image moved into a cell keeps the figure's own sizing (`inline` off).
function inlineImageToLatex(
  node: DocumentNode,
  settings: ProjectSettings,
  inline: boolean,
  columns = 0,
): string {
  const src = attribute(node, "path") ?? attribute(node, "src") ?? "";
  const alt = attribute(node, "alt") ?? "";
  const filename = imageSourcePath(src, alt);
  const options = imageOptions(node, settings, inline, columns) ?? (inline ? "height=1.5em" : null);
  const image = options
    ? `\\includegraphics[${options}]{${escapeLatex(filename)}}`
    : `\\includegraphics{${escapeLatex(filename)}}`;
  // The alt text is a comment so it survives source round trips without
  // adding a caption or a paragraph break to the surrounding text.
  return alt ? `${image}% Sentence alt: ${metadataComment(alt)}\n` : image;
}

// A figure cannot float inside a tabular cell and \caption only works in a
// float, so a captioned picture in a cell becomes a minipage as wide as the
// graphic with a \captionof, which the caption package provides for exactly
// this case. Dropping the caption would leave it visible in the page and
// missing from the PDF with no warning.
function imageInCellToLatex(
  node: DocumentNode,
  settings: ProjectSettings,
  columns: number,
): string {
  const graphic = inlineImageToLatex(node, settings, false, columns);
  const caption = attribute(node, "caption") ?? "";
  if (!caption.trim()) return graphic;
  const options = imageOptions(node, settings, false, columns) ?? "";
  const width = options.match(/(?:^|,)width=([^,]+)/)?.[1] ?? "\\linewidth";
  return [
    `\\begin{minipage}{${width}}`,
    "\\centering",
    graphic.trimEnd(),
    `\\captionof{figure}{${escapeLatex(caption)}}`,
    "\\end{minipage}",
  ].join("\n");
}

type LatexColumnAlign = "l" | "c" | "r";

function cellAlign(cell: DocumentNode): LatexColumnAlign {
  const align = attribute(cell, "align");
  return align === "center" ? "c" : align === "right" ? "r" : "l";
}

// LaTeX has no display-math environment that a tabular cell can hold: both
// \[...\] and equation fail there with "Missing $ inserted". A block equation
// in a cell is written as inline math in display style instead, and the
// \displaystyle prefix is what the importer turns back into a block.
function mathBlockInCellToLatex(node: DocumentNode): string {
  return `\\(\\displaystyle ${normaliseMathBody(attribute(node, "latex") ?? "")}\\)`;
}

// A \multicolumn span is a real table-cell attribute, not text: the cell covers
// several of the tabular's columns, so the export has to write the command back
// or the valid spanning header would come back as escaped literal text.
function tableCellSpan(cell: DocumentNode): number {
  const value = cell.attrs?.colspan;
  const span = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 1;
  return Number.isFinite(span) && span > 1 ? Math.floor(span) : 1;
}

function containsHardBreak(node: DocumentNode): boolean {
  return (node.content ?? []).some(
    (child) => child.type === "hardBreak" || containsHardBreak(child),
  );
}

function tableCellToLatex(
  cell: DocumentNode,
  columnAlign: LatexColumnAlign,
  settings: ProjectSettings,
  columns: number,
): string {
  const children = cell.content ?? [];
  const align = cellAlign(cell);
  // `\\` ends the tabular row, so a Shift+Enter line break cannot be written
  // inside a cell that way. A \shortstack stacks the lines within the cell and
  // is valid in an l, c or r column, so the break stays where the page shows it.
  const body = children
    .map((child) => {
      if (child.type === "image") return imageInCellToLatex(child, settings, columns);
      if (child.type === "mathBlock") return mathBlockInCellToLatex(child);
      const inline = inlineContent([child], settings);
      return containsHardBreak(child) ? `\\shortstack[${align}]{${inline}}` : inline;
    })
    .filter(Boolean)
    .join("\\par ");
  const span = tableCellSpan(cell);
  if (span > 1) return `\\multicolumn{${span}}{${align}}{${body}}`;
  return align === columnAlign ? body : `\\multicolumn{1}{${align}}{${body}}`;
}

function tableToLatex(node: DocumentNode, settings: ProjectSettings): string {
  const rows = (node.content ?? [])
    .filter((row) => row.type === "tableRow")
    .map((row) => (row.content ?? []).filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader"));
  const columnCount = Math.max(
    1,
    ...rows.map((row) => row.reduce((count, cell) => count + tableCellSpan(cell), 0)),
  );
  const columnAligns: Array<LatexColumnAlign | undefined> = [];
  // A spanning cell's alignment is row-local, so it cannot describe the whole
  // column. Take each column's alignment from the first cell that covers just
  // that column, which keeps a centered \multicolumn header from recentring the
  // body and adding a \multicolumn{1} to every cell below it.
  for (const row of rows) {
    let column = 0;
    for (const cell of row) {
      const span = tableCellSpan(cell);
      if (span === 1 && columnAligns[column] === undefined) {
        columnAligns[column] = cellAlign(cell);
      }
      column += span;
    }
  }
  for (let index = 0; index < columnCount; index += 1) columnAligns[index] ??= "l";
  const body = rows
    .map((row) => {
      let column = 0;
      return `${row
        .map((cell) => {
          const latex = tableCellToLatex(cell, columnAligns[column] ?? "l", settings, columnCount);
          column += tableCellSpan(cell);
          return latex;
        })
        .join(" & ")} \\\\`;
    })
    .join("\n");
  const caption = attribute(node, "caption");
  // A hand-written \label is the target a \ref points at, so it has to follow
  // the caption out again or the reference is left dangling.
  const label = latexReferenceTarget(attribute(node, "label") ?? "");
  // A header row changes the first row's cell type, which LaTeX itself cannot
  // express. Mark the header-less case so a source round trip keeps it off.
  const headerRow = rows[0]?.[0]?.type === "tableHeader";
  return [
    "\\begin{table}[htbp]",
    "\\centering",
    caption ? `\\caption{${escapeLatex(caption)}}` : "",
    label ? `\\label{${label}}` : "",
    headerRow ? "" : "% Sentence table header: none",
    `\\begin{tabular}{${columnAligns.join("")}}`,
    "\\hline",
    body,
    "\\hline",
    "\\end{tabular}",
    "\\end{table}",
  ].filter(Boolean).join("\n");
}

function wrapAlignment(node: DocumentNode, body: string): string {
  if (!body.trim()) return body;
  const align = attribute(node, "textAlign");
  const environment =
    align === "center" ? "center" : align === "right" ? "flushright" : align === "left" ? "flushleft" : "";
  if (!environment) return body;
  return `\\begin{${environment}}\n${body}\n\\end{${environment}}`;
}

const ENUM_COUNTERS = ["enumi", "enumii", "enumiii", "enumiv"];

function orderedListStart(node: DocumentNode): number | null {
  const start = Number(node.attrs?.start ?? 1);
  return Number.isSafeInteger(start) && start > 1 ? start : null;
}

function blockToLatex(node: DocumentNode, settings: ProjectSettings, enumDepth = 0): string {
  switch (node.type) {
    case "paragraph": {
      const body = wrapAlignment(node, inlineContent(node.content, settings));
      // Word-style per-paragraph spacing: space* blocks between paragraphs.
      const before = Number(node.attrs?.spaceBefore) || 0;
      const after = Number(node.attrs?.spaceAfter) || 0;
      const out: string[] = [];
      if (before > 0) out.push(`\\vspace*{${before.toFixed(1)}pt}`, "");
      out.push(body);
      if (after > 0) out.push("", `\\vspace*{${after.toFixed(1)}pt}`);
      return out.join("\n");
    }
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const command = level <= 1 ? "section" : level === 2 ? "subsection" : "subsubsection";
      // A starred command is the user's unnumbered heading: keep the star or a
      // round trip would silently number a section they deliberately left out.
      const star = node.attrs?.unnumbered === true ? "*" : "";
      const label = latexReferenceTarget(attribute(node, "label") ?? "");
      const short = attribute(node, "shortTitle");
      return wrapAlignment(
        node,
        `\\${command}${star}${short === null ? "" : `[${short}]`}{${inlineContent(node.content, settings, true)}}${label ? `\\label{${label}}` : ""}`,
      );
    }
    case "bulletList":
      return [
        "\\begin{itemize}",
        ...(node.content ?? []).map((item) => listItemToLatex(item, settings, enumDepth)),
        "\\end{itemize}",
      ].join("\n");
    case "orderedList": {
      const start = orderedListStart(node);
      const counter = ENUM_COUNTERS[Math.min(enumDepth, ENUM_COUNTERS.length - 1)];
      return [
        "\\begin{enumerate}",
        ...(start === null ? [] : [`\\setcounter{${counter}}{${start - 1}}`]),
        ...(node.content ?? []).map((item) => listItemToLatex(item, settings, enumDepth + 1)),
        "\\end{enumerate}",
      ].join("\n");
    }
    case "blockquote":
      return [
        "\\begin{quote}",
        ...(node.content ?? []).map((child) => blockToLatex(child, settings, enumDepth)),
        "\\end{quote}",
      ].join("\n");
    case "codeBlock":
      return `\\begin{verbatim}\n${verbatimText(node.content)}\n\\end{verbatim}`;
    case "horizontalRule":
      return "\\noindent\\rule{\\linewidth}{0.4pt}";
    case "image":
      return imageToLatex(node, settings);
    case "table":
      return tableToLatex(node, settings);
    case "mathBlock": {
      const mathEnvironment = attribute(node, "environment");
      const body = normaliseMathBody(attribute(node, "latex") ?? "");
      if (mathEnvironment) {
        return wrapAlignment(
          node,
          `\\begin{${mathEnvironment}}\n${body}\n\\end{${mathEnvironment}}`,
        );
      }
      const environment = node.attrs?.numbered === true ? "equation" : "equation*";
      return wrapAlignment(node, `\\begin{${environment}}\n${body}\n\\end{${environment}}`);
    }
    case "pageBreak":
      return "\\newpage";
    case "toc":
      return "\\tableofcontents";
    case "text":
      return applyMarks(node.text ?? "", node.marks);
    default:
      return (node.content ?? [])
        .map((child) => blockToLatex(child, settings, enumDepth))
        .filter(Boolean)
        .join("\n\n");
  }
}

function listItemToLatex(node: DocumentNode, settings: ProjectSettings, enumDepth: number): string {
  const blocks = (node.content ?? [])
    .map((child) => ({ type: child.type, latex: blockToLatex(child, settings, enumDepth) }))
    .filter((block) => block.latex);
  // Two paragraphs in one item are two paragraphs in the PDF. A single newline
  // is just a space to LaTeX, so the blank line that ends a paragraph is needed
  // or the second paragraph joins the first one.
  const content = blocks
    .map((block, index) => {
      const previous = blocks[index - 1];
      const sameParagraphs = previous?.type === "paragraph" && block.type === "paragraph";
      const separator = index === 0 ? "" : sameParagraphs ? "\n\n" : "\n";
      return `${separator}${block.latex}`;
    })
    .join("");
  // LaTeX reads a bracket right after \item as the optional label that replaces
  // the bullet or number, so `[draft] note` would silently lose its brackets.
  // A group in front of the bracket keeps it as printed text.
  return `\\item ${content.replace(/^([ \t]*)\[/, "$1{[}")}`;
}

function naturalImageSize(node: DocumentNode): { width: number; height: number } | null {
  const width = Number(node.attrs?.naturalWidth ?? 0);
  const height = Number(node.attrs?.naturalHeight ?? 0);
  return width > 0 && height > 0 ? { width, height } : null;
}

// The editor draws images at their own size, caps a figure at the text block and
// an inline image at 1.5em (styles.css). A graphic that already fits is written
// in `bp`, which is this app's CSS pixel at 96 dpi, so the PDF prints it at the
// size the page shows. A graphic that does not fit is pinned to the matching
// LaTeX length instead, which also keeps a figure from growing past the page.
const BP_PER_CSS_PX = 0.75;

// A table column pads its content with \tabcolsep on both sides, and every
// column of the tabular contributes that padding. A graphic pinned to the text
// block inside a cell has to give that padding back, or the table runs exactly
// that far past the margin in the compiled PDF.
function cellImageWidth(columns: number): string {
  return `\\dimexpr\\linewidth-${2 * columns}\\tabcolsep\\relax`;
}

function imageOptions(
  node: DocumentNode,
  settings: ProjectSettings,
  inline: boolean,
  columns = 0,
): string | null {
  const size = naturalImageSize(node);
  if (!size) return null;
  const geometry = pageGeometry(settings);
  const maxWidth = geometry.width - 2 * geometry.margin;
  const maxHeight = inline ? 1.5 * geometry.fontSize : geometry.contentHeight;
  if (size.width <= maxWidth && size.height <= maxHeight) {
    return `width=${(size.width * BP_PER_CSS_PX).toFixed(2)}bp`;
  }
  const width = columns > 0 ? cellImageWidth(columns) : "\\linewidth";
  return inline
    ? `width=${width},height=1.5em,keepaspectratio`
    : `width=${width},height=\\textheight,keepaspectratio`;
}

function imageToLatex(node: DocumentNode, settings: ProjectSettings): string {
  const src = attribute(node, "path") ?? attribute(node, "src") ?? "";
  const alt = attribute(node, "alt") ?? "";
  // Only an explicit caption becomes \caption. Alt text names the image but is
  // not a caption the user ever wrote, so it must not reach the PDF.
  const caption = attribute(node, "caption") ?? "";
  const filename = imageSourcePath(src, alt);
  const options = imageOptions(node, settings, false);
  const graphics = options
    ? `\\includegraphics[${options}]{${escapeLatex(filename)}}`
    : `\\includegraphics{${escapeLatex(filename)}}`;
  // The alt text rides along as a comment, as it does for an inline image, so a
  // source round trip does not lose it: a figure has no other place for it.
  return [
    "\\begin{figure}[htbp]",
    "\\centering",
    alt ? `${graphics}% Sentence alt: ${metadataComment(alt)}` : graphics,
    caption ? `\\caption{${escapeLatex(caption)}}` : "",
    "\\end{figure}",
  ]
    .filter(Boolean)
    .join("\n");
}

const SERIF_FONT_SPEC =
  "Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic";

function typographyPackages(settings: ProjectSettings): string {
  const mainFont =
    settings.fontFamily === "times"
      ? "texgyretermes"
      : settings.fontFamily === "palatino"
        ? "texgyrepagella"
        : "lmroman10";
  const lines = [
    "\\usepackage{fontspec}",
    `\\setmainfont[${SERIF_FONT_SPEC}]{${mainFont}}`,
    "\\setsansfont[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-oblique, BoldItalicFont=*-boldoblique]{lmsans10}",
    "\\setmonofont[Extension=.otf, UprightFont=*-regular, BoldFont=*-regular, ItalicFont=*-italic, BoldItalicFont=*-italic]{lmmono10}",
    `\\newfontfamily\\sentenceTimes[${SERIF_FONT_SPEC}]{texgyretermes}`,
    `\\newfontfamily\\sentenceArial[${SERIF_FONT_SPEC}]{texgyreheros}`,
    `\\newfontfamily\\sentenceCourier[${SERIF_FONT_SPEC}]{texgyrecursor}`,
    `\\newfontfamily\\sentencePalatino[${SERIF_FONT_SPEC}]{texgyrepagella}`,
  ];
  if (settings.lineSpacing !== "single") {
    lines.push("\\usepackage{setspace}");
    lines.push(settings.lineSpacing === "double" ? "\\doublespacing" : "\\onehalfspacing");
  }
  // Word-style paragraph spacing: Space before/after in points applies in both
  // modes; indent mode adds a first-line indent on top, gap mode drops it.
  if (settings.paragraphSpacing === "gap") lines.push("\\usepackage{parskip}");
  const spaceAfter = Number(settings.paragraphSpaceAfter ?? 10);
  if (Number.isFinite(spaceAfter) && spaceAfter > 0) {
    lines.push(`\\setlength{\\parskip}{${spaceAfter.toFixed(1)}pt plus 2pt}`);
  }
  if (settings.paragraphSpacing === "indent") lines.push("\\setlength{\\parindent}{1.5em}");
  return lines.join("\n");
}

function marginGeometry(settings: ProjectSettings): string {
  switch (settings.margins) {
    case "narrow":
      return "margin=0.75in";
    case "wide":
      return "margin=1.5in";
    default:
      return "margin=1in";
  }
}

// A document-level \tableofcontents prints one contents page. Projects keep
// the generated one in settings and a placed one as a block, so export has to
// refuse to print both.
export function documentHasToc(document: SentenceDocument): boolean {
  return (document.content ?? []).some((node) => node.type === "toc");
}

export function documentToLatex(
  document: SentenceDocument,
  settings: ProjectSettings,
): string {
  const bibliography = nodesContainCitations(document.content)
    ? "\\bibliographystyle{plain}\n\\bibliography{references}"
    : "";
  const content = document.content ?? [];
  const firstNode = content[0];
  const repeatsTitle =
    firstNode?.type === "heading" &&
    Number(firstNode.attrs?.level ?? 1) === 1 &&
    plainText(firstNode.content).toLocaleLowerCase() ===
      settings.title.trim().toLocaleLowerCase();
  const body = (repeatsTitle ? content.slice(1) : content)
    .map((node) => blockToLatex(node, settings))
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
  const header = settings.header.trim()
    ? `\\fancyhead[C]{${escapeLatex(settings.header)}}`
    : "";
  const footer = settings.footer.trim()
    ? `\\fancyfoot[C]{${escapeLatex(settings.footer)}}`
    : "\\fancyfoot[C]{\\thepage}";
  const authors = authorToLatex(settings.author);
  const authorDetails = [
    settings.affiliation.trim()
      ? `{\\small ${escapeLatex(settings.affiliation.trim())}}`
      : "",
    settings.email.trim()
      ? `{\\small\\texttt{${escapeLatex(settings.email.trim())}}}`
      : "",
  ].filter(Boolean);
  const authorBlock = authorDetails.length
    ? `${authors}${authors ? "\\\\[7pt]" : ""}${authorDetails.join("\\\\[2pt]")}`
    : authors;
  const title = settings.title.trim()
    ? `\\title{${escapeLatex(settings.title)}}\n\\author{${authorBlock}}\n\\date{${escapeLatex(settings.date)}}`
    : "";
  const subtitle = settings.subtitle.trim()
    ? `\\begin{center}\n{\\large ${escapeLatex(settings.subtitle)}}\n\\end{center}`
    : "";
  const abstract = settings.abstract.trim()
    ? `\\begin{abstract}\n${paragraphTextToLatex(settings.abstract)}\n\\end{abstract}`
    : "";
  const keywords = settings.keywords.trim()
    ? `\\keywords{${escapeLatex(settings.keywords.trim())}}`
    : "";
  const arxivComments = [
    settings.primaryCategory.trim()
      ? `% arXiv primary category: ${metadataComment(settings.primaryCategory)}`
      : "",
    settings.crossListCategories.trim()
      ? `% arXiv cross-list categories: ${metadataComment(settings.crossListCategories)}`
      : "",
    settings.arxivComment.trim()
      ? `% arXiv comments: ${metadataComment(settings.arxivComment)}`
      : "",
    settings.affiliation.trim()
      ? `% Sentence affiliation: ${metadataComment(settings.affiliation)}`
      : "",
    settings.email.trim()
      ? `% Sentence contact email: ${metadataComment(settings.email)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const typography = typographyPackages(settings);
  const usesColor =
    containsMark(content, "color") ||
    containsMark(content, "highlight") ||
    nodesContainMathColor(content);
  const usesCaptionOf = hasCaptionedImageInCell(content);
  const preamble = settings.preamble.trim();
  return `${arxivComments ? `% Prepared for arXiv\n${arxivComments}\n` : ""}\\documentclass[${settings.fontSize},${settings.paperSize}${settings.columns === "two" ? ",twocolumn" : ""}]{${settings.documentClass}}
${typography}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
${usesCaptionOf ? "\\usepackage{caption}\n" : ""}\\usepackage{booktabs}
\\usepackage{ulem}
\\usepackage{microtype}
${usesColor ? "\\usepackage{xcolor}\n" : ""}\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[${marginGeometry(settings)}]{geometry}
\\providecommand{\\keywords}[1]{\\par\\noindent\\textbf{Keywords:} #1\\par}
${settings.lineNumbers ? "\\usepackage{lineno}\\linenumbers" : ""}
\\pagestyle{fancy}
\\fancyhf{}
${header}
${footer}
\\renewcommand{\\headrulewidth}{0pt}
${preamble ? `${preamble}\n` : ""}${title}

\\begin{document}
${title ? "\\maketitle" : ""}
${subtitle}
${abstract}
${keywords}
${settings.includeToc && !documentHasToc(document) ? "\\tableofcontents\\newpage" : ""}

${body}

${bibliography}

\\end{document}
`;
}

// The preamble Sentence generates comes only from settings and the document
// body; anything else typed there (packages, macro and environment
// definitions) belongs to the project. It is kept verbatim so regenerating the
// source after an Apply does not quietly delete it.
function preambleSource(latex: string): string {
  const begin = findDocumentDelimiter(latex, "\\begin{document}", 0);
  return begin < 0 ? "" : latex.slice(0, begin);
}

function extractCustomPreamble(
  latex: string,
  settings: ProjectSettings,
  document: SentenceDocument,
): string {
  const source = preambleSource(latex);
  if (!source.trim()) return "";
  // Compare against what the settings and body would generate. Lines Sentence
  // writes itself belong to settings, not to the project: keeping a second copy
  // of a package with different options would make the PDF fail to compile.
  const generated = preambleSource(
    documentToLatex(document, { ...settings, preamble: "" }),
  );
  const generatedLines = new Map<string, number>();
  const generatedPackages = new Set<string>();
  const generatedCommands = new Set<string>();
  const definedName =
    /^\\(?:newcommand|renewcommand|providecommand|def|newfontfamily|newenvironment)\*?\s*\{?\s*\\([a-zA-Z]+)/;
  for (const line of generated.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    generatedLines.set(text, (generatedLines.get(text) ?? 0) + 1);
    const packages = text.match(/^\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/);
    if (packages) {
      for (const name of packages[1].split(",")) {
        if (name.trim()) generatedPackages.add(name.trim());
      }
      continue;
    }
    const defined = text.match(definedName);
    if (defined) {
      generatedCommands.add(defined[1]);
      continue;
    }
    const command = text.match(/^\\([a-zA-Z]+)/);
    if (command) generatedCommands.add(command[1]);
  }

  const custom: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    const count = generatedLines.get(text) ?? 0;
    if (count > 0) {
      generatedLines.set(text, count - 1);
      continue;
    }
    const packages = text.match(/^\\usepackage(?:\[([^\]]*)\])?\{([^}]*)\}/);
    if (packages) {
      const names = packages[2].split(",").map((name) => name.trim()).filter(Boolean);
      const kept = names.filter((name) => !generatedPackages.has(name));
      if (kept.length === 0) continue;
      custom.push(
        kept.length === names.length
          ? line.trimEnd()
          : `\\usepackage${packages[1] !== undefined ? `[${packages[1]}]` : ""}{${kept.join(",")}}`,
      );
      continue;
    }
    const defined = text.match(definedName);
    if (defined) {
      if (!generatedCommands.has(defined[1])) custom.push(line.trimEnd());
      continue;
    }
    const command = text.match(/^\\([a-zA-Z]+)/);
    if (command && generatedCommands.has(command[1])) continue;
    custom.push(line.trimEnd());
  }
  return custom.join("\n").trim();
}

// Zero-argument macros can be expanded while importing the body, so a `\name{}`
// call typed in the source becomes the text it prints instead of an escaped
// literal. Definitions with parameters are left alone: `#1` has nothing to
// become until the call is seen.
function preambleMacros(preamble: string): Map<string, string> {
  const macros = new Map<string, string>();
  const definitions =
    /\\(?:newcommand|renewcommand|providecommand)\*?\s*(?:\{\s*\\([a-zA-Z]+)\s*\}|\\([a-zA-Z]+))|\\def\s*\\([a-zA-Z]+)/g;
  for (const match of preamble.matchAll(definitions)) {
    const name = match[1] ?? match[2] ?? match[3];
    let cursor = (match.index ?? 0) + match[0].length;
    const optionalCount = preamble.slice(cursor).match(/^\s*\[(\d*)\]/);
    if (optionalCount) {
      if (Number(optionalCount[1] || "0") > 0) continue;
      cursor += optionalCount[0].length;
      if (/^\s*\[[^\]]*\]/.test(preamble.slice(cursor))) continue;
    }
    const open = preamble.indexOf("{", cursor);
    if (open < 0) continue;
    // A \def body is preceded by its parameter tokens; `#` means it takes
    // arguments, which the body expansion cannot substitute.
    if (preamble.slice(cursor, open).includes("#")) continue;
    const close = findMatchingBrace(preamble, open);
    if (close < 0) continue;
    macros.set(name, preamble.slice(open + 1, close));
  }
  return macros;
}

function expandPreambleMacros(source: string, macros: Map<string, string>): string {
  if (macros.size === 0) return source;
  const expand = (text: string): string => {
    let current = text;
    // A macro may print another defined macro; stop as soon as nothing changes
    // so a self-referencing definition cannot loop forever.
    for (let pass = 0; pass < 8; pass += 1) {
      let changed = false;
      current = current.replace(
        /\\([a-zA-Z]+)(?:\{\s*\})?/g,
        (call, name: string) => {
          const body = macros.get(name);
          if (body === undefined) return call;
          changed = true;
          return body;
        },
      );
      if (!changed) break;
    }
    return current;
  };
  // Verbatim text is printed as typed, so a macro name inside it is not a call.
  return source
    .split(/(\\begin\{verbatim\}[\s\S]*?\\end\{verbatim\})/)
    .map((part, index) => (index % 2 === 1 ? part : expand(part)))
    .join("");
}

// Text-mode commands that print a word or character. Reading them as the text
// they print keeps the visual document free of control sequences and stops the
// exporter from escaping the leading backslash into \textbackslash{}.
const LATEX_TEXT_COMMANDS: Record<string, string> = {
  LaTeX: "LaTeX",
  TeX: "TeX",
  ldots: "\u2026",
  dots: "\u2026",
  textellipsis: "\u2026",
  textemdash: "\u2014",
  textendash: "\u2013",
  textquoteleft: "\u2018",
  textquoteright: "\u2019",
  textquotedblleft: "\u201c",
  textquotedblright: "\u201d",
  copyright: "\u00a9",
  textcopyright: "\u00a9",
  textregistered: "\u00ae",
  texttrademark: "\u2122",
  textdegree: "\u00b0",
  textmu: "\u00b5",
  textbullet: "\u2022",
  textdagger: "\u2020",
  textdaggerdbl: "\u2021",
  textperiodcentered: "\u00b7",
  textsection: "\u00a7",
  textparagraph: "\u00b6",
  textunderscore: "_",
  textless: "<",
  textgreater: ">",
  textbar: "|",
  textbraceleft: "{",
  textbraceright: "}",
  S: "\u00a7",
  P: "\u00b6",
  ae: "\u00e6",
  AE: "\u00c6",
  oe: "\u0153",
  OE: "\u0152",
  aa: "\u00e5",
  AA: "\u00c5",
  o: "\u00f8",
  O: "\u00d8",
  ss: "\u00df",
  l: "\u0142",
  L: "\u0141",
  i: "\u0131",
  j: "\u0237",
  pounds: "\u00a3",
  textsterling: "\u00a3",
  texteuro: "\u20ac",
  textyen: "\u00a5",
  textcent: "\u00a2",
};

// An accent is a combining mark in Unicode, so it applies to whatever base
// character follows and NFC puts the pair back together as one letter.
const LATEX_ACCENTS: Record<string, string> = {
  "'": "\u0301",
  "`": "\u0300",
  "^": "\u0302",
  '"': "\u0308",
  "~": "\u0303",
  "=": "\u0304",
  ".": "\u0307",
  u: "\u0306",
  v: "\u030c",
  H: "\u030b",
  c: "\u0327",
  k: "\u0328",
  r: "\u030a",
  b: "\u0331",
  d: "\u0323",
};

function latexAccent(source: string, index: number): { text: string; end: number } | null {
  const accent = source[index + 1];
  const mark = LATEX_ACCENTS[accent];
  if (!mark) return null;
  let cursor = index + 2;
  // `\v s` and `\c c` name the accent with a letter, so the space that ends the
  // control word is not the argument and has to be skipped.
  if (/[a-zA-Z]/.test(accent)) {
    while (cursor < source.length && /[ \t]/.test(source[cursor])) cursor += 1;
  }
  let base: string;
  if (source[cursor] === "{") {
    const close = findMatchingBrace(source, cursor);
    if (close < 0) return null;
    base = source.slice(cursor + 1, close);
    cursor = close + 1;
  } else if (source.startsWith("\\i", cursor) && !/[a-zA-Z]/.test(source[cursor + 2] ?? "")) {
    base = "\u0131";
    cursor += 2;
  } else if (source.startsWith("\\j", cursor) && !/[a-zA-Z]/.test(source[cursor + 2] ?? "")) {
    base = "\u0237";
    cursor += 2;
  } else {
    base = source[cursor] ?? "";
    cursor += 1;
  }
  if (!base) return null;
  if (base === "\\i") base = "\u0131";
  if (base === "\\j") base = "\u0237";
  return { text: (base + mark).normalize("NFC"), end: cursor };
}

function decodeLatexVerbatim(value: string): string {
  return value
    .replace(/\\csname @backslashchar\\endcsname ?/g, "\\")
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\textasciitilde\{\}/g, "~")
    .replace(/\\textasciicircum\{\}/g, "^")
    .replace(/\\([&%$#_{}])/g, "$1");
}

// Running text keeps LaTeX's `~`, which is a non-breaking space and must not be
// shown as a tilde. URLs and file names are different: a `~` there is part of
// the address, so those arguments are decoded verbatim instead.
function decodeLatexText(value: string): string {
  // `{[}` is the export's guard against \item taking a leading bracket as its
  // optional label; it prints a plain bracket, so it reads back as one.
  return decodeLatexVerbatim(value.replace(/\{\[\}/g, "[").replace(/~/g, "\u00a0"));
}

function commandArgument(source: string, command: string): string | null {
  const start = source.indexOf(command);
  if (start < 0) return null;
  const open = source.indexOf("{", start + command.length);
  if (open < 0) return null;
  let depth = 1;
  for (let index = open + 1; index < source.length; index += 1) {
    if (source[index] === "{" && source[index - 1] !== "\\") depth += 1;
    if (source[index] === "}" && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return null;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{" && source[index - 1] !== "\\") depth += 1;
    if (source[index] === "}" && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseStyleGroup(inner: string): { mark: DocumentMark; body: string } | null {
  const decl = inner.match(
    /^\\(sentenceTimes|sentenceArial|sentenceCourier|sentencePalatino|sffamily|ttfamily)\s*([\s\S]*)$/,
  );
  if (decl) {
    const family = FONT_BY_LATEX[decl[1]];
    if (family) return { mark: { type: "fontFamily", attrs: { family } }, body: decl[2] };
    return null;
  }
  const selected = inner.match(/^\\fontfamily\{([a-z0-9]+)\}\\selectfont\s*([\s\S]*)$/);
  if (selected) {
    const family = FONT_BY_LATEX[selected[1]];
    if (family) return { mark: { type: "fontFamily", attrs: { family } }, body: selected[2] };
    return null;
  }
  const colored = inner.match(/^\\color\{([a-zA-Z]+)\}\s*([\s\S]*)$/);
  if (colored) {
    const hex = COLOR_BY_LATEX[colored[1]];
    if (hex) return { mark: { type: "color", attrs: { color: hex } }, body: colored[2] };
    return null;
  }
  const sized = inner.match(/^\\(small|large|Large|LARGE|huge|Huge|tiny)\s*([\s\S]*)$/);
  if (sized) return { mark: { type: "fontSize", attrs: { size: sized[1] } }, body: sized[2] };
  return null;
}

interface InlineParseResult {
  content: DocumentNode[];
}

function parseInline(source: string): InlineParseResult {
  const content: DocumentNode[] = [];
  let index = 0;
  let buffer = "";

  const flush = (marks?: DocumentMark[]) => {
    if (!buffer) return;
    content.push({
      type: "text",
      text: decodeLatexText(buffer),
      ...(marks?.length ? { marks } : {}),
    });
    buffer = "";
  };

  while (index < source.length) {
    const remainder = source.slice(index);

    if (source[index] === "{") {
      const close = findMatchingBrace(source, index);
      const style = close > 0 ? parseStyleGroup(source.slice(index + 1, close)) : null;
      if (style) {
        flush();
        for (const node of parseInline(style.body).content) {
          node.marks = [...(node.marks ?? []), style.mark];
          content.push(node);
        }
        index = close + 1;
        continue;
      }
    }

    const colorboxMatch = remainder.match(/^\\colorbox\{([a-zA-Z]+)\}\{/);
    if (colorboxMatch) {
      const open = index + colorboxMatch[0].length - 1;
      const close = findMatchingBrace(source, open);
      const hex = close > 0 ? HIGHLIGHT_BY_LATEX[colorboxMatch[1]] : null;
      if (close > 0 && hex) {
        flush();
        for (const node of parseInline(source.slice(open + 1, close)).content) {
          node.marks = [
            ...(node.marks ?? []),
            { type: "highlight", attrs: { color: hex } },
          ];
          content.push(node);
        }
        index = close + 1;
        continue;
      }
    }

    const markMatch = remainder.match(/^\\(textbf|textit|emph|underline|sout|texttt|textsuperscript|textsubscript)\{/);
    if (markMatch) {
      flush();
      const command = markMatch[1];
      let depth = 1;
      let cursor = index + markMatch[0].length;
      const start = cursor;
      while (cursor < source.length && depth > 0) {
        if (source[cursor] === "{" && source[cursor - 1] !== "\\") depth += 1;
        if (source[cursor] === "}" && source[cursor - 1] !== "\\") depth -= 1;
        cursor += 1;
      }
      const inner = source.slice(start, cursor - 1);
      const nested = parseInline(inner).content;
      const markType: Record<string, string> = {
        textbf: "bold",
        textit: "italic",
        emph: "italic",
        underline: "underline",
        sout: "strike",
        texttt: "code",
        textsuperscript: "superscript",
        textsubscript: "subscript",
      };
      for (const node of nested) {
        node.marks = [...(node.marks ?? []), { type: markType[command] }];
        content.push(node);
      }
      index = cursor;
      continue;
    }

    const hrefMatch = remainder.match(/^\\href\s*\{/);
    if (hrefMatch) {
      const urlOpen = index + hrefMatch[0].length - 1;
      const urlClose = findMatchingBrace(source, urlOpen);
      const textOpen = urlClose > 0 ? source.indexOf("{", urlClose + 1) : -1;
      const textClose = textOpen > 0 ? findMatchingBrace(source, textOpen) : -1;
      if (
        urlClose > 0 &&
        textClose > 0 &&
        !source.slice(urlClose + 1, textOpen).trim()
      ) {
        flush();
        const linkMark: DocumentMark = {
          type: "link",
          attrs: { href: decodeLatexVerbatim(source.slice(urlOpen + 1, urlClose)) },
        };
        for (const node of parseInline(source.slice(textOpen + 1, textClose)).content) {
          node.marks = [...(node.marks ?? []), linkMark];
          content.push(node);
        }
        index = textClose + 1;
        continue;
      }
    }

    if (source[index] === "\\" && source[index + 1] === "$") {
      buffer += "\\$";
      index += 2;
      continue;
    }

    const mathMatch = remainder.match(/^\\\((.+?)\\\)/s);
    if (mathMatch) {
      flush();
      content.push({ type: "mathInline", attrs: { latex: mathMatch[1] } });
      index += mathMatch[0].length;
      continue;
    }

    // Math may continue on the next line (a block never contains a blank line),
    // so a dollar-delimited formula must not stop at the line break the way
    // running text does.
    const dollarMathMatch = remainder.match(/^\$((?:\\.|[^$\\])+)\$(?!\$)/s);
    if (dollarMathMatch) {
      flush();
      content.push({ type: "mathInline", attrs: { latex: dollarMathMatch[1] } });
      index += dollarMathMatch[0].length;
      continue;
    }

    const citeMatch = remainder.match(/^\\cite\{([^}]*)\}/);
    if (citeMatch) {
      flush();
      content.push({ type: "citation", attrs: { key: citationKeys(citeMatch[1]).join(",") } });
      index += citeMatch[0].length;
      continue;
    }

    const footnoteMatch = remainder.match(/^(?:\\protect\s*)?\\footnote\{/);
    if (footnoteMatch) {
      const open = index + footnoteMatch[0].length - 1;
      const close = findMatchingBrace(source, open);
      if (close > 0) {
        flush();
        content.push({
          type: "footnote",
          attrs: { text: decodeLatexText(source.slice(open + 1, close)) },
        });
        index = close + 1;
        continue;
      }
    }

    const refMatch = remainder.match(/^\\ref\s*\{([^}]*)\}/);
    if (refMatch) {
      flush();
      content.push({ type: "crossReference", attrs: { label: refMatch[1] } });
      index += refMatch[0].length;
      continue;
    }

    const inlineImageMatch = remainder.match(/^\\includegraphics(?:\[([^\]]*)\])?\{([^}]*)\}/);
    if (inlineImageMatch) {
      flush();
      const fileName = decodeLatexVerbatim(inlineImageMatch[2]);
      let cursor = index + inlineImageMatch[0].length;
      let alt = "";
      const altComment = source.slice(cursor).match(/^[ \t]*% Sentence alt: ([^\r\n]*)\r?\n?/);
      if (altComment) {
        alt = decodeLatexText(altComment[1].trim());
        cursor += altComment[0].length;
      }
      content.push({
        type: "inlineImage",
        attrs: { src: fileName, path: fileName, ...(alt ? { alt } : {}) },
      });
      index = cursor;
      continue;
    }

    if (remainder.startsWith("\\\\")) {
      flush();
      content.push({ type: "hardBreak" });
      index += 2;
      continue;
    }

    if (source[index] === "\\") {
      const accent = latexAccent(source, index);
      if (accent) {
        buffer += accent.text;
        index = accent.end;
        continue;
      }
      const commandMatch = remainder.match(/^\\([a-zA-Z]+)/);
      const printed = commandMatch ? LATEX_TEXT_COMMANDS[commandMatch[1]] : undefined;
      if (commandMatch && printed !== undefined) {
        let cursor = index + commandMatch[0].length;
        if (source.startsWith("{}", cursor)) cursor += 2;
        buffer += printed;
        index = cursor;
        continue;
      }
    }

    buffer += source[index];
    index += 1;
  }
  flush();
  return { content };
}

const LIST_ENVIRONMENTS: Record<string, "bulletList" | "orderedList"> = {
  itemize: "bulletList",
  enumerate: "orderedList",
};

function nestedListSpans(
  body: string,
): Array<{ start: number; end: number; type: "bulletList" | "orderedList" }> {
  const spans: Array<{ start: number; end: number; type: "bulletList" | "orderedList" }> = [];
  let depth = 0;
  let start = 0;
  let type: "bulletList" | "orderedList" = "bulletList";
  for (const match of body.matchAll(/\\(begin|end)\{(itemize|enumerate)\}/g)) {
    const index = match.index ?? 0;
    if (match[1] === "begin") {
      if (depth === 0) {
        start = index;
        type = LIST_ENVIRONMENTS[match[2]];
      }
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) spans.push({ start, end: index + match[0].length, type });
    }
  }
  return spans;
}

// A quote or a list item can hold a display equation. It is a block node like
// any other block, so the surrounding text must be split around it; otherwise
// parseInline reads the environment as literal text and it is escaped on export.
const DISPLAY_MATH_BODY =
  /\\begin\{equation(\*?)\}\s*([\s\S]*?)\s*\\end\{equation\1\}|\\\[\s*([\s\S]*?)\s*\\\]|\$\$\s*([\s\S]*?)\s*\$\$/;

// A hand-written align or gather block is display math too, but its `&` and
// `\\` row syntax is only valid inside that same environment. Keep the
// environment name with the math block so it is editable and written back
// verbatim instead of being read as paragraph text and escaped on export.
const MATH_BLOCK_ENVIRONMENTS = ["align", "align*", "gather", "gather*"];

// Environments the parser turns into a node. A block that opens with any other
// environment would be read as paragraph text and escaped on export, so an
// Apply has to report it instead of silently rewriting the user's LaTeX.
const SUPPORTED_ENVIRONMENTS = new Set([
  "abstract",
  "align",
  "align*",
  "center",
  "document",
  "enumerate",
  "equation",
  "equation*",
  "figure",
  "flushleft",
  "flushright",
  "gather",
  "gather*",
  "itemize",
  "quote",
  "table",
  "tabular",
  "verbatim",
]);

function assertSupportedEnvironment(text: string): void {
  const match = text.trim().match(/^\\begin\{([a-zA-Z*]+)\}/);
  if (!match || SUPPORTED_ENVIRONMENTS.has(match[1])) return;
  throw new Error(`Invalid LaTeX: unsupported environment "${match[1]}".`);
}

// A blank line inside math ends the paragraph before the closing delimiter, so
// the environment would never compile. Math has no paragraph break anyway: join
// the body back onto fewer lines instead of writing the blank line out again.
function normaliseMathBody(body: string): string {
  return body.replace(/\r?\n(?:[ \t]*\r?\n)+/g, "\n").trim();
}

function parseMathEnvironmentBlock(block: string): { environment: string; body: string } | null {
  const match = block.match(/^\\begin\{([a-zA-Z]+\*?)\}\s*([\s\S]*?)\s*\\end\{\1\}$/);
  if (!match || !MATH_BLOCK_ENVIRONMENTS.includes(match[1])) return null;
  return { environment: match[1], body: normaliseMathBody(match[2]) };
}

// Display math in all its spellings becomes the same mathBlock node. The
// alignment is the surrounding center/flushleft/flushright wrapper, which the
// parser sets on the node so the exporter can write it back.
function mathBlockFromSource(source: string, textAlign?: string): DocumentNode | null {
  const alignment: Record<string, string> = textAlign ? { textAlign } : {};
  const environment = parseMathEnvironmentBlock(source);
  if (environment) {
    return {
      type: "mathBlock",
      attrs: {
        latex: environment.body,
        environment: environment.environment,
        numbered: false,
        ...alignment,
      },
    };
  }
  // Both delimiters are unnumbered, so they round-trip through the same
  // mathBlock node as an equation* environment.
  const displayMath =
    source.match(/^\\\[\s*([\s\S]*?)\s*\\\]$/) ??
    source.match(/^\$\$\s*([\s\S]*?)\s*\$\$$/);
  if (displayMath) {
    return {
      type: "mathBlock",
      attrs: { latex: normaliseMathBody(displayMath[1]), numbered: false, ...alignment },
    };
  }
  const equation = source.match(
    /^\\begin\{equation(\*?)\}\s*([\s\S]*?)\s*\\end\{equation\1\}$/,
  );
  if (equation) {
    return {
      type: "mathBlock",
      attrs: {
        latex: normaliseMathBody(equation[2]),
        numbered: equation[1] !== "*",
        ...alignment,
      },
    };
  }
  return null;
}

function pushBodyParagraphs(content: DocumentNode[], text: string): void {
  let rest = text;
  for (;;) {
    const match = rest.match(DISPLAY_MATH_BODY);
    if (!match) break;
    const before = rest.slice(0, match.index).trim();
    if (before) content.push({ type: "paragraph", content: parseInline(before).content });
    content.push({
      type: "mathBlock",
      attrs: {
        latex: normaliseMathBody(match[2] ?? match[3] ?? match[4]),
        numbered: match[1] === "",
      },
    });
    rest = rest.slice((match.index ?? 0) + match[0].length);
  }
  const trailing = rest.trim();
  if (trailing) content.push({ type: "paragraph", content: parseInline(trailing).content });
}

function parseListItemContent(body: string): DocumentNode[] {
  const content: DocumentNode[] = [];
  let cursor = 0;
  // A blank line inside an item ends a paragraph, exactly as it does in the
  // body: without the split the two paragraphs collapse into one on import.
  const pushParagraph = (text: string) => {
    for (const paragraph of text.split(/\n[ \t]*\n/)) {
      assertSupportedEnvironment(paragraph);
      pushBodyParagraphs(content, paragraph);
    }
  };
  for (const span of nestedListSpans(body)) {
    pushParagraph(body.slice(cursor, span.start));
    if (!content.some((node) => node.type === "paragraph")) {
      content.push({ type: "paragraph" });
    }
    content.push(parseList(body.slice(span.start, span.end), span.type));
    cursor = span.end;
  }
  pushParagraph(body.slice(cursor));
  if (content.length === 0) content.push({ type: "paragraph" });
  return content;
}

// A block command directly after paragraph text (no blank line) still starts a
// new block: LaTeX treats it that way, so a missing blank line must not turn
// \section or \begin{table} into escaped literal text.
const BLOCK_COMMAND_START =
  /^\s*\\(?:begin\{[a-zA-Z*]+\}|(?:section|subsection|subsubsection)\*?(?:\[[^\]]*\])?\{|newpage\b|tableofcontents\b|includegraphics\b|noindent\s*\\rule\b)/;
// Commands whose whole block is the line itself, so the following line starts a
// new block as well.
const BLOCK_COMMAND_LINE =
  /^\s*\\(?:(?:section|subsection|subsubsection)\*?(?:\[[^\]]*\])?\{|newpage\b|tableofcontents\b|includegraphics\b|noindent\s*\\rule\b)/;

const HEADING_START = /^\s*\\(?:section|subsection|subsubsection)\*?(?:\[[^\]]*\])?\{/;

// A heading whose title holds an inline image wraps onto a second line: the
// alt text is a `%` comment, which has to end the line to stay a comment. The
// braces still close on the next line, so the heading is one block and must not
// be flushed until they do. Braces inside a comment or escaped with a backslash
// do not count.
function braceBalance(line: string): number {
  let balance = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\\") {
      index += 1;
    } else if (char === "%") {
      break;
    } else if (char === "{") {
      balance += 1;
    } else if (char === "}") {
      balance -= 1;
    }
  }
  return balance;
}

function splitLatexBlocks(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let depth = 0;
  // Braces left open by a heading line that is still part of the current block.
  let headingOpen = 0;
  const flush = () => {
    const block = current.join("\n").trim();
    if (block) blocks.push(block);
    current = [];
    headingOpen = 0;
  };
  let verbatim = false;
  for (const line of source.split(/\r?\n/)) {
    // Verbatim bodies are printed as typed, so their `\begin`/`\end` text is not
    // an environment boundary and must not split the block.
    if (verbatim) {
      const close = line.indexOf("\\end{verbatim}");
      if (close < 0) {
        current.push(line);
        continue;
      }
      verbatim = false;
      depth = Math.max(0, depth - 1);
      const trailing = line.slice(close + "\\end{verbatim}".length);
      if (trailing.trim()) {
        current.push(line.slice(0, close + "\\end{verbatim}".length));
        flush();
        current.push(trailing);
      } else {
        current.push(line);
        flush();
      }
      continue;
    }
    if (
      depth === 0 &&
      headingOpen === 0 &&
      current.length > 0 &&
      BLOCK_COMMAND_START.test(line)
    ) {
      flush();
    }
    if (!line.trim() && depth === 0) {
      flush();
      continue;
    }
    // An environment opened on an earlier line ends its own block: LaTeX ends
    // the paragraph at \end{...}, so following text starts a new block even
    // without a blank line.
    const depthAtLineStart = depth;
    let closedAt: number | null = null;
    for (const match of line.matchAll(/\\(begin|end)\{[a-zA-Z*]+\}/g)) {
      depth += match[1] === "begin" ? 1 : -1;
      if (depthAtLineStart > 0 && depth === 0 && match[1] === "end" && closedAt === null) {
        closedAt = (match.index ?? 0) + match[0].length;
      }
    }
    if (closedAt !== null) {
      const trailing = line.slice(closedAt);
      if (trailing.trim()) {
        current.push(line.slice(0, closedAt));
        flush();
        current.push(trailing);
      } else {
        current.push(line);
        flush();
      }
      continue;
    }
    current.push(line);
    if (line.includes("\\begin{verbatim}") && !line.includes("\\end{verbatim}")) {
      verbatim = true;
    }
    if (headingOpen > 0 || HEADING_START.test(line)) {
      headingOpen = Math.max(0, headingOpen + braceBalance(line));
    }
    if (depth === 0 && headingOpen === 0 && BLOCK_COMMAND_LINE.test(line)) flush();
  }
  flush();
  return attachHeadingLabels(blocks);
}

// `\section{Title}` followed by `\label{sec:title}` on the next line is the
// same reference target as the one-line form. A heading line flushes its block
// on its own, so the label would otherwise become a paragraph of raw LaTeX and
// be lost on the way back out.
function attachHeadingLabels(blocks: string[]): string[] {
  const result: string[] = [];
  for (const block of blocks) {
    const previous = result[result.length - 1];
    const previousHeading = previous ? parseHeadingBlock(previous) : null;
    if (
      previous &&
      previousHeading &&
      !previousHeading.label &&
      /^\\label\{[^{}]*\}$/.test(block)
    ) {
      result[result.length - 1] = `${previous}\n${block}`;
      continue;
    }
    result.push(block);
  }
  return result;
}

function parseList(source: string, type: "bulletList" | "orderedList"): DocumentNode {
  const environment = type === "bulletList" ? "itemize" : "enumerate";
  let inner = source
    .replace(new RegExp(`^\\\\begin\\{${environment}\\}\\s*`), "")
    .replace(new RegExp(`\\s*\\\\end\\{${environment}\\}$`), "");
  let start: number | null = null;
  if (type === "orderedList") {
    const counter = inner.match(/^\\setcounter\{enum(?:i|ii|iii|iv)\}\{(\d+)\}\s*/);
    if (counter) {
      const value = Number(counter[1]);
      if (Number.isSafeInteger(value)) {
        start = value + 1;
        inner = inner.slice(counter[0].length);
      }
    }
  }
  const starts: Array<{ start: number; bodyStart: number }> = [];
  let depth = 0;
  for (const match of inner.matchAll(/\\item\b|\\(?:begin|end)\{(?:itemize|enumerate)\}/g)) {
    const index = match.index ?? 0;
    if (match[0] === "\\item") {
      if (depth === 0) starts.push({ start: index, bodyStart: index + match[0].length });
    } else if (match[0].startsWith("\\begin")) {
      depth += 1;
    } else {
      depth -= 1;
    }
  }
  if (starts.length === 0) starts.push({ start: 0, bodyStart: 0 });
  return {
    type,
    ...(start !== null && start > 1 ? { attrs: { start } } : {}),
    content: starts.map((item, index) => ({
      type: "listItem",
      content: parseListItemContent(
        inner.slice(item.bodyStart, starts[index + 1]?.start ?? inner.length),
      ),
    })),
  };
}

// A cell paragraph that holds only a display-style equation is the exported
// form of a math block, so restore the block instead of demoting it to inline
// math. This keeps an equation placed in a cell through a source round trip.
function tableCellParagraphToNode(paragraph: string): DocumentNode {
  // A captioned picture in a cell is exported as a minipage holding the graphic
  // and its \captionof; read it back as the same block image so the caption is
  // not turned into cell text on the next sync.
  const minipage = paragraph
    .trim()
    .match(/^\\begin\{minipage\}\{[^{}]*\}([\s\S]*?)\\end\{minipage\}$/);
  const graphics = minipage?.[1].match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/);
  const caption = minipage ? commandArgument(minipage[1], "\\captionof{figure}") : null;
  if (minipage && graphics && caption !== null) {
    const captionText = decodeLatexText(caption);
    const altComment = minipage[1].match(/% Sentence alt: ([^\r\n]*)/);
    const altText = altComment ? decodeLatexText(altComment[1].trim()) : "";
    return {
      type: "image",
      attrs: {
        src: decodeLatexVerbatim(graphics[1]),
        alt: altText || captionText,
        caption: captionText,
      },
    };
  }
  // A line break in a cell is exported as a \shortstack, so read the stack
  // back as the paragraph's own line breaks instead of literal text.
  const shortstack = paragraph
    .trim()
    .match(/^\\shortstack(?:\[[lcr]\])?\{([\s\S]*)\}$/);
  if (shortstack) {
    return { type: "paragraph", content: parseInline(shortstack[1]).content };
  }
  const content = parseInline(paragraph.trim()).content;
  const only = content.length === 1 ? content[0] : undefined;
  const latex = only?.type === "mathInline" ? attribute(only, "latex") ?? "" : "";
  const displayMatch = latex.match(/^\\displaystyle\s+([\s\S]*)$/);
  if (displayMatch) {
    return { type: "mathBlock", attrs: { latex: normaliseMathBody(displayMatch[1]), numbered: false } };
  }
  return { type: "paragraph", content };
}

// A column spec keeps its braces: p{4cm}, @{} and >{...} all wrap arguments,
// so stopping at the first } would leave part of the spec in the first cell.
function tabularContent(block: string): { spec: string; body: string } | null {
  const begin = block.indexOf("\\begin{tabular}");
  if (begin < 0) return null;
  let index = begin + "\\begin{tabular}".length;
  while (index < block.length && /\s/.test(block[index])) index += 1;
  let spec = "";
  if (block[index] === "{") {
    const close = findMatchingBrace(block, index);
    if (close < 0) return null;
    spec = block.slice(index + 1, close);
    index = close + 1;
  }
  const end = block.indexOf("\\end{tabular}", index);
  if (end < 0) return null;
  return { spec, body: block.slice(index, end) };
}

function columnSpecGroup(source: string, start: number): { content: string; end: number } | null {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  if (source[index] !== "{") return null;
  const close = findMatchingBrace(source, index);
  if (close < 0) return null;
  return { content: source.slice(index + 1, close), end: close + 1 };
}

// Column letters live at the top level of the spec; an l or c inside a braced
// width or modifier argument (p{4cm}, >{\centering}) does not describe a column.
function columnSpecAligns(spec: string): LatexColumnAlign[] {
  const aligns: LatexColumnAlign[] = [];
  let index = 0;
  while (index < spec.length) {
    const character = spec[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "{") {
      const group = columnSpecGroup(spec, index);
      index = group ? group.end : spec.length;
      continue;
    }
    if (character === "l" || character === "c" || character === "r") {
      aligns.push(character);
      index += 1;
      continue;
    }
    // p, m and b take a width and align to the left edge of that box.
    if (character === "p" || character === "m" || character === "b") {
      aligns.push("l");
      index += 1;
      const width = columnSpecGroup(spec, index);
      if (width) index = width.end;
      continue;
    }
    // *{n}{spec} repeats a column spec n times.
    if (character === "*") {
      index += 1;
      const count = columnSpecGroup(spec, index);
      if (!count) continue;
      index = count.end;
      const repeated = columnSpecGroup(spec, index);
      if (!repeated) continue;
      index = repeated.end;
      const repeats = Math.min(64, Number.parseInt(count.content, 10) || 0);
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        aligns.push(...columnSpecAligns(repeated.content));
      }
      continue;
    }
    index += 1;
  }
  return aligns;
}

function splitTableRow(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let backslashes = 0;
  for (const character of row) {
    if (character === "&" && backslashes % 2 === 0) {
      cells.push(cell);
      cell = "";
      backslashes = 0;
      continue;
    }
    cell += character;
    backslashes = character === "\\" ? backslashes + 1 : 0;
  }
  cells.push(cell);
  return cells;
}

function precedingBackslashes(source: string, index: number): number {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    count += 1;
  }
  return count;
}

function stripLatexComment(line: string): string {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "%" && precedingBackslashes(line, index) % 2 === 0) {
      return line.slice(0, index);
    }
  }
  return line;
}

// LaTeX drops everything from an unescaped % to the end of the line, so comments
// must not become body text. The image alt and table header comments are
// metadata read back while parsing, so they are the comments kept in the body.
function stripBodyComment(line: string): string {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%" || precedingBackslashes(line, index) % 2 === 1) continue;
    const comment = line.slice(index);
    if (comment.startsWith("% Sentence alt:") || comment.startsWith("% Sentence table header:")) return line;
    return line.slice(0, index).replace(/[ \t]+$/, "");
  }
  return line;
}

function stripBodyComments(source: string): string {
  const lines: string[] = [];
  let verbatim = false;
  for (const line of source.split(/\r?\n/)) {
    if (verbatim) {
      lines.push(line);
      if (line.includes("\\end{verbatim}")) verbatim = false;
      continue;
    }
    if (line.includes("\\begin{verbatim}") && !line.includes("\\end{verbatim}")) {
      lines.push(line);
      verbatim = true;
      continue;
    }
    const stripped = stripBodyComment(line);
    // A comment swallows its own newline in LaTeX, so a comment-only line must
    // not split the paragraph around it.
    if (!stripped.trim() && line.trim()) continue;
    lines.push(stripped);
  }
  return lines.join("\n");
}

function assertBalancedEnvironments(source: string): void {
  const stack: string[] = [];
  const pattern = /\\(begin|end)\{([a-zA-Z*]+)\}/g;
  let verbatim: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    let line: string = verbatim ? rawLine : stripLatexComment(rawLine);
    if (verbatim) {
      const close = line.indexOf(`\\end{${verbatim}}`);
      if (close < 0) continue;
      line = line.slice(close + verbatim.length + 6);
      stack.pop();
      verbatim = null;
    }
    for (const match of line.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (precedingBackslashes(line, index) % 2 === 1) continue;
      const command = match[1];
      const name = match[2];
      if (command === "begin") {
        stack.push(name);
        if (
          name === "verbatim" &&
          !line.includes(`\\end{verbatim}`, index + match[0].length)
        ) {
          verbatim = name;
          break;
        }
      } else if (stack.pop() !== name) {
        throw new Error(`Invalid LaTeX: unbalanced environment "${name}".`);
      }
    }
  }
  if (stack.length > 0) {
    throw new Error(
      `Invalid LaTeX: unbalanced environment "${stack[stack.length - 1]}".`,
    );
  }
}

function assertBalancedBraces(source: string): void {
  let depth = 0;
  let verbatim: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    let line: string = verbatim ? rawLine : stripLatexComment(rawLine);
    if (verbatim) {
      const close = line.indexOf(`\\end{${verbatim}}`);
      if (close < 0) continue;
      line = line.slice(close + verbatim.length + 6);
      verbatim = null;
    }
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character !== "{" && character !== "}") continue;
      if (precedingBackslashes(line, index) % 2 === 1) continue;
      depth += character === "{" ? 1 : -1;
      if (depth < 0) {
        throw new Error("Invalid LaTeX: unexpected closing brace.");
      }
    }
    const verbatimStart = line.match(/\\begin\{verbatim\}/);
    if (
      verbatimStart &&
      !line.includes(
        "\\end{verbatim}",
        (verbatimStart.index ?? 0) + verbatimStart[0].length,
      )
    ) {
      verbatim = "verbatim";
    }
  }
  if (depth > 0) {
    throw new Error("Invalid LaTeX: missing closing brace.");
  }
}

// An unclosed math delimiter is not body text: LaTeX refuses to compile it, and
// reading it as text turns the delimiter into escaped literal characters on the
// way back out. Report it like an unbalanced brace instead.
function assertBalancedMath(source: string): void {
  let dollars = 0;
  // `$$` opens display math as one delimiter, not as two inline dollars, so it
  // needs a partner of its own. Counting the two `$` separately makes a lone
  // opening `$$` look balanced and the formula is then read as text.
  let displayOpen = false;
  let parenOpen = false;
  let bracketOpen = false;
  let verbatim: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    let line: string = verbatim ? rawLine : stripLatexComment(rawLine);
    if (verbatim) {
      const close = line.indexOf(`\\end{${verbatim}}`);
      if (close < 0) continue;
      line = line.slice(close + verbatim.length + 6);
      verbatim = null;
    }
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === "$") {
        if (precedingBackslashes(line, index) % 2 === 1) continue;
        if (line[index + 1] === "$") {
          displayOpen = !displayOpen;
          index += 1;
          continue;
        }
        dollars += 1;
        continue;
      }
      if (line[index] !== "\\" || precedingBackslashes(line, index) % 2 === 1) continue;
      const command = line[index + 1];
      if (command === "h" && line.startsWith("\\href", index)) {
        // The URL argument may hold a literal `$` (an address with a dollar
        // sign), which is part of the link and not a math delimiter.
        const urlOpen = line.indexOf("{", index + 5);
        const urlClose = urlOpen >= 0 ? findMatchingBrace(line, urlOpen) : -1;
        if (urlClose > 0) index = urlClose;
        continue;
      }
      if (command === "(" || command === ")") {
        if (command === "(" && parenOpen) {
          throw new Error('Invalid LaTeX: unclosed math delimiter "\\(".');
        }
        if (command === ")" && !parenOpen) {
          throw new Error('Invalid LaTeX: unexpected closing math delimiter "\\)".');
        }
        parenOpen = command === "(";
      } else if (command === "[" || command === "]") {
        // \\[2pt] is a line-break length, so only the outer backslash counts.
        if (command === "[" && bracketOpen) {
          throw new Error('Invalid LaTeX: unclosed math delimiter "\\[".');
        }
        if (command === "]" && !bracketOpen) {
          throw new Error('Invalid LaTeX: unexpected closing math delimiter "\\]".');
        }
        bracketOpen = command === "[";
      } else {
        continue;
      }
      index += 1;
    }
    const verbatimStart = line.match(/\\begin\{verbatim\}/);
    if (
      verbatimStart &&
      !line.includes(
        "\\end{verbatim}",
        (verbatimStart.index ?? 0) + verbatimStart[0].length,
      )
    ) {
      verbatim = "verbatim";
    }
    // Math mode cannot cross a paragraph break, so every delimiter still open
    // there is unbalanced rather than a formula continuing on the next line.
    if (!line.trim()) {
      if (displayOpen) {
        throw new Error('Invalid LaTeX: unclosed math delimiter "$$".');
      }
      if (dollars % 2 === 1) {
        throw new Error('Invalid LaTeX: unclosed math delimiter "$".');
      }
      if (parenOpen) {
        throw new Error('Invalid LaTeX: unclosed math delimiter "\\(".');
      }
      if (bracketOpen) {
        throw new Error('Invalid LaTeX: unclosed math delimiter "\\[".');
      }
      dollars = 0;
    }
  }
  if (dollars % 2 === 1) {
    throw new Error('Invalid LaTeX: unclosed math delimiter "$".');
  }
  if (displayOpen) {
    throw new Error('Invalid LaTeX: unclosed math delimiter "$$".');
  }
  if (parenOpen) {
    throw new Error('Invalid LaTeX: unclosed math delimiter "\\(".');
  }
  if (bracketOpen) {
    throw new Error('Invalid LaTeX: unclosed math delimiter "\\[".');
  }
}

// A `\begin{document}`/`\end{document}` inside a verbatim environment is code
// shown to the reader, not a document delimiter, so verbatim bodies are blanked
// out before the delimiters are searched. Masking instead of removing keeps the
// offsets aligned with the original source.
function maskVerbatim(latex: string): string {
  const open = "\\begin{verbatim}";
  const close = "\\end{verbatim}";
  let masked = "";
  let index = 0;
  while (index < latex.length) {
    const start = latex.indexOf(open, index);
    if (start < 0) break;
    const end = latex.indexOf(close, start + open.length);
    if (end < 0) break;
    masked += latex.slice(index, start);
    masked += latex.slice(start, end + close.length).replace(/[^\n]/g, " ");
    index = end + close.length;
  }
  return masked + latex.slice(index);
}

// LaTeX ignores a `%`-commented `\begin{document}`/`\end{document}`, so the
// delimiters have to be searched on comment-stripped lines. Searching the raw
// source would let a commented-out `\end{document}` truncate the document.
function findDocumentDelimiter(latex: string, needle: string, from: number): number {
  const masked = maskVerbatim(latex);
  let offset = 0;
  for (const line of masked.split("\n")) {
    const start = offset;
    offset += line.length + 1;
    if (offset <= from) continue;
    const index = stripLatexComment(line).indexOf(needle, Math.max(0, from - start));
    if (index >= 0) return start + index;
  }
  return -1;
}

// LaTeX ignores everything after `\end{document}`, and the body import stops
// there, so text typed after it used to vanish while the source pane kept
// showing it and the save reported success. Only blank lines and comments may
// follow the end marker; anything else is rejected so the draft stays unsaved
// and visible until it is moved inside the document.
function trailingDocumentText(latex: string): string | null {
  for (const line of latex.split(/\r?\n/)) {
    const text = stripLatexComment(line).trim();
    if (text) return text;
  }
  return null;
}

function documentBody(latex: string): string {
  const begin = "\\begin{document}";
  const end = "\\end{document}";
  const beginIndex = findDocumentDelimiter(latex, begin, 0);
  if (beginIndex < 0) {
    throw new Error("Invalid LaTeX: missing \\begin{document}.");
  }
  const endIndex = findDocumentDelimiter(latex, end, beginIndex + begin.length);
  if (endIndex < 0) {
    throw new Error("Invalid LaTeX: missing \\end{document}.");
  }
  const trailing = trailingDocumentText(latex.slice(endIndex + end.length));
  if (trailing) {
    const snippet = trailing.length > 40 ? `${trailing.slice(0, 40)}...` : trailing;
    throw new Error(
      `Invalid LaTeX: text after \\end{document} is not part of the document ("${snippet}"). Move it before \\end{document}.`,
    );
  }
  return latex.slice(beginIndex + begin.length, endIndex);
}

// `\section{Title}\label{sec:title}` puts a reference target on the same line
// as its heading. The label is metadata, not part of the title, so it has to be
// split off before the braces are matched or the last `}` becomes text.
// `\section[Short]{Title}` carries an optional short title for the table of
// contents: it is not heading text either, but it must survive the round trip.
function parseHeadingBlock(
  block: string,
): {
  level: number;
  title: string;
  short: string | null;
  label: string | null;
  unnumbered: boolean;
} | null {
  const labelMatch = block.match(/\\label\{([^{}]*)\}\s*$/);
  const body = (labelMatch ? block.slice(0, labelMatch.index ?? 0) : block).trim();
  const heading = body.match(
    /^\\(section|subsection|subsubsection)(\*?)(?:\[([^\]]*)\])?\{([\s\S]*)\}$/,
  );
  if (!heading) return null;
  return {
    level: heading[1] === "section" ? 1 : heading[1] === "subsection" ? 2 : 3,
    title: heading[4],
    short: heading[3] ?? null,
    label: labelMatch ? labelMatch[1] : null,
    unnumbered: heading[2] === "*",
  };
}

export function latexToDocument(
  latex: string,
  fallbackSettings: ProjectSettings,
): { document: SentenceDocument; settings: ProjectSettings } {
  const settings = { ...fallbackSettings };
  const titleValue = commandArgument(latex, "\\title");
  const authorValue = commandArgument(latex, "\\author");
  const dateValue = commandArgument(latex, "\\date");
  const abstractMatch = latex.match(
    /\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/,
  );
  const keywordsMatch = latex.match(/\\keywords\{([^}]*)\}/);
  const primaryCategoryMatch = latex.match(
    /% arXiv primary category:\s*(.+)/i,
  );
  const crossListMatch = latex.match(
    /% arXiv cross-list categories:\s*(.+)/i,
  );
  const arxivCommentMatch = latex.match(/% arXiv comments:\s*(.+)/i);
  const affiliationMatch = latex.match(/% Sentence affiliation:\s*(.+)/i);
  const emailMatch = latex.match(/% Sentence contact email:\s*(.+)/i);
  const classMatch = latex.match(/\\documentclass\[([^\]]*)\]\{([^}]*)\}/);
  const headerMatch = latex.match(/\\fancyhead\[C\]\{([^}]*)\}/);
  const footerMatch = latex.match(/\\fancyfoot\[C\]\{([^}]*)\}/);
  if (titleValue !== null) settings.title = decodeLatexText(titleValue.trim());
  if (authorValue !== null) {
    settings.author = authorValue
      .split("\\\\")[0]
      .split(/\\and/)
      .map((name) => decodeLatexText(name).trim())
      .filter(Boolean)
      .join("\n");
  }
  if (dateValue !== null) settings.date = decodeLatexText(dateValue.trim());
  if (abstractMatch) {
    settings.abstract = abstractMatch[1]
      .split(/\\par/)
      .map((paragraph) => decodeLatexText(paragraph).trim())
      .join("\n\n");
  }
  if (keywordsMatch) settings.keywords = decodeLatexText(keywordsMatch[1]);
  if (primaryCategoryMatch) settings.primaryCategory = primaryCategoryMatch[1].trim();
  if (crossListMatch) settings.crossListCategories = crossListMatch[1].trim();
  if (arxivCommentMatch) settings.arxivComment = arxivCommentMatch[1].trim();
  if (affiliationMatch) settings.affiliation = affiliationMatch[1].trim();
  if (emailMatch) settings.email = emailMatch[1].trim();
  if (headerMatch) settings.header = decodeLatexText(headerMatch[1]);
  if (footerMatch && footerMatch[1] !== "\\thepage") {
    settings.footer = decodeLatexText(footerMatch[1]);
  }
  if (classMatch) {
    settings.documentClass = classMatch[2] as ProjectSettings["documentClass"];
    const options = classMatch[1].split(",").map((option) => option.trim());
    const size = options.find((option) => /^(10|11|12)pt$/.test(option));
    const paper = options.find((option) => option === "a4paper" || option === "letterpaper");
    if (size) settings.fontSize = size as ProjectSettings["fontSize"];
    if (paper) settings.paperSize = paper as ProjectSettings["paperSize"];
    settings.columns = options.includes("twocolumn") ? "two" : "one";
  }

  const packages = Array.from(latex.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/g))
    .flatMap((match) => match[1].split(","))
    .map((name) => name.trim());
  const setMainFontMatch = latex.match(/\\setmainfont(?:\[[^\]]*\])?\{([^}]*)\}/);
  if (setMainFontMatch) {
    settings.fontFamily =
      setMainFontMatch[1] === "texgyretermes"
        ? "times"
        : setMainFontMatch[1] === "texgyrepagella"
          ? "palatino"
          : "default";
  } else if (packages.includes("mathptmx")) {
    settings.fontFamily = "times";
  } else if (packages.includes("mathpazo")) {
    settings.fontFamily = "palatino";
  } else {
    settings.fontFamily = "default";
  }
  if (packages.includes("setspace")) {
    if (/\\doublespacing/.test(latex)) settings.lineSpacing = "double";
    else if (/\\onehalfspacing/.test(latex)) settings.lineSpacing = "onehalf";
    else settings.lineSpacing = "single";
  } else {
    settings.lineSpacing = "single";
  }
  settings.paragraphSpacing = packages.includes("parskip") ? "gap" : "indent";
  const parskip = latex.match(/\\setlength\{\\parskip\}\{([\d.]+)pt/);
  settings.paragraphSpaceAfter = parskip ? Number(parskip[1]) : 10;
  settings.paragraphSpaceBefore = 0;
  // Only macros from the user's own preamble lines may be expanded; the
  // generated preamble is Sentence's, not the project's.
  const macros = preambleMacros(
    extractCustomPreamble(latex, settings, { type: "doc", content: [] }),
  );

  const body = documentBody(latex);
  assertBalancedEnvironments(body);
  assertBalancedBraces(body);
  assertBalancedMath(body);
  const source = stripBodyComments(body)
    .replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, "")
    .replace(/\\keywords\{[^}]*\}/g, "")
    .replace(/\\maketitle/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}\s*/g, "")
    .replace(/\\bibliography\{[^}]*\}\s*/g, "")
    .replace(/\\tableofcontents\\newpage/g, "")
    .trim();
  const blocks = splitLatexBlocks(expandPreambleMacros(source, macros));
  const content: DocumentNode[] = [];

  let pendingParagraphSpaceBefore = 0;
  for (const block of blocks) {
    const vspace = block.match(/^\\vspace\*?\{([\d.]+)pt\}$/);
    if (vspace) {
      const points = Number(vspace[1]);
      const previous = content[content.length - 1];
      if (previous && previous.type === "paragraph") {
        previous.attrs = { ...(previous.attrs ?? {}), spaceAfter: points };
      } else {
        pendingParagraphSpaceBefore = points;
      }
      continue;
    }
    const aligned = block.match(
      /^\\begin\{(center|flushleft|flushright)\}\s*([\s\S]*?)\s*\\end\{\1\}$/,
    );
    if (aligned) {
      const textAlign =
        aligned[1] === "center" ? "center" : aligned[1] === "flushleft" ? "left" : "right";
      const inner = aligned[2].trim();
      assertSupportedEnvironment(inner);
      const innerMath = mathBlockFromSource(inner, textAlign);
      if (innerMath) {
        content.push(innerMath);
        continue;
      }
      const innerHeading = parseHeadingBlock(inner);
      if (innerHeading) {
        content.push({
          type: "heading",
          attrs: {
            level: innerHeading.level,
            textAlign,
            ...(innerHeading.label ? { label: innerHeading.label } : {}),
            ...(innerHeading.short !== null ? { shortTitle: innerHeading.short } : {}),
            ...(innerHeading.unnumbered ? { unnumbered: true } : {}),
          },
          content: parseInline(innerHeading.title).content,
        });
      } else {
        content.push({
          type: "paragraph",
          attrs: { textAlign },
          content: parseInline(inner).content,
        });
      }
      continue;
    }
    const heading = parseHeadingBlock(block);
    if (heading) {
      content.push({
        type: "heading",
        attrs: {
          level: heading.level,
          ...(heading.label ? { label: heading.label } : {}),
          ...(heading.short !== null ? { shortTitle: heading.short } : {}),
          ...(heading.unnumbered ? { unnumbered: true } : {}),
        },
        content: parseInline(heading.title).content,
      });
      continue;
    }
    if (/^\\begin\{itemize\}[\s\S]*\\end\{itemize\}$/.test(block)) {
      content.push(parseList(block, "bulletList"));
      continue;
    }
    if (/^\\begin\{enumerate\}[\s\S]*\\end\{enumerate\}$/.test(block)) {
      content.push(parseList(block, "orderedList"));
      continue;
    }
    const quote = block.match(/^\\begin\{quote\}([\s\S]*)\\end\{quote\}$/);
    if (quote) {
      const quoteContent: DocumentNode[] = [];
      assertSupportedEnvironment(quote[1]);
      pushBodyParagraphs(quoteContent, quote[1].trim());
      content.push({
        type: "blockquote",
        content: quoteContent.length > 0 ? quoteContent : [{ type: "paragraph" }],
      });
      continue;
    }
    const mathEnvironment = mathBlockFromSource(block);
    if (mathEnvironment) {
      content.push(mathEnvironment);
      continue;
    }
    const verbatim = block.match(/^\\begin\{verbatim\}\n([\s\S]*)\n\\end\{verbatim\}$/);
    if (verbatim) {
      content.push({
        type: "codeBlock",
        content: [{ type: "text", text: verbatim[1] }],
      });
      continue;
    }
    // Only standalone figures are block images. An \includegraphics inside a
    // paragraph belongs to parseInline so it can stay beside the surrounding text.
    const image =
      block.match(
        /\\begin\{figure\}(?:\[[^\]]*\])?[\s\S]*?\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}[\s\S]*?\\end\{figure\}/,
      ) ?? block.match(/^\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}$/);
    if (image) {
      // A caption may hold escaped braces such as \{x\}, so a plain [^}]* match
      // would stop before the real closing brace and keep its backslash.
      const caption = commandArgument(block, "\\caption");
      const captionText = caption ? decodeLatexText(caption) : "";
      // A caption is the fallback alt text, because that is the only text a
      // hand-written figure carries; an explicit alt comment wins over it.
      const altComment = block.match(/% Sentence alt: ([^\r\n]*)/);
      const altText = altComment ? decodeLatexText(altComment[1].trim()) : "";
      content.push({
        type: "image",
        attrs: {
          src: decodeLatexVerbatim(image[1]),
          // LaTeX has one text for a figure: the caption. Show it in the
          // editor and keep it as the alt text for the HTML and Markdown exports.
          alt: altText || captionText,
          caption: captionText,
        },
      });
      continue;
    }
    if (/^\\newpage$/.test(block)) {
      content.push({ type: "pageBreak" });
      continue;
    }
    if (/^\\tableofcontents$/.test(block)) {
      content.push({ type: "toc" });
      continue;
    }
    if (/^\\noindent\\rule/.test(block)) {
      content.push({ type: "horizontalRule" });
      continue;
    }
    if (/^\\begin\{(?:table|tabular)\}/.test(block)) {
      const tabular = tabularContent(block);
      // Booktabs and \hline rules are row separators, not cell text: drop them
      // so a hand-written ruled table imports as its rows instead of rows that
      // begin with the rule name.
      const tabularBody = (tabular?.body ?? block).replace(
        /\\(?:toprule|midrule|bottomrule|hline|addlinespace|cmidrule)(?![a-zA-Z])(?:\([^)]*\))?(?:\{[^}]*\})?/g,
        "",
      );
      const columnAligns = columnSpecAligns(tabular?.spec ?? "").map((char) =>
        char === "c" ? "center" : char === "r" ? "right" : "left",
      );
      // A caption may hold escaped braces such as \{x\}, so a plain [^}]* match
      // would stop before the real closing brace and keep its backslash.
      // The frame around the tabular is where the table's own \caption and
      // \label live: a caption written inside a cell (a picture on a minipage
      // with \captionof) belongs to that picture, not to the table.
      const tabularStart = block.indexOf("\\begin{tabular}");
      const tabularEnd = block.indexOf("\\end{tabular}");
      const tableFrame =
        tabularStart >= 0 && tabularEnd > tabularStart
          ? block.slice(0, tabularStart) + block.slice(tabularEnd)
          : block;
      const caption = commandArgument(tableFrame, "\\caption");
      // A table's \label names the target of a \ref. It is metadata on the
      // table node, not cell text, so the next Refresh from visual keeps it.
      const label = tableFrame.match(/\\label\{([^{}]*)\}/)?.[1];
      const headerless = /% Sentence table header:\s*(?:none|off|false)/i.test(block);
      // A row break may carry an optional vertical-space argument such as
      // \\[4pt]; it is row spacing, not cell text, so it ends the row too.
      const parts = tabularBody.split(/\\\\\s*(?:\[[^\]]*\])?\s*(?:\n|$)/);
      // LaTeX lets the last row end at \end{tabular} without a trailing row
      // break, so a single-row tabular with no \\ at all is still one row.
      // Whatever follows the last row break is not a row, so dropping it keeps
      // an exported trailing \\ from adding a phantom row. Empty rows between
      // row breaks are table structure, though, and must survive: a one-column
      // table keeps its blank body rows, and a 1x1 table keeps its empty cell.
      if (parts.length > 0 && parts[parts.length - 1].trim() === "") parts.pop();
      const rows = tabular ? parts.map((row) => row.trim()) : [];
      if (rows.length > 0) {
        const attrs: Record<string, string> = {};
        if (caption !== null) attrs.caption = decodeLatexText(caption);
        if (label) attrs.label = label;
        content.push({
          type: "table",
          ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
          content: rows.map((row, rowIndex) => {
            let columnOffset = 0;
            return {
              type: "tableRow",
              content: splitTableRow(row).map((rawCell) => {
                const multiColumn = rawCell
                  .trim()
                  .match(/^\\multicolumn\{(\d+)\}\{([^}]*)\}\{([\s\S]*)\}$/);
                const span = multiColumn ? Math.max(1, Number(multiColumn[1])) : 1;
                const spec = multiColumn ? multiColumn[2].replace(/\|/g, "").trim() : "";
                const align = multiColumn
                  ? spec === "c"
                    ? "center"
                    : spec === "r"
                      ? "right"
                      : "left"
                  : columnAligns[columnOffset];
                const cell = (multiColumn ? multiColumn[3] : rawCell).trim();
                const attrs: Record<string, string | number> = {};
                if (align && align !== "left") attrs.align = align;
                if (span > 1) attrs.colspan = span;
                columnOffset += span;
                return {
                  type: rowIndex === 0 && !headerless ? "tableHeader" : "tableCell",
                  ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
                  content: cell.split(/(?<!\\)\\par\b/).map((paragraph) =>
                    tableCellParagraphToNode(paragraph.trim()),
                  ),
                };
              }),
            };
          }),
        });
        continue;
      }
    }
    // Display math can sit inside running text, e.g. "Before $$F=ma$$ after.".
    // Splitting it out keeps the equation a block node instead of letting
    // parseInline read the delimiters as literal dollars and escape them.
    assertSupportedEnvironment(block);
    pushBodyParagraphs(content, block);
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }
  // Keep the user's own preamble lines so the next Refresh from visual writes
  // them back instead of silently reporting a successful sync without them.
  settings.preamble = extractCustomPreamble(latex, settings, {
    type: "doc",
    content,
  });
  // A leading \vspace* (before the first paragraph) has no previous block to
  // attach to, so it becomes that paragraph's Space before.
  if (pendingParagraphSpaceBefore > 0 && content[0]?.type === "paragraph") {
    content[0].attrs = { ...(content[0].attrs ?? {}), spaceBefore: pendingParagraphSpaceBefore };
  }
  return { document: { type: "doc", content }, settings };
}

export function documentPlainText(document: SentenceDocument): string {
  const visit = (node: DocumentNode): string => {
    if (node.text) return node.text;
    if (node.type === "hardBreak") return "\n";
    if (node.type === "footnote") return attribute(node, "text") ?? "";
    const inner = (node.content ?? []).map(visit).join("");
    return ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
      ? `${inner}\n\n`
      : inner;
  };
  return (document.content ?? []).map(visit).join("").trim();
}

export function countWords(document: SentenceDocument): number {
  const text = documentPlainText(document).trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
