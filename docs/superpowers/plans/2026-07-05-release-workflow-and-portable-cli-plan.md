# Release Workflow and Portable CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix release workflow conflicts, add raw binary uploads, and make `aq-debug` download binaries directly without installing.

**Architecture:** Two independent changes: (1) rewrite `release.yml` to use `tauri-action@v2` + upload raw binary per platform; (2) update `aq-debug` CLI's asset matching to prefer raw binaries and skip NSIS installer execution.

**Tech Stack:** GitHub Actions, Node.js

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.github/workflows/release.yml` | Modify | Upgrade action, add raw binary upload, fix macOS matrix |
| `packages/action-quick-debug/bin/run.js` | Modify | Update asset patterns, fix download/install logic |

---

### Task 1: Rewrite release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Replace the workflow**

Replace the entire file with:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: '版本号，留空则从 Cargo.toml 读取'
        required: false
        type: string

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
            binary-ext: .exe
          - platform: macos-latest
            target: x86_64-apple-darwin
            binary-ext: ''
          - platform: macos-latest
            target: aarch64-apple-darwin
            binary-ext: ''

    runs-on: ${{ matrix.platform }}
    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: npm ci

      - name: Read version
        id: version
        shell: bash
        run: |
          if [ -n "${{ inputs.version }}" ]; then
            VERSION="${{ inputs.version }}"
          else
            VERSION=$(grep '^version' src-tauri/Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Version: $VERSION"

      - name: Build and bundle
        uses: tauri-apps/tauri-action@v2
        id: tauri
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v${{ steps.version.outputs.version }}
          releaseName: 'v${{ steps.version.outputs.version }}'
          releaseBody: 'ActionQuick v${{ steps.version.outputs.version }}'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}

      - name: Upload raw binary
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.tauri.outputs.release-upload-url }}
          asset_path: src-tauri/target/${{ matrix.target }}/release/action-quick${{ matrix.binary-ext }}
          asset_name: action-quick-${{ matrix.target }}${{ matrix.binary-ext }}
          asset_content_type: application/octet-stream
```

- [ ] **Step 2: Verify syntax**

Check that there are no obvious YAML issues. The key points to verify:
- `upload-release-asset@v1` uses `upload_url` from `tauri-action@v2` output
- `asset_path` matches the actual binary location after Tauri build
- macOS does NOT have `.exe` extension for `binary-ext`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: upgrade tauri-action to v2 and upload raw binary per platform"
```

---

### Task 2: Update CLI for portable download

**Files:**
- Modify: `packages/action-quick-debug/bin/run.js`

- [ ] **Step 1: Update assetPatterns to prioritize raw binary**

Change `assetPatterns()` from:

```javascript
function assetPatterns() {
  switch (os.platform()) {
    case 'win32': return ['x64-setup.exe', 'x64_en-US.msi'];
    case 'darwin': return ['x64.app.tar.gz', 'x64.dmg', 'aarch64.app.tar.gz'];
    case 'linux': return ['.deb', '.AppImage'];
    default: return [];
  }
}
```

To:

```javascript
function assetPatterns() {
  switch (os.platform()) {
    case 'win32': return ['action-quick-x86_64-pc-windows-msvc.exe', 'x64-setup.exe', 'x64_en-US.msi'];
    case 'darwin': return ['action-quick-x86_64-apple-darwin', 'action-quick-aarch64-apple-darwin', 'x64.app.tar.gz', 'x64.dmg', 'aarch64.app.tar.gz'];
    case 'linux': return ['.deb', '.AppImage'];
    default: return [];
  }
}
```

- [ ] **Step 2: Update binaryPath for portable mode**

Change `binaryPath()` from:

```javascript
function binaryPath(version) {
  switch (os.platform()) {
    case 'win32':
      // NSIS installs to %LOCALAPPDATA%\ActionQuick by default
      return path.join(os.homedir(), 'AppData', 'Local', 'ActionQuick', 'action-quick.exe');
    case 'darwin':
      return path.join(hostDir(version), 'ActionQuick.app', 'Contents', 'MacOS', 'action-quick');
    case 'linux':
      return path.join(hostDir(version), 'action-quick');
    default:
      return null;
  }
}
```

To:

```javascript
function binaryPath(version, assetName) {
  const dir = hostDir(version);
  switch (os.platform()) {
    case 'win32':
      // Raw binary downloaded directly or extracted from installer
      return path.join(dir, assetName || 'action-quick-x86_64-pc-windows-msvc.exe');
    case 'darwin':
      // Raw binary downloaded directly, or inside extracted .app bundle
      if (assetName && (assetName.includes('action-quick-'))) {
        return path.join(dir, assetName);
      }
      return path.join(dir, 'ActionQuick.app', 'Contents', 'MacOS', 'action-quick');
    case 'linux':
      return path.join(dir, assetName || 'action-quick');
    default:
      return null;
  }
}
```

- [ ] **Step 3: Replace cacheFile with cacheAsset for portable cache tracking**

Remove the `cacheFile()` function. Add a `cacheAsset()` function that stores the downloaded asset name:

```javascript
function cacheAssetPath(version) {
  return path.join(hostDir(version), '.asset-name');
}
```

- [ ] **Step 4: Update isCached to check by cache marker**

Replace `isCached()`:

```javascript
function isCached(version) {
  const marker = cacheAssetPath(version);
  if (!fs.existsSync(marker)) return false;
  const assetName = fs.readFileSync(marker, 'utf-8').trim();
  const binPath = binaryPath(version, assetName);
  return fs.existsSync(binPath);
}
```

- [ ] **Step 5: Update downloadAndInstall for portable mode**

Change `downloadAndInstall()` to use the asset filename directly for the binary path, remove NSIS silent installation, and write the `.asset-name` marker:

```javascript
async function downloadAndInstall(release) {
  const version = release.tag_name.replace(/^v/, '');
  const asset = findAsset(release);
  if (!asset) {
    console.error(`错误: 未能找到当前平台 (${os.platform()}) 的兼容制品`);
    process.exit(1);
  }

  const dir = hostDir(version);
  fs.mkdirSync(dir, { recursive: true });

  const dest = path.join(dir, asset.name);

  console.log(`下载 ActionQuick v${version}...`);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(asset.browser_download_url, (res) => {
      if (res.statusCode >= 300) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`下载失败 (HTTP ${res.statusCode})`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });

  // If it's an archive, extract the binary
  if (asset.name.endsWith('.tar.gz')) {
    console.log('  解压中...');
    execSync(`tar -xzf "${dest}" -C "${dir}"`, { stdio: 'inherit' });
    try { fs.unlinkSync(dest); } catch {}
  } else if (asset.name.endsWith('-setup.exe')) {
    // NSIS fallback: extract with 7-zip
    console.log('  提取二进制...');
    const sevenZip = path.join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7z.exe');
    if (fs.existsSync(sevenZip)) {
      execSync(`"${sevenZip}" x "${dest}" -o"${dir}" -y`, { stdio: 'inherit' });
      try { fs.unlinkSync(dest); } catch {}
    } else {
      console.error('错误: 需要 7-Zip 来提取安装器，请安装 https://7-zip.org');
      process.exit(1);
    }
  }
  // Raw binary: nothing to extract, already at dest

  // Write cache marker so isCached knows which file to check
  fs.writeFileSync(cacheAssetPath(version), asset.name);
}
```

- [ ] **Step 6: Update main() to use asset name for binary path**

Change `main()` to pass `asset.name` to `binaryPath()`:

```javascript
async function main() {
  const manifest = parsePluginJson(pluginJsonPath());
  const patterns = assetPatterns();
  if (patterns.length === 0) {
    console.error('错误: 不支持的操作系统:', os.platform());
    process.exit(1);
  }

  console.log(`查找兼容 v${manifest.minHostVersion} 的最新版本...`);
  const release = await findCompatibleRelease(manifest.minHostVersion);
  if (!release) {
    console.error(`错误: 未找到兼容 v${manifest.minHostVersion} 的主程序版本`);
    process.exit(1);
  }

  const version = release.tag_name.replace(/^v/, '');
  const asset = findAsset(release);

  if (!isCached(version)) {
    await downloadAndInstall(release);
  }

  const binPath = path.resolve(binaryPath(version, asset ? asset.name : null));
  if (!fs.existsSync(binPath)) {
    console.error(`错误: 主程序二进制未找到: ${binPath}`);
    process.exit(1);
  }

  console.log(`启动 ActionQuick v${version} (调试模式)...`);
  const child = spawn(binPath, ['--dev-plugin', process.cwd()], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
```

- [ ] **Step 7: Verify the CLI parses correctly**

Run: `node -c packages/action-quick-debug/bin/run.js`
Expected: No syntax errors

- [ ] **Step 8: npm link**

```bash
cd packages/action-quick-debug; npm link
```

- [ ] **Step 9: Commit**

```bash
git add packages/action-quick-debug/bin/run.js
git commit -m "fix: prefer raw binary download in aq-debug, remove installer pollution"
```

---

## Self-Review

- **Spec coverage**: Workflow optimization (Task 1) covers all points in the spec — action upgrade, raw binary upload, macOS matrix. CLI changes (Task 2) cover portable mode, raw binary priority, fallback extraction.
- **Placeholder scan**: No TBD/TODO/placeholder patterns.
- **Type consistency**: `binaryPath(version, assetName)` is used consistently. Cache tracking uses `.asset-name` marker file.
- **Package name**: `@action-quick/debug` matches existing setup.
