import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { FolderOpen, Save, X } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CloneProjectDialog from "./components/CloneProjectDialog";
import ArxivExportDialog from "./components/ArxivExportDialog";
import BibliographyDialog from "./components/BibliographyDialog";
import GitHubAuthDialog from "./components/GitHubAuthDialog";
import FindBar from "./components/FindBar";
import GitPanel from "./components/GitPanel";
import IconButton from "./components/IconButton";
import InputDialog from "./components/InputDialog";
import Inspector from "./components/Inspector";
import MathDialog from "./components/MathDialog";
import NewProjectDialog from "./components/NewProjectDialog";
import PdfPreview from "./components/PdfPreview";
import Ribbon from "./components/Ribbon";
import Sidebar, { type SidebarPanel } from "./components/Sidebar";
import SourceEditor, { type SourceHistory } from "./components/SourceEditor";
import StartScreen, { type RecentProject } from "./components/StartScreen";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import WorkspaceTabs, {
  WORKSPACE_PANEL_ID,
  workspaceTabId,
  type WorkspaceTabInfo,
} from "./components/WorkspaceTabs";
import { findDocumentMatches, findTextRanges, setFindHighlight } from "./editor/find";
import { toggleList } from "./editor/listToggle";
import {
  createWelcomeDocument,
  DEFAULT_SETTINGS,
  DEMO_DOCUMENT,
  EMPTY_GIT_STATE,
} from "./lib/defaults";
import {
  addBibliographyEntry,
  parseBibliography,
  removeBibliographyEntry,
  updateBibliographyEntry,
  type BibliographyDraft,
  type BibliographyEntry,
} from "./lib/bibliography";
import { commentAnchors, restoreCommentMarks } from "./lib/comments";
import {
  documentToHtml,
  documentToMarkdown,
  type TextExportFormat,
} from "./lib/exporters";
import {
  citationKeys,
  countWords,
  documentPlainText,
  documentToLatex,
  hasCitations,
  isLatexCitationTarget,
  isLatexReferenceTarget,
  latexToDocument,
  restoreImageSources,
  uniqueImageAssetPath,
} from "./lib/latex";
import {
  acceptRevisions,
  pendingRevisions,
  rejectRevisions,
  revisionText,
  trackedShape,
} from "./lib/revisions";
import {
  assetUrl,
  authorizeAsset,
  checkoutBranch,
  chooseArxivDestination,
  chooseExportDestination,
  choosePdfDestination,
  chooseProject,
  commitChanges,
  compileProject,
  createBranch,
  createProject,
  exportArxivPackage,
  exportPdf,
  exportTextFile,
  fetchRemote,
  getGitDiff,
  getGitHubSession,
  getGitState,
  importImage,
  isDesktop,
  mergeBranch,
  openProject,
  publishGitHubRepository,
  pullRemote,
  pushRemote,
  saveProject,
  setRemote,
} from "./lib/tauri";
import type {
  ArxivPackageResult,
  CommentThread,
  CompileResult,
  DocumentNode,
  EditorMode,
  GitAuthor,
  GitState,
  GitHubAccount,
  ProjectSettings,
  ProjectSnapshot,
  Revision,
  RibbonTab,
  SentenceDocument,
} from "./lib/types";

const EditorSurface = lazy(() => import("./editor/EditorSurface"));

interface Workspace {
  path: string;
  name: string;
  document: SentenceDocument;
  bibliography: string;
  settings: ProjectSettings;
  comments: CommentThread[];
  revisions: Revision[];
  git: GitState;
}

// Inactive tabs keep their whole snapshot in memory (including un-applied
// source edits) so switching tabs never remounts the editor or loses work.
interface WorkspaceTab extends WorkspaceTabInfo {
  workspace: Workspace;
  source: string;
  sourceDirty: boolean;
  // The visual document the unapplied source draft started from. A visual edit
  // after this point means the draft is older than the visible text.
  sourceDraftDocument: string | null;
}

type DialogState =
  | { kind: "citation" }
  | { kind: "footnote"; initialValue?: string; position?: number }
  | { kind: "cross-reference" }
  | {
      kind: "link";
      initialValue: string;
      range?: { from: number; to: number };
      insertAtCaret?: boolean;
      revertOnCancel?: boolean;
      existingLink?: boolean;
    }
  | { kind: "comment" }
  | null;

interface MathEditorState {
  display: boolean;
  latex: string;
  editing: boolean;
}

interface FindState {
  open: boolean;
  query: string;
  replacement: string;
  showReplace: boolean;
  current: number;
}

function loadRecent(): RecentProject[] {
  try {
    const value = JSON.parse(localStorage.getItem("sentence.recent") ?? "[]") as RecentProject[];
    return Array.isArray(value) ? value.slice(0, 8) : [];
  } catch {
    return [];
  }
}

const BROWSER_WORKSPACE_KEY = "sentence.workspace";
const BROWSER_WORKSPACE_PATH = "browser://workspace";

function loadBrowserWorkspace(): Workspace | null {
  if (isDesktop) return null;
  try {
    const raw = localStorage.getItem(BROWSER_WORKSPACE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Workspace>;
    if (!saved.document || !saved.settings) return null;
    return {
      path: "",
      name: saved.name ?? "Quiet architecture",
      document: saved.document,
      bibliography: saved.bibliography ?? "",
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      comments: Array.isArray(saved.comments) ? saved.comments : [],
      revisions: Array.isArray(saved.revisions) ? saved.revisions : [],
      git: {
        ...EMPTY_GIT_STATE,
        ...saved.git,
        status: { ...EMPTY_GIT_STATE.status, ...saved.git?.status },
      },
    };
  } catch {
    return null;
  }
}

function saveBrowserWorkspace(project: Workspace): void {
  localStorage.setItem(BROWSER_WORKSPACE_KEY, JSON.stringify({ ...project, path: "" }));
}

// An unapplied LaTeX draft is not part of the workspace: the workspace always
// holds the visual document, which is what an invalid draft cannot be applied
// to. Keep the draft beside it so leaving the page (where the pagehide flush
// can only save the visual document) does not silently drop the text.
const BROWSER_DRAFT_KEY = "sentence.workspace.draft";

interface BrowserDraft {
  source: string;
  document: string | null;
}

function loadBrowserDraft(): BrowserDraft | null {
  if (isDesktop) return null;
  try {
    const raw = localStorage.getItem(BROWSER_DRAFT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<BrowserDraft>;
    if (typeof saved.source !== "string" || saved.source.length === 0) return null;
    return { source: saved.source, document: typeof saved.document === "string" ? saved.document : null };
  } catch {
    return null;
  }
}

function saveBrowserDraft(draft: BrowserDraft | null): void {
  // Best effort: a draft that cannot be stored is still in the editor, and
  // storage failures that matter are reported by the workspace autosave.
  try {
    if (draft) localStorage.setItem(BROWSER_DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(BROWSER_DRAFT_KEY);
  } catch {
    // Nothing to do here; the next workspace save reports a blocked storage.
  }
}

function hydrate(snapshot: ProjectSnapshot): Workspace {
  return {
    path: snapshot.path,
    name: snapshot.name,
    document: snapshot.document,
    bibliography: snapshot.bibliography ?? "",
    settings: { ...DEFAULT_SETTINGS, ...snapshot.settings },
    comments: snapshot.comments ?? [],
    revisions: snapshot.revisions ?? [],
    git: { ...EMPTY_GIT_STATE, ...snapshot.git },
  };
}

function demoWorkspace(): Workspace {
  const settings = {
    ...DEFAULT_SETTINGS,
    title: "The quiet architecture of a sentence",
    author: "Ada Lovelace\nGrace Hopper",
    affiliation: "Analytical Engine Laboratory",
    email: "ada@example.org",
    abstract:
      "A paper-shaped writing environment should keep the visual page, the LaTeX source, and the submission package aligned. We present a compact workflow for drafting and preparing a manuscript for arXiv.",
    keywords: "document editing, LaTeX, reproducible research",
    primaryCategory: "cs.SE",
    crossListCategories: "cs.DL",
    arxivComment: "Preprint draft",
  };
  return {
    path: "",
    name: "Quiet architecture",
    document: DEMO_DOCUMENT,
    bibliography:
      "@article{sentence2026,\n  author = {Sentence},\n  title = {A Sentence Test},\n  year = {2026}\n}\n",
    settings,
    comments: [
      {
        id: "demo-comment",
        markId: "demo-comment",
        author: "Editor",
        body: "This is the kind of paragraph that benefits from a quieter interface.",
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [],
      },
    ],
    revisions: [],
    git: {
      ...EMPTY_GIT_STATE,
      isRepository: true,
      status: { ...EMPTY_GIT_STATE.status, branch: "draft/opening" },
      branches: ["main", "draft/opening"],
      history: [
        {
          id: "demo1",
          shortId: "a41c8fd",
          message: "Refine the opening paragraph",
          author: "Mara Voss",
          email: "mara@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          parents: [],
        },
        {
          id: "demo2",
          shortId: "0b577e2",
          message: "Create the paper structure",
          author: "Sentence",
          email: "sentence@localhost",
          timestamp: Math.floor(Date.now() / 1000) - 86400,
          parents: ["demo1"],
        },
      ],
    },
  };
}

function joinProjectPath(root: string, relative: string): string {
  return `${root.replace(/[\\/]$/, "")}\\${relative.replace(/\//g, "\\")}`;
}

function documentSource(document: SentenceDocument, settings: ProjectSettings): string {
  return documentToLatex(document, settings);
}

// LaTeX carries the document body but no visual-only review state, so parse
// the source and put comment marks back on the text they still cover.
function parseSourceDocument(document: SentenceDocument, source: string, settings: ProjectSettings) {
  const parsed = latexToDocument(source, settings);
  const restored = restoreCommentMarks(parsed.document, commentAnchors(document));
  return {
    ...parsed,
    document: restoreImageSources(restored.document, document),
    detached: restored.detached,
  };
}

function downloadTextFile(fileName: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function withoutCommentMark(document: SentenceDocument, markId: string): SentenceDocument {
  const strip = (node: DocumentNode): DocumentNode => ({
    ...node,
    ...(node.marks
      ? { marks: node.marks.filter((mark) => !(mark.type === "comment" && mark.attrs?.markId === markId)) }
      : {}),
    ...(node.content ? { content: node.content.map(strip) } : {}),
  });
  return { ...document, content: document.content.map(strip) };
}

// With a collapsed caret Ctrl+K has no text to link, so target the word under
// the caret instead. This gives the shortcut an immediate visible effect.
function wordRangeAtCursor(editor: Editor): { from: number; to: number } | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  const before = $from.nodeBefore?.isText ? $from.nodeBefore.text ?? "" : "";
  const after = $from.nodeAfter?.isText ? $from.nodeAfter.text ?? "" : "";
  const start = before.match(/[\p{L}\p{N}_]*$/u)?.[0].length ?? 0;
  const end = after.match(/^[\p{L}\p{N}_]*/u)?.[0].length ?? 0;
  if (start === 0 && end === 0) return null;
  return { from: $from.pos - start, to: $from.pos + end };
}

// Linking or unlinking leaves the affected text selected, so the next keystroke
// would replace it. Put the caret after the text instead and drop the link from
// the stored marks, so continuing the sentence types plain text.
function caretAfterLink(editor: Editor) {
  const { from, to } = editor.state.selection;
  if (from !== to) editor.chain().focus().setTextSelection(to).run();
  editor.commands.unsetMark("link");
}

// A block atom inserted at the end of the document leaves ProseMirror with a
// node selection, so the next keystroke would replace the block just added.
// Give the caret an empty paragraph after the atom instead.
function caretAfterBlockAtom(editor: Editor) {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection) || !selection.node.isBlock) return;
  const position = selection.to;
  editor.chain().focus().insertContentAt(position, { type: "paragraph" }).setTextSelection(position + 1).run();
}

function insertBlockContent(
  editor: Editor | null,
  content: { type: string; attrs?: Record<string, string> },
) {
  if (!editor) return;
  const { selection } = editor.state;
  // Tiptap leaves an inserted block atom node-selected. A following ribbon
  // click would replace that node, so insert at the boundary after it instead.
  if (selection instanceof NodeSelection && selection.node.isBlock) {
    editor.chain().focus().insertContentAt(selection.to, content).run();
  } else {
    editor.chain().focus().insertContent(content).run();
  }
  caretAfterBlockAtom(editor);
}

function insertPageFurniture(editor: Editor | null, type: "pageBreak" | "toc") {
  insertBlockContent(editor, { type });
}

// A block image inserts at a mid-text caret by splitting the paragraph. Use
// the inline node when the caret is strictly inside a text block so the
// surrounding sentence stays intact; boundaries still insert standalone figures.
function insertImage(editor: Editor | null, attrs: Record<string, string>) {
  if (!editor) return;
  const { $from, empty } = editor.state.selection;
  const insideText =
    empty &&
    $from.parent.isTextblock &&
    $from.parentOffset > 0 &&
    $from.parentOffset < $from.parent.content.size;
  if (insideText) {
    editor.chain().focus().insertContent({ type: "inlineImage", attrs }).run();
    return;
  }
  insertBlockContent(editor, { type: "image", attrs });
}

// Inserting two files that share a name must not reuse one asset path: LaTeX
// refers to each figure by path, so the document's own images claim theirs.
function documentImagePaths(document: SentenceDocument): string[] {
  const paths: string[] = [];
  const collect = (nodes: DocumentNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "image" || node.type === "inlineImage") {
        const path = node.attrs?.path;
        if (typeof path === "string" && path) paths.push(path);
      }
      collect(node.content);
    }
  };
  collect(document.content);
  return paths;
}

// The image export writes a graphic at its own size, so the inserted node has
// to carry the pixel size the source file actually has.
function measureImage(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () =>
      resolve(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null,
      );
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(loadBrowserWorkspace);
  // A draft left unapplied when the page went away is restored before the first
  // render, so opening Source shows the user's text instead of regenerated
  // LaTeX. Only restore it into a workspace that is actually on screen.
  const [restoredDraft] = useState<BrowserDraft | null>(() => workspace ? loadBrowserDraft() : null);
  const workspaceRef = useRef<Workspace | null>(workspace);
  const [tabs, setTabsState] = useState<WorkspaceTab[]>([]);
  const tabsRef = useRef<WorkspaceTab[]>(tabs);
  const dirtyRef = useRef(false);
  const [source, setSource] = useState(() =>
    restoredDraft?.source ?? (workspace ? documentSource(workspace.document, workspace.settings) : ""));
  const sourceRef = useRef(source);
  const [sourceFile, setSourceFile] = useState<"document.tex" | "references.bib">("document.tex");
  const [sourceDirty, setSourceDirty] = useState(restoredDraft !== null);
  const sourceDirtyRef = useRef(sourceDirty);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [find, setFind] = useState<FindState>({
    open: false,
    query: "",
    replacement: "",
    showReplace: false,
    current: 0,
  });
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("Home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("outline");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [arxivOpen, setArxivOpen] = useState(false);
  const [arxivBusy, setArxivBusy] = useState(false);
  const [arxivError, setArxivError] = useState<string | null>(null);
  const [arxivResult, setArxivResult] = useState<ArxivPackageResult | null>(null);
  const [tracking, setTracking] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [gitAuthor, setGitAuthor] = useState<GitAuthor>(() => {
    try {
      return JSON.parse(localStorage.getItem("sentence.gitAuthor") ?? "null") ?? { name: "", email: "" };
    } catch {
      return { name: "", email: "" };
    }
  });
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubAccount, setGithubAccount] = useState<GitHubAccount | null>(null);
  const [githubOpen, setGithubOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [pendingClone, setPendingClone] = useState(false);
  const [gitBusy, setGitBusy] = useState(false);
  const [gitDiff, setGitDiff] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [bibliographyEntry, setBibliographyEntry] = useState<BibliographyEntry | null | undefined>(undefined);
  const [mathEditor, setMathEditor] = useState<MathEditorState | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [recent, setRecent] = useState<RecentProject[]>(loadRecent);
  // Mirrors `recent` so the list can be written outside the state updater: a
  // storage failure inside the updater would throw while React renders.
  const recentRef = useRef<RecentProject[]>(recent);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Bumped whenever the source draft is committed (Apply, autosave, leaving the
  // pane) so the source editor starts a fresh undo step. Applying does not
  // change the textarea's text, so without this the next keystroke would
  // coalesce into the edit that was just applied and one undo would drop both.
  const [sourceUndoBoundary, setSourceUndoBoundary] = useState(0);
  // The message that autosave reported for an unapplied source draft, so
  // discarding that draft can drop the error with it.
  const draftSaveError = useRef<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const sourceTextarea = useRef<HTMLTextAreaElement>(null);
  // Undo history of the source editor, kept here because the editor unmounts
  // whenever the view leaves the LaTeX pane.
  const sourceHistory = useRef<SourceHistory | null>(null);
  // Document the current clean source was last applied from. Re-entering the
  // source view regenerates LaTeX from the document, which would rewrite a
  // hand-written draft (and drop its undo history) even though nothing changed.
  const appliedSourceDocument = useRef<string | null>(null);
  // LaTeX text the clean source pane holds. Undoing a draft edit back to
  // exactly this text leaves nothing to apply.
  const appliedSourceText = useRef<string | null>(restoredDraft ? null : source);
  // The visual document as it was when the current LaTeX draft started. If the
  // visual pane is edited before the draft is applied, the draft is older than
  // what the user sees and applying it would silently delete those edits.
  const sourceDraftDocument = useRef<string | null>(restoredDraft?.document ?? null);
  const sourceDraftWarning = useRef(false);
  // The visual editor unmounts in the LaTeX view. Keep the caret it had so a
  // citation or footnote inserted after coming back lands where the user was
  // working instead of at the top of the document.
  const visualSelection = useRef<{ from: number; to: number } | null>(null);
  const linkSubmitted = useRef(false);
  const changeVersion = useRef(0);
  const revisionBaseline = useRef<SentenceDocument | null>(null);
  const revisionTimer = useRef<number | null>(null);
  // Threads whose comment mark an undo removed. Keeping them lets a redo bring
  // the thread back with the highlight instead of leaving it threadless.
  const undoneCommentThreads = useRef<CommentThread[]>([]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    sourceDirtyRef.current = sourceDirty;
  }, [sourceDirty]);

  useEffect(() => {
    if (!sourceDirty) appliedSourceText.current = source;
  }, [source, sourceDirty]);

  useEffect(() => {
    if (mode !== "source") return;
    // A mode switch remounts the textarea, so the caret (and the keyboard
    // focus the source view owns) must be handed back explicitly.
    sourceTextarea.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!editor || mode === "source") return;
    const saved = visualSelection.current;
    if (!saved) return;
    visualSelection.current = null;
    const size = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(saved.from, size));
    const to = Math.max(from, Math.min(saved.to, size));
    editor.chain().setTextSelection({ from, to }).run();
  }, [editor, mode]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    localStorage.setItem("sentence.gitAuthor", JSON.stringify(gitAuthor));
  }, [gitAuthor]);

  useEffect(() => {
    if (!isDesktop) return;
    void getGitHubSession().then((session) => {
      if (session?.status === "connected" && session.token) {
        setGithubToken(session.token);
        setGithubAccount(session.account);
      }
    }).catch(() => undefined);
  }, []);

  const handleGitHubConnected = useCallback((token: string, account: GitHubAccount) => {
    setGithubToken(token);
    setGithubAccount(account);
    setToast(`Connected to GitHub as ${account.login}.`);
    if (pendingClone) {
      setCloneOpen(true);
      setPendingClone(false);
    }
  }, [pendingClone]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setTabs = (next: WorkspaceTab[]) => {
    tabsRef.current = next;
    setTabsState(next);
  };

  const replaceTab = (tab: WorkspaceTab) => {
    const current = tabsRef.current;
    const next = current.map((item) => item.path === tab.path ? tab : item);
    setTabs(next.some((item) => item.path === tab.path) ? next : [...next, tab]);
  };

  const setDirtyState = (value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  };

  const stashActive = () => {
    if (!isDesktop) return;
    const current = workspaceRef.current;
    if (!current?.path) return;
    replaceTab({
      path: current.path,
      name: current.name,
      workspace: current,
      source: sourceRef.current,
      sourceDirty: sourceDirtyRef.current,
      sourceDraftDocument: sourceDraftDocument.current,
      dirty: dirtyRef.current,
    });
  };

  const markDirty = () => {
    changeVersion.current += 1;
    setDirtyState(true);
    setSaveState("dirty");
    const path = workspaceRef.current?.path;
    if (isDesktop && path && tabsRef.current.some((tab) => tab.path === path && !tab.dirty)) {
      setTabs(tabsRef.current.map((tab) => tab.path === path ? { ...tab, dirty: true } : tab));
    }
  };

  // A visual edit made after the draft started makes the draft older than the
  // visible text; applying it would silently delete the visual work.
  const sourceDraftConflicts = (document: SentenceDocument, draftDocument: string | null) =>
    draftDocument !== null && draftDocument !== JSON.stringify(document);

  const activateTab = (tab: WorkspaceTab, stashCurrent = true) => {
    if (stashCurrent) stashActive();
    setWorkspace(tab.workspace);
    workspaceRef.current = tab.workspace;
    setSource(tab.source);
    sourceRef.current = tab.source;
    sourceHistory.current = null;
    setSourceFile("document.tex");
    setSourceDirty(tab.sourceDirty);
    sourceDirtyRef.current = tab.sourceDirty;
    appliedSourceText.current = tab.sourceDirty ? null : tab.source;
    sourceDraftDocument.current = tab.sourceDraftDocument;
    sourceDraftWarning.current = false;
    setDirtyState(tab.dirty);
    setSaveState(tab.dirty ? "dirty" : "saved");
    setCompileResult(null);
    setVisualPages(null);
    setActiveCommentId(null);
    revisionBaseline.current = null;
    visualSelection.current = null;
    rememberProject(tab.workspace);
  };

  const openTab = (path: string) => {
    if (path === workspaceRef.current?.path) return;
    const tab = tabsRef.current.find((item) => item.path === path);
    if (tab) activateTab(tab);
  };

  const clearWorkspace = () => {
    workspaceRef.current = null;
    setWorkspace(null);
    sourceRef.current = "";
    setSource("");
    sourceHistory.current = null;
    sourceDirtyRef.current = false;
    setSourceDirty(false);
    sourceDraftDocument.current = null;
    sourceDraftWarning.current = false;
    setDirtyState(false);
    setSaveState("saved");
    setCompileResult(null);
    setVisualPages(null);
    setPreviewOpen(false);
    setGitOpen(false);
    setInspectorOpen(false);
    setActiveCommentId(null);
    revisionBaseline.current = null;
    visualSelection.current = null;
  };

  const rememberProject = (project: Workspace): string | null => {
    const path = project.path || (isDesktop ? "" : BROWSER_WORKSPACE_PATH);
    if (!path) return null;
    const next = [
      { path, name: project.name, openedAt: new Date().toISOString() },
      ...recentRef.current.filter((item) => item.path !== path),
    ].slice(0, 8);
    recentRef.current = next;
    setRecent(next);
    try {
      localStorage.setItem("sentence.recent", JSON.stringify(next));
      return null;
    } catch (error) {
      // Blocked or full storage must not take the editor down with it. Report
      // it like a failed save so the existing Retry save control can recover.
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      setSaveState("error");
      setToast(message);
      return message;
    }
  };

  const persistBrowser = (project: Workspace): boolean => {
    try {
      saveBrowserWorkspace(project);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      setSaveState("error");
      setToast(message);
      return false;
    }
  };

  const adoptWorkspace = (project: Workspace) => {
    const latex = documentSource(project.document, project.settings);
    if (isDesktop && project.path) {
      stashActive();
      replaceTab({
        path: project.path,
        name: project.name,
        workspace: project,
        source: latex,
        sourceDirty: false,
        sourceDraftDocument: null,
        dirty: false,
      });
    }
    setWorkspace(project);
    workspaceRef.current = project;
    setSource(latex);
    sourceRef.current = latex;
    sourceHistory.current = null;
    setSourceFile("document.tex");
    setSourceDirty(false);
    sourceDirtyRef.current = false;
    sourceDraftDocument.current = null;
    sourceDraftWarning.current = false;
    setDirtyState(false);
    setSaveState("saved");
    setSaveError(null);
    draftSaveError.current = null;
    setCompileResult(null);
    setVisualPages(null);
    setActiveCommentId(null);
    revisionBaseline.current = null;
    visualSelection.current = null;
    if (!isDesktop) persistBrowser(project);
    rememberProject(project);
  };

  const persist = async (): Promise<Workspace | null> => {
    let current = workspaceRef.current;
    if (!current) return null;
    const pathAtStart = current.path;
    const stillActive = () => workspaceRef.current?.path === pathAtStart;
    let draftError: string | null = null;
    // A visual edit made after the draft started is newer than the draft.
    // Applying the draft here would drop the visible text on the next autosave,
    // so the draft waits for the explicit Apply source.
    const draftConflict = sourceDraftConflicts(current.document, sourceDraftDocument.current);
    if (sourceDirtyRef.current && !draftConflict && !sourceRef.current.includes("<<<<<<<")) {
      try {
        const parsed = parseSourceDocument(current.document, sourceRef.current, current.settings);
        let applied: Workspace = { ...current, document: parsed.document, settings: parsed.settings };
        if (tracking) {
          // Autosave applies the draft without the Apply button, so the edit
          // still has to reach review from here.
          const revision = trackedRevisionFor(revisionBaseline.current ?? current.document, applied.document);
          revisionBaseline.current = applied.document;
          if (revision) applied = { ...applied, revisions: [revision, ...applied.revisions] };
        }
        current = applied;
        if (stillActive()) {
          workspaceRef.current = current;
          setWorkspace(current);
        }
        setSourceDirty(false);
        sourceDirtyRef.current = false;
        sourceDraftDocument.current = null;
        sourceDraftWarning.current = false;
        // Autosave commits the draft without the Apply button, so the next key
        // still has to start a new undo step rather than extend the old one.
        setSourceUndoBoundary((value) => value + 1);
        // The pagehide flush can run this far and then never render again, so
        // drop the stored draft here rather than waiting for the effect.
        if (!isDesktop) saveBrowserDraft(null);
        setSaveError(null);
      } catch (error) {
        // An unapplied draft can be hidden behind the visual editor. Letting
        // that parse block every later autosave would leave visible edits
        // unsaved and drop them on reload, so save the visual document and
        // keep reporting the draft error until it is fixed or discarded.
        draftError = error instanceof Error ? error.message : String(error);
        setSaveError(draftError);
        setSaveState("error");
        setToast(draftError);
      }
    }
    draftSaveError.current = draftError;
    const versionAtStart = changeVersion.current;
    const sourceDraftAtStart = sourceDraftDocument.current;
    // An invalid or outdated draft is never written; fall back to LaTeX
    // generated from the document that is actually on screen, and keep the
    // draft so the user can still choose Apply source.
    const latex = sourceDirtyRef.current && !draftError && !draftConflict
      ? sourceRef.current
      : documentSource(current.document, current.settings);
    if (!isDesktop) {
      if (!persistBrowser(current)) return null;
      const recentError = rememberProject(current);
      setSaveError(recentError ?? draftError);
      if (draftError || draftConflict || recentError) {
        setSaveState(draftError || recentError ? "error" : "dirty");
      } else {
        setDirtyState(false);
        setSaveState("saved");
      }
      return current;
    }
    if (!current.path) {
      setSaveError(draftError);
      if (draftError || draftConflict) {
        setSaveState(draftError ? "error" : "dirty");
      } else {
        setDirtyState(false);
        setSaveState("saved");
      }
      return current;
    }
    if (stillActive()) setSaveState("saving");
    setSaveError(draftError);
    try {
      const snapshot = await saveProject(
        current.path,
        current.name,
        current.document,
        current.settings,
        latex,
        current.bibliography,
        current.comments,
        current.revisions,
      );
      const updated = hydrate(snapshot);
      // The snapshot's document and settings round-trip through serde_json,
      // which reorders JSON object keys. Adopting them wholesale would make
      // EditorSurface's key-order-sensitive content guard treat the document
      // as new and reset the caret after every autosave. Keep the live
      // objects; take only identity and Git state from the snapshot.
      const merged: Workspace = {
        ...current,
        path: updated.path,
        name: updated.name,
        git: updated.git,
      };
      // A switch or a new edit can happen while saveProject is in flight.
      // Update the saved tab without replacing newer work on screen.
      const changedDuringSave = versionAtStart !== changeVersion.current;
      if (tabsRef.current.some((tab) => tab.path === pathAtStart)) {
        replaceTab({
          path: pathAtStart,
          name: merged.name,
          workspace: merged,
          source: draftError || draftConflict ? sourceRef.current : latex,
          sourceDirty: Boolean(draftError) || draftConflict,
          sourceDraftDocument: draftError || draftConflict ? sourceDraftAtStart : null,
          dirty: Boolean(draftError) || draftConflict || (stillActive() && changedDuringSave && dirtyRef.current),
        });
      }
      if (stillActive()) {
        if (changedDuringSave) {
          const live = workspaceRef.current;
          if (live) {
            const next = { ...live, git: updated.git };
            workspaceRef.current = next;
            setWorkspace(next);
          }
        } else {
          workspaceRef.current = merged;
          setWorkspace(merged);
          if (!draftError && !draftConflict) setDirtyState(false);
          setSaveState(draftError ? "error" : draftConflict ? "dirty" : "saved");
        }
        rememberProject(merged);
      }
      return merged;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      if (stillActive()) setSaveState("error");
      setToast(message);
      return null;
    }
  };

  // Closing a tab must not silently drop its unsaved edits, even when that tab
  // is not the one currently on screen.
  const persistTab = async (tab: WorkspaceTab): Promise<boolean> => {
    if (!isDesktop || !tab.workspace.path) return true;
    // An inactive tab can hold a draft older than its visual text. Applying it
    // on close would delete that text, so the draft needs an explicit choice.
    if (tab.sourceDirty && sourceDraftConflicts(tab.workspace.document, tab.sourceDraftDocument)) {
      setToast("This tab has newer visual edits than its LaTeX draft. Apply source or refresh from visual before closing.");
      return false;
    }
    let workspace = tab.workspace;
    let latex = tab.source;
    if (tab.sourceDirty) {
      try {
        const parsed = parseSourceDocument(workspace.document, tab.source, workspace.settings);
        workspace = { ...workspace, document: parsed.document, settings: parsed.settings };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSaveError(message);
        setToast(message);
        return false;
      }
    } else {
      latex = documentSource(workspace.document, workspace.settings);
    }
    setSaveError(null);
    draftSaveError.current = null;
    try {
      const snapshot = await saveProject(
        workspace.path,
        workspace.name,
        workspace.document,
        workspace.settings,
        latex,
        workspace.bibliography,
        workspace.comments,
        workspace.revisions,
      );
      const updated = hydrate(snapshot);
      replaceTab({
        path: tab.path,
        name: updated.name,
        workspace: { ...workspace, path: updated.path, name: updated.name, git: updated.git },
        source: latex,
        sourceDirty: false,
        sourceDraftDocument: null,
        dirty: false,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      if (workspaceRef.current?.path === tab.path) setSaveState("error");
      setToast(message);
      return false;
    }
  };

  const closeTab = async (path: string) => {
    const index = tabsRef.current.findIndex((tab) => tab.path === path);
    if (index < 0) return;
    const tab = tabsRef.current[index];
    const wasActive = workspaceRef.current?.path === path;
    if (tab.dirty && !(await persistTab(tab))) return;
    const remaining = tabsRef.current.filter((item) => item.path !== path);
    setTabs(remaining);
    if (!wasActive) {
      const activeIndex = remaining.findIndex((item) => item.path === workspaceRef.current?.path);
      if (activeIndex >= 0) {
        window.requestAnimationFrame(() => document.getElementById(workspaceTabId(activeIndex))?.focus());
      }
      return;
    }
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) {
      activateTab(next, false);
      window.requestAnimationFrame(() => document.getElementById(workspaceTabId(remaining.indexOf(next)))?.focus());
    } else {
      clearWorkspace();
    }
  };

  const cycleTab = (step: number) => {
    const ordered = tabsRef.current;
    if (ordered.length < 2) return;
    const index = ordered.findIndex((tab) => tab.path === workspaceRef.current?.path);
    const next = (index + step + ordered.length) % ordered.length;
    openTab(ordered[next].path);
    window.requestAnimationFrame(() => document.getElementById(workspaceTabId(next))?.focus());
  };

  useEffect(() => {
    if (workspace) rememberProject(workspace);
  }, []);

  useEffect(() => {
    if (!dirty || !workspace) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [dirty, workspace?.document, workspace?.settings, workspace?.comments, workspace?.revisions, workspace?.bibliography, source]);

  useEffect(() => {
    // The browser workspace keeps only the visual document. Mirror an unapplied
    // draft into its own key, on every keystroke rather than on the autosave
    // debounce, so a navigation away mid-word still has it after coming back.
    if (isDesktop) return;
    saveBrowserDraft(sourceDirty && source ? { source, document: sourceDraftDocument.current } : null);
  }, [source, sourceDirty]);

  useEffect(() => {
    // A page reload can happen before the autosave debounce fires. Flush the
    // latest workspace synchronously on the way out so pending edits survive.
    const flushPending = () => {
      if (!isDesktop) void persist();
    };
    window.addEventListener("pagehide", flushPending);
    return () => window.removeEventListener("pagehide", flushPending);
  }, []);

  useEffect(() => {
    // The draft was recovered from a previous page load; say where it is so a
    // reload does not look like it silently dropped it.
    if (restoredDraft) setToast("Restored your unapplied LaTeX draft in the source pane.");
  }, []);

  const handleCreate = async (name: string, parentPath: string) => {
    const document = createWelcomeDocument(name);
    const settings = { ...DEFAULT_SETTINGS, title: name };
    const latex = documentToLatex(document, settings);
    try {
      if (!isDesktop) {
        adoptWorkspace(demoWorkspace());
        return;
      }
      const snapshot = await createProject(parentPath, name, document, settings, latex);
      adoptWorkspace(hydrate(snapshot));
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpenRecent = async (path: string) => {
    if (!isDesktop) {
      adoptWorkspace(loadBrowserWorkspace() ?? demoWorkspace());
      return;
    }
    if (tabsRef.current.some((tab) => tab.path === path)) {
      openTab(path);
      return;
    }
    try {
      const snapshot = await openProject(path);
      adoptWorkspace(hydrate(snapshot));
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpen = async () => {
    if (!isDesktop) {
      adoptWorkspace(loadBrowserWorkspace() ?? demoWorkspace());
      return;
    }
    const path = await chooseProject();
    if (path) await handleOpenRecent(path);
  };

  const requestClone = () => {
    if (!isDesktop) {
      setToast("GitHub clone is available in the desktop application.");
      return;
    }
    if (githubToken) {
      setCloneOpen(true);
    } else {
      setPendingClone(true);
      setGithubOpen(true);
    }
  };

  // The pending revision for everything edited since the baseline, or null when
  // the document only differs in ways review does not track (marks, attributes).
  // Both the visual editor and the LaTeX source pane stage their edits through
  // this, so a source edit cannot slip past review.
  const trackedRevisionFor = (baseline: SentenceDocument, after: SentenceDocument): Revision | null => {
    // Compare shape, not just text: a paragraph break with no words is still an
    // edit. Saving it only in the baseline would make a rejection leave the
    // empty paragraph behind.
    if (trackedShape(baseline) === trackedShape(after)) return null;
    return {
      id: crypto.randomUUID(),
      author: gitAuthor.name || workspaceRef.current?.settings.author || "You",
      createdAt: new Date().toISOString(),
      summary: "Tracked edit",
      before: revisionText(baseline),
      after: revisionText(after),
      beforeDocument: baseline,
      afterDocument: after,
      accepted: false,
    };
  };

  // Record everything edited since the baseline as one pending revision. Called
  // by the debounce timer and, so nothing is lost, when tracking is turned off
  // mid-debounce.
  const commitTrackedRevision = () => {
    if (revisionTimer.current) {
      window.clearTimeout(revisionTimer.current);
      revisionTimer.current = null;
    }
    const latest = workspaceRef.current;
    const baseline = revisionBaseline.current;
    if (!latest || !baseline) return;
    const revision = trackedRevisionFor(baseline, latest.document);
    revisionBaseline.current = latest.document;
    if (!revision) return;
    setWorkspace((current) => current ? { ...current, revisions: [revision, ...current.revisions] } : current);
    markDirty();
  };

  const handleDocumentUpdate = (document: SentenceDocument, undoneComments: string[] = []) => {
    const before = workspaceRef.current?.document;
    if (!isDesktop && before && JSON.stringify(before) === JSON.stringify(document)) return;
    const currentSettings = workspaceRef.current?.settings;
    // Undo removes a comment's mark along with its thread. A redo puts the mark
    // back, so its stashed thread returns with it rather than leaving a
    // highlight no thread explains.
    if (undoneComments.length > 0) {
      const removed = (workspaceRef.current?.comments ?? []).filter((thread) => undoneComments.includes(thread.markId));
      undoneCommentThreads.current = [...removed, ...undoneCommentThreads.current];
      setActiveCommentId((id) => (id && undoneComments.includes(id) ? null : id));
    }
    const liveMarks = undoneCommentThreads.current.length > 0
      ? new Set(commentAnchors(document).map((anchor) => anchor.markId))
      : null;
    const restoredThreads = liveMarks
      ? undoneCommentThreads.current.filter((thread) => liveMarks.has(thread.markId))
      : [];
    if (liveMarks && restoredThreads.length > 0) {
      undoneCommentThreads.current = undoneCommentThreads.current.filter((thread) => !liveMarks.has(thread.markId));
    }
    const keepThreads = (threads: CommentThread[]) => {
      const kept = undoneComments.length > 0
        ? threads.filter((thread) => !undoneComments.includes(thread.markId))
        : threads;
      return restoredThreads.length > 0 ? [...restoredThreads, ...kept] : kept;
    };
    // Keep the ref current for the pagehide flush, which may run before React
    // commits the state update from a rapid edit.
    workspaceRef.current = workspaceRef.current
      ? { ...workspaceRef.current, document, comments: keepThreads(workspaceRef.current.comments) }
      : null;
    setWorkspace((current) =>
      current ? { ...current, document, comments: keepThreads(current.comments) } : current,
    );
    if (!sourceDirtyRef.current && currentSettings) {
      const latex = documentToLatex(document, currentSettings);
      setSource(latex);
      sourceRef.current = latex;
    } else if (sourceDirtyRef.current && mode === "split") {
      if (sourceDraftConflicts(document, sourceDraftDocument.current)) {
        if (!sourceDraftWarning.current) {
          sourceDraftWarning.current = true;
          setToast("Visual edit kept. It is not in the LaTeX draft, and Apply source would replace it.");
        }
      } else {
        sourceDraftWarning.current = false;
      }
    }
    markDirty();
    if (tracking && before) {
      const pendingBaseline = revisionBaseline.current ?? before;
      // A comment (or other annotation) changes the document but not its plain
      // text, so it must move the baseline forward instead of being folded into
      // the next tracked revision — rejecting that revision would undo it too.
      // Structural edits count: an added paragraph is a real change even when it
      // adds no words yet.
      if (trackedShape(pendingBaseline) === trackedShape(document)) {
        revisionBaseline.current = document;
      } else {
        revisionBaseline.current = pendingBaseline;
        if (revisionTimer.current) window.clearTimeout(revisionTimer.current);
        revisionTimer.current = window.setTimeout(commitTrackedRevision, 1800);
      }
    }
  };

  const acceptTrackedChanges = (ids: string[]) => {
    const current = workspaceRef.current;
    if (!current || ids.length === 0) return;
    const next: Workspace = { ...current, revisions: acceptRevisions(current.revisions, ids) };
    workspaceRef.current = next;
    setWorkspace(next);
    markDirty();
  };

  const rejectTrackedChanges = (ids: string[]) => {
    const current = workspaceRef.current;
    if (!current || ids.length === 0) return;
    const { document, revisions } = rejectRevisions(current.document, current.revisions, ids);
    if (revisionTimer.current) window.clearTimeout(revisionTimer.current);
    const next: Workspace = { ...current, document, revisions };
    workspaceRef.current = next;
    setWorkspace(next);
    revisionBaseline.current = document;
    if (!sourceDirtyRef.current) {
      const latex = documentToLatex(document, current.settings);
      setSource(latex);
      sourceRef.current = latex;
    }
    markDirty();
  };

  const activeRevisionIds = () => pendingRevisions(workspaceRef.current?.revisions ?? []).map((revision) => revision.id);

  const handleSourceChange = (value: string) => {
    if (value === appliedSourceText.current) {
      // An edit (or Ctrl+Z) returned the draft to the applied LaTeX, so there
      // is nothing left to synchronise.
      setSource(value);
      sourceRef.current = value;
      setSourceDirty(false);
      sourceDirtyRef.current = false;
      sourceDraftDocument.current = null;
      sourceDraftWarning.current = false;
      discardSourceDraft();
      return;
    }
    if (!sourceDirtyRef.current) {
      // Remember the visual text this draft started from, so an edit in the
      // other pane of the split view is not mistaken for the draft's content.
      const current = workspaceRef.current;
      sourceDraftDocument.current = current ? JSON.stringify(current.document) : null;
      sourceDraftWarning.current = false;
    }
    setSource(value);
    sourceRef.current = value;
    setSourceDirty(true);
    sourceDirtyRef.current = true;
    markDirty();
  };

  const handleBibliographyChange = (value: string) => {
    const current = workspaceRef.current;
    if (!current) return;
    const next = { ...current, bibliography: value };
    workspaceRef.current = next;
    setWorkspace(next);
    markDirty();
  };

  const openReferences = () => {
    setSidebarOpen(true);
    setSidebarPanel("references");
  };

  const insertCitation = (key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: "citation", attrs: { key } }).run();
    const current = workspaceRef.current;
    if (!current) return;
    const bibliography = parseBibliography(current.bibliography);
    const missing = citationKeys(key).filter(
      (part) => bibliography.every((entry) => entry.key !== part),
    );
    if (missing.length === 1) {
      setToast(`Citation “${missing[0]}” is not in the bibliography. Add an entry for it to resolve the reference.`);
    } else if (missing.length > 1) {
      setToast(`Citation keys ${missing.map((part) => `“${part}”`).join(", ")} are not in the bibliography. Add entries for them to resolve the references.`);
    }
  };

  const saveBibliographyEntry = (draft: BibliographyDraft) => {
    const current = workspaceRef.current;
    if (!current) return;
    try {
      const next = bibliographyEntry
        ? updateBibliographyEntry(current.bibliography, bibliographyEntry.key, draft)
        : addBibliographyEntry(current.bibliography, draft);
      handleBibliographyChange(next);
      setBibliographyEntry(undefined);
      setToast(bibliographyEntry ? "Bibliography entry updated." : "Bibliography entry added.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const applySource = () => {
    const current = workspaceRef.current;
    if (!current) return;
    setSourceUndoBoundary((value) => value + 1);
    try {
      const parsed = parseSourceDocument(current.document, sourceRef.current, current.settings);
      const next: Workspace = { ...current, document: parsed.document, settings: parsed.settings };
      workspaceRef.current = next;
      setWorkspace(next);
      if (tracking) {
        // Applying the source draft is another way to edit the document, so it
        // goes through review like a visual edit. Anything already pending is
        // folded into the same revision so the reviewer sees one change.
        revisionBaseline.current = revisionBaseline.current ?? current.document;
        commitTrackedRevision();
      }
      appliedSourceDocument.current = JSON.stringify(parsed.document);
      setSourceDirty(false);
      sourceDirtyRef.current = false;
      sourceDraftDocument.current = null;
      sourceDraftWarning.current = false;
      draftSaveError.current = null;
      setSaveError(null);
      markDirty();
      setToast(parsed.detached.length === 0
        ? "Visual document synchronized from LaTeX."
        : parsed.detached.length === 1
          ? "Visual document synchronized from LaTeX. 1 comment no longer matches any text and lost its highlight."
          : `Visual document synchronized from LaTeX. ${parsed.detached.length} comments no longer match any text and lost their highlight.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const applySourceFromButton = () => {
    applySource();
    // The Apply button disables itself once the draft is clean, which drops
    // focus onto <body>; on failure it keeps focus. Either way the caret must
    // stay in the editor, or the next keystrokes and Ctrl+Shift+Z are lost.
    sourceTextarea.current?.focus();
  };

  const discardSourceDraft = () => {
    // The autosave error came from the draft's parse failure, not from a
    // failed write. Once the draft is replaced by LaTeX from the saved visual
    // document there is nothing left to retry. Pending visual edits stay
    // dirty, so the next autosave still saves them.
    if (draftSaveError.current === null || saveError !== draftSaveError.current) return;
    draftSaveError.current = null;
    setSaveError(null);
    setSaveState(dirtyRef.current ? "dirty" : "saved");
  };

  const handleModeChange = (nextMode: EditorMode) => {
    if (nextMode === mode) return;
    // Leaving the visual editor unmounts it; remember the caret so the next
    // insertion after returning is not placed at the start of the document.
    if (nextMode === "source" && editor) {
      visualSelection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    }
    const current = workspaceRef.current;
    if (current && nextMode !== "source" && mode !== "visual" && sourceDirtyRef.current) {
      if (sourceDraftConflicts(current.document, sourceDraftDocument.current)) {
        // The draft predates the visual edit, so applying it would erase what
        // the user just typed. Keep the visible text and leave the draft
        // unapplied (Apply source is still an explicit choice).
        setToast("Visual edits kept. The unapplied LaTeX draft stays in the source pane.");
      } else {
        applySource();
      }
    }
    // Re-entering source from split keeps the already-visible source text; only
    // a transition from the visual-only view needs a fresh LaTeX snapshot.
    // An unapplied draft stays dirty when Apply failed, so regenerating here
    // would silently throw away the text the user still needs to fix. A clean
    // draft that is already applied to the untouched document is kept too:
    // regenerating it only reformats the text and would drop the undo history.
    if (nextMode === "source" && current && mode === "visual" && !sourceDirtyRef.current) {
      if (appliedSourceDocument.current !== JSON.stringify(current.document)) {
        const latex = documentToLatex(current.document, current.settings);
        setSource(latex);
        sourceRef.current = latex;
        appliedSourceDocument.current = null;
      }
      setSourceDirty(false);
      sourceDirtyRef.current = false;
      sourceDraftDocument.current = null;
      sourceDraftWarning.current = false;
    }
    setMode(nextMode);
  };

  const handleSettingsChange = (patch: Partial<ProjectSettings>) => {
    setWorkspace((current) => {
      if (!current) return current;
      const settings = { ...current.settings, ...patch };
      if (!sourceDirtyRef.current) {
        const latex = documentToLatex(current.document, settings);
        setSource(latex);
        sourceRef.current = latex;
      }
      return { ...current, settings };
    });
    markDirty();
  };

  const handleCompile = async () => {
    if (!workspaceRef.current?.path) {
      setToast(isDesktop ? "Save the project before compiling." : "Compilation is available in the desktop application.");
      return;
    }
    const saved = await persist();
    if (!saved) return;
    setCompiling(true);
    setPreviewOpen(true);
    try {
      const result = await compileProject(saved.path);
      setCompileResult(result);
      setToast(result.success ? `PDF built in ${result.durationMs} ms.` : "LaTeX reported an error.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    } finally {
      setCompiling(false);
    }
  };

  const handleExportPdf = async () => {
    const current = workspaceRef.current;
    if (!current?.path || !compileResult?.success) {
      setToast("Compile the document before exporting a PDF.");
      return;
    }
    try {
      const destination = await choosePdfDestination(current.name);
      if (!destination) return;
      await exportPdf(current.path, destination);
      setToast("PDF exported.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const handleExportArxiv = async () => {
    const current = workspaceRef.current;
    if (!current?.path) {
      setArxivOpen(true);
      setArxivError("Save the project before creating an arXiv submission package.");
      return;
    }
    if (!isDesktop) {
      setArxivOpen(true);
      setArxivError("arXiv packaging is available in the desktop application.");
      return;
    }
    setArxivResult(null);
    setArxivError(null);
    const destination = await chooseArxivDestination(current.name);
    if (!destination) return;
    setArxivBusy(true);
    setCompiling(true);
    try {
      const saved = await persist();
      if (!saved) return;
      const compiled = await compileProject(saved.path);
      setCompileResult(compiled);
      if (!compiled.success) {
        const errors = compiled.diagnostics
          .filter((item) => item.severity === "error")
          .slice(0, 4)
          .map((item) => item.message);
        throw new Error(
          errors.length > 0
            ? errors.join("\n")
            : "The paper did not compile. Fix the LaTeX error before exporting.",
        );
      }
      const packageResult = await exportArxivPackage(saved.path, destination);
      setArxivResult(packageResult);
      setToast("arXiv source package created.");
    } catch (error) {
      setArxivError(error instanceof Error ? error.message : String(error));
    } finally {
      setArxivBusy(false);
      setCompiling(false);
    }
  };

  const handleExportText = async (format: TextExportFormat | "latex") => {
    const saved = await persist();
    if (!saved) return;
    const baseName = saved.name.replace(/\.[^./\\]+$/, "") || "document";
    const exportOptions = {
      latex: {
        label: "LaTeX",
        extension: "tex",
        mime: "application/x-tex",
        content: documentToLatex(saved.document, saved.settings),
      },
      html: {
        label: "HTML",
        extension: "html",
        mime: "text/html",
        content: documentToHtml(saved.document, saved.settings),
      },
      markdown: {
        label: "Markdown",
        extension: "md",
        mime: "text/markdown",
        content: documentToMarkdown(saved.document, saved.settings),
      },
    }[format];
    const fileName = `${baseName}.${exportOptions.extension}`;
    try {
      if (isDesktop) {
        const destination = await chooseExportDestination(
          fileName,
          exportOptions.label,
          exportOptions.extension,
        );
        if (!destination) return;
        await exportTextFile(destination, exportOptions.content);
        setToast(`${exportOptions.label} exported.`);
      } else {
        downloadTextFile(fileName, exportOptions.content, exportOptions.mime);
        setToast(`${exportOptions.label} downloaded.`);
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const handleMathSubmit = (latex: string) => {
    if (!mathEditor || !editor) return;
    const selection = editor.state.selection;
    const selectedNode = selection instanceof NodeSelection ? selection.node : null;
    if (
      mathEditor.editing &&
      selectedNode &&
      (selectedNode.type.name === "mathInline" || selectedNode.type.name === "mathBlock")
    ) {
      editor.chain().focus().updateAttributes(selectedNode.type.name, { latex }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: mathEditor.display ? "mathBlock" : "mathInline",
          attrs: { latex },
        })
        .run();
    }
  };

  const closeDialog = () => {
    if (dialog?.kind === "link" && dialog.revertOnCancel && dialog.range && !linkSubmitted.current && editor) {
      editor.chain().focus().undo().run();
    }
    linkSubmitted.current = false;
    setDialog(null);
  };

  const closeMathEditor = () => {
    setMathEditor(null);
    // The dialog steals focus from the editor; restore it (and the selection on
    // a clicked math node) so typing and Backspace/Delete work immediately.
    editor?.commands.focus();
  };

  const openLinkDialog = () => {
    if (!editor) return;
    linkSubmitted.current = false;
    const href = editor.getAttributes("link").href;
    const existingHref = typeof href === "string" ? href : "";
    const { selection } = editor.state;
    const range = selection.empty ? wordRangeAtCursor(editor) : { from: selection.from, to: selection.to };
    if (!existingHref && range) {
      editor.chain().focus().setTextSelection(range).setLink({ href: "https://" }).run();
      setDialog({ kind: "link", initialValue: "", range, revertOnCancel: true });
      return;
    }
    setDialog({ kind: "link", initialValue: existingHref, insertAtCaret: !existingHref && !range, existingLink: Boolean(existingHref) });
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    caretAfterLink(editor);
    setDialog(null);
  };

  const validateDialog = (value: string): string | null => {
    if (dialog?.kind === "comment") {
      if (!workspace || !editor) return "Open a document before adding a comment.";
      return editor.state.selection.empty ? "Select text before adding a comment." : null;
    }
    if (dialog?.kind === "citation" && !isLatexCitationTarget(value)) {
      return "A BibTeX key cannot contain spaces, braces, parentheses or LaTeX special characters. Separate several keys with commas.";
    }
    if (dialog?.kind === "cross-reference" && !isLatexReferenceTarget(value)) {
      return "A label cannot contain spaces, braces, parentheses or LaTeX special characters.";
    }
    return null;
  };

  const handleDialogSubmit = (value: string) => {
    if (!dialog) return;
    switch (dialog.kind) {
      case "citation":
        insertCitation(value);
        break;
      case "footnote": {
        if (!editor) break;
        const position = dialog.position;
        if (position === undefined) {
          editor.chain().focus().insertContent({ type: "footnote", attrs: { text: value } }).run();
          break;
        }
        if (editor.state.doc.nodeAt(position)?.type.name === "footnote") {
          // Updating leaves the marker selected, which puts the caret before it.
          // Put it after the note so continuing the line types on the right side.
          editor
            .chain()
            .focus()
            .setNodeSelection(position)
            .updateAttributes("footnote", { text: value })
            .setTextSelection(position + 1)
            .run();
        }
        break;
      }
      case "cross-reference":
        editor?.chain().focus().insertContent({ type: "crossReference", attrs: { label: value } }).run();
        break;
      case "link": {
        linkSubmitted.current = true;
        if (!editor) break;
        if (dialog.range) {
          editor.chain().focus().setTextSelection(dialog.range).extendMarkRange("link").setLink({ href: value }).run();
        } else if (dialog.insertAtCaret) {
          editor.chain().focus().insertContent({
            type: "text",
            text: value,
            marks: [{ type: "link", attrs: { href: value } }],
          }).run();
        } else {
          editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
        }
        caretAfterLink(editor);
        break;
      }
      case "comment": {
        if (!workspace || !editor || editor.state.selection.empty) break;
        const markId = crypto.randomUUID();
        editor.chain().focus().addComment(markId).run();
        const thread: CommentThread = {
          id: crypto.randomUUID(),
          markId,
          author: gitAuthor.name || workspace.settings.author || "You",
          body: value,
          createdAt: new Date().toISOString(),
          resolved: false,
          replies: [],
        };
        setWorkspace((current) => current ? { ...current, comments: [thread, ...current.comments] } : current);
        setActiveCommentId(markId);
        setSidebarOpen(true);
        setSidebarPanel("comments");
        markDirty();
        break;
      }
    }
    setDialog(null);
  };

  const dialogProps = useMemo(() => {
    switch (dialog?.kind) {
      case "citation":
        return { title: "Insert citation", label: "BibTeX key", placeholder: "einstein1905" };
      case "footnote":
        return dialog.position === undefined
          ? { title: "Insert footnote", label: "Note", placeholder: "A useful note" }
          : { title: "Edit footnote", label: "Note", placeholder: "A useful note", confirmLabel: "Update" };
      case "cross-reference":
        return { title: "Insert cross-reference", label: "Label", placeholder: "fig:architecture" };
      case "link":
        return dialog.existingLink
          ? { title: "Edit link", label: "Address", placeholder: "https://example.com" }
          : { title: "Add link", label: "Address", placeholder: "https://example.com" };
      case "comment":
        return { title: "Add a comment", description: "The comment stays inside Sentence and is not written into the LaTeX.", label: "Comment", placeholder: "What should be reviewed?", multiline: true, confirmLabel: "Comment" };
      default:
        return { title: "", label: "" };
    }
  }, [dialog]);

  const handleImageSelected = async (file: File) => {
    const current = workspaceRef.current;
    if (!current) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1] ?? "";
    const size = await measureImage(dataUrl);
    const dimensions: Record<string, string> = size
      ? { naturalWidth: String(size.width), naturalHeight: String(size.height) }
      : {};
    if (isDesktop && current.path) {
      try {
        const relative = await importImage(current.path, file.name, base64);
        const absolute = joinProjectPath(current.path, relative);
        await authorizeAsset(absolute);
        insertImage(editor, {
          src: assetUrl(current.path, relative),
          alt: file.name,
          path: relative,
          ...dimensions,
        });
        markDirty();
        return;
      } catch (error) {
        setToast(error instanceof Error ? error.message : String(error));
      }
    }
    insertImage(editor, {
      src: dataUrl,
      alt: file.name,
      path: uniqueImageAssetPath(file.name, documentImagePaths(current.document)),
      ...dimensions,
    });
  };

  const refreshGit = async () => {
    const current = workspaceRef.current;
    if (!current?.path) return;
    try {
      const state = await getGitState(current.path);
      setWorkspace((next) => next ? { ...next, git: state } : next);
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
  };

  const runGit = async (action: () => Promise<GitState>, success: string) => {
    const current = workspaceRef.current;
    if (!current?.path) {
      setToast("Save or open a project before using Git.");
      return;
    }
    setGitBusy(true);
    try {
      await persist();
      await action();
      await refreshGit();
      setGitDiff(await getGitDiff(current.path));
      setToast(success);
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    } finally {
      setGitBusy(false);
    }
  };

  const handleSave = async () => {
    const saved = await persist();
    if (saved) {
      await refreshGit();
      // A draft that still cannot be parsed stays pending; keep its error
      // visible instead of reporting the whole document as saved.
      if (!sourceDirtyRef.current) {
        setToast(isDesktop ? "Saved to disk." : "Saved in this browser.");
      }
    }
  };

  const handlePublish = async (repositoryName: string, isPrivate: boolean) => {
    const current = workspaceRef.current;
    if (!current?.path || !githubToken) {
      setToast("Connect GitHub before publishing.");
      return;
    }
    setGitBusy(true);
    try {
      await persist();
      const repository = await publishGitHubRepository(
        current.path,
        githubToken,
        repositoryName,
        isPrivate,
      );
      await refreshGit();
      setToast(`Published ${repository.name ?? repositoryName} to GitHub.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    } finally {
      setGitBusy(false);
    }
  };

  const findSource = sourceFile === "document.tex" ? source : workspace?.bibliography ?? "";
  const findRanges = findTextRanges(findSource, find.query);
  const visualFindMatches = useMemo(
    () => (editor ? findDocumentMatches(editor.state.doc, find.query) : []),
    [editor, editorVersion, find.query],
  );
  const findMatches = mode === "source" ? findRanges : visualFindMatches;
  const activeFindIndex = findMatches.length ? Math.min(find.current, findMatches.length - 1) : 0;
  const findPosition = findMatches.length ? `${activeFindIndex + 1}/${findMatches.length}` : "No matches";

  useEffect(() => {
    if (!editor || (!find.open && !find.query)) return;
    setFindHighlight(editor, find.open ? find.query : "", find.open ? activeFindIndex : 0);
  }, [editor, find.open, find.query, activeFindIndex]);

  const openFind = (withReplace: boolean) => {
    let selected = "";
    if (mode === "source") {
      const textarea = sourceTextarea.current;
      if (textarea) selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    } else if (editor && !editor.state.selection.empty) {
      const { from, to } = editor.state.selection;
      selected = editor.state.doc.textBetween(from, to, " ");
    }
    setFind((current) => ({
      open: true,
      query: selected || current.query,
      replacement: current.replacement,
      showReplace: withReplace || current.showReplace,
      current: 0,
    }));
    window.requestAnimationFrame(() => {
      findInput.current?.focus();
      findInput.current?.select();
    });
  };

  const closeFind = () => {
    setFind((current) => ({ ...current, open: false }));
    window.requestAnimationFrame(() => {
      if (mode === "source") sourceTextarea.current?.focus();
      else editor?.commands.focus();
    });
  };

  const moveFind = (step: number) => {
    if (!findMatches.length) return;
    const next = (activeFindIndex + step + findMatches.length) % findMatches.length;
    setFind((current) => ({ ...current, current: next }));
    if (mode === "source") {
      const range = findRanges[next];
      const textarea = sourceTextarea.current;
      if (range && textarea) {
        textarea.setSelectionRange(range.from, range.to);
        const line = findSource.slice(0, range.from).split("\n").length - 1;
        textarea.scrollTop = Math.max(0, (line - 3) * 22);
      }
      return;
    }
    if (!editor) return;
    const ranges = visualFindMatches[next]?.ranges;
    if (!ranges?.length) return;
    editor.view.dispatch(
      editor.state.tr
        .setSelection(TextSelection.create(editor.state.doc, ranges[0].from, ranges[ranges.length - 1].to))
        .scrollIntoView(),
    );
  };

  const replaceFind = (all: boolean) => {
    if (!find.query) return;
    if (mode === "source") {
      if (!findRanges.length) return;
      const targets = all ? [...findRanges].reverse() : [findRanges[activeFindIndex]];
      let next = findSource;
      for (const range of targets) {
        if (!range) continue;
        next = next.slice(0, range.from) + find.replacement + next.slice(range.to);
      }
      if (sourceFile === "document.tex") handleSourceChange(next);
      else handleBibliographyChange(next);
    } else if (editor) {
      if (!visualFindMatches.length) return;
      const targets = all ? [...visualFindMatches].reverse() : [visualFindMatches[activeFindIndex]];
      const tr = editor.state.tr;
      for (const match of targets) {
        const ranges = match?.ranges;
        if (!ranges?.length) continue;
        tr.insertText(find.replacement, ranges[0].from, ranges[ranges.length - 1].to);
      }
      if (tr.docChanged) editor.view.dispatch(tr);
    }
    setFind((current) => ({ ...current, current: 0 }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A modal dialog owns the keyboard while it is open: background shortcuts
      // must not run or move focus out of the dialog.
      if (document.querySelector(".modal-backdrop")) return;
      const mod = event.ctrlKey || event.metaKey;
      const target = event.target;
      const inEditor = target instanceof HTMLElement && Boolean(target.closest(".sentence-editor"));
      const inTextField = target instanceof HTMLElement && (
        target.matches("input, textarea, select") ||
        (target.isContentEditable && !inEditor)
      );
      const editingDocument = mode !== "source" && !inTextField && !dialog && !mathEditor;
      const pressedDigit = (digit: string) =>
        event.key === digit || event.code === `Digit${digit}` || event.code === `Numpad${digit}`;
      if (isDesktop && mod && !event.altKey && event.key === "Tab") {
        event.preventDefault();
        cycleTab(event.shiftKey ? -1 : 1);
      }
      if (mod && event.altKey && !event.shiftKey) {
        const nextMode: EditorMode | null = pressedDigit("1") ? "visual" : pressedDigit("2") ? "source" : pressedDigit("3") ? "split" : null;
        if (nextMode) {
          event.preventDefault();
          handleModeChange(nextMode);
        }
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
      if (mod && event.key === "Enter") {
        event.preventDefault();
        void handleCompile();
      }
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (findInput.current?.closest(".find-bar")?.contains(document.activeElement)) {
          findInput.current.select();
        } else {
          openFind(find.showReplace);
        }
      }
      if (mod && event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (find.open) setFind((current) => ({ ...current, showReplace: true }));
        else openFind(true);
      }
      if (editingDocument && mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openLinkDialog();
      }
      // Inside the page Tiptap already owns these list shortcuts; outside it,
      // route them to the same commands against the current selection.
      if (editingDocument && !inEditor && mod && event.shiftKey && !event.altKey && editor) {
        if (pressedDigit("7")) {
          event.preventDefault();
          toggleList(editor, "orderedList");
        } else if (pressedDigit("8")) {
          event.preventDefault();
          toggleList(editor, "bulletList");
        }
      }
      if (editingDocument && mod && !event.shiftKey && !event.altKey) {
        const spacing: ProjectSettings["lineSpacing"] | null = pressedDigit("1") ? "single" : pressedDigit("2") ? "double" : pressedDigit("5") ? "onehalf" : null;
        if (spacing) {
          event.preventDefault();
          handleSettingsChange({ lineSpacing: spacing });
        }
      }
      if (event.key === "Escape" && find.open) {
        event.preventDefault();
        closeFind();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const words = workspace ? countWords(workspace.document) : 0;
  const [visualPages, setVisualPages] = useState<number | null>(null);
  const pages = visualPages ?? 1;
  const branch = workspace?.git.status.branch ?? "main";
  const showTabs = isDesktop && tabs.length > 0;
  const activeTabIndex = tabs.findIndex((tab) => tab.path === workspace?.path);

  const findBar = find.open ? (
    <FindBar
      query={find.query}
      replacement={find.replacement}
      showReplace={find.showReplace}
      position={findPosition}
      inputRef={findInput}
      onQueryChange={(query) => setFind((current) => ({ ...current, query, current: 0 }))}
      onReplacementChange={(replacement) => setFind((current) => ({ ...current, replacement }))}
      onToggleReplace={() => setFind((current) => ({ ...current, showReplace: !current.showReplace }))}
      onNext={() => moveFind(1)}
      onPrevious={() => moveFind(-1)}
      onReplace={() => replaceFind(false)}
      onReplaceAll={() => replaceFind(true)}
      onClose={closeFind}
    />
  ) : null;

  if (!workspace) {
    return (
      <>
        <StartScreen
          recent={recent}
          onNew={() => {
            if (isDesktop) setNewProjectOpen(true);
            else adoptWorkspace(demoWorkspace());
          }}
          onOpen={() => void handleOpen()}
          onOpenRecent={(path) => void handleOpenRecent(path)}
          onClone={requestClone}
        />
        <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} onCreate={(name, path) => void handleCreate(name, path)} />
        <GitHubAuthDialog open={githubOpen} onClose={() => setGithubOpen(false)} onConnected={handleGitHubConnected} />
        <CloneProjectDialog
          open={cloneOpen}
          token={githubToken}
          onClose={() => { setCloneOpen(false); setPendingClone(false); }}
          onCloned={(project) => adoptWorkspace(hydrate(project))}
        />
        {toast ? <div className="toast" role="alert">{toast}</div> : null}
      </>
    );
  }

  return (
    <div className={`app-shell ${showTabs ? "with-document-tabs" : ""}`} style={{ "--editor-zoom": zoom / 100 } as React.CSSProperties}>
      <TopBar
        projectName={workspace.name}
        saveState={saveState}
        branch={branch}
        dirty={dirty}
        onSave={() => void handleSave()}
        onOpenSettings={() => { setInspectorOpen(true); setGitOpen(false); }}
        onOpenGit={() => { setGitOpen(!gitOpen); setInspectorOpen(false); }}
      />
      <Ribbon
        editor={editor}
        activeTab={ribbonTab}
        mode={mode}
        settings={workspace.settings}
        tracking={tracking}
        editorVersion={editorVersion}
        inspectorOpen={inspectorOpen}
        gitOpen={gitOpen}
        onTabChange={setRibbonTab}
        onModeChange={handleModeChange}
        onSettingsChange={handleSettingsChange}
        onInsertImage={() => imageInput.current?.click()}
        onInsertMath={(display) => setMathEditor({ display, latex: "", editing: false })}
        onInsertCitation={openReferences}
        onInsertFootnote={() => setDialog({ kind: "footnote" })}
        onInsertCrossReference={() => setDialog({ kind: "cross-reference" })}
        onInsertLink={openLinkDialog}
        onInsertToc={() => insertPageFurniture(editor, "toc")}
        onInsertPageBreak={() => insertPageFurniture(editor, "pageBreak")}
        onToggleTracking={() => {
          const next = !tracking;
          if (!next) commitTrackedRevision();
          setTracking(next);
          revisionBaseline.current = next ? workspaceRef.current?.document ?? null : null;
          setToast(next ? "Tracked changes is on." : "Tracked changes is off.");
        }}
        onAddComment={() => setDialog({ kind: "comment" })}
        onOpenGit={() => { setGitOpen(true); setInspectorOpen(false); }}
        onToggleInspector={() => { setInspectorOpen(!inspectorOpen); setGitOpen(false); }}
        onCompile={() => void handleCompile()}
        onExportArxiv={() => { setArxivError(null); setArxivOpen(true); }}
        onExportLatex={() => void handleExportText("latex")}
        onExportHtml={() => void handleExportText("html")}
        onExportMarkdown={() => void handleExportText("markdown")}
      />
      {showTabs ? (
        <WorkspaceTabs
          tabs={tabs}
          activePath={workspace.path}
          onSelect={openTab}
          onClose={(path) => void closeTab(path)}
          onNew={() => setNewProjectOpen(true)}
          onOpen={() => void handleOpen()}
        />
      ) : null}
      <div
        className="workspace-row"
        id={showTabs ? WORKSPACE_PANEL_ID : undefined}
        role={showTabs ? "tabpanel" : undefined}
        aria-labelledby={showTabs && activeTabIndex >= 0 ? workspaceTabId(activeTabIndex) : undefined}
      >
        <Sidebar
          open={sidebarOpen}
          panel={sidebarPanel}
          document={workspace.document}
          comments={workspace.comments}
          revisions={workspace.revisions}
          history={workspace.git.history}
          bibliography={workspace.bibliography}
          activeCommentId={activeCommentId}
          onPanelChange={setSidebarPanel}
          onBibliographyChange={handleBibliographyChange}
          onInsertCitationKey={insertCitation}
          onInsertCitationManually={() => setDialog({ kind: "citation" })}
          onAddBibliographyEntry={() => setBibliographyEntry(null)}
          onEditBibliographyEntry={(entry) => setBibliographyEntry(entry)}
          onHeadingClick={(position) => {
            const heading = document.querySelectorAll<HTMLElement>(".sentence-editor h1, .sentence-editor h2, .sentence-editor h3")[position];
            if (!heading) return;
            // Pagination pads a heading that starts on a page rule, so its box
            // centre can sit a page below the text. Centre the text line itself.
            const range = window.document.createRange();
            range.selectNodeContents(heading);
            const textBounds = range.getBoundingClientRect();
            const textTop = textBounds.height > 0 ? textBounds.top : heading.getBoundingClientRect().top;
            const scroller = heading.closest<HTMLElement>(".visual-editor-scroll");
            if (!scroller) {
              heading.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            const bounds = scroller.getBoundingClientRect();
            scroller.scrollTo({
              top: Math.max(0, scroller.scrollTop + textTop - (bounds.top + scroller.clientHeight / 2)),
              behavior: "smooth",
            });
          }}
          onCommentSelected={(id) => {
            setActiveCommentId(id);
            setSidebarPanel("comments");
          }}
          onResolveComment={(id, resolved) => {
            setWorkspace((current) => current ? {
              ...current,
              comments: current.comments.map((thread) => thread.id === id ? { ...thread, resolved } : thread),
            } : current);
            markDirty();
          }}
          onDeleteComment={(id) => {
            const thread = workspace.comments.find((item) => item.id === id);
            if (!thread) return;
            setWorkspace((current) => current ? {
              ...current,
              document: withoutCommentMark(current.document, thread.markId),
              comments: current.comments.filter((item) => item.id !== id),
            } : current);
            if (activeCommentId === thread.markId) setActiveCommentId(null);
            markDirty();
          }}
          onAddReply={(id, body) => {
            setWorkspace((current) => current ? {
              ...current,
              comments: current.comments.map((thread) => thread.id === id ? {
                ...thread,
                replies: [...thread.replies, {
                  id: crypto.randomUUID(),
                  author: gitAuthor.name || current.settings.author || "You",
                  body,
                  createdAt: new Date().toISOString(),
                }],
              } : thread),
            } : current);
            markDirty();
          }}
          onAcceptRevision={(id) => acceptTrackedChanges([id])}
          onRejectRevision={(id) => rejectTrackedChanges([id])}
          onAcceptAllRevisions={() => acceptTrackedChanges(activeRevisionIds())}
          onRejectAllRevisions={() => rejectTrackedChanges(activeRevisionIds())}
        />
        <main className="document-stage">
          <div className={`editor-workspace layout-${mode} ${previewOpen ? "with-preview" : ""}`}>
            {mode === "visual" || mode === "split" ? (
              <section className="editor-column">
                {findBar}
                {sidebarOpen ? null : (
                  <button className="restore-sidebar" type="button" onClick={() => setSidebarOpen(true)} title="Show navigation">
                    <FolderOpen size={15} />
                  </button>
                )}
                <Suspense fallback={<div className="editor-loading">Opening document</div>}>
                  <EditorSurface
                    document={workspace.document}
                    settings={workspace.settings}
                    comments={workspace.comments}
                    revisions={workspace.revisions}
                    editable
                    onUpdate={handleDocumentUpdate}
                    onReady={setEditor}
                    onStateChange={() => setEditorVersion((version) => version + 1)}
                    onCommentSelected={(id) => {
                      setActiveCommentId(id);
                      setSidebarOpen(true);
                      setSidebarPanel("comments");
                    }}
                    onEditMath={(latex, display) => setMathEditor({ display, latex, editing: true })}
                    onEditFootnote={(text, position) => setDialog({ kind: "footnote", initialValue: text, position })}
                    onPageCountChange={setVisualPages}
                  />
                </Suspense>
              </section>
            ) : null}
            {mode === "source" || mode === "split" ? (
              <section className="source-column">
                {findBar}
                <header className="source-header">
                  <div className="source-file-tabs">
                    <button type="button" className={sourceFile === "document.tex" ? "active" : ""} onClick={() => setSourceFile("document.tex")}>document.tex</button>
                    <button type="button" className={sourceFile === "references.bib" ? "active" : ""} onClick={() => setSourceFile("references.bib")}>references.bib</button>
                    <small>{(sourceFile === "document.tex" ? source : workspace.bibliography).split("\n").length} lines</small>
                  </div>
                  <div>
                    {sourceFile === "document.tex" ? (
                      <>
                        <button className="secondary-button small" type="button" onClick={() => {
                          const latex = documentToLatex(workspace.document, workspace.settings);
                          setSource(latex);
                          setSourceDirty(false);
                          sourceDirtyRef.current = false;
                          sourceDraftDocument.current = null;
                          sourceDraftWarning.current = false;
                          discardSourceDraft();
                        }}>
                          Refresh from visual
                        </button>
                        <button className="accent-button small" type="button" onClick={applySourceFromButton} disabled={!sourceDirty}>
                          Apply source
                        </button>
                      </>
                    ) : (
                      <button className="secondary-button small" type="button" onClick={() => void handleSave()}>Save bibliography</button>
                    )}
                  </div>
                </header>
                <SourceEditor
                  value={sourceFile === "document.tex" ? source : workspace.bibliography}
                  onChange={sourceFile === "document.tex" ? handleSourceChange : handleBibliographyChange}
                  activeLine={sourceFile === "document.tex" ? compileResult?.diagnostics.find((item) => item.line)?.line : undefined}
                  textareaRef={sourceTextarea}
                  historyRef={sourceHistory}
                  undoBoundary={sourceUndoBoundary}
                />
              </section>
            ) : null}
            {previewOpen ? (
              <section className="preview-column">
                <header className="preview-column-header">
                  <span>Compiled document</span>
                  <IconButton label="Close preview" onClick={() => setPreviewOpen(false)}><X size={15} /></IconButton>
                </header>
                <PdfPreview
                  compileResult={compileResult}
                  compiling={compiling}
                  onCompile={() => void handleCompile()}
                  onExport={() => void handleExportPdf()}
                />
              </section>
            ) : null}
          </div>
        </main>
        {gitOpen ? (
          <GitPanel
            open
            projectName={workspace.name}
            git={workspace.git}
            author={gitAuthor}
            account={githubAccount}
            busy={gitBusy}
            githubConnected={Boolean(githubToken)}
            diff={gitDiff}
            onClose={() => setGitOpen(false)}
            onAuthorChange={(patch) => setGitAuthor((author) => ({ ...author, ...patch }))}
            onCommit={(message) => void runGit(() => commitChanges(workspace.path, message, gitAuthor), "Commit created.")}
            onCreateBranch={(name) => void runGit(() => createBranch(workspace.path, name), `Branch ${name} created.`)}
            onCheckoutBranch={(name) => void runGit(() => checkoutBranch(workspace.path, name), `Checked out ${name}.`)}
            onMergeBranch={(name) => void runGit(() => mergeBranch(workspace.path, name, gitAuthor), `Merged ${name}.`)}
            onFetch={() => void runGit(() => fetchRemote(workspace.path, githubToken), "Fetched remote changes.")}
            onPull={() => void runGit(() => pullRemote(workspace.path, githubToken), "Pulled remote changes.")}
            onPush={() => void runGit(() => pushRemote(workspace.path, githubToken), "Pushed branch to GitHub.")}
            onSetRemote={(url) => void runGit(() => setRemote(workspace.path, url), "Remote configured.")}
            onConnectGitHub={() => setGithubOpen(true)}
            onPublish={(name, isPrivate) => void handlePublish(name, isPrivate)}
            onLoadDiff={() => void getGitDiff(workspace.path).then(setGitDiff).catch((error) => setToast(String(error)))}
          />
        ) : null}
        {inspectorOpen && !gitOpen ? (
          <Inspector
            open
            settings={workspace.settings}
            gitAuthor={gitAuthor}
            projectPath={workspace.path}
            onClose={() => setInspectorOpen(false)}
            onSettingsChange={handleSettingsChange}
            onGitAuthorChange={(patch) => setGitAuthor((author) => ({ ...author, ...patch }))}
          />
        ) : null}
      </div>
      <StatusBar
        words={words}
        pages={pages}
        mode={mode}
        branch={branch}
        zoom={zoom}
        compileState={compiling ? "compiling" : compileResult?.success ? "success" : compileResult ? "error" : "idle"}
        onZoomChange={setZoom}
        onModeChange={handleModeChange}
      />
      {saveError ? <button className="save-error" type="button" title={saveError} aria-label={`Retry save: ${saveError}`} onClick={() => void handleSave()}><Save size={14} /> Retry save</button> : null}
      {toast ? <div className="toast" role="alert">{toast}</div> : null}
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImageSelected(file);
          event.target.value = "";
        }}
      />
      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} onCreate={(name, path) => void handleCreate(name, path)} />
      <ArxivExportDialog
        open={arxivOpen}
        settings={workspace.settings}
        hasCitations={hasCitations(workspace.document)}
        busy={arxivBusy}
        error={arxivError}
        result={arxivResult}
        onClose={() => setArxivOpen(false)}
        onOpenProperties={() => {
          setArxivOpen(false);
          setGitOpen(false);
          setInspectorOpen(true);
        }}
        onExport={() => void handleExportArxiv()}
      />
      <GitHubAuthDialog
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        onConnected={handleGitHubConnected}
      />
      <CloneProjectDialog
        open={cloneOpen}
        token={githubToken}
        onClose={() => setCloneOpen(false)}
        onCloned={(project) => adoptWorkspace(hydrate(project))}
      />
      <BibliographyDialog
        open={bibliographyEntry !== undefined}
        entry={bibliographyEntry ?? null}
        existingKeys={parseBibliography(workspace.bibliography).map((entry) => entry.key)}
        onClose={() => setBibliographyEntry(undefined)}
        onSave={saveBibliographyEntry}
      />
      <InputDialog
        open={Boolean(dialog)}
        title={dialogProps.title}
        description={"description" in dialogProps ? dialogProps.description : undefined}
        label={dialogProps.label}
        initialValue={dialog?.kind === "link" || dialog?.kind === "footnote" ? dialog.initialValue : undefined}
        placeholder={"placeholder" in dialogProps ? dialogProps.placeholder : undefined}
        multiline={"multiline" in dialogProps ? dialogProps.multiline : false}
        confirmLabel={"confirmLabel" in dialogProps ? dialogProps.confirmLabel : "Insert"}
        validate={dialog ? validateDialog : undefined}
        removeLabel={dialog?.kind === "link" && dialog.existingLink ? "Remove link" : undefined}
        onRemove={dialog?.kind === "link" && dialog.existingLink ? removeLink : undefined}
        onClose={closeDialog}
        onSubmit={handleDialogSubmit}
      />
      <MathDialog
        open={Boolean(mathEditor)}
        display={mathEditor?.display ?? false}
        initialLatex={mathEditor?.latex ?? ""}
        onClose={closeMathEditor}
        onSubmit={handleMathSubmit}
      />
    </div>
  );
}
