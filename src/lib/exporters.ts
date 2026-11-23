import { imageAssetPath } from "./latex";
import { FONT_CSS, SIZE_PX } from "./textStyles";
import type {
  DocumentMark,
  DocumentNode,
  ProjectSettings,
  SentenceDocument,
} from "./types";

export type TextExportFormat = "html" | "markdown";

interface ExportMeta {
  title: string;
  author: string;
  subtitle: string;
  date: string;
  abstract: string;
  keywords: string;
}

const VOID_TAGS = new Set(["br", "hr", "img", "meta", "link", "input"]);

const MARK_TAGS: Record<string, string> = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  u: "underline",
  s: "strike",
  strike: "strike",
  del: "strike",
  code: "code",
  sup: "superscript",
  sub: "subscript",
};

const TAG_MARKS: Record<string, string> = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  u: "underline",
  s: "strike",
  strike: "strike",
  del: "strike",
  code: "code",
  sup: "superscript",
  sub: "subscript",
};

const CSS_FONTS: Record<string, string> = Object.fromEntries(
  Object.entries(FONT_CSS)
    .filter(([, css]) => css)
    .map(([key, css]) => [css, key]),
);
const CSS_SIZES: Record<string, string> = Object.fromEntries(
  Object.entries(SIZE_PX).map(([key, px]) => [px, key]),
);

function attribute(node: DocumentNode, name: string): string {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : "";
}

function markAttribute(mark: DocumentMark, name: string): string {
  const value = mark.attrs?.[name];
  return typeof value === "string" ? value : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/g, "&");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/[\\`*_[\]$<&|~]/g, "\\$&");
}

// Backslash escapes become private-use placeholders before Markdown tokens are
// recognised, then become literal characters again when a text run is emitted.
function protectEscapes(value: string): string {
  return value.replace(/\\(.)/gs, (_, character: string) =>
    String.fromCharCode(0xe000 + character.charCodeAt(0)),
  );
}

function restoreEscapes(value: string): string {
  return value.replace(/[\ue000-\uf8ff]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xe000),
  );
}

function safeUrl(value: string): string {
  return /^(https?:|mailto:|#|\/|\.\/|\.\.\/|assets\/)/i.test(value) ? value : "#";
}

function imageSource(node: DocumentNode): string {
  const src = attribute(node, "path") || attribute(node, "src");
  if (!/^data:/i.test(src)) return src;
  return imageAssetPath(attribute(node, "alt") || "image.png");
}

function plainText(nodes: DocumentNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => node.text ?? plainText(node.content))
    .join("")
    .trim();
}

function styleForMark(mark: DocumentMark): string | null {
  switch (mark.type) {
    case "fontFamily": {
      const css = FONT_CSS[markAttribute(mark, "family")];
      return css ? `font-family: ${css}` : null;
    }
    case "fontSize": {
      const px = SIZE_PX[markAttribute(mark, "size")];
      return px ? `font-size: ${px}` : null;
    }
    case "color": {
      const color = markAttribute(mark, "color");
      return /^#[0-9a-f]{6}$/i.test(color) ? `color: ${color}` : null;
    }
    case "highlight": {
      const color = markAttribute(mark, "color");
      return /^#[0-9a-f]{6}$/i.test(color) ? `background-color: ${color}` : null;
    }
    default:
      return null;
  }
}

function marksFromStyle(style: string): DocumentMark[] {
  const marks: DocumentMark[] = [];
  for (const declaration of style.split(";")) {
    const [property, rawValue] = declaration.split(":");
    if (!rawValue) continue;
    const name = property?.trim().toLowerCase();
    const value = rawValue.trim();
    if (name === "font-family" && CSS_FONTS[value]) {
      marks.push({ type: "fontFamily", attrs: { family: CSS_FONTS[value] } });
    } else if (name === "font-size" && CSS_SIZES[value]) {
      marks.push({ type: "fontSize", attrs: { size: CSS_SIZES[value] } });
    } else if (name === "color" && /^#[0-9a-f]{6}$/i.test(value)) {
      marks.push({ type: "color", attrs: { color: value } });
    } else if (name === "background-color" && /^#[0-9a-f]{6}$/i.test(value)) {
      marks.push({ type: "highlight", attrs: { color: value } });
    }
  }
  return marks;
}

function wrapMark(text: string, mark: DocumentMark, mode: "html" | "markdown"): string {
  switch (mark.type) {
    case "bold": return mode === "markdown" ? `**${text}**` : `<strong>${text}</strong>`;
    case "italic": return mode === "markdown" ? `*${text}*` : `<em>${text}</em>`;
    case "underline": return `<u>${text}</u>`;
    case "strike": return mode === "markdown" ? `~~${text}~~` : `<s>${text}</s>`;
    case "superscript": return `<sup>${text}</sup>`;
    case "subscript": return `<sub>${text}</sub>`;
    case "link": {
      const href = escapeHtml(safeUrl(markAttribute(mark, "href")));
      return mode === "markdown" ? `[${text}](${href})` : `<a href="${href}">${text}</a>`;
    }
    default: {
      const style = styleForMark(mark);
      return style ? `<span style="${escapeHtml(style)}">${text}</span>` : text;
    }
  }
}

function applyMarks(text: string, marks: DocumentMark[] | undefined, mode: "html" | "markdown"): string {
  let rendered = mode === "html" ? escapeHtml(text) : escapeMarkdownText(text);
  for (const mark of marks ?? []) {
    if (mark.type === "code" || mark.type === "inlineCode") {
      rendered = mode === "markdown"
        ? `\`${text.replace(/`/g, "''")}\``
        : `<code>${escapeHtml(text)}</code>`;
    } else if (mark.type !== "comment") {
      rendered = wrapMark(rendered, mark, mode);
    }
  }
  return rendered;
}

function serializeInline(
  nodes: DocumentNode[] | undefined,
  mode: "html" | "markdown",
): string {
  return (nodes ?? [])
    .map((node) => {
      switch (node.type) {
        case "text":
          return applyMarks(node.text ?? "", node.marks, mode);
        case "hardBreak":
          return mode === "html" ? "<br>" : "  \n";
        case "mathInline": {
          const latex = attribute(node, "latex");
          return mode === "html"
            ? `<span class="math" data-latex="${escapeHtml(latex)}">\\(${escapeHtml(latex)}\\)</span>`
            : `$${latex}$`;
        }
        case "citation": {
          const key = attribute(node, "key");
          return mode === "html"
            ? `<span class="citation" data-key="${escapeHtml(key)}">[cite: ${escapeHtml(key)}]</span>`
            : `[cite: ${escapeMarkdownText(key)}]`;
        }
        case "footnote": {
          const note = attribute(node, "text");
          return mode === "html"
            ? `<span class="footnote" data-note="${escapeHtml(note)}">[note: ${escapeHtml(note)}]</span>`
            : `[note: ${escapeMarkdownText(note)}]`;
        }
        case "crossReference": {
          const label = attribute(node, "label");
          return mode === "html"
            ? `<a class="cross-reference" data-label="${escapeHtml(label)}">[ref: ${escapeHtml(label)}]</a>`
            : `[ref: ${escapeMarkdownText(label)}]`;
        }
        case "inlineImage": {
          const src = escapeHtml(imageSource(node));
          const alt = escapeHtml(attribute(node, "alt"));
          return mode === "html"
            ? `<img src="${src}" alt="${alt}">`
            : `![${attribute(node, "alt")}](${imageSource(node)})`;
        }
        default:
          return serializeInline(node.content, mode);
      }
    })
    .join("");
}

function textAlignStyle(node: DocumentNode): string {
  const align = attribute(node, "textAlign");
  if (align !== "left" && align !== "center" && align !== "right") return "";
  return ` style="text-align: ${align}"`;
}

function cellContent(node: DocumentNode, mode: "html" | "markdown"): string {
  const children = node.content ?? [];
  return children
    .map((child) =>
      child.type === "paragraph"
        ? serializeInline(child.content, mode)
        : serializeBlock(child, mode),
    )
    .filter(Boolean)
    .join(mode === "html" ? "" : " ");
}

function tableRows(node: DocumentNode): DocumentNode[][] {
  return (node.content ?? [])
    .filter((row) => row.type === "tableRow")
    .map((row) =>
      (row.content ?? []).filter(
        (cell) => cell.type === "tableCell" || cell.type === "tableHeader",
      ),
    )
    .filter((row) => row.length > 0);
}

function tableToHtml(node: DocumentNode): string {
  const rows = tableRows(node);
  const caption = attribute(node, "caption");
  const cells = (row: DocumentNode[], tag: string) =>
    row
      .map((cell) => {
        const align = attribute(cell, "align");
        const style = align === "center" || align === "right"
          ? ` style="text-align: ${align}"`
          : "";
        return `<${tag}${style}>${cellContent(cell, "html")}</${tag}>`;
      })
      .join("");
  const head = rows[0] ? `<thead><tr>${cells(rows[0], "th")}</tr></thead>` : "";
  const body = rows.slice(1)
    .map((row) => `<tr>${cells(row, "td")}</tr>`)
    .join("");
  return [
    "<table>",
    caption ? `<caption>${escapeHtml(caption)}</caption>` : "",
    head,
    body ? `<tbody>${body}</tbody>` : "",
    "</table>",
  ]
    .filter(Boolean)
    .join("");
}

function tableToMarkdown(node: DocumentNode): string {
  const rows = tableRows(node);
  if (rows.length === 0) return "";
  const alignments = rows[0].map((cell) => attribute(cell, "align"));
  const delimiter = alignments
    .map((align) =>
      align === "center" ? ":---:" : align === "right" ? "---:" : "---",
    )
    .join(" | ");
  const rowToMarkdown = (row: DocumentNode[]) =>
    `| ${row.map((cell) => cellContent(cell, "markdown")).join(" | ")} |`;
  const lines = [
    rowToMarkdown(rows[0]),
    `| ${delimiter} |`,
    ...rows.slice(1).map(rowToMarkdown),
  ];
  return lines.join("\n");
}

function listItemToHtml(node: DocumentNode): string {
  const children = node.content ?? [];
  const paragraphs = children.filter((child) => child.type === "paragraph");
  if (paragraphs.length === 1 && children.length === 1) {
    return serializeInline(paragraphs[0].content, "html");
  }
  return children.map((child) => serializeBlock(child, "html")).join("");
}

function listItemToMarkdown(node: DocumentNode): string {
  return (node.content ?? [])
    .map((child) =>
      child.type === "paragraph"
        ? serializeInline(child.content, "markdown")
        : serializeBlock(child, "markdown"),
    )
    .filter(Boolean)
    .join("\n");
}

function listToMarkdown(node: DocumentNode): string {
  const ordered = node.type === "orderedList";
  const start = Number(node.attrs?.start ?? 1);
  return (node.content ?? [])
    .filter((item) => item.type === "listItem")
    .map((item, index) => {
      const marker = ordered ? `${(Number.isSafeInteger(start) ? start : 1) + index}.` : "-";
      const body = listItemToMarkdown(item).split("\n");
      return [ `${marker} ${body[0] ?? ""}`, ...body.slice(1).map((line) => `  ${line}`) ].join("\n");
    })
    .join("\n");
}

function serializeBlock(node: DocumentNode, mode: "html" | "markdown"): string {
  switch (node.type) {
    case "paragraph":
      return mode === "html"
        ? `<p${textAlignStyle(node)}>${serializeInline(node.content, mode)}</p>`
        : serializeInline(node.content, mode);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      const inner = serializeInline(node.content, mode);
      return mode === "html"
        ? `<h${level}${textAlignStyle(node)}>${inner}</h${level}>`
        : `${"#".repeat(level)} ${inner}`;
    }
    case "bulletList":
    case "orderedList": {
      if (mode === "markdown") return listToMarkdown(node);
      const tag = node.type === "bulletList" ? "ul" : "ol";
      const start = Number(node.attrs?.start ?? 1);
      const startAttr = Number.isSafeInteger(start) && start > 1 ? ` start="${start}"` : "";
      const items = (node.content ?? [])
        .filter((item) => item.type === "listItem")
        .map((item) => `<li>${listItemToHtml(item)}</li>`)
        .join("");
      return `<${tag}${startAttr}>${items}</${tag}>`;
    }
    case "blockquote": {
      const inner = (node.content ?? [])
        .map((child) => serializeBlock(child, mode))
        .filter(Boolean);
      if (mode === "html") return `<blockquote>${inner.join("")}</blockquote>`;
      return inner.map((part) => `> ${part.split("\n").join("\n> ")}`).join("\n>\n");
    }
    case "codeBlock": {
      const code = (node.content ?? []).map((child) => child.text ?? "").join("");
      return mode === "html"
        ? `<pre><code>${escapeHtml(code)}</code></pre>`
        : `\`\`\`\n${code}\n\`\`\``;
    }
    case "mathBlock": {
      const latex = attribute(node, "latex");
      return mode === "html"
        ? `<div class="math" data-latex="${escapeHtml(latex)}">\\[${escapeHtml(latex)}\\]</div>`
        : `$$\n${latex}\n$$`;
    }
    case "horizontalRule":
      return mode === "html" ? "<hr>" : "---";
    case "image": {
      const src = escapeHtml(imageSource(node));
      const alt = escapeHtml(attribute(node, "alt"));
      if (mode === "html") {
        const caption = attribute(node, "alt");
        return `<figure><img src="${src}" alt="${alt}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
      }
      return `![${attribute(node, "alt")}](${imageSource(node)})`;
    }
    case "table":
      return mode === "html" ? tableToHtml(node) : tableToMarkdown(node);
    case "pageBreak":
      return "";
    default:
      return (node.content ?? [])
        .map((child) => serializeBlock(child, mode))
        .filter(Boolean)
        .join(mode === "html" ? "" : "\n\n");
  }
}

function exportMeta(settings: ProjectSettings): ExportMeta {
  return {
    title: settings.title.trim(),
    author: settings.author.trim(),
    subtitle: settings.subtitle.trim(),
    date: settings.date.trim(),
    abstract: settings.abstract.trim(),
    keywords: settings.keywords.trim(),
  };
}

function bodyNodes(document: SentenceDocument, settings: ProjectSettings): DocumentNode[] {
  const content = document.content ?? [];
  const first = content[0];
  const repeatsTitle =
    first?.type === "heading" &&
    Number(first.attrs?.level ?? 1) === 1 &&
    plainText(first.content).toLocaleLowerCase() === settings.title.trim().toLocaleLowerCase();
  return repeatsTitle ? content.slice(1) : content;
}

function authorLine(author: string): string {
  return author.split(/\r?\n|;/).map((name) => name.trim()).filter(Boolean).join(" · ");
}

export function documentToHtml(
  document: SentenceDocument,
  settings: ProjectSettings,
): string {
  const meta = exportMeta(settings);
  const header = [
    meta.title ? `<h1>${escapeHtml(meta.title)}</h1>` : "",
    meta.author || meta.date
      ? `<p class="sentence-byline">${escapeHtml([authorLine(meta.author), meta.date].filter(Boolean).join(" · "))}</p>`
      : "",
    meta.subtitle ? `<p class="sentence-subtitle">${escapeHtml(meta.subtitle)}</p>` : "",
    meta.abstract
      ? `<blockquote class="sentence-abstract">${meta.abstract.split(/\n\s*\n/).map((part) => `<p>${escapeHtml(part.replace(/\s+/g, " ").trim())}</p>`).join("")}</blockquote>`
      : "",
    meta.keywords
      ? `<p class="sentence-keywords"><strong>Keywords:</strong> ${escapeHtml(meta.keywords)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const body = bodyNodes(document, settings)
    .map((node) => serializeBlock(node, "html"))
    .filter(Boolean)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<script type="application/json" id="sentence-metadata">${JSON.stringify(meta).replace(/</g, "\\u003c")}</script>
<style>
body{max-width:46rem;margin:3rem auto;padding:0 1.25rem;font:16px/1.6 Georgia,serif;color:#282a25}
h1,h2,h3{line-height:1.25}.sentence-byline{color:#6c7067}pre,code{font-family:Consolas,monospace}
pre{padding:1rem;background:#f5f4f0;overflow-x:auto}blockquote{border-left:3px solid #c8c3b8;padding-left:1rem;color:#565b54}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d9d5cc;padding:.35rem .6rem;text-align:left}
img{max-width:100%}
</style>
</head>
<body>
<article>
${header ? `<header>\n${header}\n</header>` : ""}
<main>
${body}
</main>
</article>
</body>
</html>
`;
}

export function documentToMarkdown(
  document: SentenceDocument,
  settings: ProjectSettings,
): string {
  const meta = exportMeta(settings);
  const header = [
    meta.title ? `# ${escapeMarkdownText(meta.title)}` : "",
    meta.author || meta.date
      ? `*${escapeMarkdownText([authorLine(meta.author), meta.date].filter(Boolean).join(" · "))}*`
      : "",
    meta.subtitle ? `*${escapeMarkdownText(meta.subtitle)}*` : "",
    meta.abstract
      ? meta.abstract.split(/\n\s*\n/).map((part) => `> ${escapeMarkdownText(part.replace(/\s+/g, " ").trim())}`).join("\n>\n")
      : "",
    meta.keywords ? `**Keywords:** ${escapeMarkdownText(meta.keywords)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const body = bodyNodes(document, settings)
    .map((node) => serializeBlock(node, "markdown"))
    .filter(Boolean)
    .join("\n\n");
  const frontMatter = Object.entries(meta)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  return `---\n${frontMatter}\n---\n\n<!-- sentence-header-start -->\n${header}\n<!-- sentence-header-end -->\n\n${body}\n`;
}

interface HtmlChildText {
  kind: "text";
  value: string;
}

interface HtmlChildElement {
  kind: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlChild[];
}

type HtmlChild = HtmlChildText | HtmlChildElement;

const HTML_TOKEN = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>|[^<]+/g;

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2]);
  }
  return attrs;
}

function parseHtmlTree(source: string): HtmlChild[] {
  const root: HtmlChildElement = { kind: "element", tag: "root", attrs: {}, children: [] };
  const stack: HtmlChildElement[] = [root];
  for (const match of source.matchAll(HTML_TOKEN)) {
    const token = match[0];
    if (token.startsWith("<!")) continue;
    if (!token.startsWith("<")) {
      const current = stack[stack.length - 1];
      const value = decodeHtml(token);
      const previous = current.children[current.children.length - 1];
      if (previous?.kind === "text") previous.value += value;
      else current.children.push({ kind: "text", value });
      continue;
    }
    const tag = (match[1] ?? "").toLowerCase();
    if (!tag) continue;
    if (token.startsWith("</")) {
      const index = stack.map((frame) => frame.tag).lastIndexOf(tag);
      if (index > 0) stack.length = index;
      continue;
    }
    const element: HtmlChildElement = {
      kind: "element",
      tag,
      attrs: parseAttributes(match[2] ?? ""),
      children: [],
    };
    stack[stack.length - 1].children.push(element);
    if (!VOID_TAGS.has(tag) && match[3] !== "/") stack.push(element);
  }
  return root.children;
}

function sameMarks(left: DocumentMark[] | undefined, right: DocumentMark[]): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right);
}

function marksForElement(element: HtmlChildElement): DocumentMark[] {
  const tagMark = TAG_MARKS[element.tag];
  if (tagMark) return [{ type: tagMark }];
  if (element.tag === "span") return marksFromStyle(element.attrs.style ?? "");
  if (element.tag === "a" && element.attrs.class !== "cross-reference") {
    return [{ type: "link", attrs: { href: safeUrl(element.attrs.href ?? "") } }];
  }
  return [];
}

function normalizeInline(source: string): string {
  return protectEscapes(source)
    .replace(/ {2,}\n/g, "<br>")
    .replace(/`([^`]+)`/g, (_, code: string) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) =>
      `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, href: string) =>
      `<a href="${escapeHtml(href)}">${text}</a>`)
    .replace(/\$([^$\n]+)\$/g, (_, latex: string) =>
      `<span class="math" data-latex="${escapeHtml(latex)}"></span>`)
    .replace(/\[cite: ([^\]]+)\]/g, (_, key: string) =>
      `<span class="citation" data-key="${escapeHtml(key)}"></span>`)
    .replace(/\[note: ([^\]]+)\]/g, (_, note: string) =>
      `<span class="footnote" data-note="${escapeHtml(note)}"></span>`)
    .replace(/\[ref: ([^\]]+)\]/g, (_, label: string) =>
      `<a class="cross-reference" data-label="${escapeHtml(label)}"></a>`);
}

function inlineNodesFromHtml(children: HtmlChild[]): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  let buffer = "";
  let marks: DocumentMark[] = [];

  const flush = () => {
    const text = restoreEscapes(buffer);
    buffer = "";
    if (!text) return;
    const previous = nodes[nodes.length - 1];
    if (previous?.type === "text" && sameMarks(previous.marks, marks)) {
      previous.text = `${previous.text ?? ""}${text}`;
    } else {
      nodes.push({
        type: "text",
        text,
        ...(marks.length ? { marks: [...marks] } : {}),
      });
    }
  };

  const visit = (child: HtmlChild) => {
    if (child.kind === "text") {
      buffer += child.value;
      return;
    }
    if (child.tag === "br") {
      flush();
      nodes.push({ type: "hardBreak" });
      return;
    }
    if (child.tag === "img") {
      flush();
      nodes.push({
        type: "inlineImage",
        attrs: {
          src: child.attrs.src ?? "",
          path: child.attrs.src ?? "",
          ...(child.attrs.alt ? { alt: child.attrs.alt } : {}),
        },
      });
      return;
    }
    if (child.attrs.class === "math" || child.attrs["data-latex"] !== undefined) {
      flush();
      nodes.push({ type: "mathInline", attrs: { latex: child.attrs["data-latex"] ?? "" } });
      return;
    }
    if (child.attrs.class === "citation") {
      flush();
      nodes.push({ type: "citation", attrs: { key: child.attrs["data-key"] ?? "" } });
      return;
    }
    if (child.attrs.class === "footnote") {
      flush();
      nodes.push({ type: "footnote", attrs: { text: child.attrs["data-note"] ?? "" } });
      return;
    }
    if (child.attrs.class === "cross-reference") {
      flush();
      nodes.push({ type: "crossReference", attrs: { label: child.attrs["data-label"] ?? "" } });
      return;
    }
    const added = marksForElement(child);
    const previousMarks = marks;
    if (added.length) {
      flush();
      marks = [...marks, ...added];
    }
    child.children.forEach(visit);
    if (added.length) {
      flush();
      marks = previousMarks;
    }
  };

  children.forEach(visit);
  flush();
  return nodes;
}

function parseInlineText(source: string): DocumentNode[] {
  return inlineNodesFromHtml(parseHtmlTree(normalizeInline(source)));
}

function elementText(element: HtmlChildElement): string {
  return element.children
    .map((child) =>
      child.kind === "text" ? child.value : elementText(child),
    )
    .join("");
}

function parseTable(element: HtmlChildElement): DocumentNode {
  const rows: DocumentNode[] = [];
  const visit = (parent: HtmlChildElement) => {
    for (const child of parent.children) {
      if (child.kind !== "element") continue;
      if (child.tag === "tr") {
        const cells = child.children
          .filter((cell): cell is HtmlChildElement => cell.kind === "element")
          .filter((cell) => cell.tag === "th" || cell.tag === "td")
          .map((cell, index) => {
            const align = /text-align:\s*(center|right)/.exec(cell.attrs.style ?? "")?.[1];
            const content = blocksFromHtml(cell.children);
            return {
              type: index === 0 && cell.tag === "th" ? "tableHeader" : "tableCell",
              ...(align ? { attrs: { align } } : {}),
              content: content.length ? content : [{ type: "paragraph" }],
            };
          });
        if (cells.length) rows.push({ type: "tableRow", content: cells });
      } else if (child.tag === "thead" || child.tag === "tbody" || child.tag === "tfoot") {
        visit(child);
      }
    }
  };
  visit(element);
  const caption = element.children.find(
    (child): child is HtmlChildElement => child.kind === "element" && child.tag === "caption",
  );
  return {
    type: "table",
    ...(caption ? { attrs: { caption: elementText(caption) } } : {}),
    content: rows,
  };
}

function blocksFromHtml(children: HtmlChild[]): DocumentNode[] {
  const blocks: DocumentNode[] = [];
  for (const child of children) {
    if (child.kind === "text") {
      if (child.value.trim()) {
        blocks.push({ type: "paragraph", content: inlineNodesFromHtml([child]) });
      }
      continue;
    }
    const heading = /^h([1-6])$/.exec(child.tag);
    if (heading) {
      const align = /text-align:\s*(left|center|right)/.exec(child.attrs.style ?? "")?.[1];
      blocks.push({
        type: "heading",
        attrs: { level: Math.min(3, Number(heading[1])), ...(align ? { textAlign: align } : {}) },
        content: inlineNodesFromHtml(child.children),
      });
      continue;
    }
    if (child.tag === "p") {
      const align = /text-align:\s*(left|center|right)/.exec(child.attrs.style ?? "")?.[1];
      blocks.push({
        type: "paragraph",
        ...(align ? { attrs: { textAlign: align } } : {}),
        content: inlineNodesFromHtml(child.children),
      });
      continue;
    }
    if (child.tag === "ul" || child.tag === "ol") {
      const items = child.children
        .filter((item): item is HtmlChildElement => item.kind === "element" && item.tag === "li")
        .map((item) => {
          const content = blocksFromHtml(item.children);
          return {
            type: "listItem",
            content: content.length ? content : [{ type: "paragraph" }],
          };
        });
      const start = Number(child.attrs.start ?? 1);
      blocks.push({
        type: child.tag === "ul" ? "bulletList" : "orderedList",
        ...(Number.isSafeInteger(start) && start > 1 ? { attrs: { start } } : {}),
        content: items,
      });
      continue;
    }
    if (child.tag === "blockquote") {
      const inner = blocksFromHtml(child.children);
      blocks.push({
        type: "blockquote",
        content: inner.length ? inner : [{ type: "paragraph", content: inlineNodesFromHtml(child.children) }],
      });
      continue;
    }
    if (child.tag === "figure") {
      const image = child.children.find(
        (item): item is HtmlChildElement => item.kind === "element" && item.tag === "img",
      );
      if (image) {
        const caption = child.children.find(
          (item): item is HtmlChildElement => item.kind === "element" && item.tag === "figcaption",
        );
        blocks.push({
          type: "image",
          attrs: {
            src: image.attrs.src ?? "",
            alt: caption ? elementText(caption) : image.attrs.alt ?? "",
          },
        });
      }
      continue;
    }
    if (child.tag === "table") {
      blocks.push(parseTable(child));
      continue;
    }
    if (child.tag === "hr") {
      blocks.push({ type: "horizontalRule" });
      continue;
    }
    if (child.attrs.class === "math") {
      blocks.push({
        type: "mathBlock",
        attrs: { latex: child.attrs["data-latex"] ?? "" },
      });
      continue;
    }
    if (child.attrs.class === "page-break") {
      blocks.push({ type: "pageBreak" });
      continue;
    }
    if (child.tag === "pre") {
      const code = elementText(child).trimEnd();
      if (/\\\(([\s\S]+)\\\)/.test(code) || /\$\$([\s\S]+)\$\$/.test(code)) {
        blocks.push({
          type: "mathBlock",
          attrs: {
            latex: code.replace(/^\\\[|\\\]$/g, "").replace(/^\$\$|\$\$$/g, "").trim(),
          },
        });
      } else {
        blocks.push({ type: "codeBlock", content: [{ type: "text", text: code }] });
      }
      continue;
    }
    if (child.tag === "img") {
      blocks.push({
        type: "image",
        attrs: {
          src: child.attrs.src ?? "",
          alt: child.attrs.alt ?? "",
        },
      });
      continue;
    }
    const inner = blocksFromHtml(child.children);
    if (inner.length) blocks.push(...inner);
    else {
      const inline = inlineNodesFromHtml([child]);
      if (inline.length) blocks.push({ type: "paragraph", content: inline });
    }
  }
  return blocks;
}

function applyMeta(settings: ProjectSettings, meta: unknown): ProjectSettings {
  const next = { ...settings };
  if (!meta || typeof meta !== "object") return next;
  const values = meta as Record<string, unknown>;
  const keys: Array<keyof ExportMeta> = [
    "title", "author", "subtitle", "date", "abstract", "keywords",
  ];
  for (const key of keys) {
    if (typeof values[key] === "string") next[key] = values[key] as string;
  }
  return next;
}

export function htmlToDocument(
  html: string,
  fallbackSettings: ProjectSettings,
): { document: SentenceDocument; settings: ProjectSettings } {
  const metaMatch = /<script type="application\/json" id="sentence-metadata">([\s\S]*?)<\/script>/.exec(html);
  let settings = { ...fallbackSettings };
  if (metaMatch) {
    try {
      settings = applyMeta(settings, JSON.parse(metaMatch[1]));
    } catch {
      // A malformed metadata script must not discard the document body.
    }
  }
  const mainMatch = /<main>([\s\S]*?)<\/main>/.exec(html);
  const content = blocksFromHtml(parseHtmlTree(mainMatch?.[1] ?? html));
  return {
    document: {
      type: "doc",
      content: content.length ? content : [{ type: "paragraph" }],
    },
    settings,
  };
}

function parseFrontMatter(
  markdown: string,
): { meta: Record<string, string>; body: string } {
  if (!markdown.startsWith("---\n")) return { meta: {}, body: markdown };
  const end = markdown.indexOf("\n---", 4);
  if (end < 0) return { meta: {}, body: markdown };
  const meta: Record<string, string> = {};
  for (const line of markdown.slice(4, end).split("\n")) {
    const match = /^([a-z]+):\s*(.+)$/.exec(line);
    if (!match) continue;
    try {
      const value: unknown = JSON.parse(match[2]);
      if (typeof value === "string") meta[match[1]] = value;
    } catch {
      // Ignore front matter this exporter does not understand.
    }
  }
  return { meta, body: markdown.slice(end + 4) };
}

function leadingSpaces(line: string): number {
  return line.match(/^ */)?.[0].length ?? 0;
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (!line.trim() || /^(#{1,6}\s|```|\$\$|\s*>|\s*[-*+]\s|\s*\d+[.)]\s|<!--|---\s*$)/.test(line)) {
    return true;
  }
  return line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[index + 1] ?? "");
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === "|" && trimmed[index - 1] !== "\\") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseMarkdownList(lines: string[], start: number): { node: DocumentNode; next: number } {
  const first = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[start]);
  const indent = first?.[1].length ?? 0;
  const ordered = Boolean(first?.[2].match(/^\d/));
  const startValue = Number((first?.[2] ?? "1").match(/^\d+/)?.[0] ?? 1);
  const items: DocumentNode[] = [];
  let index = start;
  while (index < lines.length) {
    const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
    if (!match || match[1].length !== indent || Boolean(match[2].match(/^\d/)) !== ordered) break;
    const itemLines = [match[3]];
    index += 1;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        const following = lines[index + 1];
        if (following && leadingSpaces(following) > indent) {
          itemLines.push("");
          index += 1;
          continue;
        }
        break;
      }
      if (leadingSpaces(line) <= indent) break;
      itemLines.push(line.slice(Math.min(line.length, indent + 2)));
      index += 1;
    }
    const content = parseMarkdownBlocks(itemLines);
    items.push({
      type: "listItem",
      content: content.length ? content : [{ type: "paragraph" }],
    });
  }
  return {
    node: {
      type: ordered ? "orderedList" : "bulletList",
      ...(ordered && Number.isSafeInteger(startValue) && startValue > 1
        ? { attrs: { start: startValue } }
        : {}),
      content: items,
    },
    next: index,
  };
}

function parseMarkdownBlocks(lines: string[]): DocumentNode[] {
  const blocks: DocumentNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("<!--")) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "codeBlock", content: [{ type: "text", text: code.join("\n") }] });
      continue;
    }
    if (line.trim() === "$$") {
      const latex: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        latex.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "mathBlock", attrs: { latex: latex.join("\n").trim() } });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        attrs: { level: Math.min(3, heading[1].length) },
        content: parseInlineText(heading[2]),
      });
      index += 1;
      continue;
    }
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      blocks.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      const paragraphs = parseMarkdownBlocks(quoted);
      blocks.push({
        type: "blockquote",
        content: paragraphs.length ? paragraphs : [{ type: "paragraph" }],
      });
      continue;
    }
    if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) {
      const list = parseMarkdownList(lines, index);
      blocks.push(list.node);
      index = list.next;
      continue;
    }
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[index + 1] ?? "")) {
      const header = splitMarkdownRow(line);
      const alignments = splitMarkdownRow(lines[index + 1]).map((value) =>
        value.startsWith(":") && value.endsWith(":")
          ? "center"
          : value.endsWith(":")
            ? "right"
            : "left",
      );
      index += 2;
      const rows: DocumentNode[][] = [header].map((cells, rowIndex) =>
        cells.map((cell, columnIndex) => {
          const align = alignments[columnIndex];
          return {
            type: rowIndex === 0 ? "tableHeader" : "tableCell",
            ...(align && align !== "left" ? { attrs: { align } } : {}),
            content: [{ type: "paragraph", content: parseInlineText(cell) }],
          };
        }),
      );
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(
          splitMarkdownRow(lines[index]).map((cell, columnIndex) => {
            const align = alignments[columnIndex];
            return {
              type: "tableCell",
              ...(align && align !== "left" ? { attrs: { align } } : {}),
              content: [{ type: "paragraph", content: parseInlineText(cell) }],
            };
          }),
        );
        index += 1;
      }
      blocks.push({ type: "table", content: rows.map((row) => ({ type: "tableRow", content: row })) });
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (image) {
      blocks.push({
        type: "image",
        attrs: { src: image[2], alt: image[1] },
      });
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: parseInlineText(paragraph.join("\n")) });
  }
  return blocks;
}

export function markdownToDocument(
  markdown: string,
  fallbackSettings: ProjectSettings,
): { document: SentenceDocument; settings: ProjectSettings } {
  const { meta, body } = parseFrontMatter(markdown);
  const settings = applyMeta(fallbackSettings, meta);
  const source = body
    .replace(/<!-- sentence-header-start -->[\s\S]*?<!-- sentence-header-end -->/, "")
    .trim();
  const content = parseMarkdownBlocks(source.split(/\r?\n/));
  return {
    document: {
      type: "doc",
      content: content.length ? content : [{ type: "paragraph" }],
    },
    settings,
  };
}
