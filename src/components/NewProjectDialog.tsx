import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { chooseDirectory } from "../lib/tauri";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, parentPath: string) => void;
}

export default function NewProjectDialog({ open, onClose, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState("Untitled document");
  const [parentPath, setParentPath] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("Untitled document");
      setParentPath("");
    }
  }, [open]);

  const chooseLocation = async () => {
    setBusy(true);
    try {
      const path = await chooseDirectory();
      if (path) setParentPath(path);
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (!name.trim() || !parentPath) return;
    onCreate(name.trim(), parentPath);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Create a project"
      description="Sentence creates a folder with readable LaTeX, project metadata, references, and a local Git repository."
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="button" disabled={!name.trim() || !parentPath || busy} onClick={create}>
            Create project
          </button>
        </>
      }
    >
      <label className="dialog-field">
        <span>Document name</span>
        <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="dialog-field">
        <span>Location</span>
        <div className="path-picker">
          <input readOnly value={parentPath} placeholder="Choose a folder" />
          <button className="secondary-button" type="button" onClick={chooseLocation} disabled={busy}>
            <FolderOpen size={16} />
            Browse
          </button>
        </div>
      </label>
      <div className="preview-path">
        <span>Project folder</span>
        <code>{parentPath ? `${parentPath}\\${name || "Untitled document"}` : "No location selected"}</code>
      </div>
    </Modal>
  );
}
