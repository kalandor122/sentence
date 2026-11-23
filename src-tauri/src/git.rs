use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{TimeZone, Utc};
use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    BranchType, Cred, FetchOptions, IndexAddOption, MergeOptions, RemoteCallbacks, Repository,
    RepositoryInitOptions, Status, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitAuthor {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    id: String,
    short_id: String,
    message: String,
    author: String,
    email: String,
    timestamp: i64,
    parents: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    path: String,
    status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    detached: bool,
    ahead: usize,
    behind: usize,
    changes: Vec<GitChange>,
    remote_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitState {
    pub is_repository: bool,
    pub status: GitStatus,
    history: Vec<GitCommit>,
    pub branches: Vec<String>,
}

fn empty_state() -> GitState {
    GitState {
        is_repository: false,
        status: GitStatus {
            branch: "main".to_string(),
            detached: false,
            ahead: 0,
            behind: 0,
            changes: Vec::new(),
            remote_url: None,
        },
        history: Vec::new(),
        branches: Vec::new(),
    }
}

fn run_git(path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("Git is unavailable: {error}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn run_git_with_token(path: &Path, args: &[&str], token: Option<&str>) -> Result<String, String> {
    let mut command = Command::new("git");
    command.arg("-C").arg(path).env("GIT_TERMINAL_PROMPT", "0");
    if let Some(token) = token {
        let authorization = STANDARD.encode(format!("x-access-token:{token}"));
        command.arg("-c").arg(format!(
            "http.extraheader=AUTHORIZATION: basic {authorization}"
        ));
    }
    let output = command
        .args(args)
        .output()
        .map_err(|error| format!("Git is unavailable: {error}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

pub fn ensure_repository(path: &Path) -> Result<(), String> {
    // open(), not discover(): discover() walks up and happily finds the repo that
    // happens to contain the project folder, so the project never gets its own
    // repository — and every later commit/branch lands in the *parent* repo.
    if let Ok(repository) = Repository::open(path) {
        drop(repository);
        return Ok(());
    }
    let mut options = RepositoryInitOptions::new();
    options.initial_head("main");
    match Repository::init_opts(path, &options) {
        Ok(_) => Ok(()),
        Err(error) => {
            let status = std::process::Command::new("git")
                .args(["init", "--initial-branch=main"])
                .arg(path)
                .status()
                .map_err(|_| format!("Could not initialize Git: {error}"))?;
            if !status.success() {
                return Err(format!("Could not initialize Git: {error}"));
            }
            Ok(())
        }
    }
}

pub fn set_remote_url(path: &Path, url: &str) -> Result<(), String> {
    if let Ok(repository) = Repository::discover(path) {
        if repository.find_remote("origin").is_ok() {
            repository
                .remote_set_url("origin", url)
                .map_err(|error| error.to_string())?;
        } else {
            repository
                .remote("origin", url)
                .map_err(|error| error.to_string())?;
        }
        let _ = repository.remote_add_fetch("origin", "+refs/heads/*:refs/remotes/origin/*");
        return Ok(());
    }
    if run_git(path, &["remote", "get-url", "origin"]).is_ok() {
        run_git(path, &["remote", "set-url", "origin", url])?;
    } else {
        run_git(path, &["remote", "add", "origin", url])?;
    }
    Ok(())
}

fn map_status(status: Status) -> Option<&'static str> {
    if status.is_conflicted() {
        Some("conflicted")
    } else if status.is_index_new() || status.is_wt_new() {
        Some("untracked")
    } else if status.is_index_deleted() || status.is_wt_deleted() {
        Some("deleted")
    } else if status.is_index_renamed() || status.is_wt_renamed() {
        Some("renamed")
    } else if status.is_index_modified() || status.is_wt_modified() || status.is_wt_typechange() {
        Some("modified")
    } else {
        None
    }
}

fn branch_name(repository: &Repository) -> (String, bool) {
    let head = match repository.head() {
        Ok(head) => head,
        Err(_) => return ("main".to_string(), false),
    };
    if head.is_branch() {
        let name = head.shorthand().unwrap_or("main").to_string();
        return (name, false);
    }
    (
        head.target()
            .map(|oid| oid.to_string())
            .unwrap_or_else(|| "detached".to_string()),
        true,
    )
}

fn commits(repository: &Repository) -> Vec<GitCommit> {
    let walk = match repository.revwalk() {
        Ok(mut walk) => {
            if walk.push_head().is_err() {
                return Vec::new();
            }
            walk
        }
        Err(_) => return Vec::new(),
    };
    walk.take(100)
        .filter_map(Result::ok)
        .filter_map(|oid| repository.find_commit(oid).ok())
        .map(|commit| GitCommit {
            id: commit.id().to_string(),
            short_id: commit.id().to_string().chars().take(7).collect(),
            message: commit.message().unwrap_or("").trim().to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parents: commit.parent_ids().map(|id| id.to_string()).collect(),
        })
        .collect()
}

fn branches(repository: &Repository) -> Vec<String> {
    repository
        .branches(Some(BranchType::Local))
        .ok()
        .map(|branches| {
            branches
                .filter_map(Result::ok)
                .filter_map(|(branch, _)| branch.name().ok().flatten().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn read_git_state_cli(path: &Path) -> Result<GitState, String> {
    let status_text = run_git(path, &["status", "--porcelain", "--branch"])
        .map_err(|error| format!("Could not read Git status: {error}"))?;
    let mut branch = "main".to_string();
    let mut detached = false;
    let mut ahead = 0;
    let mut behind = 0;
    let mut changes = Vec::new();
    for line in status_text.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            if let Some(unborn) = rest.strip_prefix("No commits yet on ") {
                branch = unborn.trim().to_string();
                continue;
            }
            if rest.starts_with("HEAD (no branch)") {
                detached = true;
                branch = "detached".to_string();
                continue;
            }
            branch = rest
                .split("...")
                .next()
                .unwrap_or("main")
                .split(' ')
                .next()
                .unwrap_or("main")
                .to_string();
            if let Some(tracking) = rest.find("[ahead ") {
                let values = rest[tracking..].split_whitespace().collect::<Vec<_>>();
                for (index, value) in values.iter().enumerate() {
                    if *value == "ahead" {
                        ahead = values
                            .get(index + 1)
                            .and_then(|value| value.trim_end_matches(',').parse().ok())
                            .unwrap_or(0);
                    }
                    if *value == "behind" {
                        behind = values
                            .get(index + 1)
                            .and_then(|value| value.trim_end_matches(']').parse().ok())
                            .unwrap_or(0);
                    }
                }
            }
            continue;
        }
        if line.len() < 4 {
            continue;
        }
        let code = &line[..2];
        let raw_path = line[3..].trim();
        let file = raw_path.split(" -> ").last().unwrap_or(raw_path);
        let kind = if code == "??" {
            "untracked"
        } else if code.contains('U') || code == "AA" || code == "DD" {
            "conflicted"
        } else if code.contains('D') {
            "deleted"
        } else if code.contains('R') {
            "renamed"
        } else if code.contains('A') {
            "added"
        } else {
            "modified"
        };
        changes.push(GitChange {
            path: file.to_string(),
            status: kind.to_string(),
        });
    }
    let history = run_git(
        path,
        &[
            "log",
            "--max-count=100",
            "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%P%x1f%s%x1e",
        ],
    )
    .ok()
    .map(|text| {
        text.split('\x1e')
            .filter(|record| !record.trim().is_empty())
            .filter_map(|record| {
                let fields = record.trim_matches('\n').split('\x1f').collect::<Vec<_>>();
                if fields.len() < 7 {
                    return None;
                }
                Some(GitCommit {
                    id: fields[0].to_string(),
                    short_id: fields[1].to_string(),
                    author: fields[2].to_string(),
                    email: fields[3].to_string(),
                    timestamp: fields[4].parse().ok()?,
                    parents: fields[5].split_whitespace().map(str::to_string).collect(),
                    message: fields[6].trim().to_string(),
                })
            })
            .collect::<Vec<_>>()
    })
    .unwrap_or_default();
    let branches = run_git(path, &["branch", "--format=%(refname:short)"])
        .ok()
        .map(|text| text.lines().map(str::to_string).collect::<Vec<_>>())
        .unwrap_or_default();
    let remote_url = run_git(path, &["remote", "get-url", "origin"])
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    Ok(GitState {
        is_repository: true,
        status: GitStatus {
            branch,
            detached,
            ahead,
            behind,
            changes,
            remote_url,
        },
        history,
        branches,
    })
}

pub fn read_git_state(path: &Path) -> Result<GitState, String> {
    let repository = match Repository::discover(path) {
        Ok(repository) => repository,
        Err(_) => {
            if path.join(".git").exists() {
                return read_git_state_cli(path);
            }
            return Ok(empty_state());
        }
    };
    let (branch, detached) = branch_name(&repository);
    let mut status_options = StatusOptions::new();
    status_options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let changes = repository
        .statuses(Some(&mut status_options))
        .map_err(|error| error.to_string())?
        .iter()
        .filter_map(|entry| {
            let path = entry
                .path()
                .or_else(|| {
                    entry
                        .head_to_index()
                        .and_then(|diff| diff.new_file().path().and_then(Path::to_str))
                })
                .unwrap_or("");
            map_status(entry.status()).map(|status| GitChange {
                path: path.to_string(),
                status: status.to_string(),
            })
        })
        .collect::<Vec<_>>();

    let (ahead, behind) = if detached {
        (0, 0)
    } else {
        let local = repository
            .find_reference(&format!("refs/heads/{branch}"))
            .ok()
            .and_then(|reference| reference.target());
        let remote = repository
            .find_reference(&format!("refs/remotes/origin/{branch}"))
            .ok()
            .and_then(|reference| reference.target());
        match (local, remote) {
            (Some(local), Some(remote)) => repository
                .graph_ahead_behind(local, remote)
                .unwrap_or((0, 0)),
            _ => (0, 0),
        }
    };
    let remote_url = repository
        .find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(str::to_string));

    Ok(GitState {
        is_repository: true,
        status: GitStatus {
            branch,
            detached,
            ahead,
            behind,
            changes,
            remote_url,
        },
        history: commits(&repository),
        branches: branches(&repository),
    })
}

fn signature(author: &GitAuthor) -> Result<git2::Signature<'static>, String> {
    if author.name.trim().is_empty() || author.email.trim().is_empty() {
        return Err("Set your Git name and email before committing.".to_string());
    }
    git2::Signature::now(author.name.trim(), author.email.trim())
        .map_err(|error| format!("Invalid Git author: {error}"))
}

fn credentials(token: Option<&str>) -> RemoteCallbacks<'_> {
    let token = token.map(str::to_string);
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username, allowed| {
        if allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(token) = token.as_deref() {
                return Cred::userpass_plaintext("x-access-token", token);
            }
            return Cred::userpass_plaintext("git", "");
        }
        Cred::default()
    });
    callbacks
}

pub fn clone_repository(url: &str, destination: &Path, token: Option<&str>) -> Result<(), String> {
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(credentials(token));
    let mut builder = RepoBuilder::new();
    builder.fetch_options(fetch_options);
    if builder.clone(url, destination).is_ok() {
        return Ok(());
    }
    let mut command = Command::new("git");
    command
        .args(["clone", url])
        .arg(destination)
        .env("GIT_TERMINAL_PROMPT", "0");
    if let Some(token) = token {
        let authorization = STANDARD.encode(format!("x-access-token:{token}"));
        command.arg("-c").arg(format!(
            "http.extraheader=AUTHORIZATION: basic {authorization}"
        ));
    }
    let output = command
        .output()
        .map_err(|error| format!("Clone failed: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Clone failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

fn fetch_remote(repository: &Repository, token: Option<&str>) -> Result<(), String> {
    let mut remote = repository
        .find_remote("origin")
        .map_err(|_| "No GitHub remote is configured.".to_string())?;
    let mut options = FetchOptions::new();
    options.remote_callbacks(credentials(token));
    remote
        .fetch(&[] as &[&str], Some(&mut options), None)
        .map_err(|error| format!("Fetch failed: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn git_state(path: String) -> Result<GitState, String> {
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_diff(path: String) -> Result<String, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            let staged =
                run_git(Path::new(&path), &["diff", "--cached", "--no-color"]).unwrap_or_default();
            let unstaged = run_git(Path::new(&path), &["diff", "--no-color"]).unwrap_or_default();
            return Ok(format!("{staged}{unstaged}"));
        }
    };
    let mut options = git2::DiffOptions::new();
    options.include_untracked(true).recurse_untracked_dirs(true);
    let diff = repository
        .diff_index_to_workdir(None, Some(&mut options))
        .map_err(|error| error.to_string())?;
    let mut output = Vec::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        output.extend_from_slice(line.content());
        true
    })
    .map_err(|error| error.to_string())?;
    Ok(String::from_utf8_lossy(&output).to_string())
}

#[tauri::command]
pub fn git_commit(path: String, message: String, author: GitAuthor) -> Result<GitState, String> {
    let mut repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            run_git(Path::new(&path), &["add", "-A"])?;
            let author_arg = format!("{} <{}>", author.name.trim(), author.email.trim());
            run_git(
                Path::new(&path),
                &[
                    "-c",
                    &format!("user.name={}", author.name.trim()),
                    "-c",
                    &format!("user.email={}", author.email.trim()),
                    "commit",
                    "--author",
                    &author_arg,
                    "-m",
                    if message.trim().is_empty() {
                        "Update document"
                    } else {
                        message.trim()
                    },
                ],
            )?;
            return read_git_state_cli(Path::new(&path));
        }
    };
    let mut index = repository.index().map_err(|error| error.to_string())?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|error| error.to_string())?;
    index
        .update_all(["*"].iter(), None)
        .map_err(|error| error.to_string())?;
    index.write().map_err(|error| error.to_string())?;
    let sig = signature(&author)?;
    let mut merge_heads = Vec::new();
    if repository.state() == git2::RepositoryState::Merge {
        repository
            .mergehead_foreach(|oid| {
                merge_heads.push(*oid);
                true
            })
            .map_err(|error| error.to_string())?;
    }
    let mut parent_commits = repository
        .head()
        .ok()
        .and_then(|head| head.peel_to_commit().ok())
        .into_iter()
        .collect::<Vec<_>>();
    for oid in merge_heads {
        if let Ok(commit) = repository.find_commit(oid) {
            parent_commits.push(commit);
        }
    }
    let parents = parent_commits.iter().collect::<Vec<_>>();
    let tree_id = index.write_tree().map_err(|error| error.to_string())?;
    let tree = repository
        .find_tree(tree_id)
        .map_err(|error| error.to_string())?;
    repository
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            if message.trim().is_empty() {
                "Update document"
            } else {
                message.trim()
            },
            &tree,
            &parents,
        )
        .map_err(|error| format!("Commit failed: {error}"))?;
    let _ = repository.cleanup_state();
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            run_git(Path::new(&path), &["branch", &name])?;
            return read_git_state_cli(Path::new(&path));
        }
    };
    let head = repository
        .head()
        .and_then(|head| head.peel_to_commit())
        .map_err(|_| "Create the first commit before branching.".to_string())?;
    repository
        .branch(&name, &head, false)
        .map_err(|error| format!("Could not create branch: {error}"))?;
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_checkout_branch(path: String, name: String) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            run_git(Path::new(&path), &["switch", &name])?;
            return read_git_state_cli(Path::new(&path));
        }
    };
    let reference = format!("refs/heads/{name}");
    repository
        .set_head(&reference)
        .map_err(|error| error.to_string())?;
    let mut checkout = CheckoutBuilder::new();
    checkout.safe();
    repository
        .checkout_head(Some(&mut checkout))
        .map_err(|error| error.to_string())?;
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_merge(path: String, branch: String, author: GitAuthor) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            let result = run_git(
                Path::new(&path),
                &[
                    "-c",
                    &format!("user.name={}", author.name.trim()),
                    "-c",
                    &format!("user.email={}", author.email.trim()),
                    "merge",
                    "--no-edit",
                    &branch,
                ],
            );
            if let Err(error) = result {
                let state = read_git_state_cli(Path::new(&path))?;
                if !state
                    .status
                    .changes
                    .iter()
                    .any(|change| change.status == "conflicted")
                {
                    return Err(error);
                }
                return Ok(state);
            }
            return read_git_state_cli(Path::new(&path));
        }
    };
    let reference = repository
        .find_branch(&branch, BranchType::Local)
        .map_err(|error| error.to_string())?;
    let annotated = repository
        .reference_to_annotated_commit(reference.get())
        .map_err(|error| error.to_string())?;
    let analysis = repository
        .merge_analysis(&[&annotated])
        .map_err(|error| error.to_string())?
        .0;
    if analysis.is_up_to_date() {
        return read_git_state(Path::new(&path));
    }
    if analysis.is_fast_forward() {
        let mut reference = repository
            .find_reference("HEAD")
            .map_err(|error| error.to_string())?;
        reference
            .set_target(annotated.id(), "Fast-forward merge")
            .map_err(|error| error.to_string())?;
        repository
            .checkout_head(Some(CheckoutBuilder::default().force()))
            .map_err(|error| error.to_string())?;
        return read_git_state(Path::new(&path));
    }

    repository
        .merge(&[&annotated], Some(&mut MergeOptions::new()), None)
        .map_err(|error| format!("Merge failed: {error}"))?;
    let mut index = repository.index().map_err(|error| error.to_string())?;
    if index.has_conflicts() {
        return read_git_state(Path::new(&path));
    }
    let tree_id = index.write_tree().map_err(|error| error.to_string())?;
    let tree = repository
        .find_tree(tree_id)
        .map_err(|error| error.to_string())?;
    let head = repository
        .head()
        .and_then(|head| head.peel_to_commit())
        .map_err(|error| error.to_string())?;
    let other = repository
        .find_commit(annotated.id())
        .map_err(|error| error.to_string())?;
    let sig = signature(&author)?;
    repository
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Merge branch '{branch}'"),
            &tree,
            &[&head, &other],
        )
        .map_err(|error| error.to_string())?;
    repository
        .cleanup_state()
        .map_err(|error| error.to_string())?;
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_fetch(path: String, token: Option<String>) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            run_git_with_token(Path::new(&path), &["fetch", "origin"], token.as_deref())?;
            return read_git_state_cli(Path::new(&path));
        }
    };
    fetch_remote(&repository, token.as_deref())?;
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_pull(path: String, token: Option<String>) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            let result = run_git_with_token(
                Path::new(&path),
                &["pull", "--no-rebase", "--no-edit"],
                token.as_deref(),
            );
            if let Err(error) = result {
                let state = read_git_state_cli(Path::new(&path))?;
                if !state
                    .status
                    .changes
                    .iter()
                    .any(|change| change.status == "conflicted")
                {
                    return Err(error);
                }
                return Ok(state);
            }
            return read_git_state_cli(Path::new(&path));
        }
    };
    let (branch, detached) = branch_name(&repository);
    if detached {
        return Err("Check out a branch before pulling.".to_string());
    }
    fetch_remote(&repository, token.as_deref())?;
    let fetch_head = repository
        .find_reference("FETCH_HEAD")
        .map_err(|error| error.to_string())?;
    let annotated = repository
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|error| error.to_string())?;
    let analysis = repository
        .merge_analysis(&[&annotated])
        .map_err(|error| error.to_string())?
        .0;
    if analysis.is_up_to_date() {
        return read_git_state(Path::new(&path));
    }
    if analysis.is_fast_forward() {
        let mut head = repository
            .find_reference("HEAD")
            .map_err(|error| error.to_string())?;
        head.set_target(annotated.id(), "Fast-forward pull")
            .map_err(|error| error.to_string())?;
        repository
            .checkout_head(Some(CheckoutBuilder::default().force()))
            .map_err(|error| error.to_string())?;
        return read_git_state(Path::new(&path));
    }
    repository
        .merge(&[&annotated], Some(&mut MergeOptions::new()), None)
        .map_err(|error| format!("Pull produced conflicts for branch {branch}: {error}"))?;
    let mut index = repository.index().map_err(|error| error.to_string())?;
    if index.has_conflicts() {
        return Err(
            "Pull produced merge conflicts. Resolve them in Source view, then commit.".to_string(),
        );
    }
    let tree_id = index.write_tree().map_err(|error| error.to_string())?;
    let tree = repository
        .find_tree(tree_id)
        .map_err(|error| error.to_string())?;
    let head = repository
        .head()
        .and_then(|head| head.peel_to_commit())
        .map_err(|error| error.to_string())?;
    let other = repository
        .find_commit(annotated.id())
        .map_err(|error| error.to_string())?;
    let sig = repository
        .signature()
        .or_else(|_| git2::Signature::now("Sentence", "sentence@localhost"))
        .map_err(|error| error.to_string())?;
    repository
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Merge remote branch '{branch}'"),
            &tree,
            &[&head, &other],
        )
        .map_err(|error| error.to_string())?;
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_push(
    path: String,
    token: Option<String>,
    branch: Option<String>,
) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            let refspec = branch
                .map(|branch| format!("HEAD:refs/heads/{branch}"))
                .unwrap_or_else(|| "HEAD".to_string());
            run_git_with_token(
                Path::new(&path),
                &["push", "origin", &refspec],
                token.as_deref(),
            )?;
            return read_git_state_cli(Path::new(&path));
        }
    };
    let (current, detached) = branch_name(&repository);
    if detached {
        return Err("Check out a branch before pushing.".to_string());
    }
    let branch = branch.unwrap_or(current);
    let mut remote = repository
        .find_remote("origin")
        .map_err(|_| "No GitHub remote is configured.".to_string())?;
    let mut options = git2::PushOptions::new();
    options.remote_callbacks(credentials(token.as_deref()));
    remote
        .push(
            &[format!("refs/heads/{branch}:refs/heads/{branch}")],
            Some(&mut options),
        )
        .map_err(|error| format!("Push failed: {error}"))?;
    read_git_state(Path::new(&path))
}

#[tauri::command]
pub fn git_set_remote(path: String, url: String) -> Result<GitState, String> {
    let repository = match Repository::discover(Path::new(&path)) {
        Ok(repository) => repository,
        Err(_) => {
            if run_git(Path::new(&path), &["remote", "get-url", "origin"]).is_ok() {
                run_git(Path::new(&path), &["remote", "set-url", "origin", &url])?;
            } else {
                run_git(Path::new(&path), &["remote", "add", "origin", &url])?;
            }
            return read_git_state_cli(Path::new(&path));
        }
    };
    if repository.find_remote("origin").is_ok() {
        repository
            .remote_set_url("origin", &url)
            .map_err(|error| error.to_string())?;
    } else {
        repository
            .remote("origin", &url)
            .map_err(|error| error.to_string())?;
    }
    let _ = repository.remote_add_fetch("origin", "+refs/heads/*:refs/remotes/origin/*");
    read_git_state(Path::new(&path))
}

#[allow(dead_code)]
fn _commit_date(timestamp: i64) -> String {
    Utc.timestamp_opt(timestamp, 0)
        .single()
        .map(|date| date.to_rfc3339())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn commit_branch_and_history_work() {
        let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".tools");
        let root = workspace.join(format!("sentence-git-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        ensure_repository(&root).unwrap();
        fs::write(root.join("document.tex"), "\\section{Test}\nText.\n").unwrap();
        let author = GitAuthor {
            name: "Test Author".to_string(),
            email: "test@example.com".to_string(),
        };
        git_commit(
            root.to_string_lossy().to_string(),
            "Initial commit".to_string(),
            author.clone(),
        )
        .unwrap();
        let state = read_git_state(&root).unwrap();
        assert_eq!(state.history.len(), 1);
        assert_eq!(state.history[0].message, "Initial commit");
        let branch_state =
            git_create_branch(root.to_string_lossy().to_string(), "draft/test".to_string())
                .unwrap();
        assert!(branch_state
            .branches
            .iter()
            .any(|branch| branch == "draft/test"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn merge_conflict_resolution_creates_merge_commit() {
        let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".tools");
        let root = workspace.join(format!("sentence-merge-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        ensure_repository(&root).unwrap();
        let author = GitAuthor {
            name: "Merge Tester".to_string(),
            email: "merge@example.com".to_string(),
        };
        let path = root.to_string_lossy().to_string();
        fs::write(root.join("document.tex"), "base\n").unwrap();
        git_commit(path.clone(), "base".to_string(), author.clone()).unwrap();
        git_create_branch(path.clone(), "feature".to_string()).unwrap();
        git_checkout_branch(path.clone(), "feature".to_string()).unwrap();
        fs::write(root.join("document.tex"), "feature\n").unwrap();
        git_commit(path.clone(), "feature".to_string(), author.clone()).unwrap();
        git_checkout_branch(path.clone(), "main".to_string()).unwrap();
        fs::write(root.join("document.tex"), "main\n").unwrap();
        git_commit(path.clone(), "main".to_string(), author.clone()).unwrap();
        let merged = git_merge(path.clone(), "feature".to_string(), author.clone()).unwrap();
        assert!(merged
            .status
            .changes
            .iter()
            .any(|change| change.status == "conflicted"));
        fs::write(root.join("document.tex"), "resolved\n").unwrap();
        let committed = git_commit(path, "resolve".to_string(), author).unwrap();
        assert_eq!(committed.history[0].parents.len(), 2);
        fs::remove_dir_all(root).unwrap();
    }
}
