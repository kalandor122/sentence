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

export function tocEntries(editor: Editor): TocEntry[] {
  const counters = [0, 0, 0];
  const entries: TocEntry[] = [];
  editor.state.doc.descendants((node: ProseMirrorNode) => {
    if (node.type.name !== "heading") return;
    // \section*{...} is left out of the contents and does not step the section
    // counter, so the next numbered heading keeps the number it would have had.
    if (node.attrs.unnumbered === true) return;
    const level = Math.min(3, Math.max(1, Number(node.attrs.level ?? 1)));
    counters[level - 1] += 1;
    for (let deeper = level; deeper < counters.length; deeper += 1) counters[deeper] = 0;
    // \section[Short]{Long} makes the PDF contents print the optional short
    // title, so the preview has to show that rather than the heading text.
    const shortTitle = typeof node.attrs.shortTitle === "string" ? node.attrs.shortTitle.trim() : "";
    entries.push({
      level,
      number: counters.slice(0, level).join("."),
      text: shortTitle || node.textContent.trim(),
    });
  });
  return entries;
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
  const [entries, setEntries] = useState(() => tocEntries(editor));

  useEffect(() => {
    const refresh = () => {
      const next = tocEntries(editor);
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
