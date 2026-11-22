# AGENTS.md

Sentence is a Windows-first Tauri 2 desktop app: a Word-like visual editor that writes readable LaTeX, compiles PDFs through a bundled Tectonic sidecar, and adds visual Git (libgit2), GitHub sync, and arXiv packaging. Frontend: React 19 + Tiptap 3 + Vite, strict TS. Backend: Rust in `src-tauri/`. Read `README.md` for product-level detail.

## Commands

- `npm install` — one-time setup.
- `npm run desktop` — full desktop app. Runs `.tools/tauri.ps1`, which sets the `.tools` env vars, starts the cargo proxy, then runs `tauri dev`. Plain `npm run tauri dev` fails with `cargo metadata: program not found` because cargo is not installed globally on this machine. The Vite dev server uses `strictPort` 1420; kill any stale process holding that port first.
- `npm run desktop:build` — release build: `src-tauri/target/release/sentence.exe`, Tectonic sidecar beside it, installers under `src-tauri/target/release/bundle/`.
- `npm run dev` — UI in a plain browser. Desktop-only actions are stubbed via the `isDesktop` guard in `src/lib/tauri.ts`.
- `npm test` — Vitest in the default node environment (no jsdom needed).
- `npx tsc -b` — the real typecheck (see gotcha below).

### Typecheck gotcha

`npm run check` (`tsc --noEmit`) is a **silent no-op**: the root `tsconfig.json` is solution-style (`files: []`, references only), so it checks nothing — a deliberate type error passes with exit 0. Use `npx tsc -b` or `npm run build` (`tsc -b && vite build`) to typecheck.

## Rust toolchain on this machine

The working Rust setup is self-contained under `.tools/` (gitignored) and routed through a local crates.io proxy. Before any cargo command:

```powershell
$env:CARGO_HOME  = "$PWD\.tools\cargo"
$env:RUSTUP_HOME = "$PWD\.tools\rustup"
$env:PATH        = "$PWD\.tools\cargo\bin;$env:PATH"
powershell -File .tools\start-cargo-proxy.ps1   # idempotent; waits for port 38999
```

`.tools\cargo\config.toml` replaces crates.io with `sparse+http://127.0.0.1:38999/index/`, so the proxy must be running for any registry access. `.tools\tauri.ps1` (behind `npm run desktop` / `npm run desktop:build`) applies this whole setup automatically. For other cargo commands:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

## Tests

- Frontend unit tests live in `src/lib/latex.test.ts` (pure functions, fast).
- Tectonic tests are skipped by default. `SENTENCE_TECTONIC_TEST=1` enables both the Vitest pipeline test (`src/lib/tectonic.integration.test.ts`) and the Rust arXiv e2e test (`extracted_package_compiles_with_tectonic` in `src-tauri/src/arxiv.rs`):

  ```powershell
  $env:SENTENCE_TECTONIC_TEST = "1"; npm test
  cargo test --manifest-path src-tauri/Cargo.toml   # after setting the .tools env vars above
  ```

  Both shell out to the bundled engine `src-tauri/binaries/tectonic-x86_64-pc-windows-msvc.exe`; the first run downloads LaTeX packages into `.tools/tectonic-cache` (network, slow).
- The remaining Rust tests (`#[cfg(test)]` modules in `src-tauri/src/*.rs`) are hermetic: they create UUID-suffixed temp dirs under the repo-root `.tools/` directory — keep it present and writable.

## Architecture

- `src/App.tsx` (~1000 lines) is the monolithic state container; `src/components/*` are dialogs/panels; `src/editor/` holds Tiptap extensions.
- `src/lib/latex.ts` is the core: `documentToLatex` / `latexToDocument` implement two-way visual⇄LaTeX-source sync for the supported document subset. Any document-model change must keep both directions and the round-trip tests in sync.
- `src/lib/tauri.ts` types every Tauri `invoke`; all backend access goes through it.
- `src-tauri/src/lib.rs` registers every Tauri command; modules are per domain: `project.rs`, `latex.rs`, `git.rs`, `github.rs`, `arxiv.rs`. `latex.rs` runs the Tectonic sidecar with `--untrusted`, cache in `<project>/.sentence/tex-cache`, output in `.sentence/build`.
- Projects are plain folders: `document.tex` (readable outside the app), `sentence.json` (visual model + settings), `references.bib`, `.sentence/` (review state, build, cache), `.git/`. Visual-only state (comments, tracked edits) must never leak into exported LaTeX.
- WebView2 dev/test overrides read in `lib.rs`: `SENTENCE_WEBVIEW_DATA_DIR` (isolated profile dir) and `SENTENCE_WEBVIEW_BROWSER_ARGS`. The `.tools/*runtime*` and `.tools/webview-data` dirs are past smoke-test profiles.

## Conventions

- Version is triple-tracked — `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` — bump all three together.
- Update `THIRD_PARTY_NOTICES.md` when adding a significant runtime dependency.
- Tectonic is a required sidecar (`bundle.externalBin` in `tauri.conf.json`): dev and builds fail without `src-tauri/binaries/tectonic-x86_64-pc-windows-msvc.exe` (a copy is archived in `.tools/tectonic.zip`).
- Windows-only in v1 (WebView2, Windows Credential Manager for GitHub tokens, NSIS bundling). Linux and `.docx` interoperability are intentionally out of scope.
- No CI, lint, or formatter config exists; match the existing code style.
