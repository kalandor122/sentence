import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

const pageGapsKey = new PluginKey<DecorationSet>("pageGaps");

export interface PageGap {
  pos: number;
  height: number;
}

// The gap is a block-level widget between two text lines, so the line after it
// starts on the next page without changing the document model. It has no text,
// so selection and copy still see one continuous paragraph.
function pageGapNode(height: number) {
  const gap = document.createElement("span");
  gap.className = "page-gap";
  gap.style.display = "block";
  gap.style.height = `${height}px`;
  gap.setAttribute("aria-hidden", "true");
  gap.setAttribute("contenteditable", "false");
  return gap;
}

export function setPageGaps(view: EditorView, gaps: PageGap[]) {
  const decorations = DecorationSet.create(
    view.state.doc,
    gaps
      .slice()
      .sort((a, b) => a.pos - b.pos)
      .map((gap) =>
        Decoration.widget(gap.pos, () => pageGapNode(gap.height), {
          side: -1,
          key: `page-gap-${gap.height}`,
        }),
      ),
  );
  const transaction = view.state.tr.setMeta(pageGapsKey, decorations);
  transaction.setMeta("addToHistory", false);
  view.dispatch(transaction);
}

export const PageGaps = Extension.create({
  name: "pageGaps",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageGapsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, decorations) {
            const next = transaction.getMeta(pageGapsKey) as DecorationSet | undefined;
            return next ?? decorations.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return pageGapsKey.getState(state);
          },
        },
      }),
    ];
  },
});
