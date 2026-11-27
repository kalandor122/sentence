// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { liftEmptyNestedItem, isListActive, splitListItemKeepingSublist, splitOrderedListOnEmptyItem, toggleList } from "./listToggle";

function createEditor(content: string): Editor {
  return new Editor({ extensions: [StarterKit], content });
}

function paragraphs(...texts: string[]) {
  return texts.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));
}

function expectParagraphs(editor: Editor, ...texts: string[]) {
  const blocks = (editor.getJSON().content ?? []).filter((node) => node.type !== "paragraph" || node.content?.length);
  expect(blocks).toEqual(paragraphs(...texts));
}

// StarterKit's trailing-node extension appends an empty paragraph when the
// document ends with a list; ignore it when comparing the converted blocks.
function getHTML(editor: Editor): string {
  return editor.getHTML().replace(/<p><\/p>$/, "");
}

describe("toggleList", () => {
  it("converts a fully selected bullet list to paragraphs", () => {
    const editor = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    editor.commands.selectAll();
    expect(isListActive(editor, "bulletList")).toBe(true);
    expect(toggleList(editor, "bulletList")).toBe(true);
    expectParagraphs(editor, "one", "two");
    editor.destroy();
  });

  it("converts a fully selected numbered list to paragraphs", () => {
    const editor = createEditor("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    editor.commands.selectAll();
    expect(isListActive(editor, "orderedList")).toBe(true);
    expect(toggleList(editor, "orderedList")).toBe(true);
    expectParagraphs(editor, "one", "two");
    editor.destroy();
  });

  it("keeps ordinary blocks while unwrapping the selected list", () => {
    const editor = createEditor("<p>intro</p><ul><li><p>one</p></li></ul>");
    editor.commands.selectAll();
    expect(toggleList(editor, "bulletList")).toBe(true);
    expectParagraphs(editor, "intro", "one");
    editor.destroy();
  });

  it("converts a fully selected bullet list to a numbered list", () => {
    const editor = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    editor.commands.selectAll();
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    editor.destroy();
  });

  it("converts a fully selected numbered list to a bulleted list", () => {
    const editor = createEditor("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    editor.commands.selectAll();
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    editor.destroy();
  });

  it("converts the selected list in place and leaves other blocks alone", () => {
    const editor = createEditor(
      "<p>intro</p><ul><li><p>one</p></li><li><p>two</p></li></ul><p>outro</p>",
    );
    editor.commands.selectAll();
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<p>intro</p><ol><li><p>one</p></li><li><p>two</p></li></ol><p>outro</p>",
    );
    editor.destroy();
  });

  it("keeps nested sublists when converting the whole document", () => {
    const editor = createEditor(
      "<p>intro</p><ul><li><p>one</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    editor.commands.selectAll();
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<p>intro</p><ol><li><p>one</p><ol><li><p>child</p></li></ol></li></ol>",
    );
    editor.destroy();
  });
});

describe("isListActive", () => {
  function selectText(editor: Editor, text: string) {
    let pos = -1;
    editor.state.doc.descendants((node, offset) => {
      if (pos >= 0) return false;
      if (node.isText && node.text === text) pos = offset + 1;
      return pos < 0;
    });
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);
  }

  it("reports only the list type that holds the caret in a nested list", () => {
    const bulletParent = createEditor(
      "<ul><li><p>parent</p><ol><li><p>child one</p></li><li><p>child two</p></li></ol></li></ul>",
    );
    selectText(bulletParent, "child two");
    expect(isListActive(bulletParent, "orderedList")).toBe(true);
    expect(isListActive(bulletParent, "bulletList")).toBe(false);
    selectText(bulletParent, "parent");
    expect(isListActive(bulletParent, "bulletList")).toBe(true);
    expect(isListActive(bulletParent, "orderedList")).toBe(false);
    bulletParent.destroy();

    const numberedParent = createEditor(
      "<ol><li><p>parent</p><ul><li><p>child one</p></li><li><p>child two</p></li></ul></li></ol>",
    );
    selectText(numberedParent, "child one");
    expect(isListActive(numberedParent, "bulletList")).toBe(true);
    expect(isListActive(numberedParent, "orderedList")).toBe(false);
    selectText(numberedParent, "parent");
    expect(isListActive(numberedParent, "orderedList")).toBe(true);
    expect(isListActive(numberedParent, "bulletList")).toBe(false);
    numberedParent.destroy();
  });
});

describe("removing one bulleted item", () => {
  it("removes the bullet on the last item", () => {
    const editor = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    // End of "two".
    editor.commands.setTextSelection(12);
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe("<ul><li><p>one</p></li></ul><p>two</p>");
    editor.destroy();
  });

  it("removes the bullet instead of only outdenting a nested item", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>inner one</p></li><li><p>inner two</p></li></ul></li></ul>",
    );
    // End of "inner one", before its sibling.
    editor.commands.setTextSelection(21);
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>outer</p><p>inner one</p><ul><li><p>inner two</p></li></ul></li></ul>",
    );
    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe("inner one");
    editor.destroy();
  });

  it("removes the bullet from every selected nested item", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>inner one</p></li><li><p>inner two</p></li></ul></li></ul>",
    );
    // Entire text of both nested items.
    editor.commands.setTextSelection({ from: 12, to: 33 });
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>outer</p><p>inner one</p><p>inner two</p></li></ul>",
    );
    editor.destroy();
  });

  it("removes the bullet from a child selected with its parent", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    // From "outer" down to "child".
    editor.commands.setTextSelection({ from: 4, to: 16 });
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe("<p>outer</p><p>child</p>");
    editor.destroy();
  });

  it("removes the bullets when the selection starts in the nested item", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>child</p></li></ul></li><li><p>second</p></li></ul>",
    );
    // From "child" down to the following top-level item.
    editor.commands.setTextSelection({ from: 14, to: 26 });
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe("<p>outer</p><p>child</p><p>second</p>");
    editor.destroy();
  });

  it("keeps the sublist items the selection does not reach", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>child one</p></li><li><p>child two</p></li></ul></li></ul>",
    );
    // From "outer" down to "child one".
    editor.commands.setTextSelection({ from: 4, to: 20 });
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<p>outer</p><p>child one</p><ul><li><p>child two</p></li></ul>",
    );
    editor.destroy();
  });
});

describe("re-bulleting a paragraph left inside an item", () => {
  function caretAfter(editor: Editor, text: string) {
    let pos = -1;
    editor.state.doc.descendants((node, offset) => {
      if (pos >= 0) return false;
      if (node.isText && node.text === text) pos = offset + node.nodeSize;
      return pos < 0;
    });
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);
  }

  it("does not report a marker on the paragraph the bullet was removed from", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><p>inner one</p><ul><li><p>inner two</p></li></ul></li></ul>",
    );
    caretAfter(editor, "inner one");
    expect(isListActive(editor, "bulletList")).toBe(false);
    expect(isListActive(editor, "orderedList")).toBe(false);
    editor.destroy();
  });

  it("restores the bullet and leaves the parent item alone", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>inner one</p></li><li><p>inner two</p></li></ul></li></ul>",
    );
    caretAfter(editor, "inner one");
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>outer</p><p>inner one</p><ul><li><p>inner two</p></li></ul></li></ul>",
    );
    expect(isListActive(editor, "bulletList")).toBe(false);
    expect(toggleList(editor, "bulletList")).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>outer</p><ul><li><p>inner one</p></li><li><p>inner two</p></li></ul></li></ul>",
    );
    expect(isListActive(editor, "bulletList")).toBe(true);
    editor.destroy();
  });
});

describe("removing one numbered item", () => {
  // Positions run from the list start; an item's paragraph opens one past the
  // item start, so the cursor inside "two" below sits at 8.
  it("continues the trailing items at the number they already had", () => {
    const editor = createEditor(
      "<ol><li><p>one</p></li><li><p>two</p></li><li><p>three</p></li><li><p>four</p></li></ol>",
    );
    editor.commands.setTextSelection(8);
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      '<ol><li><p>one</p></li></ol><p>two</p><ol start="3"><li><p>three</p></li><li><p>four</p></li></ol>',
    );
    editor.destroy();
  });

  it("keeps the numbers of the items below a removed leading item", () => {
    const editor = createEditor(
      "<ol><li><p>one</p></li><li><p>two</p></li><li><p>three</p></li></ol>",
    );
    editor.commands.setTextSelection(2);
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      '<p>one</p><ol start="2"><li><p>two</p></li><li><p>three</p></li></ol>',
    );
    editor.destroy();
  });

  it("keeps an explicit start when continuing a list", () => {
    const editor = createEditor(
      '<ol start="4"><li><p>four</p></li><li><p>five</p></li><li><p>six</p></li></ol>',
    );
    editor.commands.setTextSelection(11);
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      '<ol start="4"><li><p>four</p></li></ol><p>five</p><ol start="6"><li><p>six</p></li></ol>',
    );
    editor.destroy();
  });

  it("keeps a nested sublist with the item it belongs to", () => {
    const editor = createEditor(
      "<ol><li><p>one</p></li><li><p>two</p><ul><li><p>child</p></li></ul></li><li><p>three</p></li></ol>",
    );
    // End of "two", right before its nested list.
    editor.commands.setTextSelection(13);
    expect(toggleList(editor, "orderedList")).toBe(true);
    expect(getHTML(editor)).toBe(
      '<ol><li><p>one</p></li></ol><p>two</p><ul><li><p>child</p></li></ul><ol start="3"><li><p>three</p></li></ol>',
    );
    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe("two");
    editor.destroy();
  });

  it("leaves the selection in the unnumbered paragraph", () => {
    const editor = createEditor(
      "<ol><li><p>one</p></li><li><p>two</p></li><li><p>three</p></li></ol>",
    );
    editor.commands.setTextSelection(8);
    expect(toggleList(editor, "orderedList")).toBe(true);
    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe("two");
    editor.destroy();
  });
});

describe("splitListItemKeepingSublist", () => {
  it("adds a sibling after the sublist instead of adopting it", () => {
    const editor = createEditor(
      "<ul><li><p>parent</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    // End of the "parent" text, before its nested list.
    editor.commands.setTextSelection(9);
    expect(splitListItemKeepingSublist(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>parent</p><ul><li><p>child</p></li></ul></li><li><p></p></li></ul>",
    );
    const { $from } = editor.state.selection;
    expect($from.parent.type.name).toBe("paragraph");
    expect($from.parent.content.size).toBe(0);
    editor.destroy();
  });

  it("leaves ordinary splits and non-list text to the default Enter", () => {
    const midItem = createEditor(
      "<ul><li><p>parent</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    midItem.commands.setTextSelection(5);
    expect(splitListItemKeepingSublist(midItem)).toBe(false);
    midItem.destroy();

    const paragraph = createEditor("<p>outside</p>");
    paragraph.commands.setTextSelection(7);
    expect(splitListItemKeepingSublist(paragraph)).toBe(false);
    paragraph.destroy();
  });
});

describe("liftEmptyNestedItem", () => {
  it("outdents an empty item from the middle of a nested bullet list", () => {
    const editor = createEditor(
      "<ul><li><p>outer</p><ul><li><p>child one</p></li><li><p></p></li><li><p>child two</p></li></ul></li></ul>",
    );
    // The empty item's paragraph opens at 23.
    editor.commands.setTextSelection(23);
    expect(liftEmptyNestedItem(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ul><li><p>outer</p><ul><li><p>child one</p></li><li><p>child two</p></li></ul></li><li><p></p></li></ul>",
    );
    const { $from } = editor.state.selection;
    expect($from.depth).toBe(3);
    expect($from.parent.content.size).toBe(0);
    editor.destroy();
  });

  it("outdents an empty item from the middle of a nested numbered list", () => {
    const editor = createEditor(
      "<ol><li><p>outer</p><ol><li><p>child one</p></li><li><p></p></li><li><p>child two</p></li></ol></li></ol>",
    );
    editor.commands.setTextSelection(23);
    expect(liftEmptyNestedItem(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ol><li><p>outer</p><ol><li><p>child one</p></li><li><p>child two</p></li></ol></li><li><p></p></li></ol>",
    );
    const { $from } = editor.state.selection;
    expect($from.parent.content.size).toBe(0);
    editor.destroy();
  });

  it("outdents the last nested item the same way the default Enter does", () => {
    const editor = createEditor(
      "<ol><li><p>outer</p><ol><li><p>child</p></li><li><p></p></li></ol></li></ol>",
    );
    // The empty item's paragraph opens at 19.
    editor.commands.setTextSelection(19);
    expect(liftEmptyNestedItem(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ol><li><p>outer</p><ol><li><p>child</p></li></ol></li><li><p></p></li></ol>",
    );
    editor.destroy();
  });

  it("leaves top-level and filled items to the default Enter", () => {
    const topLevel = createEditor(
      "<ul><li><p>one</p></li><li><p></p></li><li><p>two</p></li></ul>",
    );
    topLevel.commands.setTextSelection(8);
    expect(liftEmptyNestedItem(topLevel)).toBe(false);
    topLevel.destroy();

    const filled = createEditor(
      "<ul><li><p>outer</p><ul><li><p>child</p></li></ul></li></ul>",
    );
    filled.commands.setTextSelection(14);
    expect(liftEmptyNestedItem(filled)).toBe(false);
    filled.destroy();

    const paragraph = createEditor("<p>outside</p>");
    paragraph.commands.setTextSelection(2);
    expect(liftEmptyNestedItem(paragraph)).toBe(false);
    paragraph.destroy();
  });
});

describe("splitOrderedListOnEmptyItem", () => {
  // Doc positions: the list starts at 0, so item i's empty paragraph sits at
  // itemStart + 1. "one" fills the first item, so the empty second item's
  // paragraph opens at 8.
  it("continues the trailing items at the number they already had", () => {
    const editor = createEditor(
      "<ol><li><p>one</p></li><li><p></p></li><li><p>two</p></li><li><p>three</p></li></ol>",
    );
    editor.commands.setTextSelection(8);
    expect(splitOrderedListOnEmptyItem(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ol><li><p>one</p></li></ol><p></p><ol start=\"2\"><li><p>two</p></li><li><p>three</p></li></ol>",
    );
    const { $from } = editor.state.selection;
    expect($from.parent.type.name).toBe("paragraph");
    expect($from.parent.content.size).toBe(0);
    editor.destroy();
  });

  it("keeps an explicit start when continuing a list", () => {
    const editor = createEditor(
      "<ol start=\"4\"><li><p>four</p></li><li><p>five</p></li><li><p></p></li><li><p>seven</p></li></ol>",
    );
    editor.commands.setTextSelection(17);
    expect(splitOrderedListOnEmptyItem(editor)).toBe(true);
    expect(getHTML(editor)).toBe(
      "<ol start=\"4\"><li><p>four</p></li><li><p>five</p></li></ol><p></p><ol start=\"6\"><li><p>seven</p></li></ol>",
    );
    editor.destroy();
  });

  it("leaves the last empty item to the default lift", () => {
    const editor = createEditor("<ol><li><p>one</p></li><li><p></p></li></ol>");
    editor.commands.setTextSelection(8);
    expect(splitOrderedListOnEmptyItem(editor)).toBe(false);
    editor.destroy();
  });

  it("leaves bullet lists and non-empty items alone", () => {
    const bullet = createEditor("<ul><li><p>one</p></li><li><p></p></li><li><p>two</p></li></ul>");
    bullet.commands.setTextSelection(8);
    expect(splitOrderedListOnEmptyItem(bullet)).toBe(false);
    bullet.destroy();

    const filled = createEditor("<ol><li><p>one</p></li><li><p>two</p></li></ol>");
    filled.commands.setTextSelection(5);
    expect(splitOrderedListOnEmptyItem(filled)).toBe(false);
    filled.destroy();
  });
});
