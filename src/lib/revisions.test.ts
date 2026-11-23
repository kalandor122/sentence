import { describe, expect, it } from "vitest";
import { documentPlainText } from "./latex";
import { documentChanges, undoDocumentChanges } from "./revisions";
import type { SentenceDocument } from "./types";

function doc(text: string): SentenceDocument {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
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
});
