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
  revisionPreviewText,
  revisionText,
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

  it("shows an inserted empty paragraph in the review preview", () => {
    const single = doc("Only paragraph");
    const appended: SentenceDocument = { type: "doc", content: [...single.content, { type: "paragraph" }] };
    expect(revisionText(single)).toBe("Only paragraph");
    expect(revisionText(appended)).toBe("Only paragraph\n¶");
  });

  it("identifies an inserted citation or equation in the review preview", () => {
    const before = doc("See");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "citation", attrs: { key: "sentence2026" } },
            { type: "text", text: " and " },
            { type: "mathInline", attrs: { latex: "x^2" } },
          ],
        },
      ],
    };
    expect(trackedShape(before)).not.toBe(trackedShape(after));
    expect(revisionText(before)).not.toBe(revisionText(after));
    expect(revisionText(after)).toContain("[sentence2026]");
    expect(revisionText(after)).toContain("x^2");
  });

  it("identifies an empty equation in the review preview", () => {
    const before = doc("See");
    const after: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "See " }, { type: "mathInline", attrs: { latex: "" } }] }],
    };
    expect(trackedShape(before)).not.toBe(trackedShape(after));
    expect(revisionText(after)).toBe("See [equation]");
  });

  it("identifies atoms appended to an existing paragraph across revisions", () => {
    const before = doc("The central model can be expressed compactly: meaning = structure + language.");
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
    expect(revisionText(before)).not.toBe(revisionText(withCitation));
    expect(revisionText(withCitation)).not.toBe(revisionText(withEquation));
    expect(revisionText(withCitation)).toContain("[sentence2026]");
    expect(revisionText(withEquation)).toContain("x^2");
  });

  it("rebuilds an older card's preview from its snapshots", () => {
    const before = doc("See");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const legacy = { ...revision("old", before, after), before: "See", after: "See" };
    expect(revisionPreviewText(legacy)).toEqual({ before: "See", after: "See [sentence2026]" });
  });

  it("falls back to the recorded change when a snapshot cannot print an inserted atom", () => {
    const before = doc("Body");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }, { type: "horizontalRule" }],
        },
      ],
    };
    // The atom prints no text of its own, so both snapshots read "Body".
    expect(revisionText(after)).toBe("Body");
    expect(revisionPreviewText(revision("rule", before, after))).toEqual({
      before: "Body",
      after: "Body [horizontalRule]",
    });
  });

  it("keeps a stored preview that is more detailed than a stale snapshot", () => {
    const stale = doc("See");
    const legacy = {
      ...revision("old", stale, stale),
      before: "See",
      after: "See [sentence2026]",
    };
    expect(revisionPreviewText(legacy)).toEqual({ before: "See", after: "See [sentence2026]" });
  });

  it("shows distinct History previews for a citation and an equation appended to the last paragraph", () => {
    const before = doc("The central model can be expressed compactly: meaning = structure + language.");
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
    const citation = revisionPreviewText(revision("citation", before, withCitation));
    const equation = revisionPreviewText(revision("equation", withCitation, withEquation));
    expect(citation.before).not.toBe(citation.after);
    expect(citation.after).toContain("[sentence2026]");
    expect(equation.before).not.toBe(equation.after);
    expect(equation.after).toContain("x^2");
  });

  it("identifies other inserted atoms in the review preview", () => {
    const before = doc("Body");
    const after: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body" },
            { type: "image", attrs: { path: "assets/images/figure.png" } },
            { type: "pageBreak" },
            { type: "toc" },
          ],
        },
      ],
    };
    expect(revisionText(before)).not.toBe(revisionText(after));
    expect(revisionText(after)).toContain("assets/images/figure.png");
    expect(revisionText(after)).toContain("[page break]");
    expect(revisionText(after)).toContain("[table of contents]");
  });

  it("treats a citation key or equation body edit as a tracked edit", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "citation", attrs: { key: "sentence2026" } },
            { type: "text", text: " for " },
            { type: "mathInline", attrs: { latex: "x^2" } },
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
            { type: "text", text: "See " },
            { type: "citation", attrs: { key: "otherKey2026" } },
            { type: "text", text: " for " },
            { type: "mathInline", attrs: { latex: "y^3" } },
          ],
        },
      ],
    };
    expect(trackedShape(after)).not.toBe(trackedShape(before));
    expect(revisionText(before)).toContain("[sentence2026]");
    expect(revisionText(after)).toContain("[otherKey2026]");
    expect(revisionText(before)).toContain("x^2");
    expect(revisionText(after)).toContain("y^3");
  });

  it("does not track a materialised atom default", () => {
    const stored: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "mathBlock", attrs: { latex: "x" } }] }],
    };
    const materialised: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "mathBlock", attrs: { latex: "x", numbered: false, environment: "" } }],
        },
      ],
    };
    expect(trackedShape(materialised)).toBe(trackedShape(stored));
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

  it("reports a deleted commented word without marking the unchanged rest of the run", () => {
    const after: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Keep  text" }] }],
    };
    expect(revisionChanges(revision("r1", commented, after))).toEqual([
      {
        kind: "text",
        path: ["content", 0, "content", 0, "text"],
        prefix: "Keep ",
        removed: "beta",
        inserted: "",
        suffix: " text",
        after: "Keep  text",
      },
    ]);
  });

  it("keeps unchanged blocks aligned when the editor adds default attributes", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Good tools stay close" }] },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Clarity arrives." }] }],
        },
        { type: "paragraph", content: [{ type: "text", text: "The central model." }] },
      ],
    };
    const after: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { textAlign: null }, content: [{ type: "text", text: "Good tools" }] },
        { type: "paragraph", attrs: { textAlign: null }, content: [{ type: "text", text: " stay close" }] },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              attrs: { textAlign: null },
              content: [{ type: "text", text: "Clarity arrives." }],
            },
          ],
        },
        { type: "paragraph", attrs: { textAlign: null }, content: [{ type: "text", text: "The central model." }] },
      ],
    };
    expect(revisionChanges(revision("r1", before, after))).toEqual([
      {
        kind: "text",
        path: ["content", 0, "content", 0, "text"],
        prefix: "Good tools",
        removed: " stay close",
        inserted: "",
        suffix: "",
        after: "Good tools",
      },
      {
        kind: "value",
        path: ["content", 0, "attrs"],
        before: undefined,
        after: { textAlign: null },
      },
      {
        kind: "value",
        path: ["content", 1],
        before: undefined,
        after: { type: "paragraph", attrs: { textAlign: null }, content: [{ type: "text", text: " stay close" }] },
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

  it("rejects a paragraph merge even after a comment split its text and was deleted", () => {
    const mark = { type: "comment", attrs: { markId: "c1" } };
    const before: SentenceDocument = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "A sentence is not ", marks: [mark] },
            { type: "text", text: "merely a container." },
          ],
        },
      ],
    };
    const merged: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            { type: "text", text: "Introduction" },
            { type: "text", text: "A sentence is not ", marks: [mark] },
            { type: "text", text: "merely a container." },
          ],
        },
      ],
    };
    // Deleting the comment leaves the merged heading as plain runs, and the
    // editor may join them again, so reject against both shapes.
    const split: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            { type: "text", text: "Introduction" },
            { type: "text", text: "A sentence is not " },
            { type: "text", text: "merely a container." },
          ],
        },
      ],
    };
    const joined: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "IntroductionA sentence is not merely a container." }],
        },
      ],
    };
    const expected: SentenceDocument = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "A sentence is not " },
            { type: "text", text: "merely a container." },
          ],
        },
      ],
    };
    for (const current of [split, joined]) {
      expect(rejectRevisions(current, [revision("r1", before, merged)], ["r1"]).document).toEqual(expected);
    }
  });

  it("keeps formatting when rejecting the deletion of a formatted paragraph", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep" }] },
        { type: "paragraph", content: [{ type: "text", text: "Bold text", marks: [{ type: "bold" }] }] },
      ],
    };
    const after: SentenceDocument = { type: "doc", content: [before.content[0]] };
    expect(rejectRevisions(after, [revision("r1", before, after)], ["r1"]).document).toEqual(before);
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

  it("keeps a newer uncommitted edit reviewable when an older revision is rejected", () => {
    const base = doc("BASE");
    const withOld = doc("BASEAAA");
    const withNew = doc("BASEAAABBB");
    // The app commits the edit typed after AAA as a pending revision before it
    // rejects AAA, so the newer change is not absorbed into the baseline.
    const revisions = [revision("new", withOld, withNew), revision("old", base, withOld)];
    const { document, revisions: reviewed } = rejectRevisions(withNew, revisions, ["old"]);
    expect(documentPlainText(document)).toBe("BASEBBB");
    expect(reviewed[1].accepted).toBe(true);
    expect(reviewed[0].accepted).toBe(false);
    expect(reviewed[0].before).toBe("BASE");
    expect(reviewed[0].after).toBe("BASEBBB");
    expect(documentPlainText(rejectRevisions(document, reviewed, ["new"]).document)).toBe("BASE");
  });

  it("accepts only the requested changes", () => {
    const before = doc("alpha");
    const after = doc("alpha beta");
    const revisions = [revision("r1", before, after), revision("r2", after, doc("alpha beta gamma"))];
    const reviewed = acceptRevisions(revisions, ["r2"]);
    expect(reviewed.map((item) => item.accepted)).toEqual([false, true]);
  });

  it("restores a citation key and an equation body when their revision is rejected", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "citation", attrs: { key: "sentence2026" } },
            { type: "text", text: " and " },
            { type: "mathInline", attrs: { latex: "x^2" } },
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
            { type: "citation", attrs: { key: "otherKey2026" } },
            { type: "text", text: " and " },
            { type: "mathInline", attrs: { latex: "y^3" } },
          ],
        },
      ],
    };
    expect(rejectRevisions(after, [revision("r1", before, after)], ["r1"]).document).toEqual(before);
  });

  it("rejects an atom edit that follows runs merged for the diff", () => {
    const before: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "text", text: "the", marks: [{ type: "comment", attrs: { markId: "c1" } }] },
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
            { type: "text", text: "See " },
            { type: "text", text: "the", marks: [{ type: "comment", attrs: { markId: "c1" } }] },
            { type: "text", text: " note " },
            { type: "citation", attrs: { key: "otherKey2026" } },
          ],
        },
      ],
    };
    expect(rejectRevisions(after, [revision("r1", before, after)], ["r1"]).document).toEqual(before);
  });
});
