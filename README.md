# Sentence

Sentence is a desktop document editor (Windows and Linux) that combines a Word-like writing surface with readable LaTeX and visual Git. It is built with Tauri 2, Rust, React, TypeScript, Tectonic, and libgit2.

## What works

- Visual rich-text editing with headings, lists, quotations, links, tables, images, equations, citations, footnotes, cross-references, and page breaks.
- LaTeX source mode and synchronized visual editing for the supported Sentence document subset.
- PDF compilation through the bundled Tectonic engine. No TeX Live or MiKTeX installation is required.
- arXiv submission workflow with paper metadata, validation, source packaging, BibTeX, figures, and compiled PDF.
- Project autosave, crash recovery ready project metadata, comments, and tracked-edit review.
- Local Git commits, branches, history, fetch, pull, push, merge, and conflict status.
- GitHub device-flow authorization through the system browser, secure token storage in Windows Credential Manager, repository publishing, and cloning Sentence projects.
- Local-only operation with no telemetry or application cloud service.

## Project format

Projects are folders rather than opaque archives:

```text
Paper/
  document.tex
  sentence.json
  references.bib
  assets/images/
  .sentence/
    review.json
    build/
    tex-cache/
  .git/
```

`document.tex` is readable outside Sentence. The visual document model and review state are stored separately so visual-only comments and tracked edits never leak into exported LaTeX.

## Writing for arXiv

1. Open **Paper properties** from the **Paper** ribbon tab.
2. Add the paper title, one author per line, abstract, keywords, primary arXiv category, optional cross-list categories, and submission comments.
3. Use **Insert** for equations, citations, tables, and figures. Use PNG or JPEG for visual figures; source-mode users can also reference PDF and EPS figures already in the project.
4. Edit `references.bib` from the **View > LaTeX** source workspace. Citation entries must match the BibTeX keys inserted with the Citation command.
5. Compile the paper, then choose **Paper > Create arXiv ZIP**.

The exported archive contains the portable `document.tex`, `references.bib`, generated `document.bbl` when applicable, arXiv-compatible figure assets, and the compiled `document.pdf`. It excludes Sentence-only project metadata, comments, revisions, Git state, and build caches.

The package checks for unresolved merge markers, missing metadata, missing bibliography files, absolute or missing figure paths, unsupported image formats, and oversized archives. The final submission, category choice, endorsements, and any arXiv moderation requirements are completed on arXiv's submission site.

## Development

Prerequisites:

- Node.js 20 or newer
- Rust stable with the MSVC toolchain
- Visual Studio C++ build tools
- Microsoft Edge WebView2 runtime

Install dependencies:

```powershell
npm install
```

The Tauri build requires the Tectonic engine as a sidecar at
`src-tauri/binaries/tectonic-x86_64-pc-windows-msvc.exe`. Builds fail without it.
The engine (Tectonic 0.17.0, SHA-256 `99ffcfdb…1c8bf08d`) is not tracked in Git
because it is a 50 MB Windows binary. Fetch the pinned release with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-tectonic.ps1
```

The script downloads the official Tectonic release, verifies the checksum, and
places the executable at the path Tauri expects.

Run the app in development mode:

```powershell
npm run desktop        # or: npm run tauri dev, if cargo is on PATH globally
npm run dev            # browser-only UI, desktop actions stubbed
```

Build the Windows executable:

```powershell
npm run desktop:build  # or: npm run tauri build
```

The release executable is written to `src-tauri/target/release/sentence.exe`. The bundled Tectonic sidecar is placed beside it. Installer bundles are written under `src-tauri/target/release/bundle/`.


## GitHub setup

Sentence uses the GitHub OAuth device flow, so no client secret is embedded in the application. Create a GitHub OAuth App, enable device flow, and enter its Client ID in Sentence when connecting GitHub. The requested scopes are `repo` and `read:user`.

Tokens are stored through Windows Credential Manager. Repository content is sent to GitHub only after an explicit push or publish action.

## Tests

```powershell
npm test
npx tsc -b                              # real typecheck (npm run check is a no-op)
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Run the Tectonic integration check with:

```powershell
$env:SENTENCE_TECTONIC_TEST = "1"
npm test
```

The first Tectonic build downloads missing LaTeX packages and caches them under the project's `.sentence/tex-cache/` directory.

## Current scope

Version 1 targets Windows and GitHub. A Linux build runs for development (see AGENTS.md); real-time multi-author editing is planned for version 2. Arbitrary external LaTeX projects and Microsoft `.docx` interoperability are intentionally outside the current visual-editing boundary.

## License

MIT — see [LICENSE](LICENSE). Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

