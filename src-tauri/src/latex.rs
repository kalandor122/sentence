use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileDiagnostic {
    severity: String,
    message: String,
    file: Option<String>,
    line: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    success: bool,
    pdf_base64: Option<String>,
    log: String,
    diagnostics: Vec<CompileDiagnostic>,
    duration_ms: u128,
}

fn diagnostics_from_log(log: &str) -> Vec<CompileDiagnostic> {
    let mut diagnostics = Vec::new();
    for line in log.lines() {
        let trimmed = line.trim();
        if !(trimmed.starts_with('!') || trimmed.contains(": warning:")) {
            continue;
        }
        let (severity, message) = if trimmed.starts_with('!') {
            ("error", trimmed.trim_start_matches('!').trim())
        } else {
            ("warning", trimmed)
        };
        let mut file = None;
        let mut line = None;
        if let Some(colon) = trimmed.find(':') {
            let source = &trimmed[..colon];
            if source.ends_with(".tex") {
                file = Some(source.to_string());
                let rest = &trimmed[colon + 1..];
                let digits = rest
                    .chars()
                    .take_while(|character| character.is_ascii_digit())
                    .collect::<String>();
                if !digits.is_empty() {
                    line = digits.parse::<usize>().ok();
                }
            }
        }
        diagnostics.push(CompileDiagnostic {
            severity: severity.to_string(),
            message: message.to_string(),
            file,
            line,
        });
        if diagnostics.len() >= 50 {
            break;
        }
    }
    diagnostics
}

#[tauri::command]
pub async fn compile_project(app: AppHandle, path: String) -> Result<CompileResult, String> {
    let project = Path::new(&path);
    let source = project.join("document.tex");
    if !source.exists() {
        return Err("Save the document before compiling.".to_string());
    }
    let build = project.join(".sentence").join("build");
    let cache = project.join(".sentence").join("tex-cache");
    fs::create_dir_all(&build).map_err(|error| error.to_string())?;
    fs::create_dir_all(&cache).map_err(|error| error.to_string())?;
    let started = Instant::now();
    let command = app
        .shell()
        .sidecar("tectonic")
        .map_err(|error| format!("The bundled LaTeX engine is unavailable: {error}"))?
        .args([
            "document.tex",
            "--outdir",
            ".sentence/build",
            "--keep-logs",
            "--keep-intermediates",
            "--untrusted",
        ])
        .env("TECTONIC_CACHE_DIR", cache)
        .current_dir(project);
    let output = command
        .output()
        .await
        .map_err(|error| format!("Could not start the LaTeX engine: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let log_path = build.join("document.log");
    let tex_log = fs::read_to_string(log_path).unwrap_or_default();
    let log = format!("{stdout}\n{stderr}\n{tex_log}");
    let pdf_path = build.join("document.pdf");
    let success = output.status.success() && pdf_path.exists();
    let pdf_base64 = if success {
        fs::read(pdf_path).ok().map(|bytes| STANDARD.encode(bytes))
    } else {
        None
    };
    Ok(CompileResult {
        success,
        pdf_base64,
        diagnostics: diagnostics_from_log(&log),
        log,
        duration_ms: started.elapsed().as_millis(),
    })
}

#[tauri::command]
pub fn tectonic_status(app: AppHandle) -> Result<serde_json::Value, String> {
    app.shell()
        .sidecar("tectonic")
        .map_err(|error| error.to_string())?;
    Ok(serde_json::json!({
        "available": true
    }))
}
