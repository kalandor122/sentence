import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface FindRange {
  from: number;
  to: number;
}

export interface FindMatch {
  ranges: FindRange[];
}

export function findTextRanges(text: string, query: string): FindRange[] {
  if (!query) return [];
  const needle = query.toLocaleLowerCase();
  const haystack = text.toLocaleLowerCase();
  const ranges: FindRange[] = [];
  let at = 0;
  while (at <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, at);
    if (found < 0) break;
    ranges.push({ from: found, to: found + needle.length });
    at = found + needle.length;
  }
  return ranges;
}

// Flatten the ProseMirror document into searchable text while keeping a map
// back to document positions. Text splits caused by marks stay searchable;
// block boundaries become newlines so matches cannot cross paragraphs.
export function findDocumentMatches(doc: ProseMirrorNode, query: string): FindMatch[] {
  if (!query) return [];
  const needle = query.toLocaleLowerCase();
  let text = "";
  const segments: Array<{ start: number; end: number; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      segments.push({ start: text.length, end: text.length + node.text.length, pos });
      text += node.text;
    } else if (node.isBlock && text.length) {
      text += "\n";
    }
  });

  const matches: FindMatch[] = [];
  const haystack = text.toLocaleLowerCase();
  let at = 0;
  while (at <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, at);
    if (found < 0) break;
    at = found + needle.length;
    const ranges: FindRange[] = [];
    for (const segment of segments) {
      const start = Math.max(found, segment.start);
      const end = Math.min(found + needle.length, segment.end);
      if (start < end) {
        ranges.push({
          from: segment.pos + start - segment.start,
          to: segment.pos + end - segment.start,
        });
      }
    }
    if (ranges.length) matches.push({ ranges });
  }
  return matches;
}

interface FindPluginState {
  query: string;
  current: number;
}

const findKey = new PluginKey<FindPluginState>("sentenceFind");

export const FindHighlight = Extension.create({
  name: "findHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<FindPluginState>({
        key: findKey,
        state: {
          init: () => ({ query: "", current: 0 }),
          apply(tr, value) {
            const meta = tr.getMeta(findKey) as Partial<FindPluginState> | undefined;
            return meta ? { ...value, ...meta } : value;
          },
        },
        props: {
          decorations(state) {
            const { query, current } = findKey.getState(state) ?? { query: "", current: 0 };
            if (!query) return DecorationSet.empty;
            const matches = findDocumentMatches(state.doc, query);
            return DecorationSet.create(
              state.doc,
              matches.flatMap((match, index) =>
                match.ranges.map((range) =>
                  Decoration.inline(range.from, range.to, {
                    class: index === current ? "sentence-find-current" : "sentence-find-match",
                  }),
                ),
              ),
            );
          },
        },
      }),
    ];
  },
});

export function setFindHighlight(editor: Editor, query: string, current: number): void {
  if (editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr
      .setMeta(findKey, { query, current })
      .setMeta("addToHistory", false),
  );
}
