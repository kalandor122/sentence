import {
  BookOpenText,
  Check,
  CloudOff,
  GitBranch,
  LoaderCircle,
  Settings2,
} from "lucide-react";

interface TopBarProps {
  projectName: string;
  saveState: "saved" | "dirty" | "saving" | "error";
  branch: string;
  dirty: boolean;
  onSave: () => void;
  onOpenSettings: () => void;
  onOpenGit: () => void;
}

export default function TopBar({
  projectName,
  saveState,
  branch,
  dirty,
  onSave,
  onOpenSettings,
  onOpenGit,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="wordmark">
        <span className="app-mark"><BookOpenText size={17} /></span>
        <span>Sentence</span>
      </div>
      <button className="quick-access" type="button" onClick={onSave} title="Save (Ctrl+S)">
        {saveState === "saving" ? <LoaderCircle className="spin" size={15} /> : saveState === "saved" && !dirty ? <Check size={15} /> : null}
        Save
      </button>
      <div className="document-heading">
        <span>{projectName}</span>
        <small>{dirty ? "Editing" : saveState === "error" ? "Not saved" : "Saved locally"}</small>
      </div>
      <div className="topbar-spacer" />
      <button className="branch-pill" type="button" onClick={onOpenGit} title="Open Git">
        <GitBranch size={14} />
        {branch}
      </button>
      <span className="local-pill" title="No telemetry or cloud sync">
        <CloudOff size={14} />
        Local only
      </span>
      <button className="avatar-button" type="button" onClick={onOpenSettings} aria-label="Settings">
        <Settings2 size={16} />
      </button>
    </header>
  );
}
