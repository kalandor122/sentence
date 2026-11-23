import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  GitCommitHorizontal,
  ListTree,
  MessageSquareText,
  Trash2,
  Undo2,
} from "lucide-react";
import type {
  CommentThread,
  DocumentNode,
  GitCommit,
  Revision,
  SentenceDocument,
} from "../lib/types";

export type SidebarPanel = "outline" | "comments" | "history";

interface HeadingEntry {
  level: number;
  text: string;
  position: number;
}

function headingEntries(document: SentenceDocument): HeadingEntry[] {
  const result: HeadingEntry[] = [];
  let position = 0;
  const visit = (node: DocumentNode) => {
    if (node.type === "heading") {
      const text = (node.content ?? []).map((child) => child.text ?? "").join("") || "Untitled heading";
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
  onSelected: (markId: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onAddReply: (id: string, body: string) => void;
}

function CommentThreadCard({
  thread,
  active,
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
      className={`comment-thread ${thread.resolved ? "resolved" : ""} ${active ? "active" : ""}`}
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

interface SidebarProps {
  open: boolean;
  panel: SidebarPanel;
  document: SentenceDocument;
  comments: CommentThread[];
  revisions: Revision[];
  history: GitCommit[];
  activeCommentId: string | null;
  onPanelChange: (panel: SidebarPanel) => void;
  onHeadingClick: (position: number) => void;
  onCommentSelected: (id: string) => void;
  onResolveComment: (id: string, resolved: boolean) => void;
  onDeleteComment: (id: string) => void;
  onAddReply: (id: string, body: string) => void;
  onAcceptRevision: (id: string) => void;
  onRejectRevision: (id: string) => void;
}

export default function Sidebar({
  open,
  panel,
  document,
  comments,
  revisions,
  history,
  activeCommentId,
  onPanelChange,
  onHeadingClick,
  onCommentSelected,
  onResolveComment,
  onDeleteComment,
  onAddReply,
  onAcceptRevision,
  onRejectRevision,
}: SidebarProps) {
  const headings = headingEntries(document);
  const unresolved = comments.filter((thread) => !thread.resolved);
  const pendingRevisions = revisions.filter((revision) => !revision.accepted && !revision.rejected);

  if (!open) return null;
  return (
    <aside className="sidebar">
      <nav className="sidebar-rail" aria-label="Navigation panels">
        <button type="button" className={panel === "outline" ? "active" : ""} onClick={() => onPanelChange("outline")}>
          <ListTree size={18} />
          <span>Outline</span>
        </button>
        <button type="button" className={panel === "comments" ? "active" : ""} onClick={() => onPanelChange("comments")}>
          <MessageSquareText size={18} />
          <span>Review</span>
          {unresolved.length > 0 ? <b>{unresolved.length}</b> : null}
        </button>
        <button type="button" className={panel === "history" ? "active" : ""} onClick={() => onPanelChange("history")}>
          <GitCommitHorizontal size={18} />
          <span>History</span>
        </button>
      </nav>
      <section className="sidebar-panel">
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
                  onSelected={onCommentSelected}
                  onResolve={onResolveComment}
                  onDelete={onDeleteComment}
                  onAddReply={onAddReply}
                />
              ))}
            </div>
            {pendingRevisions.length > 0 ? (
              <div className="revision-list">
                <header className="revision-heading">
                  <span>Tracked edits</span>
                  <b>{pendingRevisions.length}</b>
                </header>
                {pendingRevisions.map((revision) => (
                  <article className="revision-card" key={revision.id}>
                    <header>
                      <strong>{revision.author}</strong>
                      <small>{new Date(revision.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                    </header>
                    <p className="revision-before">{revision.before.slice(-180) || "Empty document"}</p>
                    <p className="revision-after">{revision.after.slice(-180)}</p>
                    <div>
                      <button type="button" className="accent-button" onClick={() => onAcceptRevision(revision.id)}>Accept</button>
                      <button type="button" className="secondary-button" onClick={() => onRejectRevision(revision.id)}>Reject</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </>
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
          </>
        ) : null}
      </section>
    </aside>
  );
}
