export interface BibliographyField {
  name: string;
  value: string;
}

export interface BibliographyDraft {
  key: string;
  type: string;
  author: string;
  year: string;
  title: string;
}

export interface BibliographyEntry extends BibliographyDraft {
  fields: BibliographyField[];
  start: number;
  end: number;
  raw: string;
}

const KEYLESS_TYPES = new Set(["comment", "preamble", "string"]);
const DISPLAY_FIELDS = ["author", "title", "year"] as const;

function skipSpace(text: string, index: number): number {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

function readDelimited(
  text: string,
  start: number,
  open: string,
  close: string,
): { value: string; end: number } | null {
  let depth = 1;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quoted) {
      if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return { value: text.slice(start, index), end: index + 1 };
    }
  }
  return null;
}

function nextComma(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && text[cursor] !== ",") cursor += 1;
  return cursor + 1;
}

function parseFields(body: string): BibliographyField[] {
  const fields: BibliographyField[] = [];
  let index = 0;
  while (index < body.length) {
    index = skipSpace(body, index);
    if (index >= body.length) break;
    if (body[index] === ",") {
      index += 1;
      continue;
    }
    const nameStart = index;
    while (index < body.length && /[A-Za-z0-9_!-]/.test(body[index])) index += 1;
    if (index === nameStart) {
      index = nextComma(body, index);
      continue;
    }
    const name = body.slice(nameStart, index).toLowerCase();
    index = skipSpace(body, index);
    if (body[index] !== "=") {
      index = nextComma(body, index);
      continue;
    }
    index = skipSpace(body, index + 1);
    let value = "";
    if (body[index] === "{") {
      const read = readDelimited(body, index + 1, "{", "}");
      if (!read) break;
      value = read.value.trim();
      index = read.end;
    } else if (body[index] === '"') {
      index += 1;
      let raw = "";
      let escaped = false;
      while (index < body.length) {
        const char = body[index];
        index += 1;
        if (escaped) {
          raw += char;
          escaped = false;
        } else if (char === "\\") {
          raw += char;
          escaped = true;
        } else if (char === '"') {
          break;
        } else {
          raw += char;
        }
      }
      value = raw.trim();
    } else {
      const start = index;
      while (index < body.length && body[index] !== ",") index += 1;
      value = body.slice(start, index).trim();
    }
    fields.push({ name, value });
  }
  return fields;
}

function parseEntryAt(text: string, at: number): { entry: BibliographyEntry | null; end: number } {
  let index = skipSpace(text, at + 1);
  const typeStart = index;
  while (index < text.length && /[A-Za-z]/.test(text[index])) index += 1;
  if (index === typeStart) return { entry: null, end: at + 1 };
  const type = text.slice(typeStart, index).toLowerCase();
  index = skipSpace(text, index);
  const open = text[index];
  if (open !== "{" && open !== "(") return { entry: null, end: at + 1 };
  const read = readDelimited(text, index + 1, open, open === "{" ? "}" : ")");
  if (!read) return { entry: null, end: at + 1 };
  const end = read.end;
  if (KEYLESS_TYPES.has(type)) return { entry: null, end };

  let depth = 0;
  let quoted = false;
  let escaped = false;
  let comma = -1;
  for (let cursor = 0; cursor < read.value.length; cursor += 1) {
    const char = read.value[cursor];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quoted) {
      if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{" || char === "(") depth += 1;
    if (char === "}" || char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      comma = cursor;
      break;
    }
  }
  if (comma < 0) return { entry: null, end };
  const key = read.value.slice(0, comma).trim();
  if (!/^[^\s,{}()]+$/.test(key)) return { entry: null, end };

  const fields = parseFields(read.value.slice(comma + 1));
  const field = (name: string) => fields.find((item) => item.name === name)?.value ?? "";
  return {
    entry: {
      key,
      type,
      author: field("author"),
      year: field("year"),
      title: field("title"),
      fields,
      start: at,
      end,
      raw: text.slice(at, end),
    },
    end,
  };
}

export function parseBibliography(text: string): BibliographyEntry[] {
  const entries: BibliographyEntry[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "@") {
      index += 1;
      continue;
    }
    const parsed = parseEntryAt(text, index);
    if (parsed.entry) entries.push(parsed.entry);
    index = parsed.end > index ? parsed.end : index + 1;
  }
  return entries;
}

export function formatBibliographyEntry(
  entry: BibliographyDraft & { fields?: BibliographyField[] },
): string {
  const fields = (entry.fields ?? []).map((field) => ({ ...field }));
  for (const name of DISPLAY_FIELDS) {
    const value = entry[name].trim();
    const index = fields.findIndex((field) => field.name === name);
    if (value) {
      if (index >= 0) fields[index] = { name, value };
      else fields.push({ name, value });
    } else if (index >= 0) {
      fields.splice(index, 1);
    }
  }
  const header = `@${entry.type.trim() || "misc"}{${entry.key.trim()}`;
  if (fields.length === 0) return `${header}}`;
  return `${header},\n${fields.map((field) => `  ${field.name} = {${field.value}}`).join(",\n")}\n}`;
}

export function stringifyBibliography(
  entries: Array<BibliographyDraft & { fields?: BibliographyField[] }>,
): string {
  return entries.length
    ? `${entries.map((entry) => formatBibliographyEntry(entry)).join("\n\n")}\n`
    : "";
}

function findEntry(text: string, key: string): BibliographyEntry {
  const entry = parseBibliography(text).find((item) => item.key === key);
  if (!entry) throw new Error(`Bibliography entry "${key}" was not found.`);
  return entry;
}

export function addBibliographyEntry(text: string, draft: BibliographyDraft): string {
  const key = draft.key.trim();
  if (!/^[^\s,{}()]+$/.test(key)) throw new Error("Enter a valid BibTeX key.");
  if (parseBibliography(text).some((entry) => entry.key === key)) {
    throw new Error(`A bibliography entry with key "${key}" already exists.`);
  }
  const base = text.replace(/[ \t]+$/, "");
  const separator = !base ? "" : base.endsWith("\n\n") ? "" : base.endsWith("\n") ? "\n" : "\n\n";
  return `${base}${separator}${formatBibliographyEntry({ ...draft, key })}\n`;
}

export function updateBibliographyEntry(
  text: string,
  key: string,
  patch: Partial<BibliographyDraft>,
): string {
  const entry = findEntry(text, key);
  const updated = formatBibliographyEntry({ ...entry, ...patch, key: entry.key });
  return `${text.slice(0, entry.start)}${updated}${text.slice(entry.end)}`;
}

export function removeBibliographyEntry(text: string, key: string): string {
  const entry = findEntry(text, key);
  const trailing = text.slice(entry.end);
  const blankLine = /^\r?\n[ \t]*\r?\n/.exec(trailing);
  const newline = /^\r?\n/.exec(trailing);
  const end = entry.end + (blankLine?.[0].length ?? newline?.[0].length ?? 0);
  return `${text.slice(0, entry.start)}${text.slice(end)}`;
}
