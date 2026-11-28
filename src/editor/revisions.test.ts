// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { documentPlainText } from "../lib/latex";
import type { Revision, SentenceDocument } from "../lib/types";
import { Citation, MathInline } from "./extensions";
import { RevisionMarks, setRevisionMarks } from "./revisions";

function twoParagraphs(first: string, second: string): SentenceDocument {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: first }] },
      { type: "paragraph", content: [{ type: "text", text: second }] },
    ],
  };
}

function revision(before: SentenceDocument, after: SentenceDocument): Revision {
  return {
    id: "r1",
    author: "Ada",
    createdAt: "",
    summary: "Tracked edit",
    before: documentPlainText(before),
    after: documentPlainText(after),
    beforeDocument: before,
    afterDocument: after,
    accepted: false,
  };
}

function paragraphs(editor: Editor): HTMLElement[] {
  return Array.from(editor.view.dom.querySelectorAll("p"));
}

describe("tracked change decorations", () => {
  it("draws a deletion in the edited paragraph when an identical line appears earlier", () => {
    const before = twoParagraphs("Same line", "Same line");
    const after = twoParagraphs("Same line", "Same ");
    const editor = new Editor({ extensions: [StarterKit, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [first, second] = paragraphs(editor);
    expect(first.querySelector(".sentence-revision-deletion")).toBeNull();
    expect(second.querySelector(".sentence-revision-deletion")?.textContent).toBe("line");
    editor.destroy();
  });

  it("draws a deletion between the repeated context that surrounds it", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "tail X tail" }] }],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "tail tail" }] }],
    };
    const editor = new Editor({ extensions: [StarterKit, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [paragraph] = paragraphs(editor);
    const deletion = paragraph.querySelector(".sentence-revision-deletion");
    expect(paragraph.textContent).toBe("tail X tail");
    expect(deletion?.previousSibling?.textContent).toBe("tail ");
    editor.destroy();
  });

  it("draws an insertion in the edited paragraph when an identical line appears earlier", () => {
    const before = twoParagraphs("Same row", "Same line");
    const after = twoParagraphs("Same row", "Same row");
    const editor = new Editor({ extensions: [StarterKit, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [first, second] = paragraphs(editor);
    expect(first.querySelector(".sentence-revision-insertion")).toBeNull();
    expect(second.querySelector(".sentence-revision-insertion")?.textContent).toBe("row");
    editor.destroy();
  });

  it("draws a deletion in a paragraph whose entire text was removed", () => {
    const before = twoParagraphs("Keep this", "Gone entirely");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep this" }] },
        { type: "paragraph" },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    expect(second.querySelector(".sentence-revision-deletion")?.textContent).toBe("Gone entirely");
    editor.destroy();
  });

  it("keeps the deletion visible when the emptied paragraph stores empty content", () => {
    const before = twoParagraphs("Keep this", "Gone entirely");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep this" }] },
        { type: "paragraph", content: [] },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    expect(second.querySelector(".sentence-revision-deletion")?.textContent).toBe("Gone entirely");
    editor.destroy();
  });

  it("marks an inserted citation as an insertion", () => {
    const before = twoParagraphs("Keep this", "See");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep this" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See" },
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, Citation, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    expect(second.querySelector(".sentence-revision-insertion")?.textContent).toBe("[sentence2026]");
    editor.destroy();
  });

  it("marks an inserted equation as an insertion", () => {
    const before = twoParagraphs("Keep this", "See");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep this" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See" },
            { type: "mathInline", attrs: { latex: "x^2" } },
          ],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, MathInline, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    expect(second.querySelectorAll(".sentence-revision-insertion")).toHaveLength(1);
    editor.destroy();
  });

  it("marks an inserted empty paragraph with a paragraph symbol", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Only paragraph" }] }],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [...(before.content ?? []), { type: "paragraph" }],
    };
    const editor = new Editor({ extensions: [StarterKit, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    expect(second.querySelector(".sentence-revision-insertion")?.textContent).toBe("¶");
    editor.destroy();
  });
});
