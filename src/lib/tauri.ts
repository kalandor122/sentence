import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  ArxivPackageResult,
  CommentThread,
  CompileResult,
  GitAuthor,
  GitState,
  GitHubAccount,
  GitHubDeviceStart,
  GitHubPollResult,
  ProjectSettings,
  ProjectSnapshot,
  Revision,
  SentenceDocument,
} from "./types";

export const isDesktop =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function desktopOnly(): never {
  throw new Error("This action is available in the Sentence desktop application.");
}

export async function chooseDirectory(): Promise<string | null> {
  if (!isDesktop) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose a project location",
  });
  return typeof selected === "string" ? selected : null;
}

export async function chooseProject(): Promise<string | null> {
  if (!isDesktop) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open a Sentence project",
  });
  return typeof selected === "string" ? selected : null;
}

export async function createProject(
  parentPath: string,
  name: string,
  document: SentenceDocument,
  settings: ProjectSettings,
  latex: string,
): Promise<ProjectSnapshot> {
  if (!isDesktop) return desktopOnly();
  return invoke<ProjectSnapshot>("create_project", {
    path: parentPath,
    name,
    document,
    settings,
    latex,
  });
}

export async function openProject(path: string): Promise<ProjectSnapshot> {
  if (!isDesktop) return desktopOnly();
  return invoke<ProjectSnapshot>("open_project", { path });
}

export async function saveProject(
  path: string,
  name: string,
  document: SentenceDocument,
  settings: ProjectSettings,
  latex: string,
  bibliography: string,
  comments: CommentThread[],
  revisions: Revision[],
): Promise<ProjectSnapshot> {
  if (!isDesktop) return desktopOnly();
  return invoke<ProjectSnapshot>("save_project", {
    request: {
      path,
      name,
      document,
      settings,
      latex,
      bibliography,
      comments,
      revisions,
    },
  });
}

export async function compileProject(path: string): Promise<CompileResult> {
  if (!isDesktop) return desktopOnly();
  return invoke<CompileResult>("compile_project", { path });
}

export async function importImage(
  projectPath: string,
  fileName: string,
  dataBase64: string,
): Promise<string> {
  if (!isDesktop) return desktopOnly();
  return invoke<string>("import_image", {
    projectPath,
    fileName,
    dataBase64,
  });
}

export async function authorizeAsset(path: string): Promise<void> {
  if (!isDesktop) return;
  await invoke("authorize_asset", { path });
}

export function assetUrl(projectPath: string, relativePath: string): string {
  if (!isDesktop) return relativePath;
  const normalized = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
  return convertFileSrc(`${normalized}/${relativePath}`);
}

export async function getGitState(path: string): Promise<GitState> {
  return invoke<GitState>("git_state", { path });
}

export async function getGitDiff(path: string): Promise<string> {
  return invoke<string>("git_diff", { path });
}

export async function commitChanges(
  path: string,
  message: string,
  author: GitAuthor,
): Promise<GitState> {
  return invoke<GitState>("git_commit", { path, message, author });
}

export async function createBranch(path: string, name: string): Promise<GitState> {
  return invoke<GitState>("git_create_branch", { path, name });
}

export async function checkoutBranch(path: string, name: string): Promise<GitState> {
  return invoke<GitState>("git_checkout_branch", { path, name });
}

export async function mergeBranch(
  path: string,
  branch: string,
  author: GitAuthor,
): Promise<GitState> {
  return invoke<GitState>("git_merge", { path, branch, author });
}

export async function fetchRemote(path: string, token: string | null): Promise<GitState> {
  return invoke<GitState>("git_fetch", { path, token });
}

export async function pullRemote(path: string, token: string | null): Promise<GitState> {
  return invoke<GitState>("git_pull", { path, token });
}

export async function pushRemote(
  path: string,
  token: string | null,
  branch?: string,
): Promise<GitState> {
  return invoke<GitState>("git_push", { path, token, branch });
}

export async function setRemote(path: string, url: string): Promise<GitState> {
  return invoke<GitState>("git_set_remote", { path, url });
}

export async function startGitHubDeviceFlow(
  clientId: string | null,
): Promise<GitHubDeviceStart> {
  return invoke<GitHubDeviceStart>("github_start_device_flow", { clientId });
}

export async function pollGitHubDeviceFlow(
  clientId: string | null,
  deviceCode: string,
): Promise<GitHubPollResult> {
  return invoke<GitHubPollResult>("github_poll_device_flow", {
    clientId,
    deviceCode,
  });
}

export async function getGitHubSession(): Promise<GitHubPollResult | null> {
  if (!isDesktop) return null;
  return invoke<GitHubPollResult | null>("github_session");
}

export async function disconnectGitHub(): Promise<void> {
  return invoke("github_disconnect");
}

export async function publishGitHubRepository(
  path: string,
  token: string,
  name: string,
  isPrivate: boolean,
): Promise<{ url: string; htmlUrl: string | null; name: string }> {
  return invoke("github_publish_repository", {
    path,
    token,
    name,
    private: isPrivate,
  });
}

export async function cloneGitHubProject(
  parentPath: string,
  url: string,
  token: string | null,
): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("github_clone_repository", {
    parentPath,
    url,
    token,
  });
}

export async function choosePdfDestination(suggestedName: string): Promise<string | null> {
  if (!isDesktop) return null;
  const path = await save({
    title: "Export PDF",
    defaultPath: suggestedName.endsWith(".pdf") ? suggestedName : `${suggestedName}.pdf`,
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  });
  return path;
}

export async function exportPdf(projectPath: string, destination: string): Promise<string> {
  return invoke<string>("export_pdf", { path: projectPath, destination });
}

export async function chooseArxivDestination(suggestedName: string): Promise<string | null> {
  if (!isDesktop) return null;
  const base = suggestedName.replace(/\.zip$/i, "");
  return save({
    title: "Export arXiv source package",
    defaultPath: `${base}-arxiv.zip`,
    filters: [{ name: "arXiv source package", extensions: ["zip"] }],
  });
}

export async function exportArxivPackage(
  projectPath: string,
  destination: string,
): Promise<ArxivPackageResult> {
  return invoke<ArxivPackageResult>("export_arxiv_package", {
    path: projectPath,
    destination,
  });
}
