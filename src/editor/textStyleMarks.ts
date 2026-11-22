import { Mark, mergeAttributes } from "@tiptap/core";
import { FONT_CSS, SIZE_PX } from "../lib/textStyles";

function stringAttr(attributes: Record<string, unknown> | undefined, name: string): string {
  const value = attributes?.[name];
  return typeof value === "string" ? value : "";
}

export const FontFamilyMark = Mark.create({
  name: "fontFamily",

  addAttributes() {
    return {
      family: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-font-family]",
        getAttrs: (element) => ({
          family: element.getAttribute("data-font-family"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const family = stringAttr(HTMLAttributes, "family");
    const css = FONT_CSS[family] ?? "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-font-family": family,
        style: css ? `font-family: ${css}` : "",
      }),
      0,
    ];
  },
});

export const FontSizeMark = Mark.create({
  name: "fontSize",

  addAttributes() {
    return {
      size: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-font-size]",
        getAttrs: (element) => ({
          size: element.getAttribute("data-font-size"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const size = stringAttr(HTMLAttributes, "size");
    const px = SIZE_PX[size] ?? "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-font-size": size,
        style: px ? `font-size: ${px}` : "",
      }),
      0,
    ];
  },
});

export const ColorMark = Mark.create({
  name: "color",

  addAttributes() {
    return {
      color: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-text-color]",
        getAttrs: (element) => ({
          color: element.getAttribute("data-text-color"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = stringAttr(HTMLAttributes, "color");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-text-color": color,
        style: color ? `color: ${color}` : "",
      }),
      0,
    ];
  },
});

export const HighlightMark = Mark.create({
  name: "highlight",

  addAttributes() {
    return {
      color: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-text-highlight]",
        getAttrs: (element) => ({
          color: element.getAttribute("data-text-highlight"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = stringAttr(HTMLAttributes, "color");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-text-highlight": color,
        style: color ? `background-color: ${color}` : "",
      }),
      0,
    ];
  },
});
