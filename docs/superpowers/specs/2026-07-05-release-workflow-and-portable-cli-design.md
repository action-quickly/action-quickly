# Release Workflow and Portable CLI Design

**Date:** 2026-07-05
**Status:** Draft

## Problem

1. **Release workflow conflict**: GitHub Actions workflow uses `tauri-apps/tauri-action@v0` (outdated). macOS dual-arch builds in the same matrix with `releaseDraft: true` can conflict when both runners try to create/push the same tag.
2. **No portable binary**: Only installers (NSIS/MSI/DMG) are uploaded. `aq-debug` CLI downloads the NSIS installer and runs it with `/S`, which installs to `%LOCALAPPDATA%` and pollutes the system.
3. **CLI artifact naming hardcoded**: Previously hardcoded artifact filenames that didn't match CI output.

## Solution

### 1. Workflow Optimization (`release.yml`)

- Upgrade `tauri-apps/tauri-action` from `@v0` to `@v2` (Tauri v2 compatible)
- Keep macOS dual-arch as separate matrix entries (`x86_64-apple-darwin` and `aarch64-apple-darwin`). Using `tauri-action@v2` with `releaseDraft: true`, both runners upload assets to the same draft release without conflict.
- Add a step after each build to upload the raw compiled binary as a release asset:
  - `action-quick-x86_64-pc-windows-msvc.exe` (Windows)
  - `action-quick-x86_64-apple-darwin` (macOS Intel)
  - `action-quick-aarch64-apple-darwin` (macOS ARM)
- Remove Linux (not needed per user).
- Use `actions/upload-release-asset@v1` with `upload_url` from `tauri-action` output `release-upload-url`.

### 2. CLI Portable Download (`bin/run.js`)

- **Asset matching priority** (via `assetPatterns()`):
  1. Try to find a raw binary asset: `action-quick-{target}` where `target` matches current platform
  2. Fall back to installer/archive assets (NSIS `.exe`, `.tar.gz`, `.dmg`)
- **Windows**: Download `action-quick-x86_64-pc-windows-msvc.exe` directly → cache to `~/.action-quick/cache/host-v{version}/` → spawn. No installation.
- **macOS**: Download `action-quick-x86_64-apple-darwin` or `action-quick-aarch64-apple-darwin` → cache → spawn.
- **Fallback extraction** (when only installer/archive available):
  - `.tar.gz`: `tar -xzf`
  - NSIS `.exe`: `7z x` to extract
  - `.dmg`: `hdiutil attach` → copy binary
- Cache marker: file exists in cache dir = cached.

### 3. Files Changed

| File | Action |
|------|--------|
| `.github/workflows/release.yml` | Rewrite (upgrade action, add raw binary upload) |
| `packages/action-quick-debug/bin/run.js` | Update asset patterns and download logic |

### 4. Non-goals / Excluded

- No Linux CI build
- No npm publishing of CLI (still uses `npm link`)
- No file watching/HMR in debug mode
- No HMR/auto-refresh

## Verification

- Trigger `workflow_dispatch` on the repo → release is created with both installers AND raw binaries
- `aq-debug` in a plugin repo → downloads raw binary (no installer run) → spawns with `--dev-plugin`
