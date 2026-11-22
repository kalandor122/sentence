import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Github,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { GitAuthor, GitState, GitHubAccount } from "../lib/types";
import GitGraph from "./GitGraph";

interface GitPanelProps {
  open: boolean;
  projectName: string;
  git: GitState;
  author: GitAuthor;
  account: GitHubAccount | null;
  busy: boolean;
  githubConnected: boolean;
  diff: string;
  onClose: () => void;
  onAuthorChange: (patch: Partial<GitAuthor>) => void;
  onCommit: (message: string) => void;
  onCreateBranch: (name: string) => void;
  onCheckoutBranch: (name: string) => void;
  onMergeBranch: (name: string) => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onSetRemote: (url: string) => void;
  onConnectGitHub: () => void;
  onPublish: (name: string, isPrivate: boolean) => void;
  onLoadDiff: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  conflicted: "!",
  untracked: "U",
};

export default function GitPanel({
  open,
  projectName,
  git,
  author,
  account,
  busy,
  githubConnected,
  diff,
  onClose,
  onAuthorChange,
  onCommit,
  onCreateBranch,
  onCheckoutBranch,
  onMergeBranch,
  onFetch,
  onPull,
  onPush,
  onSetRemote,
  onConnectGitHub,
  onPublish,
  onLoadDiff,
}: GitPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [branchName, setBranchName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState(git.status.remoteUrl ?? "");
  const [repositoryName, setRepositoryName] = useState(
    projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  );
  const [privateRepository, setPrivateRepository] = useState(true);
  const [showDiff, setShowDiff] = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  useEffect(() => {
    setRemoteUrl(git.status.remoteUrl ?? "");
  }, [git.status.remoteUrl]);

  if (!open) return null;
  const conflicts = git.status.changes.filter((change) => change.status === "conflicted");

  return (
    <aside className="git-panel">
      <header className="git-header">
        <div>
          <span className="eyebrow">Source control</span>
          <h2><GitBranch size={18} /> {git.status.branch}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close Git panel"><X size={16} /></button>
      </header>
      <div className="git-scroll">
        {account ? (
          <section className="git-section github-account">
            <span className="github-account-avatar">
              {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : account.login.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{account.name || account.login}</strong>
              <small>@{account.login}</small>
            </div>
            <span className="connected-label"><Check size={12} /> Connected</span>
          </section>
        ) : !githubConnected ? (
          <section className="git-section github-connect">
            <span className="github-mark"><Github size={24} /></span>
            <div>
              <h3>Connect GitHub</h3>
              <p>Sign in in your browser to publish and sync this repository.</p>
            </div>
            <button className="github-button" type="button" onClick={onConnectGitHub} disabled={busy}>Continue with GitHub</button>
          </section>
        ) : null}

        {account && !git.status.remoteUrl ? (
          <section className="git-section publish-section">
            <h3>Publish to GitHub</h3>
            <div className="inline-create">
              <input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} placeholder="repository-name" />
              <button className="primary-button" type="button" disabled={!repositoryName.trim() || busy} onClick={() => onPublish(repositoryName.trim(), privateRepository)}>
                Publish
              </button>
            </div>
            <label className="property-toggle">
              <input type="checkbox" checked={privateRepository} onChange={(event) => setPrivateRepository(event.target.checked)} />
              <span>Private repository</span>
            </label>
          </section>
        ) : null}

        <section className="git-section">
          <div className="git-section-title">
            <h3>Changes <span>{git.status.changes.length}</span></h3>
            <button className="text-button" type="button" onClick={() => { setShowDiff(!showDiff); onLoadDiff(); }}>
              {showDiff ? "Hide diff" : "View diff"}
            </button>
          </div>
          {git.status.changes.length > 0 ? (
            <div className="change-list">
              {git.status.changes.map((change) => (
                <button type="button" key={`${change.status}-${change.path}`} className="change-row" onClick={() => { setShowDiff(true); onLoadDiff(); }}>
                  <span className={`change-status ${change.status}`}>{STATUS_LABEL[change.status] ?? "M"}</span>
                  <span>{change.path}</span>
                </button>
              ))}
            </div>
          ) : <p className="git-empty">Working tree clean.</p>}
          {showDiff ? <pre className="diff-view">{diff || "No text diff to display."}</pre> : null}
          {conflicts.length > 0 ? (
            <div className="conflict-callout">
              Resolve conflict markers in the LaTeX source, save, then commit the result.
            </div>
          ) : null}
        </section>

        <section className="git-section">
          <h3>Commit</h3>
          {!author.name || !author.email ? (
            <div className="git-identity-fields">
              <input value={author.name} placeholder="Your name" onChange={(event) => onAuthorChange({ name: event.target.value })} />
              <input value={author.email} placeholder="you@example.com" onChange={(event) => onAuthorChange({ email: event.target.value })} />
            </div>
          ) : null}
          <textarea
            className="commit-message"
            rows={3}
            placeholder="Summarize your changes"
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
          />
          <div className="commit-author">{author.name || "Set your Git identity"} {author.email ? `<${author.email}>` : ""}</div>
          <button
            className="primary-button full-width"
            type="button"
            disabled={busy || !commitMessage.trim() || !author.name || !author.email}
            onClick={() => {
              onCommit(commitMessage.trim());
              setCommitMessage("");
            }}
          >
            {busy ? <LoaderCircle size={15} className="spin" /> : <GitCommitHorizontal size={15} />}
            Commit all changes
          </button>
        </section>

        <section className="git-section">
          <h3>Remote</h3>
          <div className="remote-field">
            <input
              value={remoteUrl}
              placeholder="https://github.com/owner/repository.git"
              onChange={(event) => setRemoteUrl(event.target.value)}
            />
            <button className="secondary-button" type="button" onClick={() => onSetRemote(remoteUrl.trim())} disabled={!remoteUrl.trim() || busy}>Set</button>
          </div>
          <div className="remote-actions">
            <button className="secondary-button" type="button" onClick={onFetch} disabled={busy || !git.status.remoteUrl}><RefreshCw size={14} /> Fetch</button>
            <button className="secondary-button" type="button" onClick={onPull} disabled={busy || !git.status.remoteUrl}><ArrowDownToLine size={14} /> Pull</button>
            <button className="secondary-button" type="button" onClick={onPush} disabled={busy || !git.status.remoteUrl}><ArrowUpFromLine size={14} /> Push</button>
          </div>
          <div className="sync-state">
            {git.status.ahead > 0 ? `${git.status.ahead} to push` : null}
            {git.status.behind > 0 ? `${git.status.behind} to pull` : null}
            {git.status.ahead === 0 && git.status.behind === 0 ? <><Check size={13} /> In sync</> : null}
          </div>
        </section>

        <section className="git-section">
          <div className="git-section-title">
            <h3>Branches</h3>
            <button className="text-button" type="button" onClick={() => setShowBranches(!showBranches)}>{showBranches ? "Hide" : "Manage"}</button>
          </div>
          {showBranches ? (
            <>
              <div className="branch-list">
                {git.branches.map((branch) => (
                  <div key={branch} className={branch === git.status.branch ? "current" : ""}>
                    <button type="button" onClick={() => onCheckoutBranch(branch)} disabled={branch === git.status.branch || busy}>
                      <GitBranch size={14} /> {branch}
                      {branch === git.status.branch ? <small>current</small> : null}
                    </button>
                    {branch !== git.status.branch ? (
                      <button className="icon-button compact" type="button" onClick={() => onMergeBranch(branch)} title={`Merge ${branch}`}><GitMerge size={14} /></button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="inline-create">
                <input value={branchName} placeholder="new-branch" onChange={(event) => setBranchName(event.target.value)} />
                <button className="secondary-button" type="button" disabled={!branchName.trim() || busy} onClick={() => { onCreateBranch(branchName.trim()); setBranchName(""); }}>Create</button>
              </div>
            </>
          ) : null}
        </section>

        <section className="git-section">
          <h3>History</h3>
          <GitGraph commits={git.history} />
        </section>
      </div>
    </aside>
  );
}
