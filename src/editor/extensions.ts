import { Mark, Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { katexNodeView } from "./KatexMath";

function stringAttribute(node: { attrs?: Record<string, unknown> }, name: string): string {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : "";
}

export const ProjectImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-path"),
        renderHTML: (attributes) =>
          attributes.path ? { "data-path": attributes.path } : {},
      },
    };
  },
});

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  addNodeView() {
    return katexNodeView();
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math-inline]",
        getAttrs: (element) => ({
          latex: element.getAttribute("data-latex") ?? element.textContent ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = stringAttribute({ attrs: HTMLAttributes }, "latex");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math-inline": "",
        "data-latex": latex,
        class: "math-inline",
        title: latex,
      }),
      latex,
    ];
  },
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
      numbered: { default: false },
    };
  },

  addNodeView() {
    return katexNodeView();
  },

  parseHTML() {
    return [
      {
        tag: "div[data-math-block]",
        getAttrs: (element) => ({
          latex: element.getAttribute("data-latex") ?? element.textContent ?? "",
          numbered: element.getAttribute("data-numbered") === "true",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = stringAttribute({ attrs: HTMLAttributes }, "latex");
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-math-block": "",
        "data-latex": latex,
        "data-numbered": HTMLAttributes.numbered ? "true" : "false",
        class: "math-block",
      }),
      latex,
    ];
  },
});

export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-citation]",
        getAttrs: (element) => ({
          key: element.getAttribute("data-key") ?? element.textContent?.replace(/^\[|\]$/g, "") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const key = stringAttribute({ attrs: HTMLAttributes }, "key");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-citation": "",
        "data-key": key,
        class: "citation",
        title: `Citation: ${key}`,
      }),
      `[${key}]`,
    ];
  },
});

export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "sup[data-footnote]",
        getAttrs: (element) => ({
          text: element.getAttribute("data-text") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const text = stringAttribute({ attrs: HTMLAttributes }, "text");
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote": "",
        "data-text": text,
        class: "footnote",
        title: text,
      }),
      "1",
    ];
  },
});

export const CrossReference = Node.create({
  name: "crossReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-cross-reference]",
        getAttrs: (element) => ({
          label: element.getAttribute("data-label") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const label = stringAttribute({ attrs: HTMLAttributes }, "label");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-cross-reference": "",
        "data-label": label,
        class: "cross-reference",
      }),
      `ref: ${label}`,
    ];
  },
});

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "",
        class: "page-break",
        contenteditable: "false",
      }),
      ["span", { class: "page-break-band" }, "Page break"],
    ];
  },
});

export const TableOfContents = Node.create({
  name: "toc",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "div[data-toc]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-toc": "",
        class: "toc-block",
        contenteditable: "false",
      }),
      "Table of contents",
    ];
  },
});

export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,

  addAttributes() {
    return {
      markId: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (element) => ({
          markId: element.getAttribute("data-comment-id"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-comment-id": HTMLAttributes.markId,
        class: "comment-highlight",
      }),
      0,
    ];
  },
});
