# AGENTS.md

Sentence is a Tauri 2 desktop app (Windows-first, also builds and runs on Linux): a Word-like visual editor that writes readable LaTeX, compiles PDFs through a bundled Tectonic sidecar, and adds visual Git (libgit2), GitHub sync, and arXiv packaging. Frontend: React 19 + Tiptap 3 + Vite, strict TS. Backend: Rust in `src-tauri/`. Read `README.md` for product-level detail.

## Commands

- `npm install` — one-time setup.
- `npm run desktop` — full desktop app. Runs `.tools/tauri.ps1`, which sets the `.tools` env vars, starts the cargo proxy, then runs `tauri dev`. Plain `npm run tauri dev` fails with `cargo metadata: program not found` because cargo is not installed globally on this machine. The Vite dev server uses `strictPort` 1420; kill any stale process holding that port first.
- `npm run desktop:build` — Windows release build: `src-tauri/target/release/sentence.exe`, Tectonic sidecar beside it, installers under `src-tauri/target/release/bundle/`.
- `npm run desktop:linux` — Linux dev run (needs port 1420, so stop the QA loop first).
- `npm run desktop:linux:build` — Linux release binary at `src-tauri/target/release/sentence` (`--no-bundle`: deb/AppImage packaging also needs `patchelf`).
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

## QA loop (autonomous)

`qa/loop.sh` runs forever under the systemd user unit `sentence-qa-loop`
(`systemctl --user status sentence-qa-loop`). Each cycle: ensure Vite on :1420 →
run `qa/smoke.mjs` (Playwright gate) → take the highest-severity open item from
`qa/backlog.json` → branch `qa/<id>-<slug>` → `opencode run` fixes it → verify
`npx tsc -b` + `npm test` + smoke → commit and merge to `main` only if green.
Every fourth cycle runs `qa/explore.py`, where an agent writes a Playwright probe
for an untested area (`qa/areas.json`) and files findings into the backlog.
When the backlog empties, `qa/roadmap.json` is promoted into it.

- Stop: `touch qa/STOP` (loop exits between cycles; systemd keeps it stopped).
- Watch: `tail -f qa/LOG.md`, per-cycle agent output in `qa/cycles/<id>.log`.
- Supervisor overrides: write `qa/requeue.json` (`[{"id":"qa-002","status":"open"}]`);
  `cycle.py` applies it under its lock so it cannot race the loop.
- Browser build only: Tauri commands are stubbed, so desktop-only paths must
  degrade with a message. Never weaken `qa/smoke.mjs` or the tests to pass a gate;
  fix the app instead. Blocked items keep their branch with a `wip` commit.

## Linux desktop

Works on this machine (Omarchy/Arch, Wayland). Verified: release binary launches,
`cargo test` passes all five backend tests, and the packaged Tectonic sidecar
compiles a real LaTeX package (`arxiv::tests::extracted_package_compiles_with_tectonic`).

- Rust toolchain: `mise use -g rust@stable` (no system cargo needed).
- System packages already present: `webkit2gtk-4.1`, `gtk3`, `libsoup3`, `librsvg`,
  `base-devel`. Bundling deb/AppImage additionally needs `patchelf`.
- Sidecar: `bash scripts/fetch-tectonic.sh` installs
  `src-tauri/binaries/tectonic-x86_64-unknown-linux-gnu`. `npm run desktop:linux:build`
  does not copy it next to the binary — copy it to `src-tauri/target/release/tectonic`
  if you run the binary directly instead of through `tauri dev`.
- WebKitGTK on Wayland aborts with `Error 71 (Protocol error) dispatching to Wayland
  display`. Both npm scripts above set `WEBKIT_DISABLE_DMABUF_RENDERER=1`; add
  `WEBKIT_DISABLE_COMPOSITING_MODE=1` if it still crashes.
- `keyring` uses the `linux-native` (kernel keyutils) backend on Linux, so GitHub
  tokens are session-scoped there; `windows-native` stays for Windows
  (see the target-specific dependency blocks in `src-tauri/Cargo.toml`).

## Conventions

- Version is triple-tracked — `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` — bump all three together.
- Update `THIRD_PARTY_NOTICES.md` when adding a significant runtime dependency.
- Tectonic is a required sidecar (`bundle.externalBin` in `tauri.conf.json`): dev and builds fail without `src-tauri/binaries/tectonic-<target-triple>[.exe]` — `scripts/fetch-tectonic.ps1` for Windows (a copy is archived in `.tools/tectonic.zip`), `scripts/fetch-tectonic.sh` for Linux/macOS.
- `ensure_repository` must use `Repository::open`, never `Repository::discover`: discover walks up and finds whatever repo contains the project folder, so projects opened inside another checkout silently commit into the parent repo.
- Windows is the shipping target (WebView2, Credential Manager, NSIS). Linux builds and runs for development; `.docx` interoperability is still out of scope.
- No CI, lint, or formatter config exists; match the existing code style.

## Model

The QA loop runs its fixer and tester agents on `opencode-go/deepseek-v4.1-flash`
(OpenCode Go gateway, `OPENCODE_GO_API_KEY` from `~/.hermes/.env`, passed to the
systemd unit via `EnvironmentFile`). `opencode run --standalone` is used so each
run picks up that key instead of reusing a background server started without it.
Override with `QA_MODEL=opencode/<other>`.
