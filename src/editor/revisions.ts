import { Extension, type Editor } from "@tiptap/core";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findDocumentMatches, type FindRange } from "./find";
import {
  deletionAnchor,
  nodeText,
  revisionAuthorClass,
  revisionChanges,
} from "../lib/revisions";
import type { Revision } from "../lib/types";

interface RevisionMarkState {
  revisions: Revision[];
}

const revisionKey = new PluginKey<RevisionMarkState>("sentenceRevisionMarks");

function positionAt(ranges: FindRange[], offset: number): number | null {
  let remaining = offset;
  for (const range of ranges) {
    const length = range.to - range.from;
    if (remaining <= length) return range.from + remaining;
    remaining -= length;
  }
  return ranges.length > 0 ? ranges[ranges.length - 1].to : null;
}

function markInsertion(
  decorations: Decoration[],
  doc: ProseMirrorNode,
  text: string,
  revision: Revision,
  colorClass: string,
  offset = 0,
  length = text.length,
): void {
  if (!text) return;
  const match = findDocumentMatches(doc, text)[0];
  if (!match) return;
  const from = positionAt(match.ranges, offset);
  const to = positionAt(match.ranges, offset + length);
  if (from === null || to === null || to <= from) return;
  decorations.push(
    Decoration.inline(from, to, {
      class: `sentence-revision-insertion ${colorClass}`,
      "data-revision-id": revision.id,
      title: `Inserted by ${revision.author || "Author"}`,
    }),
  );
}

function markDeletion(
  decorations: Decoration[],
  doc: ProseMirrorNode,
  text: string,
  revision: Revision,
  colorClass: string,
  key: string,
  prefix = "",
  suffix = "",
): void {
  if (!text) return;
  // Prefer the text immediately after the removed run; fall back to its left
  // context, then to a direct match (which handles deletions inside a run).
  const anchors: Array<{ text: string; atEnd: boolean }> = [
    { text: suffix.slice(0, 60), atEnd: false },
    { text: prefix.slice(-60), atEnd: true },
    { text, atEnd: true },
  ];
  let position: number | null = null;
  for (const anchor of anchors) {
    const match = findDocumentMatches(doc, anchor.text)[0];
    if (!match) continue;
    position = anchor.atEnd
      ? match.ranges[match.ranges.length - 1].to
      : match.ranges[0].from;
    break;
  }
  if (position === null) return;
  const author = revision.author || "Author";
  const dom = document.createElement("span");
  dom.className = `sentence-revision-deletion ${colorClass}`;
  dom.textContent = text;
  dom.title = `Deleted by ${author}`;
  dom.setAttribute("aria-label", `Deleted by ${author}: ${text}`);
  dom.setAttribute("data-revision-id", revision.id);
  decorations.push(Decoration.widget(position, dom, { side: -1, key: `${revision.id}:${key}` }));
}

// Changes are rendered as decorations rather than document marks: the visual
// model, LaTeX export and saved document never gain review-only content.
export const RevisionMarks = Extension.create({
  name: "sentenceRevisionMarks",

  addProseMirrorPlugins() {
    return [
      new Plugin<RevisionMarkState>({
        key: revisionKey,
        state: {
          init: () => ({ revisions: [] }),
          apply(tr, value) {
            const meta = tr.getMeta(revisionKey) as RevisionMarkState | undefined;
            return meta ? { ...value, ...meta } : value;
          },
        },
        props: {
          decorations(state) {
            const { revisions } = revisionKey.getState(state) ?? { revisions: [] };
            const decorations: Decoration[] = [];
            for (const revision of revisions) {
              if (revision.accepted || revision.rejected) continue;
              const colorClass = revisionAuthorClass(revision.author || "Author");
              for (const change of revisionChanges(revision)) {
                const key = change.path.join(".");
                if (change.kind === "text") {
                  markInsertion(decorations, state.doc, change.after, revision, colorClass, change.prefix.length, change.inserted.length);
                  if (change.removed) {
                    markDeletion(decorations, state.doc, change.removed, revision, colorClass, key, change.prefix, change.suffix);
                  }
                  continue;
                }
                if (change.before === undefined && change.after !== undefined) {
                  markInsertion(decorations, state.doc, nodeText(change.after), revision, colorClass);
                } else if (change.after === undefined) {
                  const anchor = deletionAnchor(revision, change);
                  if (anchor) {
                    markDeletion(decorations, state.doc, anchor.text, revision, colorClass, key, anchor.prefix, anchor.suffix);
                  }
                }
              }
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function setRevisionMarks(editor: Editor, revisions: Revision[]): void {
  if (editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr
      .setMeta(revisionKey, { revisions })
      .setMeta("addToHistory", false),
  );
}
