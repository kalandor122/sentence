import type { DocumentNode, SentenceDocument } from "./types";

export interface CommentAnchor {
  markId: string;
  text: string;
  // Offset in the flattened document text, used to pick the closest of several
  // identical occurrences when the mark is restored.
  offset: number;
}

interface TextSlice {
  start: number;
  end: number;
  node: DocumentNode;
}

interface TextRange {
  start: number;
  end: number;
  markId: string;
}

// Blocks are separated so an anchor can never match text that merely happens
// to end one paragraph and start the next.
const BLOCK_BOUNDARY = "\u0000";

function flattenText(document: SentenceDocument): { text: string; slices: TextSlice[] } {
  const slices: TextSlice[] = [];
  let text = "";
  const visit = (nodes: DocumentNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        const value = node.text ?? "";
        slices.push({ start: text.length, end: text.length + value.length, node });
        text += value;
        continue;
      }
      if (node.content?.length) {
        if (text.length > 0) text += BLOCK_BOUNDARY;
        visit(node.content);
      }
    }
  };
  visit(document.content);
  return { text, slices };
}

function closestIndex(text: string, needle: string, expected: number, minimum = 0): number {
  let best = -1;
  let bestDistance = Infinity;
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    if (index >= minimum) {
      const distance = Math.abs(index - expected);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    from = index + 1;
  }
  return best;
}

// Splits a multi-block anchor into the text it covers in each block, with the
// flattened position each piece had before the source changed.
function anchorSegments(anchor: CommentAnchor): Array<{ needle: string; expected: number }> {
  const segments: Array<{ needle: string; expected: number }> = [];
  let start = 0;
  for (const part of anchor.text.split(BLOCK_BOUNDARY)) {
    const needle = part.trim();
    if (needle) segments.push({ needle, expected: anchor.offset + start + part.indexOf(needle) });
    start += part.length + BLOCK_BOUNDARY.length;
  }
  return segments;
}

export function commentAnchors(document: SentenceDocument): CommentAnchor[] {
  const { text, slices } = flattenText(document);
  const found = new Map<string, { markId: string; start: number; end: number }>();
  for (const slice of slices) {
    for (const mark of slice.node.marks ?? []) {
      if (mark.type !== "comment") continue;
      const markId = typeof mark.attrs?.markId === "string" ? mark.attrs.markId : "";
      if (!markId) continue;
      const existing = found.get(markId);
      if (existing) existing.end = Math.max(existing.end, slice.end);
      else found.set(markId, { markId, start: slice.start, end: slice.end });
    }
  }
  return [...found.values()].map(({ markId, start, end }) => ({
    markId,
    // Taken from the flattened text so block boundaries inside the anchor are
    // kept, exactly as the matcher sees them.
    text: text.slice(start, end),
    offset: start,
  }));
}

// Rejecting a tracked deletion puts the text back, but the comment mark it
// carried was dropped with the text. The thread can still exist, so find its
// old anchor in the revision snapshots and highlight the restored words again.
export function restoreThreadComments(
  document: SentenceDocument,
  snapshots: Array<SentenceDocument | undefined>,
  markIds: Iterable<string>,
): SentenceDocument {
  const present = new Set(commentAnchors(document).map((anchor) => anchor.markId));
  const missing = new Set([...markIds].filter((markId) => !present.has(markId)));
  if (missing.size === 0) return document;
  const anchors: CommentAnchor[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot) continue;
    for (const anchor of commentAnchors(snapshot)) {
      if (!missing.has(anchor.markId)) continue;
      if (anchors.some((found) => found.markId === anchor.markId)) continue;
      anchors.push(anchor);
    }
  }
  return anchors.length > 0 ? restoreCommentMarks(document, anchors).document : document;
}

export function restoreCommentMarks(
  document: SentenceDocument,
  anchors: CommentAnchor[],
): { document: SentenceDocument; detached: string[] } {
  if (anchors.length === 0) return { document, detached: [] };
  const { text, slices } = flattenText(document);
  const ranges: TextRange[] = [];
  const detached: string[] = [];
  for (const anchor of anchors) {
    const needle = anchor.text.trim();
    const start = needle ? closestIndex(text, needle, anchor.offset) : -1;
    if (start >= 0) {
      ranges.push({ start, end: start + needle.length, markId: anchor.markId });
      continue;
    }
    // The anchor covers several blocks and one of them changed. Re-anchor each
    // block on its own, in document order, so the comment keeps a highlight on
    // the parts that still exist instead of losing the whole selection.
    let cursor = 0;
    let matched = 0;
    for (const segment of anchorSegments(anchor)) {
      const index = closestIndex(text, segment.needle, Math.max(segment.expected, cursor), cursor);
      if (index < 0) continue;
      ranges.push({ start: index, end: index + segment.needle.length, markId: anchor.markId });
      cursor = index + segment.needle.length;
      matched += 1;
    }
    if (matched === 0) {
      // A comment that no longer matches any text keeps its thread but is no
      // longer highlighted, so the caller can warn about it.
      detached.push(anchor.markId);
    }
  }

  let sliceIndex = 0;
  const visit = (nodes: DocumentNode[]): DocumentNode[] => {
    const result: DocumentNode[] = [];
    for (const node of nodes) {
      if (node.type === "text") {
        const slice = slices[sliceIndex];
        sliceIndex += 1;
        const value = node.text ?? "";
        const start = slice?.start ?? 0;
        const end = start + value.length;
        const hits = ranges.filter((range) => range.start < end && range.end > start);
        if (hits.length === 0) {
          result.push(node);
          continue;
        }
        // Split the text node at every mark boundary so the comment covers
        // only the anchored characters.
        const points = new Set<number>([start, end]);
        for (const hit of hits) {
          points.add(Math.max(start, hit.start));
          points.add(Math.min(end, hit.end));
        }
        const ordered = [...points].sort((left, right) => left - right);
        for (let index = 0; index < ordered.length - 1; index += 1) {
          const from = ordered[index];
          const to = ordered[index + 1];
          if (from >= to) continue;
          const marks = [...(node.marks ?? [])];
          for (const hit of hits) {
            if (!(hit.start <= from && hit.end >= to)) continue;
            if (marks.some((mark) => mark.type === "comment" && mark.attrs?.markId === hit.markId)) continue;
            marks.push({ type: "comment", attrs: { markId: hit.markId } });
          }
          result.push({
            ...node,
            text: value.slice(from - start, to - start),
            ...(marks.length > 0 ? { marks } : {}),
          });
        }
        continue;
      }
      if (node.content?.length) {
        result.push({ ...node, content: visit(node.content) });
      } else {
        result.push(node);
      }
    }
    return result;
  };

  return { document: { ...document, content: visit(document.content) }, detached };
}
