import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Per-paragraph Space before / Space after, in points (Word's Paragraph dialog).
 *
 * Implemented as a global attribute on the existing paragraph node, so no node
 * replacement is needed. Values are stored on the paragraph's attrs and rendered
 * as inline margins; the LaTeX writer emits them as \vspace* between paragraphs.
 *
 * Adjacent spacing collapses (max of the previous paragraph's after and this
 * one's before) exactly like CSS margins, which is also how it looks on a page.
 */
export const ParagraphSpacing = Extension.create({
  name: "sentenceParagraphSpacing",

  addGlobalAttributes() {
    const styleFor = (attributes: Record<string, unknown>) => {
      const parts: string[] = [];
      const before = Number(attributes.spaceBefore);
      const after = Number(attributes.spaceAfter);
      if (Number.isFinite(before) && before > 0) parts.push(`margin-top:${before}pt`);
      if (Number.isFinite(after) && after > 0) parts.push(`margin-bottom:${after}pt`);
      return parts.join(";");
    };

    return [
      {
        types: ["paragraph"],
        attributes: {
          spaceBefore: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute("data-space-before");
              return value === null ? null : Number(value);
            },
            renderHTML: (attributes) => {
              const value = Number(attributes.spaceBefore);
              return Number.isFinite(value) && value > 0
                ? { "data-space-before": String(value), style: styleFor(attributes) }
                : {};
            },
          },
          spaceAfter: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute("data-space-after");
              return value === null ? null : Number(value);
            },
            renderHTML: (attributes) => {
              const value = Number(attributes.spaceAfter);
              return Number.isFinite(value) && value > 0
                ? { "data-space-after": String(value), style: styleFor(attributes) }
                : {};
            },
          },
        },
      },
    ];
  },
});

/** Apply spacing to every paragraph touched by the selection. */
export function setParagraphSpacing(
  editor: Editor | null,
  patch: { spaceBefore?: number | null; spaceAfter?: number | null },
): void {
  if (!editor) return;
  const { state, view } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  let touched = false;
  state.doc.nodesBetween(from, to, (node: PMNode, pos: number) => {
    if (node.type.name !== "paragraph") return;
    const attrs = { ...node.attrs, ...patch };
    tr.setNodeMarkup(pos, undefined, attrs);
    touched = true;
  });
  if (!touched) {
    // Collapsed caret inside a paragraph: nodesBetween still visits it, but be safe.
    editor.chain().focus().updateAttributes("paragraph", patch).run();
    return;
  }
  view.dispatch(tr);
  editor.commands.focus();
}

/** Current paragraph's spacing, for the toolbar fields. */
export function paragraphSpacingAt(editor: Editor | null): { before: number; after: number } {
  if (!editor) return { before: 0, after: 0 };
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "paragraph") {
      return {
        before: Number(node.attrs.spaceBefore) || 0,
        after: Number(node.attrs.spaceAfter) || 0,
      };
    }
  }
  return { before: 0, after: 0 };
}
