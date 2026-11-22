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

export function escapeLatex(value: string): string {
  return value.replace(/[\\&%$#_{}~^]/g, (character) => SPECIAL_CHARACTERS[character]);
}

export function imageAssetPath(fileName: string): string {
  const safeName = fileName
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "");
  return `assets/images/${safeName || "image.png"}`;
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

export function hasCitations(document: SentenceDocument): boolean {
  return nodesContainCitations(document.content);
}

function plainText(nodes: DocumentNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => node.text ?? plainText(node.content))
    .join("")
    .trim();
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
        rendered = `\\href{${escapeLatex(href)}}{${rendered}}`;
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

function inlineContent(nodes: DocumentNode[] | undefined): string {
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
        return `\\cite{${attribute(node, "key") ?? ""}}`;
      }
      if (node.type === "footnote") {
        return `\\footnote{${escapeLatex(attribute(node, "text") ?? "")}}`;
      }
      if (node.type === "crossReference") {
        return `\\ref{${attribute(node, "label") ?? ""}}`;
      }
      return inlineContent(node.content);
    })
    .join("");
}

function tableCellToLatex(cell: DocumentNode): string {
  const children = cell.content ?? [];
  if (children.every((child) => child.type === "paragraph")) {
    return children.map((child) => inlineContent(child.content)).join("\\par ");
  }
  return inlineContent(children);
}

function tableToLatex(node: DocumentNode): string {
  const rows = (node.content ?? []).filter((row) => row.type === "tableRow");
  const columnCount = Math.max(
    1,
    ...rows.map((row) => (row.content ?? []).filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader").length),
  );
  const body = rows
    .map((row) => {
      const cells = (row.content ?? [])
        .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
        .map(tableCellToLatex);
      return `${cells.join(" & ")} \\\\`;
    })
    .join("\n");
  return [
    "\\begin{table}[htbp]",
    "\\centering",
    `\\begin{tabular}{${"l".repeat(columnCount)}}`,
    "\\hline",
    body,
    "\\hline",
    "\\end{tabular}",
    "\\end{table}",
  ].join("\n");
}

function wrapAlignment(node: DocumentNode, body: string): string {
  if (!body.trim()) return body;
  const align = attribute(node, "textAlign");
  const environment =
    align === "center" ? "center" : align === "right" ? "flushright" : align === "left" ? "flushleft" : "";
  if (!environment) return body;
  return `\\begin{${environment}}\n${body}\n\\end{${environment}}`;
}

function blockToLatex(node: DocumentNode): string {
  switch (node.type) {
    case "paragraph":
      return wrapAlignment(node, inlineContent(node.content));
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const command = level <= 1 ? "section" : level === 2 ? "subsection" : "subsubsection";
      return wrapAlignment(node, `\\${command}{${inlineContent(node.content)}}`);
    }
    case "bulletList":
      return [
        "\\begin{itemize}",
        ...(node.content ?? []).map(listItemToLatex),
        "\\end{itemize}",
      ].join("\n");
    case "orderedList":
      return [
        "\\begin{enumerate}",
        ...(node.content ?? []).map(listItemToLatex),
        "\\end{enumerate}",
      ].join("\n");
    case "blockquote":
      return [
        "\\begin{quote}",
        ...(node.content ?? []).map(blockToLatex),
        "\\end{quote}",
      ].join("\n");
    case "codeBlock":
      return `\\begin{verbatim}\n${inlineContent(node.content)}\n\\end{verbatim}`;
    case "horizontalRule":
      return "\\noindent\\rule{\\linewidth}{0.4pt}";
    case "image":
      return imageToLatex(node);
    case "table":
      return tableToLatex(node);
    case "mathBlock": {
      const environment = node.attrs?.numbered === true ? "equation" : "equation*";
      return `\\begin{${environment}}\n${attribute(node, "latex") ?? ""}\n\\end{${environment}}`;
    }
    case "pageBreak":
      return "\\newpage";
    case "toc":
      return "\\tableofcontents";
    case "text":
      return applyMarks(node.text ?? "", node.marks);
    default:
      return (node.content ?? []).map(blockToLatex).filter(Boolean).join("\n\n");
  }
}

function listItemToLatex(node: DocumentNode): string {
  const content = (node.content ?? [])
    .map((child) => blockToLatex(child))
    .filter(Boolean)
    .join("\n");
  return `\\item ${content}`;
}

function imageToLatex(node: DocumentNode): string {
  const src = attribute(node, "path") ?? attribute(node, "src") ?? "";
  const alt = attribute(node, "alt") ?? "";
  const filename = imageSourcePath(src, alt);
  const width = Number(node.attrs?.width ?? 0);
  const widthArgument = width > 0 ? `width=${(width / 100).toFixed(2)}\\linewidth` : "width=0.8\\linewidth";
  return [
    "\\begin{figure}[htbp]",
    "\\centering",
    `\\includegraphics[${widthArgument}]{${escapeLatex(filename)}}`,
    alt ? `\\caption{${escapeLatex(alt)}}` : "",
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
  if (settings.paragraphSpacing === "gap") lines.push("\\usepackage{parskip}");
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
    .map(blockToLatex)
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
    containsMark(content, "color") || containsMark(content, "highlight");
  return `${arxivComments ? `% Prepared for arXiv\n${arxivComments}\n` : ""}\\documentclass[${settings.fontSize},${settings.paperSize}]{${settings.documentClass}}
${typography}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
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
${title}

\\begin{document}
${title ? "\\maketitle" : ""}
${subtitle}
${abstract}
${keywords}
${settings.includeToc ? "\\tableofcontents\\newpage" : ""}

${body}

${bibliography}

\\end{document}
`;
}

function decodeLatexText(value: string): string {
  return value
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\textasciitilde\{\}/g, "~")
    .replace(/\\textasciicircum\{\}/g, "^")
    .replace(/\\([&%$#_{}])/g, "$1");
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

    const markMatch = remainder.match(/^\\(textbf|textit|underline|sout|texttt|textsuperscript|textsubscript)\{/);
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
          attrs: { href: decodeLatexText(source.slice(urlOpen + 1, urlClose)) },
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

    const dollarMathMatch = remainder.match(/^\$([^$\n]+)\$(?!\$)/);
    if (dollarMathMatch) {
      flush();
      content.push({ type: "mathInline", attrs: { latex: dollarMathMatch[1] } });
      index += dollarMathMatch[0].length;
      continue;
    }

    const citeMatch = remainder.match(/^\\cite\{([^}]*)\}/);
    if (citeMatch) {
      flush();
      content.push({ type: "citation", attrs: { key: citeMatch[1] } });
      index += citeMatch[0].length;
      continue;
    }

    const footnoteMatch = remainder.match(/^\\footnote\{([^}]*)\}/);
    if (footnoteMatch) {
      flush();
      content.push({ type: "footnote", attrs: { text: decodeLatexText(footnoteMatch[1]) } });
      index += footnoteMatch[0].length;
      continue;
    }

    const refMatch = remainder.match(/^\\ref\s*\{([^}]*)\}/);
    if (refMatch) {
      flush();
      content.push({ type: "crossReference", attrs: { label: refMatch[1] } });
      index += refMatch[0].length;
      continue;
    }

    if (remainder.startsWith("\\\\")) {
      flush();
      content.push({ type: "hardBreak" });
      index += 2;
      continue;
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

function parseListItemContent(body: string): DocumentNode[] {
  const content: DocumentNode[] = [];
  let cursor = 0;
  const pushParagraph = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) content.push({ type: "paragraph", content: parseInline(trimmed).content });
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

function splitLatexBlocks(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let depth = 0;
  const flush = () => {
    const block = current.join("\n").trim();
    if (block) blocks.push(block);
    current = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() && depth === 0) {
      flush();
      continue;
    }
    current.push(line);
    for (const match of line.matchAll(/\\(begin|end)\{[a-zA-Z*]+\}/g)) {
      depth += match[1] === "begin" ? 1 : -1;
    }
  }
  flush();
  return blocks;
}

function parseList(source: string, type: "bulletList" | "orderedList"): DocumentNode {
  const environment = type === "bulletList" ? "itemize" : "enumerate";
  const inner = source
    .replace(new RegExp(`^\\\\begin\\{${environment}\\}\\s*`), "")
    .replace(new RegExp(`\\s*\\\\end\\{${environment}\\}$`), "");
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
    content: starts.map((item, index) => ({
      type: "listItem",
      content: parseListItemContent(
        inner.slice(item.bodyStart, starts[index + 1]?.start ?? inner.length),
      ),
    })),
  };
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

function documentBody(latex: string): string {
  const begin = "\\begin{document}";
  const end = "\\end{document}";
  const beginIndex = latex.indexOf(begin);
  if (beginIndex < 0) {
    throw new Error("Invalid LaTeX: missing \\begin{document}.");
  }
  const endIndex = latex.indexOf(end, beginIndex + begin.length);
  if (endIndex < 0) {
    throw new Error("Invalid LaTeX: missing \\end{document}.");
  }
  return latex.slice(beginIndex + begin.length, endIndex);
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
    const options = classMatch[1].split(",");
    const size = options.find((option) => /^(10|11|12)pt$/.test(option));
    const paper = options.find((option) => option === "a4paper" || option === "letterpaper");
    if (size) settings.fontSize = size as ProjectSettings["fontSize"];
    if (paper) settings.paperSize = paper as ProjectSettings["paperSize"];
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

  const body = documentBody(latex);
  assertBalancedEnvironments(body);
  const source = body
    .replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, "")
    .replace(/\\keywords\{[^}]*\}/g, "")
    .replace(/\\maketitle/g, "")
    .replace(/\\bibliographystyle\{[^}]*\}\s*/g, "")
    .replace(/\\bibliography\{[^}]*\}\s*/g, "")
    .replace(/\\tableofcontents\\newpage/g, "")
    .trim();
  const blocks = splitLatexBlocks(source);
  const content: DocumentNode[] = [];

  for (const block of blocks) {
    const aligned = block.match(
      /^\\begin\{(center|flushleft|flushright)\}\s*([\s\S]*?)\s*\\end\{\1\}$/,
    );
    if (aligned) {
      const textAlign =
        aligned[1] === "center" ? "center" : aligned[1] === "flushleft" ? "left" : "right";
      const inner = aligned[2].trim();
      const innerHeading = inner.match(/^\\(section|subsection|subsubsection)\{([\s\S]*)\}$/);
      if (innerHeading) {
        const level =
          innerHeading[1] === "section" ? 1 : innerHeading[1] === "subsection" ? 2 : 3;
        content.push({
          type: "heading",
          attrs: { level, textAlign },
          content: parseInline(innerHeading[2]).content,
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
    const heading = block.match(/^\\(section|subsection|subsubsection)\{([\s\S]*)\}$/);
    if (heading) {
      const level = heading[1] === "section" ? 1 : heading[1] === "subsection" ? 2 : 3;
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInline(heading[2]).content,
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
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: parseInline(quote[1].trim()).content }],
      });
      continue;
    }
    const equation = block.match(/^\\begin\{equation(\*?)\}[\s\S]*?\n([\s\S]*)\n\\end\{equation\1\}$/);
    if (equation) {
      content.push({
        type: "mathBlock",
        attrs: { latex: equation[2].trim(), numbered: equation[1] !== "*" },
      });
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
    const image = block.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/);
    if (image) {
      const caption = block.match(/\\caption\{([^}]*)\}/);
      content.push({
        type: "image",
        attrs: { src: decodeLatexText(image[1]), alt: caption ? decodeLatexText(caption[1]) : "" },
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
      const tabularBody = block.match(
        /\\begin\{tabular\}(?:\s*\{[^{}]*\})?\s*([\s\S]*?)\\end\{tabular\}/,
      )?.[1] ?? block;
      const parts = tabularBody.split(/\\\\\s*(?:\n|$)/);
      const rows =
        parts.length > 1
          ? parts
              .map((row) => row.replace(/^\s*\\hline\s*/, "").trim())
              .filter(Boolean)
          : [];
      if (rows.length > 0) {
        content.push({
          type: "table",
          content: rows.map((row, rowIndex) => ({
            type: "tableRow",
            content: splitTableRow(row).map((cell) => ({
              type: rowIndex === 0 ? "tableHeader" : "tableCell",
              content: cell.trim().split(/(?<!\\)\\par\b/).map((paragraph) => ({
                type: "paragraph",
                content: parseInline(paragraph.trim()).content,
              })),
            })),
          })),
        });
        continue;
      }
    }
    content.push({ type: "paragraph", content: parseInline(block).content });
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
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
