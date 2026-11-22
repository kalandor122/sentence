import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
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
import GitHubAuthDialog from "./components/GitHubAuthDialog";
import GitPanel from "./components/GitPanel";
import IconButton from "./components/IconButton";
import InputDialog from "./components/InputDialog";
import Inspector from "./components/Inspector";
import MathDialog from "./components/MathDialog";
import NewProjectDialog from "./components/NewProjectDialog";
import PdfPreview from "./components/PdfPreview";
import Ribbon from "./components/Ribbon";
import Sidebar, { type SidebarPanel } from "./components/Sidebar";
import SourceEditor from "./components/SourceEditor";
import StartScreen, { type RecentProject } from "./components/StartScreen";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import {
  createWelcomeDocument,
  DEFAULT_SETTINGS,
  DEMO_DOCUMENT,
  EMPTY_GIT_STATE,
} from "./lib/defaults";
import {
  countWords,
  documentPlainText,
  documentToLatex,
  hasCitations,
  latexToDocument,
} from "./lib/latex";
import {
  assetUrl,
  authorizeAsset,
  checkoutBranch,
  chooseArxivDestination,
  choosePdfDestination,
  chooseProject,
  commitChanges,
  compileProject,
  createBranch,
  createProject,
  exportArxivPackage,
  exportPdf,
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

type DialogState =
  | { kind: "citation" }
  | { kind: "footnote" }
  | { kind: "cross-reference" }
  | { kind: "link" }
  | { kind: "comment" }
  | null;

interface MathEditorState {
  display: boolean;
  latex: string;
  editing: boolean;
}

function loadRecent(): RecentProject[] {
  try {
    const value = JSON.parse(localStorage.getItem("sentence.recent") ?? "[]") as RecentProject[];
    return Array.isArray(value) ? value.slice(0, 8) : [];
  } catch {
    return [];
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

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const [source, setSource] = useState("");
  const sourceRef = useRef("");
  const [sourceFile, setSourceFile] = useState<"document.tex" | "references.bib">("document.tex");
  const [sourceDirty, setSourceDirty] = useState(false);
  const sourceDirtyRef = useRef(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [mode, setMode] = useState<EditorMode>("visual");
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
  const [mathEditor, setMathEditor] = useState<MathEditorState | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [recent, setRecent] = useState<RecentProject[]>(loadRecent);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const changeVersion = useRef(0);
  const revisionBaseline = useRef<SentenceDocument | null>(null);
  const revisionTimer = useRef<number | null>(null);

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

  const markDirty = () => {
    changeVersion.current += 1;
    setDirty(true);
    setSaveState("dirty");
  };

  const rememberProject = (project: Workspace) => {
    if (!project.path) return;
    setRecent((current) => {
      const next = [
        { path: project.path, name: project.name, openedAt: new Date().toISOString() },
        ...current.filter((item) => item.path !== project.path),
      ].slice(0, 8);
      localStorage.setItem("sentence.recent", JSON.stringify(next));
      return next;
    });
  };

  const adoptWorkspace = (project: Workspace) => {
    const latex = documentSource(project.document, project.settings);
    setWorkspace(project);
    workspaceRef.current = project;
    setSource(latex);
    sourceRef.current = latex;
    setSourceFile("document.tex");
    setSourceDirty(false);
    sourceDirtyRef.current = false;
    setDirty(false);
    setSaveState("saved");
    setCompileResult(null);
    rememberProject(project);
  };

  const persist = async (): Promise<Workspace | null> => {
    let current = workspaceRef.current;
    if (!current) return null;
    if (sourceDirtyRef.current && !sourceRef.current.includes("<<<<<<<")) {
      const parsed = latexToDocument(sourceRef.current, current.settings);
      current = { ...current, document: parsed.document, settings: parsed.settings };
      workspaceRef.current = current;
      setWorkspace(current);
      setSourceDirty(false);
      sourceDirtyRef.current = false;
    }
    const versionAtStart = changeVersion.current;
    const latex = sourceDirtyRef.current
      ? sourceRef.current
      : documentSource(current.document, current.settings);
    if (!isDesktop || !current.path) {
      setDirty(false);
      setSaveState("saved");
      return current;
    }
    setSaveState("saving");
    setSaveError(null);
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
      if (versionAtStart === changeVersion.current) {
        setWorkspace(merged);
        setDirty(false);
        setSaveState("saved");
      } else {
        setWorkspace((existing) => existing ? { ...existing, git: updated.git } : updated);
      }
      workspaceRef.current = merged;
      rememberProject(merged);
      return merged;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      setSaveState("error");
      setToast(message);
      return null;
    }
  };

  useEffect(() => {
    if (!dirty || !workspace) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [dirty, workspace?.document, workspace?.settings, workspace?.comments, workspace?.revisions, source]);

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
      adoptWorkspace(demoWorkspace());
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
      adoptWorkspace(demoWorkspace());
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

  const handleDocumentUpdate = (document: SentenceDocument) => {
    const before = workspaceRef.current?.document;
    const currentSettings = workspaceRef.current?.settings;
    setWorkspace((current) => current ? { ...current, document } : current);
    if (!sourceDirtyRef.current && currentSettings) {
      const latex = documentToLatex(document, currentSettings);
      setSource(latex);
      sourceRef.current = latex;
    }
    markDirty();
    if (tracking && before) {
      revisionBaseline.current ??= before;
      if (revisionTimer.current) window.clearTimeout(revisionTimer.current);
      revisionTimer.current = window.setTimeout(() => {
        const latest = workspaceRef.current;
        const baseline = revisionBaseline.current;
        if (!latest || !baseline) return;
        const beforeText = documentPlainText(baseline);
        const afterText = documentPlainText(latest.document);
        if (beforeText === afterText) return;
        const revision: Revision = {
          id: crypto.randomUUID(),
          author: gitAuthor.name || latest.settings.author || "You",
          createdAt: new Date().toISOString(),
          summary: "Tracked edit",
          before: beforeText,
          after: afterText,
          beforeDocument: baseline,
          afterDocument: latest.document,
          accepted: false,
        };
        setWorkspace((current) => current ? { ...current, revisions: [revision, ...current.revisions] } : current);
        revisionBaseline.current = latest.document;
        markDirty();
      }, 1800);
    }
  };

  const handleSourceChange = (value: string) => {
    setSource(value);
    sourceRef.current = value;
    setSourceDirty(true);
    sourceDirtyRef.current = true;
    markDirty();
  };

  const handleBibliographyChange = (value: string) => {
    setWorkspace((current) => current ? { ...current, bibliography: value } : current);
    markDirty();
  };

  const applySource = () => {
    const current = workspaceRef.current;
    if (!current) return;
    const parsed = latexToDocument(sourceRef.current, current.settings);
    setWorkspace({ ...current, document: parsed.document, settings: parsed.settings });
    setSourceDirty(false);
    sourceDirtyRef.current = false;
    markDirty();
    setToast("Visual document synchronized from LaTeX.");
  };

  const handleModeChange = (nextMode: EditorMode) => {
    const current = workspaceRef.current;
    if (current && nextMode !== "source" && mode === "source" && sourceDirtyRef.current) {
      applySource();
    }
    if (nextMode === "source" && current) {
      const latex = documentToLatex(current.document, current.settings);
      setSource(latex);
      sourceRef.current = latex;
      setSourceDirty(false);
      sourceDirtyRef.current = false;
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

  const handleDialogSubmit = (value: string) => {
    if (!dialog) return;
    switch (dialog.kind) {
      case "citation":
        editor?.chain().focus().insertContent({ type: "citation", attrs: { key: value } }).run();
        break;
      case "footnote":
        editor?.chain().focus().insertContent({ type: "footnote", attrs: { text: value } }).run();
        break;
      case "cross-reference":
        editor?.chain().focus().insertContent({ type: "crossReference", attrs: { label: value } }).run();
        break;
      case "link":
        editor?.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
        break;
      case "comment": {
        if (!workspace || !editor || editor.state.selection.empty) {
          setToast("Select text before adding a comment.");
          break;
        }
        const markId = crypto.randomUUID();
        editor.chain().focus().setMark("comment", { markId }).run();
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
        return { title: "Insert footnote", label: "Note", placeholder: "A useful note" };
      case "cross-reference":
        return { title: "Insert cross-reference", label: "Label", placeholder: "fig:architecture" };
      case "link":
        return { title: "Add link", label: "Address", placeholder: "https://example.com" };
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
    if (isDesktop && current.path) {
      try {
        const relative = await importImage(current.path, file.name, base64);
        const absolute = joinProjectPath(current.path, relative);
        await authorizeAsset(absolute);
        editor?.chain().focus().insertContent({
          type: "image",
          attrs: { src: assetUrl(current.path, relative), alt: file.name, path: relative },
        }).run();
        markDirty();
        return;
      } catch (error) {
        setToast(error instanceof Error ? error.message : String(error));
      }
    }
    editor?.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
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
      setToast("Saved to disk.");
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleCompile();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const words = workspace ? countWords(workspace.document) : 0;
  const pages = Math.max(1, Math.ceil(words / 480));
  const branch = workspace?.git.status.branch ?? "main";

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
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    );
  }

  return (
    <div className="app-shell" style={{ "--editor-zoom": zoom / 100 } as React.CSSProperties}>
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
        onInsertCitation={() => setDialog({ kind: "citation" })}
        onInsertFootnote={() => setDialog({ kind: "footnote" })}
        onInsertCrossReference={() => setDialog({ kind: "cross-reference" })}
        onInsertLink={() => setDialog({ kind: "link" })}
        onInsertToc={() => editor?.chain().focus().insertContent({ type: "toc" }).run()}
        onInsertPageBreak={() => editor?.chain().focus().insertContent({ type: "pageBreak" }).run()}
        onToggleTracking={() => {
          const next = !tracking;
          setTracking(next);
          revisionBaseline.current = next ? workspaceRef.current?.document ?? null : null;
          setToast(next ? "Tracked changes is on." : "Tracked changes is off.");
        }}
        onAddComment={() => setDialog({ kind: "comment" })}
        onOpenGit={() => { setGitOpen(true); setInspectorOpen(false); }}
        onToggleInspector={() => { setInspectorOpen(!inspectorOpen); setGitOpen(false); }}
        onCompile={() => void handleCompile()}
        onExportArxiv={() => { setArxivError(null); setArxivOpen(true); }}
      />
      <div className="workspace-row">
        <Sidebar
          open={sidebarOpen}
          panel={sidebarPanel}
          document={workspace.document}
          comments={workspace.comments}
          revisions={workspace.revisions}
          history={workspace.git.history}
          activeCommentId={activeCommentId}
          onPanelChange={setSidebarPanel}
          onHeadingClick={(position) => {
            const heading = document.querySelectorAll<HTMLElement>(".sentence-editor h1, .sentence-editor h2, .sentence-editor h3")[position];
            heading?.scrollIntoView({ behavior: "smooth", block: "center" });
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
            setWorkspace((current) => current ? {
              ...current,
              comments: current.comments.filter((thread) => thread.id !== id),
            } : current);
            markDirty();
          }}
          onAcceptRevision={(id) => {
            setWorkspace((current) => current ? {
              ...current,
              revisions: current.revisions.map((revision) => revision.id === id ? { ...revision, accepted: true } : revision),
            } : current);
            markDirty();
          }}
          onRejectRevision={(id) => {
            const revision = workspaceRef.current?.revisions.find((item) => item.id === id);
            setWorkspace((current) => {
              if (!current) return current;
              return {
                ...current,
                document: revision?.beforeDocument ?? current.document,
                revisions: current.revisions.map((item) => item.id === id ? { ...item, rejected: true, accepted: true } : item),
              };
            });
            markDirty();
          }}
        />
        <main className="document-stage">
          <div className={`editor-workspace layout-${mode} ${previewOpen ? "with-preview" : ""}`}>
            {mode === "visual" || mode === "split" ? (
              <section className="editor-column">
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
                  />
                </Suspense>
              </section>
            ) : null}
            {mode === "source" || mode === "split" ? (
              <section className="source-column">
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
                        }}>
                          Refresh from visual
                        </button>
                        <button className="accent-button small" type="button" onClick={applySource} disabled={!sourceDirty}>
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
        mode={mode === "visual" ? "Visual" : mode === "source" ? "LaTeX" : "Split"}
        branch={branch}
        zoom={zoom}
        compileState={compiling ? "compiling" : compileResult?.success ? "success" : compileResult ? "error" : "idle"}
        onZoomChange={setZoom}
      />
      {saveError ? <button className="save-error" type="button" onClick={() => void handleSave()}><Save size={14} /> Retry save</button> : null}
      {toast ? <div className="toast">{toast}</div> : null}
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
      <InputDialog
        open={Boolean(dialog)}
        title={dialogProps.title}
        description={"description" in dialogProps ? dialogProps.description : undefined}
        label={dialogProps.label}
        placeholder={"placeholder" in dialogProps ? dialogProps.placeholder : undefined}
        multiline={"multiline" in dialogProps ? dialogProps.multiline : false}
        confirmLabel={"confirmLabel" in dialogProps ? dialogProps.confirmLabel : "Insert"}
        onClose={() => setDialog(null)}
        onSubmit={handleDialogSubmit}
      />
      <MathDialog
        open={Boolean(mathEditor)}
        display={mathEditor?.display ?? false}
        initialLatex={mathEditor?.latex ?? ""}
        onClose={() => setMathEditor(null)}
        onSubmit={handleMathSubmit}
      />
    </div>
  );
}
