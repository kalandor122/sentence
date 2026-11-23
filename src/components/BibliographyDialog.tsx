import { useEffect, useState } from "react";
import type { BibliographyDraft, BibliographyEntry } from "../lib/bibliography";
import Modal from "./Modal";

interface BibliographyDialogProps {
  open: boolean;
  entry: BibliographyEntry | null;
  existingKeys: string[];
  onClose: () => void;
  onSave: (draft: BibliographyDraft) => void;
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
}: BibliographyDialogProps) {
  const [draft, setDraft] = useState<BibliographyDraft>(emptyDraft);

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
