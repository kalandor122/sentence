import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ProjectSettings } from "../lib/types";

type LineSpacing = ProjectSettings["lineSpacing"];

export const LINE_HEIGHTS: Record<LineSpacing, string> = {
  single: "1.72",
  onehalf: "2.15",
  double: "2.6",
};

const lineSpacingKey = new PluginKey<LineSpacing>("sentenceLineSpacing");

// Line spacing is a document-wide setting, but rendering it on the paragraphs
// keeps the editor markup in step with the spacing the reader actually sees.
export const LineSpacing = Extension.create({
  name: "sentenceLineSpacing",

  addProseMirrorPlugins() {
    return [
      new Plugin<LineSpacing>({
        key: lineSpacingKey,
        state: {
          init: () => "single",
          apply(tr, value) {
            return (tr.getMeta(lineSpacingKey) as LineSpacing | undefined) ?? value;
          },
        },
        props: {
          decorations(state) {
            const spacing = lineSpacingKey.getState(state) ?? "single";
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "paragraph") {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    "data-line-spacing": spacing,
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function setLineSpacing(editor: Editor, spacing: LineSpacing): void {
  if (editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr
      .setMeta(lineSpacingKey, spacing)
      .setMeta("addToHistory", false),
  );
}
