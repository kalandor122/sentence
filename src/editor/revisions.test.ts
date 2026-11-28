// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { documentPlainText } from "../lib/latex";
import { revisionText } from "../lib/revisions";
import type { Revision, SentenceDocument } from "../lib/types";
import { Citation, CommentMark, MathBlock, MathInline } from "./extensions";
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
    const mark = second.querySelector(".sentence-revision-insertion");
    expect(mark?.textContent).toBe("[sentence2026]");
    expect(mark?.getAttribute("title")).toBe("Inserted by Ada: [sentence2026]");
    expect(mark?.getAttribute("aria-label")).toBe("Inserted by Ada: [sentence2026]");
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

  it("marks a citation and an equation appended to a paragraph in separate revisions", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "The model is compact: meaning = structure + language." }] }],
    };
    const withCitation: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [...(before.content?.[0]?.content ?? []), { type: "citation", attrs: { key: "sentence2026" } }],
        },
      ],
    };
    const withEquation: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [...(withCitation.content?.[0]?.content ?? []), { type: "mathInline", attrs: { latex: "x^2" } }],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, Citation, MathInline, RevisionMarks], content: withEquation });
    setRevisionMarks(editor, [
      { ...revision(before, withCitation), id: "r1" },
      { ...revision(withCitation, withEquation), id: "r2" },
    ]);

    const citation = editor.view.dom.querySelector('.citation[data-revision-id="r1"]');
    const equation = editor.view.dom.querySelector('[data-revision-id="r2"]');
    expect(citation?.textContent).toBe("[sentence2026]");
    expect(equation?.classList.contains("sentence-revision-insertion")).toBe(true);
    expect(editor.view.dom.querySelectorAll(".sentence-revision-insertion")).toHaveLength(2);
    editor.destroy();
  });

  it("marks an equation inserted inside a new paragraph as an insertion", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Keep this" }] }],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [
        ...(before.content ?? []),
        { type: "paragraph", content: [{ type: "mathInline", attrs: { latex: "z^3" } }] },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, MathInline, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    const marks = second.querySelectorAll(".sentence-revision-insertion");
    expect(marks).toHaveLength(1);
    expect(marks[0].getAttribute("data-revision-id")).toBe("r1");
    editor.destroy();
  });

  it("marks a citation typed together with a new paragraph as an insertion", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Keep this" }] }],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [
        ...(before.content ?? []),
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, Citation, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const [, second] = paragraphs(editor);
    const marks = second.querySelectorAll(".sentence-revision-insertion");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("[sentence2026]");
    editor.destroy();
  });

  it("marks the second of two identical citations when text in the paragraph is split", () => {
    const mark = { type: "comment", attrs: { markId: "c1" } };
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "text", text: "the", marks: [mark] },
            { type: "text", text: " note " },
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            ...(before.content?.[0]?.content ?? []),
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, CommentMark, Citation, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const citations = Array.from(editor.view.dom.querySelectorAll(".citation"));
    expect(citations).toHaveLength(2);
    expect(citations.map((node) => node.classList.contains("sentence-revision-insertion"))).toEqual([false, true]);
    editor.destroy();
  });

  it("marks an appended citation when a comment split the text before an identical one", () => {
    const mark = { type: "comment", attrs: { markId: "c1" } };
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See" },
            { type: "text", text: " also", marks: [mark] },
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [...(before.content?.[0]?.content ?? []), { type: "citation", attrs: { key: "sentence2026" } }],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, CommentMark, Citation, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const citations = Array.from(editor.view.dom.querySelectorAll(".citation"));
    expect(citations).toHaveLength(2);
    expect(citations.map((node) => node.classList.contains("sentence-revision-insertion"))).toEqual([false, true]);
    editor.destroy();
  });

  it("marks a citation inserted into an empty paragraph stored without content", () => {
    const before: SentenceDocument = { type: "doc", content: [{ type: "paragraph" }] };
    const after: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "citation", attrs: { key: "sentence2026" } }] }],
    };
    const editor = new Editor({ extensions: [StarterKit, Citation, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const citation = editor.view.dom.querySelector(".citation");
    expect(citation?.classList.contains("sentence-revision-insertion")).toBe(true);
    editor.destroy();
  });

  it("marks an equation inserted into an empty paragraph stored without content", () => {
    const before: SentenceDocument = { type: "doc", content: [{ type: "paragraph" }] };
    const after: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "mathInline", attrs: { latex: "x^2" } }] }],
    };
    const editor = new Editor({ extensions: [StarterKit, MathInline, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    expect(editor.view.dom.querySelectorAll(".sentence-revision-insertion")).toHaveLength(1);
    editor.destroy();
  });

  it("marks an equation inserted as a new block as an insertion", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Keep this" }] }],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [...(before.content ?? []), { type: "mathBlock", attrs: { latex: "z^3" } }],
    };
    const editor = new Editor({ extensions: [StarterKit, MathBlock, RevisionMarks], content: after });
    setRevisionMarks(editor, [revision(before, after)]);

    const pending = editor.view.dom.querySelector(".sentence-revision-insertion");
    expect(pending?.getAttribute("data-revision-id")).toBe("r1");
    expect(pending?.getAttribute("title")).toBe("Inserted by Ada: z^3");
    expect(pending?.getAttribute("aria-label")).toBe("Inserted by Ada: z^3");
    editor.destroy();
  });

  it("marks a citation and an equation appended after a formatted run", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The central model: " },
            { type: "text", text: "meaning = structure + language", marks: [{ type: "code" }] },
          ],
        },
      ],
    };
    const withCitation: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            ...(before.content?.[0]?.content ?? []),
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const withEquation: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            ...(withCitation.content?.[0]?.content ?? []),
            { type: "mathInline", attrs: { latex: "x^2" } },
          ],
        },
      ],
    };
    const editor = new Editor({
      extensions: [StarterKit, Citation, MathInline, RevisionMarks],
      content: withEquation,
    });
    setRevisionMarks(editor, [
      { ...revision(before, withCitation), id: "r1" },
      { ...revision(withCitation, withEquation), id: "r2" },
    ]);

    const marks = Array.from(editor.view.dom.querySelectorAll(".sentence-revision-insertion"));
    expect(marks.map((mark) => mark.getAttribute("data-revision-id"))).toEqual(["r1", "r2"]);
    expect(marks.map((mark) => mark.getAttribute("title"))).toEqual([
      "Inserted by Ada: [sentence2026]",
      "Inserted by Ada: x^2",
    ]);
    editor.destroy();
  });

  it("marks and previews a citation and an equation inserted at the end of a paragraph", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The central model can be expressed compactly: " },
            { type: "text", marks: [{ type: "code" }], text: "meaning = structure + language" },
            { type: "text", text: "." },
          ],
        },
      ],
    };
    const editor = new Editor({ extensions: [StarterKit, Citation, MathInline, RevisionMarks], content: before });
    // The real command path: the dialog inserts the atom into the document, the
    // app snapshots the result, and History renders from those snapshots.
    editor.chain().insertContentAt(editor.state.doc.content.size - 1, { type: "citation", attrs: { key: "sentence2026" } }).run();
    const withCitation = editor.getJSON() as unknown as SentenceDocument;
    expect(withCitation).not.toEqual(before);
    const withCitationRevision = revision(before, withCitation);
    withCitationRevision.before = revisionText(before);
    withCitationRevision.after = revisionText(withCitation);

    editor.chain().insertContentAt(editor.state.doc.content.size - 1, { type: "mathInline", attrs: { latex: "x^2" } }).run();
    const withEquation = editor.getJSON() as unknown as SentenceDocument;
    const withEquationRevision = revision(withCitation, withEquation);
    withEquationRevision.before = revisionText(withCitation);
    withEquationRevision.after = revisionText(withEquation);

    expect(withCitationRevision.before).not.toBe(withCitationRevision.after);
    expect(withCitationRevision.after).toContain("[sentence2026]");
    expect(withEquationRevision.before).not.toBe(withEquationRevision.after);
    expect(withEquationRevision.after).toContain("x^2");

    setRevisionMarks(editor, [
      { ...withCitationRevision, id: "r1" },
      { ...withEquationRevision, id: "r2" },
    ]);
    const marks = Array.from(editor.view.dom.querySelectorAll<HTMLElement>(".sentence-revision-insertion"));
    expect(marks.map((mark) => mark.getAttribute("data-revision-id"))).toEqual(["r1", "r2"]);
    expect(marks.map((mark) => mark.getAttribute("title"))).toEqual([
      "Inserted by Ada: [sentence2026]",
      "Inserted by Ada: x^2",
    ]);
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
