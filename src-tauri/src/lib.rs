mod arxiv;
mod git;
mod github;
mod latex;
mod project;
mod zotero;

use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let mut window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Sentence")
                    .inner_size(1440.0, 920.0)
                    .min_inner_size(960.0, 640.0)
                    .center()
                    .resizable(true)
                    .decorations(true);
            if let Ok(data_directory) = std::env::var("SENTENCE_WEBVIEW_DATA_DIR") {
                window = window.data_directory(data_directory.into());
            }
            if let Ok(arguments) = std::env::var("SENTENCE_WEBVIEW_BROWSER_ARGS") {
                window = window.additional_browser_args(&arguments);
            }
            window.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project::create_project,
            project::open_project,
            project::save_project,
            project::import_image,
            project::authorize_asset,
            project::github_clone_repository,
            project::export_pdf,
            project::export_text_file,
            arxiv::export_arxiv_package,
            latex::compile_project,
            latex::tectonic_status,
            zotero::zotero_search,
            git::git_state,
            git::git_diff,
            git::git_commit,
            git::git_create_branch,
            git::git_checkout_branch,
            git::git_merge,
            git::git_fetch,
            git::git_pull,
            git::git_push,
            git::git_set_remote,
            github::github_start_device_flow,
            github::github_poll_device_flow,
            github::github_session,
            github::github_disconnect,
            github::github_publish_repository,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sentence");
}
