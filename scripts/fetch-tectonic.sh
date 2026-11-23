#!/usr/bin/env bash
# Fetch the Tectonic sidecar for this platform into src-tauri/binaries/.
# Tauri looks for binaries/tectonic-<rust-target-triple>[.exe].
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=0.17.0
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  TRIPLE=x86_64-unknown-linux-gnu; ASSET=tectonic-$VERSION-x86_64-unknown-linux-musl.tar.gz ;;
  Darwin-arm64)  TRIPLE=aarch64-apple-darwin;      ASSET=tectonic-$VERSION-aarch64-apple-darwin.tar.gz ;;
  Darwin-x86_64) TRIPLE=x86_64-apple-darwin;       ASSET=tectonic-$VERSION-x86_64-apple-darwin.tar.gz ;;
  *)
    echo "No pinned Tectonic build for $(uname -s)-$(uname -m); download one manually." >&2
    echo "Target filename: src-tauri/binaries/tectonic-<rustc -vV | grep host>" >&2
    exit 1 ;;
esac

URL="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$VERSION/$ASSET"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading $URL"
curl -fsSL -o "$TMP/tectonic.tar.gz" "$URL"
tar -xzf "$TMP/tectonic.tar.gz" -C "$TMP"
install -m 0755 "$TMP/tectonic" "src-tauri/binaries/tectonic-$TRIPLE"
echo "Installed src-tauri/binaries/tectonic-$TRIPLE"
"src-tauri/binaries/tectonic-$TRIPLE" --version
