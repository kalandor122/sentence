import { describe, expect, it } from "vitest";
import {
  addBibliographyEntry,
  formatBibliographyEntry,
  missingCitationKeys,
  parseBibliography,
  removeBibliographyEntry,
  stringifyBibliography,
  updateBibliographyEntry,
  type BibliographyEntry,
} from "./bibliography";
import type { SentenceDocument } from "./types";

const sample = `% A hand-edited bibliography
@comment{ignored by the manager}
@article{knuth1984,
  author = {Donald Knuth},
  title = {The Art of Computer Programming},
  year = {1984},
  journal = {Addison-Wesley}
}

@inproceedings{lovelace1843,
  author = "Ada Lovelace",
  title = "Notes on {the} Analytical Engine",
  year = 1843
}
`;

function normalized(entries: BibliographyEntry[]) {
  return entries.map(({ key, type, author, year, title, fields }) => ({
    key, type, author, year, title, fields,
  }));
}

describe("bibliography", () => {
  it("parses keys, display fields and unrelated fields", () => {
    const entries = parseBibliography(sample);
    expect(entries.map((entry) => entry.key)).toEqual(["knuth1984", "lovelace1843"]);
    expect(entries[0]).toMatchObject({
      type: "article",
      author: "Donald Knuth",
      year: "1984",
      title: "The Art of Computer Programming",
    });
    expect(entries[0].fields).toContainEqual({ name: "journal", value: "Addison-Wesley" });
    expect(entries[1]).toMatchObject({
      author: "Ada Lovelace",
      year: "1843",
      title: "Notes on {the} Analytical Engine",
    });
  });

  it("round-trips parsed entries through the writer", () => {
    const parsed = parseBibliography(sample);
    expect(normalized(parseBibliography(stringifyBibliography(parsed)))).toEqual(normalized(parsed));
  });

  it("preserves nested braces and escaped braces in values", () => {
    const text = "@article{nested,\n  title = {Braces {inside} and a comma, kept},\n  note = {a \\} escaped brace}\n}\n";
    const parsed = parseBibliography(text);
    expect(parsed[0].title).toBe("Braces {inside} and a comma, kept");
    expect(normalized(parseBibliography(stringifyBibliography(parsed)))).toEqual(normalized(parsed));
  });

  it("adds, edits and deletes entries without rewriting the rest of the file", () => {
    const draft = {
      key: "hopper2026",
      type: "misc",
      author: "Grace Hopper",
      year: "2026",
      title: "A manager for references",
    };
    const added = addBibliographyEntry(sample, draft);
    expect(parseBibliography(added).map((entry) => entry.key)).toEqual([
      "knuth1984", "lovelace1843", "hopper2026",
    ]);
    expect(added).toContain("% A hand-edited bibliography");
    expect(added).toContain("journal = {Addison-Wesley}");

    const edited = updateBibliographyEntry(added, "hopper2026", { title: "Renamed", year: "2025" });
    expect(parseBibliography(edited).find((entry) => entry.key === "hopper2026")).toMatchObject({
      author: "Grace Hopper",
      year: "2025",
      title: "Renamed",
    });
    expect(edited).toContain('author = "Ada Lovelace"');

    const removed = removeBibliographyEntry(edited, "knuth1984");
    expect(parseBibliography(removed).map((entry) => entry.key)).toEqual(["lovelace1843", "hopper2026"]);
    expect(removed).toContain("% A hand-edited bibliography");
  });

  it("reports citation keys the bibliography does not define", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "citation", attrs: { key: "knuth1984" } },
            { type: "citation", attrs: { key: "ghost2026" } },
            { type: "citation", attrs: { key: "ghost2026" } },
          ],
        },
      ],
    };
    expect(missingCitationKeys(document, sample)).toEqual(["ghost2026"]);
    expect(missingCitationKeys(document, "")).toEqual(["knuth1984", "ghost2026"]);
    expect(missingCitationKeys({ type: "doc", content: [] }, sample)).toEqual([]);
  });

  it("rejects duplicate keys and formats a draft entry", () => {
    expect(() => addBibliographyEntry(sample, {
      key: "knuth1984", type: "misc", author: "", year: "", title: "",
    })).toThrow(/already exists/);
    expect(formatBibliographyEntry({
      key: "new2026", type: "article", author: "A Author", year: "2026", title: "A title",
    })).toBe("@article{new2026,\n  author = {A Author},\n  title = {A title},\n  year = {2026}\n}");
  });
});
