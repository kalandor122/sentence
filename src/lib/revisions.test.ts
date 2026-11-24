import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { documentPlainText, documentToLatex } from "./latex";
import {
  acceptRevisions,
  applyRejection,
  documentChanges,
  nodeText,
  rejectRevisions,
  revisionChanges,
  trackedShape,
  trackedText,
  undoDocumentChanges,
} from "./revisions";
import type { Revision, SentenceDocument } from "./types";

function doc(text: string): SentenceDocument {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function revision(id: string, before: SentenceDocument, after: SentenceDocument): Revision {
  return {
    id,
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

describe("undoing tracked revisions", () => {
  it("removes an older insertion without dropping later edits or restoring rejected text", () => {
    const changes = documentChanges(
      doc("Baseline revision text delta-one"),
      doc("Baseline revision text delta-one EARLY"),
    );
    expect(documentPlainText(undoDocumentChanges(doc("Baseline revision text delta-one EARLY LATE"), changes))).toBe(
      "Baseline revision text delta-one LATE",
    );
    expect(documentPlainText(undoDocumentChanges(doc("Baseline revision text delta-one delta-two"), changes))).toBe(
      "Baseline revision text delta-one delta-two",
    );
  });

  it("restores deleted text at its original position when the deletion is rejected", () => {
    const changes = documentChanges(doc("alpha beta"), doc("alpha"));
    expect(documentPlainText(undoDocumentChanges(doc("alpha gamma"), changes))).toBe("alpha beta gamma");
  });

  it("bases the next tracked edit on the document after a rejection", () => {
    const before = doc("Baseline revision text delta-one");
    const after = doc("Baseline revision text delta-one delta-two");
    const tracked = revision("r1", before, after);
    const { document: baseline } = applyRejection(after, tracked);
    expect(documentPlainText(baseline)).toBe("Baseline revision text delta-one");

    const changes = documentChanges(baseline, doc("Baseline revision text delta-one EARLY"));
    expect(documentPlainText(undoDocumentChanges(doc("Baseline revision text delta-one EARLY LATE"), changes))).toBe(
      "Baseline revision text delta-one LATE",
    );
  });
});

describe("tracked text comparison", () => {
  const annotated: SentenceDocument = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Comment", marks: [{ type: "comment", attrs: { markId: "c1" } }] },
          { type: "text", text: " on tracked text" },
        ],
      },
    ],
  };

  it("ignores comment marks and the text nodes they split", () => {
    expect(trackedText(annotated)).toBe(trackedText(doc("Comment on tracked text")));
  });

  it("still sees the text of a later edit", () => {
    const edited: SentenceDocument = {
      ...annotated,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Comment", marks: [{ type: "comment", attrs: { markId: "c1" } }] },
            { type: "text", text: " on tracked text tail" },
          ],
        },
      ],
    };
    expect(trackedText(edited)).not.toBe(trackedText(annotated));
  });

  it("treats a typed trailing space as an edit", () => {
    expect(trackedText(doc("alpha "))).not.toBe(trackedText(doc("alpha")));
  });

  it("treats a paragraph break as an edit even when the joined text is unchanged", () => {
    const single = doc("Only paragraph");
    const split: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Only" }] },
        { type: "paragraph", content: [{ type: "text", text: " paragraph" }] },
      ],
    };
    const appended: SentenceDocument = { type: "doc", content: [...single.content, { type: "paragraph" }] };
    expect(trackedShape(split)).not.toBe(trackedShape(single));
    expect(trackedShape(appended)).not.toBe(trackedShape(single));
    expect(trackedShape(annotated)).toBe(trackedShape(doc("Comment on tracked text")));
  });
});

describe("review decorations", () => {
  const commented: SentenceDocument = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Keep " },
          { type: "text", text: "beta", marks: [{ type: "comment", attrs: { markId: "c1" } }] },
          { type: "text", text: " text" },
        ],
      },
    ],
  };

  it("reports a replaced commented word without touching the unchanged rest of the run", () => {
    const after: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Keep B text" }] }],
    };
    expect(revisionChanges(revision("r1", commented, after))).toEqual([
      {
        kind: "text",
        path: ["content", 0, "content", 0, "text"],
        prefix: "Keep ",
        removed: "beta",
        inserted: "B",
        suffix: " text",
        after: "Keep B text",
      },
    ]);
  });

  it("reports only the appended text when a comment mark splits the paragraph", () => {
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Keep " },
            { type: "text", text: "beta", marks: [{ type: "comment", attrs: { markId: "c1" } }] },
            { type: "text", text: " text tail" },
          ],
        },
      ],
    };
    expect(revisionChanges(revision("r1", commented, after))).toEqual([
      {
        kind: "text",
        path: ["content", 0, "content", 0, "text"],
        prefix: "Keep beta text",
        removed: "",
        inserted: " tail",
        suffix: "",
        after: "Keep beta text tail",
      },
    ]);
  });
});

describe("reviewing tracked changes", () => {
  it("treats an inserted block as an addition rather than a text replacement", () => {
    const before = doc("one");
    const after: SentenceDocument = {
      type: "doc",
      content: [...before.content, doc("two").content[0]],
    };
    const changes = documentChanges(before, after);
    expect(changes.some((change) => change.kind === "text" && /paragraph/.test(change.after))).toBe(false);
    expect(changes.some((change) => change.kind === "value" && nodeText(change.after) === "two")).toBe(true);
  });

  it("restores the original document when a paragraph insertion is rejected", () => {
    const before = doc("Only paragraph");
    const withText: SentenceDocument = {
      type: "doc",
      content: [...before.content, doc("Second paragraph").content[0]],
    };
    const withEmpty: SentenceDocument = { type: "doc", content: [...before.content, { type: "paragraph" }] };
    expect(rejectRevisions(withText, [revision("r1", before, withText)], ["r1"]).document).toEqual(before);
    expect(rejectRevisions(withEmpty, [revision("r2", before, withEmpty)], ["r2"]).document).toEqual(before);
  });

  it("rejects several changes newest first without leaving review state in the document", () => {
    const first = doc("alpha");
    const second = doc("alpha beta");
    const third = doc("alpha beta gamma");
    const revisions = [revision("r2", second, third), revision("r1", first, second)];
    const { document, revisions: reviewed } = rejectRevisions(third, revisions, ["r2", "r1"]);
    expect(documentPlainText(document)).toBe("alpha");
    expect(reviewed.every((item) => item.accepted && item.rejected)).toBe(true);
    const latex = documentToLatex(document, DEFAULT_SETTINGS);
    expect(latex).not.toMatch(/revision|accepted|rejected|Ada/);
  });

  it("accepts only the requested changes", () => {
    const before = doc("alpha");
    const after = doc("alpha beta");
    const revisions = [revision("r1", before, after), revision("r2", after, doc("alpha beta gamma"))];
    const reviewed = acceptRevisions(revisions, ["r2"]);
    expect(reviewed.map((item) => item.accepted)).toEqual([false, true]);
  });
});
