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

function closestIndex(text: string, needle: string, expected: number): number {
  let best = -1;
  let bestDistance = Infinity;
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    const distance = Math.abs(index - expected);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
    from = index + 1;
  }
  return best;
}

export function commentAnchors(document: SentenceDocument): CommentAnchor[] {
  const found = new Map<string, CommentAnchor>();
  for (const slice of flattenText(document).slices) {
    for (const mark of slice.node.marks ?? []) {
      if (mark.type !== "comment") continue;
      const markId = typeof mark.attrs?.markId === "string" ? mark.attrs.markId : "";
      if (!markId) continue;
      const text = slice.node.text ?? "";
      const existing = found.get(markId);
      if (existing) existing.text += text;
      else found.set(markId, { markId, text, offset: slice.start });
    }
  }
  return [...found.values()];
}

export function restoreCommentMarks(
  document: SentenceDocument,
  anchors: CommentAnchor[],
): { document: SentenceDocument; detached: string[] } {
  if (anchors.length === 0) return { document, detached: [] };
  const { text } = flattenText(document);
  const ranges: TextRange[] = [];
  const detached: string[] = [];
  for (const anchor of anchors) {
    const needle = anchor.text.trim();
    const start = needle ? closestIndex(text, needle, anchor.offset) : -1;
    if (start < 0) {
      // A comment that no longer matches any text keeps its thread but is no
      // longer highlighted, so the caller can warn about it.
      detached.push(anchor.markId);
      continue;
    }
    ranges.push({ start, end: start + needle.length, markId: anchor.markId });
  }

  let offset = 0;
  const visit = (nodes: DocumentNode[]): DocumentNode[] => {
    const result: DocumentNode[] = [];
    for (const node of nodes) {
      if (node.type === "text") {
        const value = node.text ?? "";
        const start = offset;
        const end = start + value.length;
        offset = end;
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
        if (offset > 0) offset += BLOCK_BOUNDARY.length;
        result.push({ ...node, content: visit(node.content) });
      } else {
        result.push(node);
      }
    }
    return result;
  };

  return { document: { ...document, content: visit(document.content) }, detached };
}
