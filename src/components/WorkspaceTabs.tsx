import { FilePlus2, FileText, FolderOpen, X } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

export interface WorkspaceTabInfo {
  path: string;
  name: string;
  dirty: boolean;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTabInfo[];
  activePath: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onNew: () => void;
  onOpen: () => void;
}

export const WORKSPACE_PANEL_ID = "sentence-workspace-panel";

export function workspaceTabId(index: number): string {
  return `${WORKSPACE_PANEL_ID}-tab-${index}`;
}

export default function WorkspaceTabs({ tabs, activePath, onSelect, onClose, onNew, onOpen }: WorkspaceTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onSelect(tabs[next].path);
    focusTab(next);
  };

  return (
    <div className="workspace-tabs">
      <div className="workspace-tab-list" role="tablist" aria-label="Open documents" ref={listRef}>
        {tabs.map((tab, index) => {
          const active = tab.path === activePath;
          return (
            <div className={`workspace-tab ${active ? "active" : ""}`} key={tab.path} role="presentation">
              <button
                type="button"
                role="tab"
                id={workspaceTabId(index)}
                className="workspace-tab-select"
                aria-selected={active}
                aria-controls={WORKSPACE_PANEL_ID}
                aria-label={`${tab.name}${tab.dirty ? " (unsaved changes)" : ""}`}
                tabIndex={active ? 0 : -1}
                title={tab.name}
                onClick={() => onSelect(tab.path)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <FileText size={13} />
                <span>{tab.name}</span>
                {tab.dirty ? <span className="workspace-tab-dirty" aria-hidden="true" /> : null}
              </button>
              <button
                type="button"
                className="workspace-tab-close"
                aria-label={`Close ${tab.name}`}
                title={`Close ${tab.name}`}
                onClick={() => onClose(tab.path)}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="workspace-tab-actions">
        <button type="button" aria-label="New document in a new tab" title="New document in a new tab" onClick={onNew}>
          <FilePlus2 size={14} />
        </button>
        <button type="button" aria-label="Open a project in a new tab" title="Open a project in a new tab" onClick={onOpen}>
          <FolderOpen size={14} />
        </button>
      </div>
    </div>
  );
}
