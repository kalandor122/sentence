# Sidecar binaries

Tauri bundles the Tectonic engine from this directory. The binary is not tracked
in Git because it is a 50 MB Windows executable.

Expected filename (Tauri appends the Rust target triple automatically, so the
`externalBin` entry is `binaries/tectonic`):

    tectonic-x86_64-pc-windows-msvc.exe

Fetch the pinned release (Tectonic 0.17.0) and verify its checksum:

    powershell -ExecutionPolicy Bypass -File scripts/fetch-tectonic.ps1
