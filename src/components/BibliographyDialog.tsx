import { useEffect, useState } from "react";
import type { BibliographyDraft, BibliographyEntry } from "../lib/bibliography";
import { zoteroItemToDraft, zoteroSearch, type ZoteroItem } from "../lib/zotero";
import Modal from "./Modal";

interface BibliographyDialogProps {
  open: boolean;
  entry: BibliographyEntry | null;
  existingKeys: string[];
  onClose: () => void;
  onSave: (draft: BibliographyDraft) => void;
  /** Zotero import: the dialog stays open so several references can be added. */
  onImport?: (draft: BibliographyDraft) => void;
}

const ENTRY_TYPES = ["article", "book", "inproceedings", "incollection", "phdthesis", "misc"];

const emptyDraft: BibliographyDraft = {
  key: "",
  type: "article",
  author: "",
  year: "",
  title: "",
};

export default function BibliographyDialog({
  open,
  entry,
  existingKeys,
  onClose,
  onSave,
  onImport,
}: BibliographyDialogProps) {
  const [draft, setDraft] = useState<BibliographyDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ZoteroItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearchError("");
    }
  }, [open]);

  const runSearch = async () => {
    const term = query.trim();
    if (!term || searching) return;
    setSearching(true);
    setSearchError("");
    try {
      setResults(await zoteroSearch(term));
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraft(entry ? {
      key: entry.key,
      type: entry.type,
      author: entry.author,
      year: entry.year,
      title: entry.title,
    } : emptyDraft);
  }, [entry, open]);

  const key = draft.key.trim();
  const keyValid = /^[^\s,{}()]+$/.test(key);
  const duplicate = keyValid && existingKeys.includes(key) && key !== entry?.key;
  const canSave = keyValid && !duplicate;
  const set = (patch: Partial<BibliographyDraft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Modal
      open={open}
      title={entry ? `Edit ${entry.key}` : "Add bibliography entry"}
      description="Saved in references.bib. Other fields in the entry are preserved."
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            type="submit"
            form="bibliography-form"
            disabled={!canSave}
          >
            {entry ? "Save entry" : "Add entry"}
          </button>
        </>
      }
    >
      {onImport ? (
        <section className="zotero-panel" aria-label="Import from Zotero">
          <div className="zotero-search">
            <input
              value={query}
              placeholder="Search your Zotero library"
              aria-label="Search Zotero"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button type="button" className="secondary-button" onClick={() => void runSearch()} disabled={searching}>
              {searching ? "Searching…" : "Search Zotero"}
            </button>
          </div>
          {searchError ? <p className="bib-form-error" role="alert">{searchError}</p> : null}
          {results.length > 0 ? (
            <ul className="zotero-results">
              {results.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onImport(zoteroItemToDraft(item, existingKeys));
                      setResults((current) => current.filter((row) => row.key !== item.key));
                    }}
                  >
                    <strong>{item.title || "(untitled)"}</strong>
                    <span>
                      {item.creators.slice(0, 3).join("; ")}
                      {item.creators.length > 3 ? " et al." : ""}
                      {item.date ? ` · ${item.date}` : ""}
                      {item.container ? ` · ${item.container}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <form
        id="bibliography-form"
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave({ ...draft, key });
        }}
      >
        <label className="dialog-field">
          <span>Type</span>
          <input
            list="bibliography-entry-types"
            value={draft.type}
            onChange={(event) => set({ type: event.target.value })}
          />
        </label>
        <datalist id="bibliography-entry-types">
          {ENTRY_TYPES.map((type) => <option key={type} value={type} />)}
        </datalist>
        <label className="dialog-field">
          <span>BibTeX key</span>
          <input
            autoFocus={!entry}
            value={draft.key}
            placeholder="einstein1905"
            readOnly={Boolean(entry)}
            onChange={(event) => set({ key: event.target.value })}
          />
        </label>
        <label className="dialog-field">
          <span>Author</span>
          <input
            autoFocus={Boolean(entry)}
            value={draft.author}
            placeholder="Ada Lovelace"
            onChange={(event) => set({ author: event.target.value })}
          />
        </label>
        <label className="dialog-field">
          <span>Year</span>
          <input
            value={draft.year}
            placeholder="2026"
            onChange={(event) => set({ year: event.target.value })}
          />
        </label>
        <label className="dialog-field">
          <span>Title</span>
          <input
            value={draft.title}
            placeholder="A readable title"
            onChange={(event) => set({ title: event.target.value })}
          />
        </label>
        {duplicate ? <p className="bib-form-error" role="alert">That key is already used by another entry.</p> : null}
      </form>
    </Modal>
  );
}
