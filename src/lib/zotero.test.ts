import { describe, expect, it } from "vitest";
import { addBibliographyEntry, parseBibliography } from "./bibliography";
import { zoteroEntryType, zoteroItemToDraft, zoteroKey, zoteroYear, type ZoteroItem } from "./zotero";

const item = (patch: Partial<ZoteroItem> = {}): ZoteroItem => ({
  key: "ABCD1234",
  itemType: "journalArticle",
  title: "The quiet architecture of a sentence",
  creators: ["Lovelace, Ada", "Hopper, Grace"],
  date: "2026-05-01 2026-05-01",
  container: "Journal of Writing Tools",
  extra: [
    ["journal", "Journal of Writing Tools"],
    ["volume", "12"],
    ["pages", "41--58"],
    ["doi", "10.1000/jwt.2026.1"],
  ],
  ...patch,
});

describe("zotero mapping", () => {
  it("maps item types to BibTeX entry types, misc as the fallback", () => {
    expect(zoteroEntryType("journalArticle")).toBe("article");
    expect(zoteroEntryType("bookSection")).toBe("incollection");
    expect(zoteroEntryType("thesis")).toBe("phdthesis");
    expect(zoteroEntryType("somethingNew")).toBe("misc");
  });

  it("reads the year out of Zotero's free-form date", () => {
    expect(zoteroYear("2026-05-01 2026-05-01")).toBe("2026");
    expect(zoteroYear("May 1999")).toBe("1999");
    expect(zoteroYear("")).toBe("");
  });

  it("builds a readable key and suffixes collisions", () => {
    expect(zoteroKey(item(), [])).toBe("lovelace2026quiet");
    expect(zoteroKey(item(), ["lovelace2026quiet"])).toBe("lovelace2026quieta");
    expect(zoteroKey(item({ creators: [] }), [])).toBe("ref2026quiet");
  });

  it("turns a Zotero item into a full BibTeX entry", () => {
    const draft = zoteroItemToDraft(item());
    expect(draft.type).toBe("article");
    expect(draft.author).toBe("Lovelace, Ada and Hopper, Grace");
    expect(draft.year).toBe("2026");

    const bib = addBibliographyEntry("", draft);
    const [entry] = parseBibliography(bib);
    expect(entry.key).toBe("lovelace2026quiet");
    expect(entry.fields.find((field) => field.name === "journal")?.value).toBe("Journal of Writing Tools");
    expect(entry.fields.find((field) => field.name === "doi")?.value).toBe("10.1000/jwt.2026.1");
    expect(entry.fields.find((field) => field.name === "pages")?.value).toBe("41--58");
  });

  it("keeps institution creators and drops the display duplicates", () => {
    const draft = zoteroItemToDraft(item({ creators: ["World Health Organization"], date: "" }));
    expect(draft.author).toBe("World Health Organization");
    expect(draft.year).toBe("");
    expect(draft.fields?.some((field) => field.name === "author")).toBe(false);
  });
});
