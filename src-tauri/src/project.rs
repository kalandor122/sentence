use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::git;

const PROJECT_FILE: &str = "sentence.json";
const REVIEW_FILE: &str = "review.json";
const SOURCE_FILE: &str = "document.tex";
const SENTENCE_DIR: &str = ".sentence";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFile {
    schema_version: u32,
    name: String,
    settings: serde_json::Value,
    document: serde_json::Value,
    source_hash: String,
    updated_at: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewFile {
    comments: Vec<serde_json::Value>,
    revisions: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    path: String,
    name: String,
    document: serde_json::Value,
    latex: String,
    bibliography: String,
    settings: serde_json::Value,
    comments: Vec<serde_json::Value>,
    revisions: Vec<serde_json::Value>,
    git: git::GitState,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectRequest {
    path: String,
    name: String,
    document: serde_json::Value,
    settings: serde_json::Value,
    latex: String,
    bibliography: String,
    comments: Vec<serde_json::Value>,
    revisions: Vec<serde_json::Value>,
}

fn normalize_project_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    let directory = if candidate.is_file() {
        candidate
            .parent()
            .ok_or_else(|| "The selected path has no parent directory.".to_string())?
            .to_path_buf()
    } else {
        candidate
    };
    Ok(directory)
}

fn project_paths(path: &Path) -> (PathBuf, PathBuf, PathBuf) {
    (
        path.join(PROJECT_FILE),
        path.join(SENTENCE_DIR).join(REVIEW_FILE),
        path.join(SOURCE_FILE),
    )
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, bytes).map_err(|error| format!("Could not write {}: {error}", path.display()))
}

fn source_hash(source: &str) -> String {
    let digest = Sha256::digest(source.as_bytes());
    format!("{digest:x}")
}

fn read_snapshot(path: &Path) -> Result<ProjectSnapshot, String> {
    let (project_path, review_path, source_path) = project_paths(path);
    let project_text = fs::read_to_string(&project_path)
        .map_err(|_| format!("{} is not a Sentence project.", path.display()))?;
    let project: ProjectFile = serde_json::from_str(&project_text)
        .map_err(|error| format!("Invalid project file: {error}"))?;
    let review: ReviewFile = fs::read_to_string(review_path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    let latex = fs::read_to_string(source_path).unwrap_or_default();
    let bibliography = fs::read_to_string(path.join("references.bib")).unwrap_or_default();
    let git = git::read_git_state(path)?;

    Ok(ProjectSnapshot {
        path: path.to_string_lossy().to_string(),
        name: project.name,
        document: project.document,
        latex,
        bibliography,
        settings: project.settings,
        comments: review.comments,
        revisions: review.revisions,
        git,
    })
}

fn init_project_metadata(path: &Path) -> Result<(), String> {
    let gitignore = "*.pdf\n*.aux\n*.log\n*.out\n*.toc\n*.bbl\n*.blg\n*.synctex.gz\n.sentence/build/\n.sentence/autosave/\n.sentence/tex-cache/\n";
    fs::write(path.join(".gitignore"), gitignore).map_err(|error| error.to_string())?;
    fs::create_dir_all(path.join(SENTENCE_DIR).join("build")).map_err(|error| error.to_string())?;
    fs::create_dir_all(path.join(SENTENCE_DIR).join("autosave"))
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(path.join("assets").join("images")).map_err(|error| error.to_string())?;
    let bibliography = path.join("references.bib");
    if !bibliography.exists() {
        fs::write(
            bibliography,
            "@article{example2026,\n  author = {Author, Example},\n  title = {An Example Reference},\n  year = {2026}\n}\n",
        )
        .map_err(|error| error.to_string())?;
    }
    git::ensure_repository(path)?;
    Ok(())
}

#[tauri::command]
pub fn create_project(
    path: String,
    name: String,
    document: serde_json::Value,
    settings: serde_json::Value,
    latex: String,
) -> Result<ProjectSnapshot, String> {
    let root = PathBuf::from(path).join(name.trim());
    if name.trim().is_empty() {
        return Err("A project name is required.".to_string());
    }
    if root.join(PROJECT_FILE).exists() {
        return Err("A Sentence project already exists in that folder.".to_string());
    }
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    init_project_metadata(&root)?;
    let project = ProjectFile {
        schema_version: 1,
        name: name.trim().to_string(),
        settings,
        document,
        source_hash: source_hash(&latex),
        updated_at: Utc::now().to_rfc3339(),
    };
    let (project_path, review_path, source_path) = project_paths(&root);
    write_json(&project_path, &project)?;
    write_json(&review_path, &ReviewFile::default())?;
    fs::write(source_path, latex).map_err(|error| error.to_string())?;
    read_snapshot(&root)
}

#[tauri::command]
pub fn open_project(path: String) -> Result<ProjectSnapshot, String> {
    let root = normalize_project_path(&path)?;
    read_snapshot(&root)
}

#[tauri::command]
pub fn save_project(request: SaveProjectRequest) -> Result<ProjectSnapshot, String> {
    let SaveProjectRequest {
        path,
        name,
        document,
        settings,
        latex,
        bibliography,
        comments,
        revisions,
    } = request;
    let root = normalize_project_path(&path)?;
    let (project_path, review_path, source_path) = project_paths(&root);
    if !project_path.exists() {
        return Err("This folder is not a Sentence project.".to_string());
    }
    let project = ProjectFile {
        schema_version: 1,
        name,
        settings,
        document,
        source_hash: source_hash(&latex),
        updated_at: Utc::now().to_rfc3339(),
    };
    write_json(&project_path, &project)?;
    write_json(
        &review_path,
        &ReviewFile {
            comments,
            revisions,
        },
    )?;
    fs::write(source_path, latex).map_err(|error| error.to_string())?;
    fs::write(root.join("references.bib"), bibliography).map_err(|error| error.to_string())?;
    read_snapshot(&root)
}

#[tauri::command]
pub fn import_image(
    project_path: String,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    let root = normalize_project_path(&project_path)?;
    let images = root.join("assets").join("images");
    fs::create_dir_all(&images).map_err(|error| error.to_string())?;
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid image name.".to_string())?;
    let extension = Path::new(safe_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg") {
        return Err("Use a PNG or JPEG image for arXiv-compatible figures.".to_string());
    }
    let safe_file_name = safe_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let target_name = format!(
        "{}-{}",
        &uuid::Uuid::new_v4().simple().to_string()[..8],
        safe_file_name
    );
    let bytes = STANDARD
        .decode(data_base64)
        .map_err(|error| format!("Invalid image data: {error}"))?;
    let target = images.join(&target_name);
    fs::write(&target, bytes).map_err(|error| error.to_string())?;
    Ok(format!("assets/images/{target_name}"))
}

#[tauri::command]
pub fn authorize_asset(app: AppHandle, path: String) -> Result<(), String> {
    let canonical = PathBuf::from(&path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    app.asset_protocol_scope()
        .allow_file(&canonical)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn github_clone_repository(
    parent_path: String,
    url: String,
    token: Option<String>,
) -> Result<ProjectSnapshot, String> {
    let parent = PathBuf::from(parent_path);
    if !parent.exists() {
        return Err("Choose an existing local folder.".to_string());
    }
    let name = url
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("sentence-project")
        .trim_end_matches(".git")
        .to_string();
    if name.is_empty() {
        return Err("The repository URL does not contain a repository name.".to_string());
    }
    let target = parent.join(&name);
    if target.exists() {
        return Err(format!(
            "{} already exists. Choose another destination.",
            target.display()
        ));
    }
    git::clone_repository(&url, &target, token.as_deref())?;
    if !target.join(PROJECT_FILE).exists() {
        return Err("This repository is not a Sentence project.".to_string());
    }
    read_snapshot(&target)
}

#[tauri::command]
pub fn export_pdf(path: String, destination: String) -> Result<String, String> {
    let project = normalize_project_path(&path)?;
    let pdf = project.join(".sentence").join("build").join("document.pdf");
    if !pdf.exists() {
        return Err("Compile the document before exporting a PDF.".to_string());
    }
    let destination = PathBuf::from(destination);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(&pdf, &destination).map_err(|error| format!("Could not export PDF: {error}"))?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_text_file(destination: String, content: String) -> Result<String, String> {
    let destination = PathBuf::from(destination);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&destination, content).map_err(|error| format!("Could not export file: {error}"))?;
    Ok(destination.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn project_files_round_trip() {
        let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".tools");
        let parent = workspace.join(format!("sentence-project-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&parent).unwrap();
        let document = json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{ "type": "text", "text": "A test sentence." }]
            }]
        });
        let settings = json!({ "title": "Test document" });
        let created = create_project(
            parent.to_string_lossy().to_string(),
            "Paper".to_string(),
            document.clone(),
            settings,
            "\\documentclass{article}\n\\begin{document}\nA test sentence.\n\\end{document}\n"
                .to_string(),
        )
        .unwrap();
        assert_eq!(created.name, "Paper");
        assert_eq!(created.git.status.branch, "main");
        assert!(Path::new(&created.path).join("document.tex").exists());
        assert!(Path::new(&created.path).join("sentence.json").exists());
        assert!(Path::new(&created.path).join(".git").exists());
        let reopened = open_project(created.path.clone()).unwrap();
        assert_eq!(reopened.name, "Paper");
        assert_eq!(reopened.document, document);
        let saved = save_project(SaveProjectRequest {
            path: created.path.clone(),
            name: "Paper".to_string(),
            document: reopened.document.clone(),
            settings: reopened.settings.clone(),
            latex: reopened.latex.clone(),
            bibliography: "@misc{paper2026}\n".to_string(),
            comments: Vec::new(),
            revisions: Vec::new(),
        })
        .unwrap();
        assert!(saved.bibliography.contains("paper2026"));
        fs::remove_dir_all(parent).unwrap();
    }
}
