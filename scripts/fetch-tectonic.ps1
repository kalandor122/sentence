# Downloads the pinned Tectonic engine that Sentence bundles as a sidecar.
#
# Tauri requires the binary to be named for the Rust target triple:
#   src-tauri/binaries/tectonic-x86_64-pc-windows-msvc.exe
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File scripts/fetch-tectonic.ps1

$ErrorActionPreference = "Stop"

$version  = "0.17.0"
$asset    = "tectonic-$version-x86_64-pc-windows-msvc.zip"
$url      = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$version/$asset"
# SHA-256 of tectonic.exe inside that release archive.
$expected = "99ffcfdbf1ebf8bdda9e791942e3d06aedb12463fddc33f07de6f5211c8bf08d"

$root      = Split-Path $PSScriptRoot -Parent
$binaries  = Join-Path $root "src-tauri\binaries"
$target    = Join-Path $binaries "tectonic-x86_64-pc-windows-msvc.exe"
$temp      = Join-Path ([System.IO.Path]::GetTempPath()) "sentence-tectonic-$version"

if (Test-Path $target) {
  $current = (Get-FileHash $target -Algorithm SHA256).Hash.ToLower()
  if ($current -eq $expected) {
    Write-Host "Tectonic $version already present at $target"
    exit 0
  }
  Write-Host "Replacing existing sidecar (hash $current does not match pinned release)."
}

New-Item -ItemType Directory -Force -Path $binaries | Out-Null
New-Item -ItemType Directory -Force -Path $temp | Out-Null

$zip = Join-Path $temp $asset
Write-Host "Downloading Tectonic $version ..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $temp -Force

$extracted = Join-Path $temp "tectonic.exe"
if (-not (Test-Path $extracted)) {
  throw "Archive did not contain tectonic.exe"
}

$actual = (Get-FileHash $extracted -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) {
  throw "Checksum mismatch for tectonic.exe: expected $expected, got $actual"
}

Copy-Item -Path $extracted -Destination $target -Force
Remove-Item -Path $temp -Recurse -Force
Write-Host "Installed Tectonic $version at $target"
