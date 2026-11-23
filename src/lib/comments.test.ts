import { describe, expect, it } from "vitest";
import { commentAnchors, restoreCommentMarks } from "./comments";
import type { DocumentNode, SentenceDocument } from "./types";

const comment = (markId: string) => ({ type: "comment", attrs: { markId } });

function paragraph(...content: DocumentNode[]): DocumentNode {
  return { type: "paragraph", content };
}

const commentMarks = (node: DocumentNode) =>
  (node.marks ?? []).filter((mark) => mark.type === "comment").map((mark) => mark.attrs?.markId);

describe("commentAnchors", () => {
  it("collects the text covered by each comment mark", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        paragraph(
          { type: "text", text: "Source sync target " },
          { type: "text", text: "text", marks: [comment("c1")] },
        ),
      ],
    };

    expect(commentAnchors(document)).toEqual([{ markId: "c1", text: "text", offset: 19 }]);
  });
});

describe("restoreCommentMarks", () => {
  it("re-applies the highlight after the source text is rewritten around it", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        paragraph(
          { type: "text", text: "Source sync target " },
          { type: "text", text: "text", marks: [comment("c1")] },
        ),
      ],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [paragraph({ type: "text", text: "Source sync target text rewritten in source" })],
    };

    const restored = restoreCommentMarks(after, commentAnchors(before));

    expect(restored.detached).toEqual([]);
    const nodes = restored.document.content[0].content ?? [];
    expect(nodes.map((node) => node.text)).toEqual([
      "Source sync target ",
      "text",
      " rewritten in source",
    ]);
    expect(commentMarks(nodes[1])).toEqual(["c1"]);
  });

  it("keeps each comment on the occurrence closest to its previous position", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        paragraph(
          { type: "text", text: "text", marks: [comment("first")] },
          { type: "text", text: " middle " },
          { type: "text", text: "text", marks: [comment("second")] },
        ),
      ],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [paragraph({ type: "text", text: "text middle text" })],
    };

    const restored = restoreCommentMarks(after, commentAnchors(before));

    expect(restored.detached).toEqual([]);
    const nodes = restored.document.content[0].content ?? [];
    expect(nodes.map((node) => node.text)).toEqual(["text", " middle ", "text"]);
    expect(commentMarks(nodes[0])).toEqual(["first"]);
    expect(commentMarks(nodes[2])).toEqual(["second"]);
  });

  it("reports comments whose text is gone instead of leaving a stray highlight", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [paragraph({ type: "text", text: "Removed passage", marks: [comment("c1")] })],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [paragraph({ type: "text", text: "Different body" })],
    };

    const restored = restoreCommentMarks(after, commentAnchors(before));

    expect(restored.detached).toEqual(["c1"]);
    expect(restored.document).toEqual(after);
  });

  it("never matches an anchor across a paragraph boundary", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [paragraph({ type: "text", text: "end start", marks: [comment("c1")] })],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [paragraph({ type: "text", text: "end" }), paragraph({ type: "text", text: "start" })],
    };

    expect(restoreCommentMarks(after, commentAnchors(before)).detached).toEqual(["c1"]);
  });
});
