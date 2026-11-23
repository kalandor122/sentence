import type { Revision, SentenceDocument } from "./types";

type Path = (string | number)[];

interface TextChange {
  kind: "text";
  path: Path;
  prefix: string;
  removed: string;
  inserted: string;
  suffix: string;
}

interface ValueChange {
  kind: "value";
  path: Path;
  before: unknown;
  after: unknown;
}

type Change = TextChange | ValueChange;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textChange(path: Path, before: string, after: string): Change[] {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const prefixText = before.slice(0, prefix);
  const suffixText = after.slice(after.length - suffix);
  const removed = before.slice(prefix, before.length - suffix);
  const inserted = after.slice(prefix, after.length - suffix);
  if (!removed && !inserted) return [];
  return [{ kind: "text", path, prefix: prefixText, removed, inserted, suffix: suffixText }];
}

function changesBetween(before: unknown, after: unknown, path: Path): Change[] {
  if (before === after) return [];
  if (typeof before === "string" && typeof after === "string") {
    return textChange(path, before, after);
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: Change[] = [];
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      changes.push(...changesBetween(before[index], after[index], [...path, index]));
    }
    return changes;
  }
  if (isObject(before) && isObject(after)) {
    const changes: Change[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      changes.push(...changesBetween(before[key], after[key], [...path, key]));
    }
    return changes;
  }
  return [{ kind: "value", path, before, after }];
}

function getAt(root: unknown, path: Path): unknown {
  let current: unknown = root;
  for (const part of path) {
    if (Array.isArray(current) && typeof part === "number") current = current[part];
    else if (isObject(current) && typeof part === "string") current = current[part];
    else return undefined;
  }
  return current;
}

function closestIndex(text: string, needle: string, expected: number): number {
  if (!needle) return -1;
  let best = -1;
  let bestDistance = Infinity;
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    const distance = Math.abs(index - expected);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
    from = index + 1;
  }
  return best;
}

function undoText(current: string, change: TextChange): string {
  const { prefix, removed, inserted, suffix } = change;
  const expected = prefix.length;
  const changed = prefix + inserted + suffix;
  const index = closestIndex(current, changed, expected);
  if (index >= 0) {
    return current.slice(0, index) + prefix + removed + suffix + current.slice(index + changed.length);
  }
  if (inserted) {
    const insertedIndex = closestIndex(current, inserted, expected);
    if (insertedIndex >= 0) {
      return current.slice(0, insertedIndex) + removed + current.slice(insertedIndex + inserted.length);
    }
  }
  if (!inserted && suffix) {
    const prefixIndex = closestIndex(current, prefix, expected);
    if (prefixIndex >= 0) {
      const suffixIndex = current.indexOf(suffix, prefixIndex + prefix.length);
      if (suffixIndex >= 0) {
        return current.slice(0, prefixIndex + prefix.length) + removed + current.slice(suffixIndex);
      }
    }
  }
  return current;
}

function setValue(root: unknown, path: Path, value: string): void {
  if (path.length === 0) return;
  const parent = getAt(root, path.slice(0, -1));
  const key = path[path.length - 1];
  if (Array.isArray(parent) && typeof key === "number") parent[key] = value;
  else if (isObject(parent) && typeof key === "string") parent[key] = value;
}

function equalValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function undoValue(root: unknown, change: ValueChange): void {
  if (change.path.length === 0) return;
  const parent = getAt(root, change.path.slice(0, -1));
  const key = change.path[change.path.length - 1];
  if (Array.isArray(parent) && typeof key === "number") {
    let index = equalValue(parent[key], change.after) ? key : -1;
    if (index < 0) index = parent.findIndex((item) => equalValue(item, change.after));
    if (change.before === undefined) {
      if (index >= 0) parent.splice(index, 1);
    } else if (change.after === undefined) {
      parent.splice(Math.min(key, parent.length), 0, change.before);
    } else if (index >= 0) {
      parent[index] = change.before;
    }
  } else if (isObject(parent) && typeof key === "string") {
    if (change.before === undefined) delete parent[key];
    else parent[key] = change.before;
  }
}

export function documentChanges(before: SentenceDocument, after: SentenceDocument): Change[] {
  return changesBetween(before, after, []);
}

export function undoDocumentChanges(document: SentenceDocument, changes: Change[]): SentenceDocument {
  const next = JSON.parse(JSON.stringify(document)) as SentenceDocument;
  for (const change of changes) {
    if (change.kind === "text") {
      const current = getAt(next, change.path);
      if (typeof current === "string") setValue(next, change.path, undoText(current, change));
    } else {
      undoValue(next, change);
    }
  }
  return next;
}

// Rejection rewrites the document, so the next tracked edit must be measured
// from that result rather than from the snapshot that still held the rejected text.
export function applyRejection(document: SentenceDocument, revision: Revision): { document: SentenceDocument; changes: Change[] } {
  const changes = documentChanges(revision.beforeDocument ?? document, revision.afterDocument ?? document);
  return { document: undoDocumentChanges(document, changes), changes };
}
