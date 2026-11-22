import { FolderOpen, Github, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { chooseDirectory, cloneGitHubProject } from "../lib/tauri";
import type { ProjectSnapshot } from "../lib/types";
import Modal from "./Modal";

interface CloneProjectDialogProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onCloned: (project: ProjectSnapshot) => void;
}

export default function CloneProjectDialog({
  open,
  token,
  onClose,
  onCloned,
}: CloneProjectDialogProps) {
  const [url, setUrl] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setParentPath("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const choose = async () => {
    const selected = await chooseDirectory();
    if (selected) setParentPath(selected);
  };

  const clone = async () => {
    if (!url.trim() || !parentPath) return;
    setBusy(true);
    setError(null);
    try {
      const project = await cloneGitHubProject(parentPath, url.trim(), token);
      onCloned(project);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Clone a Sentence project"
      description="Clone a Sentence project from GitHub into a local folder."
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="button" disabled={busy || !url.trim() || !parentPath} onClick={() => void clone()}>
            {busy ? <LoaderCircle className="spin" size={15} /> : <Github size={15} />}
            Clone repository
          </button>
        </>
      }
    >
      <label className="dialog-field">
        <span>Repository URL</span>
        <input autoFocus value={url} placeholder="https://github.com/owner/paper.git" onChange={(event) => setUrl(event.target.value)} />
      </label>
      <label className="dialog-field">
        <span>Local destination</span>
        <div className="path-picker">
          <input readOnly value={parentPath} placeholder="Choose a folder" />
          <button className="secondary-button" type="button" onClick={() => void choose()}>
            <FolderOpen size={15} /> Browse
          </button>
        </div>
      </label>
      {error ? <p className="auth-message">{error}</p> : null}
    </Modal>
  );
}
