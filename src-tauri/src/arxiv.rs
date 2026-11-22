use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArxivPackageResult {
    path: String,
    files: Vec<String>,
    warnings: Vec<String>,
    total_bytes: u64,
}

fn project_root(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if candidate.is_file() {
        candidate
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "The project path has no parent directory.".to_string())
    } else {
        Ok(candidate)
    }
}

fn latex_command_argument<'a>(source: &'a str, command: &str) -> Option<&'a str> {
    let mut search_from = 0;
    let start = loop {
        let offset = source[search_from..].find(command)?;
        let command_end = search_from + offset + command.len();
        let continues_command = source[command_end..]
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphabetic());
        if !continues_command {
            break command_end;
        }
        search_from = command_end;
    };
    let rest = &source[start..];
    let open = rest.find('{')?;
    let content = &rest[open + 1..];
    let close = content.find('}')?;
    Some(&content[..close])
}

fn graphics_paths(source: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut cursor = 0;
    while let Some(offset) = source[cursor..].find("\\includegraphics") {
        let start = cursor + offset + "\\includegraphics".len();
        let rest = &source[start..];
        let Some(open) = rest.find('{') else {
            break;
        };
        let after = &rest[open + 1..];
        let Some(close) = after.find('}') else {
            break;
        };
        paths.push(after[..close].trim().to_string());
        cursor = start + open + close + 2;
    }
    paths
}

fn resolve_figure(root: &Path, figure: &str) -> Option<PathBuf> {
    let path = root.join(figure);
    if path.is_file() {
        return Some(path);
    }
    if Path::new(figure).extension().is_none() {
        for extension in ["png", "jpg", "jpeg", "pdf", "eps"] {
            let candidate = root.join(format!("{figure}.{extension}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn collect_assets(root: &Path, directory: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    if !directory.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_dir() {
            collect_assets(root, &path, files)?;
            continue;
        }
        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "pdf" | "eps") {
            return Err(format!(
                "{} is not an arXiv-compatible image. Use PNG, JPEG, PDF, or EPS.",
                path.strip_prefix(root).unwrap_or(&path).display()
            ));
        }
        files.push(path);
    }
    Ok(())
}

fn relative_name(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect::<Vec<_>>()
        .join("/")
}

fn validate_source(root: &Path, source: &str) -> Result<Vec<String>, String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    if source.contains("<<<<<<<") || source.contains(">>>>>>>") {
        errors.push("Resolve all Git conflict markers before export.".to_string());
    }
    if latex_command_argument(source, "\\title")
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        errors.push("Add a paper title.".to_string());
    }
    if latex_command_argument(source, "\\author")
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        errors.push("Add at least one author.".to_string());
    }
    if !source.contains("\\begin{abstract}") {
        errors.push("Add an abstract to the arXiv paper properties.".to_string());
    }
    if !source.contains("% arXiv primary category:") {
        warnings.push("Choose a primary arXiv category before submitting.".to_string());
    }
    if source.contains("\\cite{") && !source.contains("\\bibliography{") {
        errors.push("Citations exist, but no bibliography is included.".to_string());
    }
    for name in latex_command_argument(source, "\\bibliography")
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        let bib = root.join(format!("{name}.bib"));
        if !bib.exists() {
            errors.push(format!("Missing bibliography file: {name}.bib"));
        }
    }
    for figure in graphics_paths(source) {
        if figure.starts_with('/') || figure.starts_with('\\') || figure.get(1..2) == Some(":") {
            errors.push(format!("Use a relative figure path instead of {figure}."));
            continue;
        }
        if resolve_figure(root, &figure).is_none() {
            errors.push(format!("Missing figure file: {figure}"));
        }
    }
    if !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    Ok(warnings)
}

fn add_file(
    zip: &mut ZipWriter<File>,
    name: &str,
    path: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    zip.start_file(name, options)
        .map_err(|error| format!("Could not add {name}: {error}"))?;
    let mut input = File::open(path).map_err(|error| format!("Could not read {name}: {error}"))?;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = input
            .read(&mut buffer)
            .map_err(|error| format!("Could not read {name}: {error}"))?;
        if read == 0 {
            break;
        }
        zip.write_all(&buffer[..read])
            .map_err(|error| format!("Could not write {name}: {error}"))?;
    }
    files.push(name.to_string());
    Ok(())
}

#[tauri::command]
pub fn export_arxiv_package(
    path: String,
    destination: String,
) -> Result<ArxivPackageResult, String> {
    let root = project_root(&path)?;
    let source_path = root.join("document.tex");
    let source = fs::read_to_string(&source_path).map_err(|_| {
        "Compile and save the document before creating an arXiv package.".to_string()
    })?;
    let mut warnings = validate_source(&root, &source)?;
    let destination = PathBuf::from(destination);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut source_files = vec![("document.tex".to_string(), source_path)];
    let bibliography = root.join("references.bib");
    if bibliography.exists() {
        source_files.push(("references.bib".to_string(), bibliography));
    }
    let bbl = root.join(".sentence").join("build").join("document.bbl");
    if bbl.exists() {
        source_files.push(("document.bbl".to_string(), bbl));
    } else if source.contains("\\cite{") {
        warnings.push(
            "The generated .bbl was not found. Compile before export so arXiv receives the resolved bibliography."
                .to_string(),
        );
    }
    let pdf = root.join(".sentence").join("build").join("document.pdf");
    if pdf.exists() {
        source_files.push(("document.pdf".to_string(), pdf));
    } else {
        warnings
            .push("No compiled PDF was found. arXiv will compile the source package.".to_string());
    }
    let mut assets = Vec::new();
    collect_assets(&root, &root.join("assets"), &mut assets)?;
    for asset in assets {
        source_files.push((relative_name(&root, &asset), asset));
    }
    for figure in graphics_paths(&source) {
        if let Some(path) = resolve_figure(&root, &figure) {
            source_files.push((relative_name(&root, &path), path));
        }
    }
    source_files.sort_by(|left, right| left.0.cmp(&right.0));
    source_files.dedup_by(|left, right| left.0 == right.0);

    let file = File::create(&destination)
        .map_err(|error| format!("Could not create the arXiv package: {error}"))?;
    let mut zip = ZipWriter::new(file);
    let mut files = Vec::new();
    for (name, source_file) in &source_files {
        add_file(&mut zip, name, source_file, &mut files)?;
    }
    zip.finish()
        .map_err(|error| format!("Could not finish the arXiv package: {error}"))?;
    let total_bytes = fs::metadata(&destination)
        .map_err(|error| error.to_string())?
        .len();
    if total_bytes > 50 * 1024 * 1024 {
        warnings.push(
            "The package is larger than 50 MB. Check arXiv's current submission size limit."
                .to_string(),
        );
    }
    Ok(ArxivPackageResult {
        path: destination.to_string_lossy().to_string(),
        files,
        warnings,
        total_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::process::Command;
    use zip::ZipArchive;

    #[test]
    fn packages_only_submission_files() {
        let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(".tools");
        let root = workspace.join(format!("sentence-arxiv-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("assets/images")).unwrap();
        fs::create_dir_all(root.join(".sentence/build")).unwrap();
        fs::write(
            root.join("document.tex"),
            "\\title{A paper}\n\\author{Ada Lovelace}\n% arXiv primary category: cs.LG\n\\begin{document}\n\\begin{abstract}\nA result.\n\\end{abstract}\n\\bibliography{references}\n\\end{document}\n",
        )
        .unwrap();
        fs::write(root.join("references.bib"), "@misc{x}\n").unwrap();
        fs::write(root.join("sentence.json"), "{}").unwrap();
        fs::write(root.join("assets/images/figure.png"), [137, 80, 78, 71]).unwrap();
        fs::write(root.join(".sentence/build/document.pdf"), b"%PDF").unwrap();
        fs::write(root.join(".sentence/build/document.bbl"), b"\\bibitem{x}").unwrap();
        let destination = workspace.join(format!("arxiv-{}.zip", uuid::Uuid::new_v4()));
        let result = export_arxiv_package(
            root.to_string_lossy().to_string(),
            destination.to_string_lossy().to_string(),
        )
        .unwrap();
        let mut archive = ZipArchive::new(File::open(&destination).unwrap()).unwrap();
        let names = (0..archive.len())
            .map(|index| archive.by_index(index).unwrap().name().unwrap().to_string())
            .collect::<Vec<_>>();
        assert!(names.contains(&"document.tex".to_string()));
        assert!(names.contains(&"references.bib".to_string()));
        assert!(names.contains(&"document.pdf".to_string()));
        assert!(names.contains(&"document.bbl".to_string()));
        assert!(names.contains(&"assets/images/figure.png".to_string()));
        assert!(!names.contains(&"sentence.json".to_string()));
        assert!(!result.files.is_empty());
        drop(archive);
        fs::remove_dir_all(root).unwrap();
        fs::remove_file(destination).unwrap();
    }

    #[test]
    fn extracted_package_compiles_with_tectonic() {
        if std::env::var("SENTENCE_TECTONIC_TEST").as_deref() != Ok("1") {
            return;
        }
        let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf();
        let root = workspace.join(format!("sentence-arxiv-e2e-{}", uuid::Uuid::new_v4()));
        let extracted =
            workspace.join(format!("sentence-arxiv-extracted-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("assets/images")).unwrap();
        fs::create_dir_all(root.join(".sentence/build")).unwrap();
        fs::write(
            root.join("document.tex"),
            "\\documentclass{article}\n\\usepackage{amsmath,graphicx,microtype}\n\\title{A complete arXiv test}\n\\author{Ada Lovelace \\and Grace Hopper\\\\[7pt]{\\small Analytical Engine Laboratory}}\n\\begin{document}\n\\maketitle\n\\begin{abstract}\nThis package is compiled after extraction.\n\\end{abstract}\n\\section{Introduction}\nEquation $E=mc^2$ and citation \\cite{paper2026}.\n\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.1\\linewidth]{assets/images/figure}\n\\caption{A test figure.}\n\\end{figure}\n\\bibliographystyle{plain}\n\\bibliography{references}\n\\end{document}\n",
        )
        .unwrap();
        fs::write(
            root.join("references.bib"),
            "@article{paper2026, author={Sentence}, title={A Paper}, year={2026}}\n",
        )
        .unwrap();
        fs::write(
            root.join("assets/images/figure.png"),
            STANDARD
                .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
                .unwrap(),
        )
        .unwrap();
        let engine = workspace
            .join("src-tauri")
            .join("binaries")
            .join("tectonic-x86_64-pc-windows-msvc.exe");
        let cache = workspace.join(".tools").join("tectonic-cache");
        fs::create_dir_all(&cache).unwrap();
        let compile = Command::new(&engine)
            .current_dir(&root)
            .args([
                "document.tex",
                "--outdir",
                ".sentence/build",
                "--keep-logs",
                "--keep-intermediates",
                "--untrusted",
            ])
            .env("TECTONIC_CACHE_DIR", &cache)
            .output()
            .unwrap();
        assert!(
            compile.status.success(),
            "{}\n{}",
            String::from_utf8_lossy(&compile.stdout),
            String::from_utf8_lossy(&compile.stderr)
        );
        let destination = workspace.join(format!("arxiv-e2e-{}.zip", uuid::Uuid::new_v4()));
        export_arxiv_package(
            root.to_string_lossy().to_string(),
            destination.to_string_lossy().to_string(),
        )
        .unwrap();
        fs::create_dir_all(&extracted).unwrap();
        let mut archive = ZipArchive::new(File::open(&destination).unwrap()).unwrap();
        archive.extract(&extracted).unwrap();
        drop(archive);
        fs::create_dir_all(extracted.join("compiled")).unwrap();
        let extracted_compile = Command::new(&engine)
            .current_dir(&extracted)
            .args([
                "document.tex",
                "--outdir",
                "compiled",
                "--keep-logs",
                "--untrusted",
            ])
            .env("TECTONIC_CACHE_DIR", &cache)
            .output()
            .unwrap();
        assert!(
            extracted_compile.status.success(),
            "{}\n{}",
            String::from_utf8_lossy(&extracted_compile.stdout),
            String::from_utf8_lossy(&extracted_compile.stderr)
        );
        assert!(extracted.join("compiled/document.pdf").exists());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(extracted).unwrap();
        fs::remove_file(destination).unwrap();
    }
}
