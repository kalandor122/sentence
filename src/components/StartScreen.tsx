import {
  BookOpenText,
  Clock3,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Github,
  ShieldCheck,
} from "lucide-react";

export interface RecentProject {
  path: string;
  name: string;
  openedAt: string;
}

interface StartScreenProps {
  recent: RecentProject[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onClone: () => void;
}

function relativeDate(value: string): string {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function StartScreen({
  recent,
  onNew,
  onOpen,
  onOpenRecent,
  onClone,
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <div className="start-masthead">
        <div className="start-brand">
          <span className="start-brand-mark"><BookOpenText size={30} /></span>
          <div>
            <strong>Sentence</strong>
            <span>Write in a page. Keep the LaTeX.</span>
          </div>
        </div>
        <div className="start-actions">
          <button className="clone-button" type="button" onClick={onClone}>
            <Github size={18} />
            <span>Clone from GitHub</span>
          </button>
          <button className="new-document-button" type="button" onClick={onNew}>
            <FilePlus2 size={22} />
            <span>New document</span>
          </button>
        </div>
      </div>

      <div className="start-layout">
        <section className="recent-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Continue writing</span>
              <h1>Recent documents</h1>
            </div>
            <button className="text-button" type="button" onClick={onOpen}>
              <FolderOpen size={16} />
              Open folder
            </button>
          </div>
          {recent.length > 0 ? (
            <div className="recent-list">
              {recent.map((project, index) => (
                <button
                  type="button"
                  className="recent-project"
                  key={project.path}
                  onClick={() => onOpenRecent(project.path)}
                >
                  <span className="recent-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="recent-document-mark">
                    <span>{project.name.slice(0, 1).toUpperCase()}</span>
                  </span>
                  <span className="recent-copy">
                    <strong>{project.name}</strong>
                    <small>{project.path}</small>
                  </span>
                  <span className="recent-time">
                    <Clock3 size={14} />
                    {relativeDate(project.openedAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-recent">
              <GitBranch size={24} />
              <p>Your first Sentence project will appear here.</p>
              <button className="primary-button" type="button" onClick={onNew}>
                Create a project
              </button>
            </div>
          )}
        </section>

        <aside className="start-aside">
          <div className="aside-block">
            <span className="eyebrow">At a glance</span>
            <h2>A writing surface with a source of truth.</h2>
            <p>Edit visually, inspect the LaTeX, and review every change without leaving the page.</p>
          </div>
          <div className="feature-list">
            <span><ShieldCheck size={17} /> Private by default</span>
            <span><GitBranch size={17} /> Visual Git history</span>
            <span><BookOpenText size={17} /> Readable LaTeX source</span>
          </div>
        </aside>
      </div>
      <footer className="start-footer">
        <span>Sentence 0.1</span>
        <span>Documents stay on this computer unless you push them to GitHub.</span>
      </footer>
    </main>
  );
}
