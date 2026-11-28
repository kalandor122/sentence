import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  CheckCheck,
  CheckCircle2,
  Circle,
  GitCommitHorizontal,
  ListTree,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Undo2,
  XCircle,
} from "lucide-react";
import {
  missingCitationKeys,
  parseBibliography,
  removeBibliographyEntry,
  type BibliographyEntry,
} from "../lib/bibliography";
import { commentAnchors } from "../lib/comments";
import { pendingRevisions, revisionAuthorClass, revisionPreviewText } from "../lib/revisions";
import type {
  CommentThread,
  DocumentNode,
  GitCommit,
  Revision,
  SentenceDocument,
} from "../lib/types";
import IconButton from "./IconButton";

export type SidebarPanel = "outline" | "comments" | "history" | "references";

interface HeadingEntry {
  level: number;
  text: string;
  position: number;
}

function headingText(node: DocumentNode): string {
  if (node.type === "mathInline") {
    const latex = node.attrs?.latex;
    return typeof latex === "string" ? latex : "";
  }
  if (node.type === "hardBreak") return " ";
  return (node.text ?? "") + (node.content ?? []).map(headingText).join("");
}

function headingEntries(document: SentenceDocument): HeadingEntry[] {
  const result: HeadingEntry[] = [];
  let position = 0;
  const visit = (node: DocumentNode) => {
    if (node.type === "heading") {
      const text = (node.content ?? []).map(headingText).join("") || "Untitled heading";
      result.push({
        level: Number(node.attrs?.level ?? 1),
        text,
        position: result.length,
      });
    }
    position += 1;
    for (const child of node.content ?? []) visit(child);
  };
  visit(document);
  return result;
}

interface CommentThreadCardProps {
  thread: CommentThread;
  active: boolean;
  anchored: boolean;
  onSelected: (markId: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onAddReply: (id: string, body: string) => void;
}

function CommentThreadCard({
  thread,
  active,
  anchored,
  onSelected,
  onResolve,
  onDelete,
  onAddReply,
}: CommentThreadCardProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const replyButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!replyOpen && restoreFocus.current) {
      restoreFocus.current = false;
      replyButton.current?.focus();
    }
  }, [replyOpen]);

  const closeReply = () => {
    setReply("");
    setReplyOpen(false);
    restoreFocus.current = true;
  };

  const submitReply = () => {
    const body = reply.trim();
    if (!body) return;
    onAddReply(thread.id, body);
    closeReply();
  };

  return (
    <article
      className={`comment-thread ${thread.resolved ? "resolved" : ""} ${active ? "active" : ""} ${anchored ? "" : "detached"}`}
      onClick={() => onSelected(thread.markId)}
    >
      <header>
        <span className="author-avatar">{thread.author.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{thread.author}</strong>
          <small>{new Date(thread.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
        </div>
        <button
          type="button"
          className="icon-button compact"
          onClick={(event) => {
            event.stopPropagation();
            onResolve(thread.id, !thread.resolved);
          }}
          title={thread.resolved ? "Reopen comment" : "Resolve comment"}
        >
          {thread.resolved ? <Undo2 size={14} /> : <CheckCircle2 size={14} />}
        </button>
        <button
          type="button"
          className="icon-button compact danger"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(thread.id);
          }}
          title="Delete comment"
        >
          <Trash2 size={14} />
        </button>
      </header>
      <p>{thread.body}</p>
      {anchored ? null : (
        <div className="comment-detached" role="note">
          <TriangleAlert size={12} aria-hidden="true" />
          <span>The text this comment was attached to was deleted, so it has no highlight in the document.</span>
        </div>
      )}
      {thread.replies.map((item) => (
        <div className="comment-reply" key={item.id}>
          <strong>{item.author}</strong>
          <p>{item.body}</p>
        </div>
      ))}
      {replyOpen ? (
        <form
          className="comment-reply-form"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            submitReply();
          }}
        >
          <label className="comment-reply-field">
            <span>Reply to {thread.author}</span>
            <textarea
              autoFocus
              rows={3}
              value={reply}
              placeholder="Write a reply..."
              onChange={(event) => setReply(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeReply();
                } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  submitReply();
                }
              }}
            />
          </label>
          <div className="comment-reply-actions">
            <button type="submit" className="primary-button small" disabled={!reply.trim()}>Reply</button>
            <button type="button" className="secondary-button small" onClick={closeReply}>Cancel</button>
          </div>
        </form>
      ) : (
        <button
          ref={replyButton}
          type="button"
          className="text-button comment-reply-toggle"
          aria-label={`Reply to ${thread.author}'s comment`}
          onClick={(event) => {
            event.stopPropagation();
            setReplyOpen(true);
          }}
        >
          Reply
        </button>
      )}
    </article>
  );
}

interface RevisionListProps {
  revisions: Revision[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const REVISION_PREVIEW_LENGTH = 180;
const REVISION_PREVIEW_CONTEXT = 40;

function revisionPreview(before: string, after: string) {
  let changeStart = 0;
  while (changeStart < before.length && changeStart < after.length && before[changeStart] === after[changeStart]) {
    changeStart += 1;
  }
  const windowStart = Math.max(0, changeStart - REVISION_PREVIEW_CONTEXT);
  return {
    before: before.slice(windowStart, windowStart + REVISION_PREVIEW_LENGTH),
    after: after.slice(windowStart, windowStart + REVISION_PREVIEW_LENGTH),
  };
}

function RevisionList({
  revisions,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: RevisionListProps) {
  return (
    <div className="revision-list">
      <header className="revision-heading">
        <span>Tracked changes</span>
        <b aria-live="polite">{revisions.length}</b>
      </header>
      {revisions.length > 0 ? (
        <div className="revision-bulk" role="group" aria-label="Review all tracked changes">
          <button type="button" className="secondary-button small" onClick={onAcceptAll} aria-label="Accept all tracked changes">
            <CheckCheck size={12} /> Accept all
          </button>
          <button type="button" className="secondary-button small" onClick={onRejectAll} aria-label="Reject all tracked changes">
            <XCircle size={12} /> Reject all
          </button>
        </div>
      ) : (
        <p className="panel-empty">Edits made with Tracking on appear here for review.</p>
      )}
      {revisions.map((revision) => {
        const { before, after } = revisionPreviewText(revision);
        const preview = revisionPreview(before, after);
        return (
          <article className={`revision-card ${revisionAuthorClass(revision.author)}`} key={revision.id}>
            <header>
              <strong><span className="revision-dot" aria-hidden="true" />{revision.author}</strong>
              <small>{new Date(revision.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
            </header>
            <p className="revision-before">{preview.before || "Empty document"}</p>
            <p className="revision-after">{preview.after}</p>
            <div role="group" aria-label={`Review change by ${revision.author}`}>
              <button
                type="button"
                className="accent-button small"
                onClick={() => onAccept(revision.id)}
                aria-label={`Accept change by ${revision.author}`}
              >
                Accept
              </button>
              <button
                type="button"
                className="secondary-button small"
                onClick={() => onReject(revision.id)}
                aria-label={`Reject change by ${revision.author}`}
              >
                Reject
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

interface ReferencesPanelProps {
  document: SentenceDocument;
  bibliography: string;
  canInsertCitations: boolean;
  onChange: (value: string) => void;
  onInsertCitation: (key: string) => void;
  onInsertManually: () => void;
  onAddEntry: () => void;
  onEditEntry: (entry: BibliographyEntry) => void;
}

function ReferencesPanel({
  document,
  bibliography,
  canInsertCitations,
  onChange,
  onInsertCitation,
  onInsertManually,
  onAddEntry,
  onEditEntry,
}: ReferencesPanelProps) {
  const entries = useMemo(() => parseBibliography(bibliography), [bibliography]);
  const missing = useMemo(
    () => missingCitationKeys(document, bibliography),
    [document, bibliography],
  );
  const [query, setQuery] = useState("");
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? entries.filter((entry) =>
        [entry.key, entry.type, entry.author, entry.year, entry.title]
          .some((value) => value.toLowerCase().includes(needle)))
    : entries;

  const insertFirst = () => {
    // The search form still filters in Source view; submitting it there reaches
    // the App-level citation guard, which explains why nothing is inserted.
    if (visible.length > 0) onInsertCitation(visible[0].key);
  };

  return (
    <>
      <header className="panel-heading">
        <div>
          <span className="eyebrow">Bibliography</span>
          <h2>References</h2>
        </div>
        <button type="button" className="accent-button small" onClick={onAddEntry} aria-label="Add bibliography entry">
          <Plus size={12} /> Add
        </button>
      </header>
      {canInsertCitations ? null : (
        <div className="bib-warning" id="bib-insert-unavailable" role="status">
          <TriangleAlert size={12} aria-hidden="true" />
          <span>Citations can only be inserted in Visual or Split view. Switch views to cite an entry.</span>
        </div>
      )}
      {missing.length > 0 ? (
        <div className="bib-warning" role="status">
          <TriangleAlert size={12} aria-hidden="true" />
          <span>
            {missing.length === 1
              ? "1 citation key is missing from the bibliography: "
              : `${missing.length} citation keys are missing from the bibliography: `}
            <code>{missing.join(", ")}</code>.{" "}
            {missing.length === 1
              ? "Add an entry for it to resolve the reference."
              : "Add entries for them to resolve the references."}
          </span>
        </div>
      ) : null}
      <div className="bib-tools">
        <form className="bib-search" role="search" aria-label="Search references" onSubmit={(event) => {
          event.preventDefault();
          insertFirst();
        }}>
          <Search size={13} aria-hidden="true" />
          <input
            autoFocus
            type="search"
            aria-label="Search bibliography"
            placeholder="Key, author, year or title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
        </form>
        <span className="bib-count" aria-live="polite">{visible.length} of {entries.length}</span>
      </div>
      <div className="bib-list">
        {entries.length === 0 ? <p className="panel-empty">No bibliography entries yet. Add one to cite it in the document.</p> : null}
        {entries.length > 0 && visible.length === 0 ? <p className="panel-empty">No entries match “{query}”.</p> : null}
        {visible.map((entry) => (
          <article className="bib-entry" key={entry.key}>
            <div className="bib-entry-heading">
              <code>{entry.key}</code>
              <small>{entry.type}</small>
            </div>
            <strong>{entry.title || "Untitled reference"}</strong>
            <p>{[entry.author, entry.year].filter(Boolean).join(" · ") || "No author or year"}</p>
            {confirmKey === entry.key ? (
              <div className="bib-confirm" role="group" aria-label={`Delete ${entry.key}?`}>
                <span>Delete this entry?</span>
                <button type="button" className="secondary-button small" onClick={() => setConfirmKey(null)}>Cancel</button>
                <button type="button" className="primary-button small" onClick={() => {
                  onChange(removeBibliographyEntry(bibliography, entry.key));
                  setConfirmKey(null);
                }}>Delete</button>
              </div>
            ) : (
              <div className="bib-entry-actions">
                <button
                  type="button"
                  className="accent-button small"
                  disabled={!canInsertCitations}
                  aria-describedby={canInsertCitations ? undefined : "bib-insert-unavailable"}
                  onClick={() => onInsertCitation(entry.key)}
                >
                  Cite
                </button>
                <IconButton label={`Edit ${entry.key}`} compact onClick={() => onEditEntry(entry)}><Pencil size={13} /></IconButton>
                <IconButton label={`Delete ${entry.key}`} compact className="danger" onClick={() => setConfirmKey(entry.key)}><Trash2 size={13} /></IconButton>
              </div>
            )}
          </article>
        ))}
      </div>
      <footer className="bib-panel-footer">
        <button
          type="button"
          className="text-button"
          disabled={!canInsertCitations}
          aria-describedby={canInsertCitations ? undefined : "bib-insert-unavailable"}
          onClick={onInsertManually}
        >
          Enter a key manually
        </button>
      </footer>
    </>
  );
}

interface SidebarProps {
  open: boolean;
  panel: SidebarPanel;
  document: SentenceDocument;
  comments: CommentThread[];
  revisions: Revision[];
  history: GitCommit[];
  bibliography: string;
  activeCommentId: string | null;
  canInsertCitations: boolean;
  onPanelChange: (panel: SidebarPanel) => void;
  onBibliographyChange: (value: string) => void;
  onInsertCitationKey: (key: string) => void;
  onInsertCitationManually: () => void;
  onAddBibliographyEntry: () => void;
  onEditBibliographyEntry: (entry: BibliographyEntry) => void;
  onHeadingClick: (position: number) => void;
  onCommentSelected: (id: string) => void;
  onResolveComment: (id: string, resolved: boolean) => void;
  onDeleteComment: (id: string) => void;
  onAddReply: (id: string, body: string) => void;
  onAcceptRevision: (id: string) => void;
  onRejectRevision: (id: string) => void;
  onAcceptAllRevisions: () => void;
  onRejectAllRevisions: () => void;
}

export default function Sidebar({
  open,
  panel,
  document,
  comments,
  revisions,
  history,
  bibliography,
  activeCommentId,
  canInsertCitations,
  onPanelChange,
  onBibliographyChange,
  onInsertCitationKey,
  onInsertCitationManually,
  onAddBibliographyEntry,
  onEditBibliographyEntry,
  onHeadingClick,
  onCommentSelected,
  onResolveComment,
  onDeleteComment,
  onAddReply,
  onAcceptRevision,
  onRejectRevision,
  onAcceptAllRevisions,
  onRejectAllRevisions,
}: SidebarProps) {
  const headings = useMemo(() => headingEntries(document), [document]);
  const anchoredCommentIds = useMemo(
    () => new Set(commentAnchors(document).map((anchor) => anchor.markId)),
    [document],
  );
  const unresolved = comments.filter((thread) => !thread.resolved);
  const pending = pendingRevisions(revisions);
  const bibliographyCount = useMemo(() => parseBibliography(bibliography).length, [bibliography]);

  if (!open) return null;
  return (
    <aside className="sidebar">
      <nav className="sidebar-rail" aria-label="Navigation panels">
        <button
          type="button"
          className={panel === "outline" ? "active" : ""}
          aria-pressed={panel === "outline"}
          aria-controls="sidebar-panel"
          onClick={() => onPanelChange("outline")}
        >
          <ListTree size={18} />
          <span>Outline</span>
        </button>
        <button
          type="button"
          className={panel === "comments" ? "active" : ""}
          aria-pressed={panel === "comments"}
          aria-controls="sidebar-panel"
          onClick={() => onPanelChange("comments")}
        >
          <MessageSquareText size={18} />
          <span>Review</span>
          {unresolved.length > 0 ? <b>{unresolved.length}</b> : null}
        </button>
        <button
          type="button"
          className={panel === "references" ? "active" : ""}
          aria-pressed={panel === "references"}
          aria-controls="sidebar-panel"
          onClick={() => onPanelChange("references")}
        >
          <BookMarked size={18} />
          <span>References</span>
          {bibliographyCount > 0 ? <b>{bibliographyCount}</b> : null}
        </button>
        <button
          type="button"
          className={panel === "history" ? "active" : ""}
          aria-pressed={panel === "history"}
          aria-controls="sidebar-panel"
          onClick={() => onPanelChange("history")}
        >
          <GitCommitHorizontal size={18} />
          <span>History</span>
          {pending.length > 0 ? <b>{pending.length}</b> : null}
        </button>
      </nav>
      <section className="sidebar-panel" id="sidebar-panel" aria-label="Navigation panel content">
        {panel === "outline" ? (
          <>
            <header className="panel-heading">
              <div>
                <span className="eyebrow">Navigation</span>
                <h2>Outline</h2>
              </div>
              <span className="count-badge">{headings.length}</span>
            </header>
            {headings.length > 0 ? (
              <div className="outline-list">
                {headings.map((heading, index) => (
                  <button
                    type="button"
                    key={`${heading.position}-${index}`}
                    className={`outline-entry level-${heading.level}`}
                    onClick={() => onHeadingClick(heading.position)}
                  >
                    <span>{heading.text}</span>
                    <small>H{heading.level}</small>
                  </button>
                ))}
              </div>
            ) : <p className="panel-empty">Headings in the document will appear here.</p>}
          </>
        ) : null}

        {panel === "comments" ? (
          <>
            <header className="panel-heading">
              <div>
                <span className="eyebrow">Review</span>
                <h2>Comments</h2>
              </div>
              <span className="count-badge">{unresolved.length}</span>
            </header>
            <div className="comment-list">
              {comments.length === 0 ? <p className="panel-empty">Select text and choose New comment from the Review tab.</p> : null}
              {comments.map((thread) => (
                <CommentThreadCard
                  key={thread.id}
                  thread={thread}
                  active={activeCommentId === thread.markId}
                  anchored={anchoredCommentIds.has(thread.markId)}
                  onSelected={onCommentSelected}
                  onResolve={onResolveComment}
                  onDelete={onDeleteComment}
                  onAddReply={onAddReply}
                />
              ))}
            </div>
          </>
        ) : null}

        {panel === "references" ? (
          <ReferencesPanel
            document={document}
            bibliography={bibliography}
            canInsertCitations={canInsertCitations}
            onChange={onBibliographyChange}
            onInsertCitation={onInsertCitationKey}
            onInsertManually={onInsertCitationManually}
            onAddEntry={onAddBibliographyEntry}
            onEditEntry={onEditBibliographyEntry}
          />
        ) : null}

        {panel === "history" ? (
          <>
            <header className="panel-heading">
              <div>
                <span className="eyebrow">Repository</span>
                <h2>History</h2>
              </div>
              <span className="count-badge">{history.length}</span>
            </header>
            <div className="mini-history">
              {history.length === 0 ? <p className="panel-empty">Your first commit will begin the history.</p> : null}
              {history.map((commit, index) => (
                <div className="mini-history-entry" key={commit.id}>
                  <span className="history-rail"><Circle size={9} fill="currentColor" />{index < history.length - 1 ? <i /> : null}</span>
                  <div>
                    <strong>{commit.message.split("\n")[0]}</strong>
                    <small>{commit.author} · {new Date(commit.timestamp * 1000).toLocaleDateString()}</small>
                    <code>{commit.shortId}</code>
                  </div>
                </div>
              ))}
            </div>
            <RevisionList
              revisions={pending}
              onAccept={onAcceptRevision}
              onReject={onRejectRevision}
              onAcceptAll={onAcceptAllRevisions}
              onRejectAll={onRejectAllRevisions}
            />
          </>
        ) : null}
      </section>
    </aside>
  );
}
