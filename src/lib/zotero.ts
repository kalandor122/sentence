import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "./tauri";
import type { BibliographyDraft, BibliographyField } from "./bibliography";

/** One row from Zotero's local API, already flattened in Rust. */
export interface ZoteroItem {
  key: string;
  itemType: string;
  title: string;
  creators: string[];
  date: string;
  container?: string;
  extra: Array<[string, string]>;
}

const ENTRY_TYPE: Record<string, string> = {
  journalArticle: "article",
  magazineArticle: "article",
  newspaperArticle: "article",
  book: "book",
  bookSection: "incollection",
  conferencePaper: "inproceedings",
  thesis: "phdthesis",
  dissertation: "phdthesis",
  report: "techreport",
  manuscript: "unpublished",
  preprint: "misc",
  webpage: "misc",
  dataset: "misc",
  computerProgram: "misc",
  presentation: "misc",
};

export function zoteroEntryType(itemType: string): string {
  return ENTRY_TYPE[itemType] ?? "misc";
}

/** "2026-05-01 2024" → "2026"; keeps a lone "n.d." out of the way. */
export function zoteroYear(date: string): string {
  return /\d{4}/.exec(date)?.[0] ?? "";
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Better-BibTeX-ish key: first author's last name, the year, then the first
 * meaningful title word — `lovelace2026quiet`. Collisions get a, b, c suffixes.
 */
export function zoteroKey(item: ZoteroItem, taken: string[]): string {
  const author = slug((item.creators[0] ?? "").split(",")[0] ?? "");
  const year = zoteroYear(item.date);
  const word =
    item.title
      .split(/\s+/)
      .map(slug)
      .find((part) => part.length > 2 && !["the", "and", "for", "with"].includes(part)) ?? "";
  const base = `${author || "ref"}${year}${word.slice(0, 12)}`;
  if (!taken.includes(base)) return base;
  for (const suffix of "abcdefghij") {
    if (!taken.includes(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  return `${base}${taken.length}`;
}

/** Zotero item → the draft the bibliography writer already understands. */
export function zoteroItemToDraft(item: ZoteroItem, taken: string[] = []): BibliographyDraft {
  const fields: BibliographyField[] = item.extra
    .filter(([name]) => !["author", "title", "year"].includes(name))
    .map(([name, value]) => ({ name, value }));
  return {
    key: zoteroKey(item, taken),
    type: zoteroEntryType(item.itemType),
    author: item.creators.join(" and "),
    year: zoteroYear(item.date),
    title: item.title,
    fields,
  };
}

export async function zoteroSearch(query: string, limit = 25): Promise<ZoteroItem[]> {
  if (!isDesktop) {
    throw new Error("Zotero search talks to your local Zotero, which needs the desktop app.");
  }
  try {
    return await invoke<ZoteroItem[]>("zotero_search", { query, limit });
  } catch (error) {
    throw new Error(typeof error === "string" ? error : String((error as Error)?.message ?? error));
  }
}
