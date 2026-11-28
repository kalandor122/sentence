import { Extension, type Editor } from "@tiptap/core";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findDocumentMatches, type FindMatch, type FindRange } from "./find";
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

type Path = readonly (string | number)[];

// Resolve a stored block path ("content", index, "content", index, ...) to the
// block in the current document and the position just inside its content, so a
// deletion can still be shown when the block has been emptied.
function locateBlock(doc: ProseMirrorNode, path: Path): { node: ProseMirrorNode; position: number } | null {
  let node = doc;
  let contentStart = 0;
  for (let step = 0; step < path.length; step += 2) {
    const index = path[step + 1];
    if (path[step] !== "content" || typeof index !== "number" || index >= node.childCount) return null;
    for (let child = 0; child < index; child += 1) contentStart += node.child(child).nodeSize;
    node = node.child(index);
    contentStart += 1;
  }
  return node === doc ? null : { node, position: contentStart };
}

// A change path starts with the top-level block it was recorded in. Anchoring
// within that block matters: with an identical line earlier in the document the
// first match would draw the decoration in the wrong paragraph. The block is
// only used when it still contains the anchor text, because the editor may have
// moved on to a later revision whose blocks shifted.
function findChangeMatches(doc: ProseMirrorNode, query: string, path: Path | null): FindMatch[] {
  const matches = findDocumentMatches(doc, query);
  const index = path?.[0] === "content" ? path[1] : undefined;
  if (typeof index !== "number" || path === null || path.length < 2 || index >= doc.childCount) return matches;
  let from = 0;
  for (let child = 0; child < index; child += 1) from += doc.child(child).nodeSize;
  const to = from + doc.child(index).nodeSize;
  const inside = matches.filter(
    (match) => match.ranges[0].from >= from && match.ranges[match.ranges.length - 1].to <= to,
  );
  return inside.length ? inside : matches;
}

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
  path: Path | null,
  offset = 0,
  length = text.length,
): void {
  if (!text) return;
  const match = findChangeMatches(doc, text, path)[0];
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

// An atom keeps its content in attributes instead of text, so findDocumentMatches
// cannot see it. Locate the inserted node in its recorded block by type and
// attributes, then mark the node itself as the insertion.
const ATOM_NODE_TYPES = new Set([
  "citation",
  "crossReference",
  "footnote",
  "mathInline",
  "mathBlock",
  "image",
  "inlineImage",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameAttributes(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return Object.keys(right).every((name) => JSON.stringify(left[name]) === JSON.stringify(right[name]));
}

function nodeAtPath(doc: ProseMirrorNode, path: Path): { node: ProseMirrorNode; position: number } | null {
  let node = doc;
  let position = 0;
  for (let step = 0; step < path.length; step += 2) {
    const index = path[step + 1];
    if (path[step] !== "content" || typeof index !== "number" || index >= node.childCount) return null;
    let offset = node === doc ? 0 : 1;
    for (let child = 0; child < index; child += 1) offset += node.child(child).nodeSize;
    position += offset;
    node = node.child(index);
  }
  return node === doc ? null : { node, position };
}

function matchesAtom(child: ProseMirrorNode, type: string, attrs: Record<string, unknown>): boolean {
  return child.type.name === type && sameAttributes(child.attrs as Record<string, unknown>, attrs);
}

function findAtomRange(doc: ProseMirrorNode, node: Record<string, unknown>, path: Path | null): { from: number; to: number } | null {
  if (typeof node.type !== "string" || !ATOM_NODE_TYPES.has(node.type) || !isRecord(node.attrs)) return null;
  const type = node.type;
  const attrs = node.attrs;
  const exact = path ? nodeAtPath(doc, path) : null;
  if (exact && matchesAtom(exact.node, type, attrs)) {
    return { from: exact.position, to: exact.position + exact.node.nodeSize };
  }
  const index = path?.[0] === "content" ? path[1] : undefined;
  let blockStart = 0;
  let blockEnd = doc.content.size;
  if (typeof index === "number" && index < doc.childCount) {
    for (let child = 0; child < index; child += 1) blockStart += doc.child(child).nodeSize;
    blockEnd = blockStart + doc.child(index).nodeSize;
  }
  let range: { from: number; to: number } | null = null;
  doc.descendants((child, position) => {
    if (range) return false;
    if (position < blockStart || position >= blockEnd) return true;
    if (!matchesAtom(child, type, attrs)) return true;
    range = { from: position, to: position + child.nodeSize };
    return false;
  });
  return range;
}

function atomDecoration(
  range: { from: number; to: number },
  revision: Revision,
  colorClass: string,
): Decoration {
  return Decoration.inline(range.from, range.to, {
    class: `sentence-revision-insertion ${colorClass}`,
    "data-revision-id": revision.id,
    title: `Inserted by ${revision.author || "Author"}`,
  });
}

function markAtomInsertion(
  decorations: Decoration[],
  doc: ProseMirrorNode,
  node: unknown,
  revision: Revision,
  colorClass: string,
  path: Path | null,
): void {
  if (!isRecord(node)) return;
  const range = findAtomRange(doc, node, path);
  if (range) {
    decorations.push(atomDecoration(range, revision, colorClass));
    return;
  }
  // A block inserted as a whole (a new paragraph holding only an equation, or a
  // paragraph typed around a new citation) is not an atom itself, but every
  // atom inside it arrived with it, so mark each one.
  if (!Array.isArray(node.content)) return;
  const container = path ? nodeAtPath(doc, path) : null;
  if (!container) return;
  const end = container.position + container.node.nodeSize;
  doc.descendants((child, position) => {
    if (position < container.position) return true;
    if (position >= end) return false;
    if (ATOM_NODE_TYPES.has(child.type.name)) {
      decorations.push(atomDecoration({ from: position, to: position + child.nodeSize }, revision, colorClass));
      return false;
    }
    return true;
  });
}

// An inserted empty block carries no text for the inline insertion mark to
// anchor to, yet the reviewer still needs to see the new paragraph break.
function markBlockInsertion(
  decorations: Decoration[],
  doc: ProseMirrorNode,
  node: unknown,
  revision: Revision,
  colorClass: string,
  path: Path,
): void {
  if (typeof node !== "object" || node === null) return;
  const block = node as { type?: unknown; content?: unknown };
  if (block.type !== "paragraph") return;
  if (Array.isArray(block.content) && block.content.length > 0) return;
  const index = path[0] === "content" ? path[1] : undefined;
  if (typeof index !== "number" || index >= doc.childCount) return;
  const child = doc.child(index);
  if (child.type.name !== "paragraph" || child.content.size > 0) return;
  let position = 0;
  for (let previous = 0; previous < index; previous += 1) position += doc.child(previous).nodeSize;
  const author = revision.author || "Author";
  const dom = document.createElement("span");
  dom.className = `sentence-revision-insertion sentence-revision-paragraph ${colorClass}`;
  dom.textContent = "¶";
  dom.title = `Paragraph break inserted by ${author}`;
  dom.setAttribute("aria-label", `Paragraph break inserted by ${author}`);
  dom.setAttribute("data-revision-id", revision.id);
  decorations.push(Decoration.widget(position + 1, dom, { key: `${revision.id}:${path.join(".")}:paragraph` }));
}

function markDeletion(
  decorations: Decoration[],
  doc: ProseMirrorNode,
  text: string,
  revision: Revision,
  colorClass: string,
  key: string,
  path: Path | null,
  prefix = "",
  suffix = "",
  block: Path | null = null,
): void {
  if (!text) return;
  // Prefer the text immediately after the removed run; fall back to its left
  // context, then to a direct match (which handles deletions inside a run).
  // A repeated phrase can match earlier than the removal: deleting "X " from
  // "tail X tail" leaves "tail tail", where the suffix also starts the
  // paragraph. The prefix and suffix were adjacent around the removed run, so
  // locating them together pins the strike-through to the right occurrence.
  let position: number | null = null;
  if (prefix && suffix) {
    const match = findChangeMatches(doc, `${prefix}${suffix}`, path)[0];
    if (match) position = positionAt(match.ranges, prefix.length);
  }
  const anchors: Array<{ text: string; atEnd: boolean }> = [
    { text: suffix.slice(0, 60), atEnd: false },
    { text: prefix.slice(-60), atEnd: true },
    { text, atEnd: true },
  ];
  if (position === null) {
    for (const anchor of anchors) {
      const match = findChangeMatches(doc, anchor.text, path)[0];
      if (!match) continue;
      position = anchor.atEnd
        ? match.ranges[match.ranges.length - 1].to
        : match.ranges[0].from;
      break;
    }
  }
  if (position === null && block) {
    const located = locateBlock(doc, block);
    if (located?.node.isTextblock && located.node.content.size === 0) position = located.position;
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
                  // An atom's content is an attribute (a citation key, an
                  // equation body). Its value is not a run in the document, so
                  // there is nothing to underline; History lists the change.
                  if (change.path.includes("attrs")) continue;
                  markInsertion(decorations, state.doc, change.after, revision, colorClass, change.path, change.prefix.length, change.inserted.length);
                  if (change.removed) {
                    markDeletion(decorations, state.doc, change.removed, revision, colorClass, key, change.path, change.prefix, change.suffix);
                  }
                  continue;
                }
                if (change.before === undefined && change.after !== undefined) {
                  const text = nodeText(change.after);
                  if (text) {
                    markInsertion(decorations, state.doc, text, revision, colorClass, change.path);
                  }
                  // A new block may also carry atoms, with or without text.
                  markAtomInsertion(decorations, state.doc, change.after, revision, colorClass, change.path);
                  if (!text) {
                    markBlockInsertion(decorations, state.doc, change.after, revision, colorClass, change.path);
                  }
                } else if (change.after === undefined) {
                  const anchor = deletionAnchor(revision, change);
                  if (anchor) {
                    markDeletion(
                      decorations,
                      state.doc,
                      anchor.text,
                      revision,
                      colorClass,
                      key,
                      null,
                      anchor.prefix,
                      anchor.suffix,
                      anchor.block ?? null,
                    );
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
