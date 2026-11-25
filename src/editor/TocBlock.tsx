import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export const TOC_COMPILE_NOTE =
  "Final contents and page numbers are generated when the PDF compiles.";

interface TocEntry {
  level: number;
  number: string;
  text: string;
}

interface TocHeading {
  level: number;
  unnumbered: boolean;
  shortTitle: string;
  text: string;
  // Only the very first top-level node can be the title that the exporter
  // turns into \maketitle and drops from the body.
  first: boolean;
}

interface TocStorage {
  title: string;
  generated: boolean;
}

function tocStorage(editor: Editor | null): TocStorage | undefined {
  return (editor?.storage as unknown as Record<string, TocStorage | undefined> | undefined)?.toc;
}

// The document title is a project setting, not part of the editor document, so
// it travels to the preview through the extension's storage.
export function tocTitle(editor: Editor | null): string {
  const title = tocStorage(editor)?.title;
  return typeof title === "string" ? title : "";
}

export function setTocTitle(editor: Editor, title: string): void {
  if (editor.isDestroyed) return;
  const storage = tocStorage(editor);
  if (!storage || storage.title === title) return;
  storage.title = title;
  // The preview refreshes on transactions; an empty one redraws the entries
  // with the new title without touching the document or its history.
  editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
}

// The Properties switch generates a contents page without placing a block in
// the document. The editor still has to show it, so the extension draws it as
// a decoration from this flag.
export function setGeneratedToc(editor: Editor, generated: boolean): void {
  if (editor.isDestroyed) return;
  const storage = tocStorage(editor);
  if (!storage || storage.generated === generated) return;
  storage.generated = generated;
  editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
}

function tocEntriesFromHeadings(headings: TocHeading[], title: string): TocEntry[] {
  const counters = [0, 0, 0];
  const entries: TocEntry[] = [];
  const normalizedTitle = title.trim().toLocaleLowerCase();
  for (const heading of headings) {
    // \section*{...} is left out of the contents and does not step the section
    // counter, so the next numbered heading keeps the number it would have had.
    if (heading.unnumbered) continue;
    // The exporter turns a first H1 that repeats the document title into
    // \maketitle and drops it from the body, so it is not a contents entry and
    // does not step the section counter either.
    if (
      heading.first &&
      normalizedTitle &&
      heading.level === 1 &&
      heading.text.toLocaleLowerCase() === normalizedTitle
    ) {
      continue;
    }
    const level = Math.min(3, Math.max(1, heading.level));
    counters[level - 1] += 1;
    for (let deeper = level; deeper < counters.length; deeper += 1) counters[deeper] = 0;
    // \section[Short]{Long} makes the PDF contents print the optional short
    // title, so the preview has to show that rather than the heading text.
    entries.push({
      level,
      number: counters.slice(0, level).join("."),
      text: heading.shortTitle || heading.text,
    });
  }
  return entries;
}

function headingsIn(doc: ProseMirrorNode): TocHeading[] {
  const firstNode = doc.firstChild;
  const headings: TocHeading[] = [];
  doc.descendants((node: ProseMirrorNode) => {
    if (node.type.name !== "heading") return;
    headings.push({
      level: Number(node.attrs.level ?? 1),
      unnumbered: node.attrs.unnumbered === true,
      shortTitle: typeof node.attrs.shortTitle === "string" ? node.attrs.shortTitle.trim() : "",
      text: node.textContent.trim(),
      first: node === firstNode,
    });
  });
  return headings;
}

export function tocEntries(editor: Editor, title = ""): TocEntry[] {
  return tocEntriesFromHeadings(headingsIn(editor.state.doc), title);
}

function tocList(entries: TocEntry[]): HTMLElement {
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "toc-block-empty";
    empty.textContent = "Add headings to see the entries.";
    return empty;
  }
  const list = document.createElement("ol");
  list.className = "toc-entries";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = `toc-entry toc-entry-level-${entry.level}`;
    const number = document.createElement("span");
    number.className = "toc-entry-number";
    number.textContent = entry.number;
    const text = document.createElement("span");
    text.className = "toc-entry-text";
    text.textContent = entry.text || "Untitled section";
    item.append(number, text);
    list.append(item);
  }
  return list;
}

// The generated contents is a decoration rather than a node, so it follows
// the headings as they change but adds no second \tableofcontents to the
// serialized document.
export function tocPreviewElement(doc: ProseMirrorNode, title: string): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "toc-block";
  nav.setAttribute("data-toc", "");
  nav.setAttribute("contenteditable", "false");
  nav.setAttribute("aria-label", "Table of contents preview");
  const heading = document.createElement("div");
  heading.className = "toc-block-title";
  heading.textContent = "Table of contents";
  const note = document.createElement("p");
  note.className = "toc-block-note";
  note.textContent = TOC_COMPILE_NOTE;
  nav.append(heading, tocList(tocEntriesFromHeadings(headingsIn(doc), title)), note);
  return nav;
}

// The export prints \tableofcontents\newpage, so the generated preview also
// ends its page. Pagination pads this marker like an inserted page break.
export function tocPageBreakElement(): HTMLElement {
  const pageBreak = document.createElement("div");
  pageBreak.className = "generated-toc-break";
  pageBreak.setAttribute("data-page-break", "");
  pageBreak.setAttribute("aria-hidden", "true");
  return pageBreak;
}

function sameEntries(left: TocEntry[], right: TocEntry[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.level === right[index].level &&
        entry.number === right[index].number &&
        entry.text === right[index].text,
    )
  );
}

function TocNodeView({ editor }: NodeViewProps) {
  const [entries, setEntries] = useState(() => tocEntries(editor, tocTitle(editor)));

  useEffect(() => {
    const refresh = () => {
      const next = tocEntries(editor, tocTitle(editor));
      setEntries((current) => (sameEntries(current, next) ? current : next));
    };
    refresh();
    editor.on("transaction", refresh);
    return () => {
      editor.off("transaction", refresh);
    };
  }, [editor]);

  return (
    <NodeViewWrapper
      as="nav"
      className="toc-block"
      data-toc=""
      contentEditable={false}
      aria-label="Table of contents preview"
    >
      <div className="toc-block-title">Table of contents</div>
      {entries.length > 0 ? (
        <ol className="toc-entries">
          {entries.map((entry) => (
            <li
              className={`toc-entry toc-entry-level-${entry.level}`}
              key={`${entry.number}-${entry.text}`}
            >
              <span className="toc-entry-number">{entry.number}</span>
              <span className="toc-entry-text">{entry.text || "Untitled section"}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="toc-block-empty">Add headings to see the entries.</p>
      )}
      <p className="toc-block-note">{TOC_COMPILE_NOTE}</p>
    </NodeViewWrapper>
  );
}

export function tocNodeView() {
  return ReactNodeViewRenderer(TocNodeView);
}
