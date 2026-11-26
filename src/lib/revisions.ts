import type { DocumentNode, Revision, SentenceDocument } from "./types";

type Path = (string | number)[];

export interface TextChange {
  kind: "text";
  path: Path;
  prefix: string;
  removed: string;
  inserted: string;
  suffix: string;
  // Kept verbatim: prefix + suffix can overlap for pure deletions, so the
  // changed text must not be reconstructed from the other fields.
  after: string;
}

interface ValueChange {
  kind: "value";
  path: Path;
  before: unknown;
  after: unknown;
}

export type Change = TextChange | ValueChange;

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
  return [{ kind: "text", path, prefix: prefixText, removed, inserted, suffix: suffixText, after }];
}

// The editor materialises schema defaults on every node (TextAlign's
// `textAlign: null`, mark-split text runs), so a block that was not touched can
// still differ from its stored JSON. Align array items by their type and text
// only, so a split pairs against the paragraph it came from instead of leaving
// every unchanged block after it to be matched one position out of step.
function alignmentKey(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(alignmentKey).join("");
  if (isObject(value)) {
    if (typeof value.text === "string") return value.text;
    if (value.type === "hardBreak") return "\n";
    const type = typeof value.type === "string" ? value.type : "";
    return `${type}{${alignmentKey(value.content)}}`;
  }
  return JSON.stringify(value);
}

function changesBetween(before: unknown, after: unknown, path: Path): Change[] {
  if (before === after) return [];
  if (typeof before === "string" && typeof after === "string") {
    return textChange(path, before, after);
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: Change[] = [];
    // Align unchanged items first. Comparing by raw index reports a bogus text
    // replacement when a paragraph is inserted ahead of another block.
    const matchedBefore = new Set<number>();
    const matchedAfter = new Set<number>();
    after.forEach((item, index) => {
      const found = before.findIndex((candidate, beforeIndex) =>
        !matchedBefore.has(beforeIndex) && alignmentKey(candidate) === alignmentKey(item));
      if (found >= 0) {
        matchedBefore.add(found);
        matchedAfter.add(index);
      }
    });
    const remainingBefore = before.map((_, index) => index).filter((index) => !matchedBefore.has(index));
    const remainingAfter = after.map((_, index) => index).filter((index) => !matchedAfter.has(index));
    for (let position = 0; position < Math.max(remainingBefore.length, remainingAfter.length); position += 1) {
      const beforeIndex = remainingBefore[position];
      const afterIndex = remainingAfter[position];
      const left = beforeIndex === undefined ? undefined : before[beforeIndex];
      const right = afterIndex === undefined ? undefined : after[afterIndex];
      const index = afterIndex ?? beforeIndex ?? position;
      if (isObject(left) && isObject(right) && left.type !== right.type) {
        changes.push({ kind: "value", path: [...path, index], before: left, after: undefined });
        changes.push({ kind: "value", path: [...path, index], before: undefined, after: right });
      } else {
        changes.push(...changesBetween(left, right, [...path, index]));
      }
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

// Comments and formatting split a run of text into several nodes. The review
// decorations compare runs as one string: diffing raw nodes would align them by
// node, so the unchanged remainder of a split run looks deleted and re-inserted.
// Marks are dropped because a mark-only update is not a tracked change.
function mergeTextRuns(document: SentenceDocument): SentenceDocument {
  const visit = (nodes: DocumentNode[]): DocumentNode[] => {
    const result: DocumentNode[] = [];
    for (const node of nodes) {
      if (node.type === "text") {
        const previous = result[result.length - 1];
        if (previous?.type === "text") {
          result[result.length - 1] = { type: "text", text: `${previous.text ?? ""}${node.text ?? ""}` };
        } else {
          result.push({ type: "text", text: node.text ?? "" });
        }
        continue;
      }
      result.push(node.content ? { ...node, content: visit(node.content) } : node);
    }
    return result;
  };
  return { ...document, content: visit(document.content ?? []) };
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

// A mark (a comment, a link, bold) splits one run of text into several nodes, so
// the changed characters can live in a different node from the one the stored
// path names. Undo the change on the block's joined text, then rebuild the runs
// around it, so rejecting a merge still finds the inserted body text instead of
// leaving it in the merged block and restoring the paragraph beside it.
function undoBlockText(root: unknown, change: TextChange): boolean {
  const length = change.path.length;
  if (
    length < 5 ||
    change.path[length - 1] !== "text" ||
    change.path[length - 3] !== "content" ||
    typeof change.path[length - 2] !== "number"
  ) {
    return false;
  }
  const block = getAt(root, change.path.slice(0, -3));
  if (!isObject(block) || !Array.isArray(block.content)) return false;
  const nodes = block.content;
  if (!nodes.every((node) => isObject(node) && node.type === "text" && typeof node.text === "string")) return false;
  const text = nodes.map((node) => node.text as string).join("");
  const undone = undoText(text, change);
  if (undone === text) return false;
  let start = 0;
  while (start < text.length && start < undone.length && text[start] === undone[start]) start += 1;
  let before = text.length;
  let after = undone.length;
  while (before > start && after > start && text[before - 1] === undone[after - 1]) {
    before -= 1;
    after -= 1;
  }
  const characters: Array<{ char: string; marks: DocumentNode["marks"] }> = [];
  for (const node of nodes) {
    for (let index = 0; index < (node.text as string).length; index += 1) {
      characters.push({ char: (node.text as string)[index], marks: node.marks });
    }
  }
  const anchor = characters[start] ?? characters[characters.length - 1];
  const inserted = Array.from(undone.slice(start, after)).map((char) => ({ char, marks: anchor?.marks }));
  const result: DocumentNode[] = [];
  for (const item of [...characters.slice(0, start), ...inserted, ...characters.slice(before)]) {
    const previous = result[result.length - 1];
    if (previous && equalValue(previous.marks, item.marks)) {
      previous.text = `${previous.text ?? ""}${item.char}`;
    } else {
      result.push({ type: "text", text: item.char, ...(item.marks ? { marks: item.marks } : {}) });
    }
  }
  block.content = result;
  return true;
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

// Tracked changes record text edits, so a mark-only update (a comment mark, a
// link, formatting) must not become part of the next revision. Marks also split
// text nodes, so compare the characters rather than the raw document JSON.
// This mirrors documentPlainText but keeps trailing whitespace: typing a space
// is still a real edit that the revision must be able to undo.
export function trackedText(document: SentenceDocument): string {
  return (document.content ?? []).map(plainNodeText).join("");
}

function plainNodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!isObject(node)) return "";
  if (typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "footnote") {
    const text = node.attrs;
    const value = isObject(text) ? text.text : undefined;
    return typeof value === "string" ? value : "";
  }
  return Array.isArray(node.content) ? node.content.map(plainNodeText).join("") : "";
}

// Structural edits need their own signature: splitting a paragraph or adding an
// empty one leaves the joined text unchanged ("Only paragraph" is the same
// characters as "Only" + " paragraph"), so a text-only comparison would fold the
// block change into the next revision's baseline and rejecting that revision
// would leave the empty block behind. Marks and attributes stay out of the
// comparison so a comment or formatting change is still not a tracked edit.
export function trackedShape(document: SentenceDocument): string {
  const visit = (node: DocumentNode): string => {
    if (typeof node.text === "string") return node.text;
    if (node.type === "hardBreak") return "\n";
    if (node.type === "footnote") {
      const text = node.attrs?.text;
      return typeof text === "string" ? text : "";
    }
    return `${node.type}{${(node.content ?? []).map(visit).join("")}}`;
  };
  return (document.content ?? []).map(visit).join("");
}

// Review cards preview before and after text, and a structural edit can add no
// words at all. Keep block breaks and mark empty blocks so an inserted paragraph
// break does not render as two identical previews.
export function revisionText(document: SentenceDocument): string {
  const visit = (node: DocumentNode): string => {
    if (typeof node.text === "string") return node.text;
    if (node.type === "hardBreak") return "\n";
    if (node.type === "footnote") {
      const text = node.attrs?.text;
      return typeof text === "string" ? text : "";
    }
    const inner = (node.content ?? []).map(visit).join("");
    return ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
      ? `${inner || "¶"}\n`
      : inner;
  };
  return (document.content ?? []).map(visit).join("").trim();
}

export function documentChanges(before: SentenceDocument, after: SentenceDocument): Change[] {
  return changesBetween(before, after, []);
}

export function undoDocumentChanges(document: SentenceDocument, changes: Change[]): SentenceDocument {
  const next = JSON.parse(JSON.stringify(document)) as SentenceDocument;
  for (const change of changes) {
    if (change.kind === "text") {
      if (undoBlockText(next, change)) continue;
      const current = getAt(next, change.path);
      if (typeof current === "string") setValue(next, change.path, undoText(current, change));
    } else {
      undoValue(next, change);
    }
  }
  return next;
}

// Merge runs only for alignment: a restored block keeps the marks it had, or
// rejecting the deletion of a formatted paragraph would strip its formatting.
// A comment whose thread was deleted must not come back with the text, though.
function commentMarkIds(document: SentenceDocument): Set<string> {
  const ids = new Set<string>();
  const visit = (node: DocumentNode) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === "comment" && typeof mark.attrs?.markId === "string") ids.add(mark.attrs.markId);
    }
    for (const child of node.content ?? []) visit(child);
  };
  visit(document);
  return ids;
}

function withoutDeletedComments(node: unknown, live: Set<string>): unknown {
  if (Array.isArray(node)) return node.map((item) => withoutDeletedComments(item, live));
  if (!isObject(node)) return node;
  const result: Record<string, unknown> = { ...node };
  if (Array.isArray(node.marks)) {
    const marks = node.marks.filter((mark) => {
      if (!isObject(mark) || mark.type !== "comment") return true;
      const attrs = mark.attrs;
      return isObject(attrs) && typeof attrs.markId === "string" && live.has(attrs.markId);
    });
    if (marks.length > 0) result.marks = marks;
    else delete result.marks;
  }
  if (Array.isArray(node.content)) result.content = node.content.map((item) => withoutDeletedComments(item, live));
  return result;
}

function rawRestoration(before: SentenceDocument, change: Change): Change {
  if (change.kind !== "value" || change.after !== undefined || !isObject(change.before)) return change;
  if (typeof change.before.type !== "string") return change;
  const raw = getAt(before, change.path);
  if (
    !isObject(raw) ||
    raw.type !== change.before.type ||
    JSON.stringify(raw.attrs) !== JSON.stringify(change.before.attrs) ||
    plainNodeText(raw) !== plainNodeText(change.before)
  ) {
    return change;
  }
  return { ...change, before: raw };
}

// Rejection rewrites the document, so the next tracked edit must be measured
// from that result rather than from the snapshot that still held the rejected text.
export function applyRejection(document: SentenceDocument, revision: Revision): { document: SentenceDocument; changes: Change[] } {
  const beforeDocument = revision.beforeDocument ?? document;
  const liveComments = commentMarkIds(document);
  const changes = documentChanges(
    mergeTextRuns(beforeDocument),
    mergeTextRuns(revision.afterDocument ?? document),
  ).map((change) => {
    const restored = rawRestoration(beforeDocument, change);
    return restored.kind === "value" && isObject(restored.before)
      ? { ...restored, before: withoutDeletedComments(restored.before, liveComments) }
      : restored;
  });
  return { document: undoDocumentChanges(document, changes), changes };
}

export function revisionChanges(revision: Revision): Change[] {
  if (!revision.beforeDocument || !revision.afterDocument) return [];
  return documentChanges(mergeTextRuns(revision.beforeDocument), mergeTextRuns(revision.afterDocument));
}

export function pendingRevisions(revisions: Revision[]): Revision[] {
  return revisions.filter((revision) => !revision.accepted && !revision.rejected);
}

export function acceptRevisions(revisions: Revision[], ids: string[]): Revision[] {
  const targets = new Set(ids);
  return revisions.map((revision) =>
    targets.has(revision.id) && !revision.accepted && !revision.rejected
      ? { ...revision, accepted: true }
      : revision,
  );
}

// Process newest first: each rejection rewrites the remaining revisions'
// snapshots, so older changes must still be locatable in the resulting text.
export function rejectRevisions(
  document: SentenceDocument,
  revisions: Revision[],
  ids: string[],
): { document: SentenceDocument; revisions: Revision[] } {
  let nextDocument = document;
  let nextRevisions = revisions;
  for (const id of ids) {
    const revision = nextRevisions.find((item) => item.id === id);
    if (!revision || revision.accepted || revision.rejected) continue;
    const { document: undone, changes } = applyRejection(nextDocument, revision);
    nextDocument = undone;
    nextRevisions = nextRevisions.map((item) => {
      if (item.id === id) return { ...item, accepted: true, rejected: true };
      if (!item.beforeDocument || !item.afterDocument) return item;
      const beforeDocument = undoDocumentChanges(item.beforeDocument, changes);
      const afterDocument = undoDocumentChanges(item.afterDocument, changes);
      return {
        ...item,
        before: revisionText(beforeDocument),
        after: revisionText(afterDocument),
        beforeDocument,
        afterDocument,
      };
    });
  }
  return { document: nextDocument, revisions: nextRevisions };
}

export function revisionAuthorClass(author: string): string {
  let hash = 0;
  for (let index = 0; index < author.length; index += 1) {
    hash = (hash * 31 + author.charCodeAt(index)) % 5;
  }
  return `revision-author-${hash}`;
}

export function nodeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(nodeText).join("\n");
  if (isObject(value)) {
    if (typeof value.text === "string") return value.text;
    if (Array.isArray(value.content)) return nodeText(value.content);
  }
  return "";
}

// A removed node has no position in the current document, so give the editor
// surrounding text it can still use to place the strike-through inline. When
// every character of a block is removed the block itself is the only anchor
// left, so report its path as well.
export function deletionAnchor(
  revision: Revision,
  change: Change,
): { text: string; prefix: string; suffix: string; block?: Path } | null {
  if (change.kind !== "value" || change.before === undefined || change.after !== undefined || !revision.beforeDocument) return null;
  const text = nodeText(change.before);
  if (!text) return null;
  const before = mergeTextRuns(revision.beforeDocument);
  const parent = getAt(before, change.path.slice(0, -1));
  const key = change.path[change.path.length - 1];
  if (Array.isArray(parent) && typeof key === "number") {
    const owner = getAt(before, change.path.slice(0, -2));
    return {
      text,
      prefix: nodeText(parent.slice(0, key)).trim(),
      suffix: nodeText(parent.slice(key + 1)).trim(),
      block: isObject(owner) && typeof owner.type === "string" ? change.path.slice(0, -2) : undefined,
    };
  }
  if (isObject(parent) && key === "content" && parent.type !== "doc" && Array.isArray(change.before)) {
    return { text, prefix: "", suffix: "", block: change.path.slice(0, -1) };
  }
  return null;
}
