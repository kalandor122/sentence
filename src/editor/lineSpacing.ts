import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { ProjectSettings } from "../lib/types";

type LineSpacing = ProjectSettings["lineSpacing"];

export const LINE_HEIGHTS: Record<LineSpacing, string> = {
  single: "1.72",
  onehalf: "2.15",
  double: "2.6",
};

interface LineSpacingState {
  spacing: LineSpacing;
  decorations: DecorationSet;
}

const lineSpacingKey = new PluginKey<LineSpacingState>("sentenceLineSpacing");

// One node decoration per paragraph, rendered so the markup shows the spacing
// the reader sees. The set is built once per spacing change and mapped through
// later edits: rebuilding it on every transaction re-walked the whole document
// and rebuilt a decoration for every paragraph, which made typing in a long
// manuscript progressively slower.
function paragraphSpacingDecorations(doc: PMNode, spacing: LineSpacing): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === "paragraph") {
      decorations.push(
        Decoration.node(position, position + node.nodeSize, {
          "data-line-spacing": spacing,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

export const LineSpacing = Extension.create({
  name: "sentenceLineSpacing",

  addProseMirrorPlugins() {
    return [
      new Plugin<LineSpacingState>({
        key: lineSpacingKey,
        state: {
          init: (_config, state) => ({
            spacing: "single",
            decorations: paragraphSpacingDecorations(state.doc, "single"),
          }),
          apply(transaction, value, _oldState, newState) {
            const next = transaction.getMeta(lineSpacingKey) as LineSpacing | undefined;
            if (next !== undefined) {
              return {
                spacing: next,
                decorations: paragraphSpacingDecorations(newState.doc, next),
              };
            }
            if (!transaction.docChanged) return value;
            return {
              spacing: value.spacing,
              decorations: value.decorations.map(transaction.mapping, transaction.doc),
            };
          },
        },
        props: {
          decorations(state) {
            return lineSpacingKey.getState(state)?.decorations ?? DecorationSet.empty;
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
