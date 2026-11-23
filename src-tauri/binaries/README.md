# Sidecar binaries

Tauri bundles the Tectonic engine from this directory. The binary is not tracked
in Git because it is a 50 MB Windows executable.

Expected filename (Tauri appends the Rust target triple automatically, so the
`externalBin` entry is `binaries/tectonic`):

    tectonic-x86_64-pc-windows-msvc.exe

Linux/macOS (Tectonic 0.17.0):

    tectonic-x86_64-unknown-linux-gnu
    tectonic-aarch64-apple-darwin

Fetch the pinned release and drop it here under the right name:

    bash scripts/fetch-tectonic.sh

Windows:

    powershell -ExecutionPolicy Bypass -File scripts/fetch-tectonic.ps1
