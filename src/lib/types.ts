export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export interface DocumentMark {
  type: string;
  attrs?: Record<string, JSONValue>;
}

export interface DocumentNode {
  type: string;
  attrs?: Record<string, JSONValue>;
  content?: DocumentNode[];
  marks?: DocumentMark[];
  text?: string;
}

export interface SentenceDocument {
  type: "doc";
  content: DocumentNode[];
}

export interface ProjectSettings {
  title: string;
  author: string;
  affiliation: string;
  email: string;
  subtitle: string;
  date: string;
  abstract: string;
  keywords: string;
  primaryCategory: string;
  crossListCategories: string;
  arxivComment: string;
  documentClass: "article" | "report" | "book";
  paperSize: "a4paper" | "letterpaper";
  fontSize: "10pt" | "11pt" | "12pt";
  margins: "normal" | "narrow" | "wide";
  fontFamily: "default" | "times" | "palatino";
  lineSpacing: "single" | "onehalf" | "double";
  paragraphSpacing: "indent" | "gap";
  includeToc: boolean;
  header: string;
  footer: string;
  lineNumbers: boolean;
}

export interface CommentThread {
  id: string;
  markId: string;
  author: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Revision {
  id: string;
  author: string;
  createdAt: string;
  summary: string;
  before: string;
  after: string;
  beforeDocument?: SentenceDocument;
  afterDocument?: SentenceDocument;
  accepted: boolean;
  rejected?: boolean;
}

export interface ReviewData {
  comments: CommentThread[];
  revisions: Revision[];
}

export interface GitAuthor {
  name: string;
  email: string;
}

export interface GitCommit {
  id: string;
  shortId: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  parents: string[];
}

export interface GitChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "conflicted" | "untracked";
}

export interface GitStatus {
  branch: string;
  detached: boolean;
  ahead: number;
  behind: number;
  changes: GitChange[];
  remoteUrl: string | null;
}

export interface GitState {
  isRepository: boolean;
  status: GitStatus;
  history: GitCommit[];
  branches: string[];
}

export interface ProjectSnapshot {
  path: string;
  name: string;
  document: SentenceDocument;
  latex: string;
  bibliography: string;
  settings: ProjectSettings;
  comments: CommentThread[];
  revisions: Revision[];
  git: GitState;
}

export interface CompileResult {
  success: boolean;
  pdfBase64: string | null;
  log: string;
  diagnostics: CompileDiagnostic[];
  durationMs: number;
}

export interface CompileDiagnostic {
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
}

export interface ArxivPackageResult {
  path: string;
  files: string[];
  warnings: string[];
  totalBytes: number;
}

export interface GitHubAccount {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GitHubDeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface GitHubPollResult {
  status: "pending" | "connected" | "error";
  account: GitHubAccount | null;
  token: string | null;
  message: string | null;
}

export type EditorMode = "visual" | "source" | "split";
export type RibbonTab = "Home" | "Insert" | "Layout" | "References" | "Review" | "Paper" | "View" | "Git";
