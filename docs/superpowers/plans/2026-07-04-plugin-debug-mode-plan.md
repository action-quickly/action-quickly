# Plugin Debug Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable plugin developers to run `npx @action-quick/debug` in their plugin repo to launch a host instance that directly loads the local plugin for debugging.

**Architecture:** A Node.js CLI tool downloads and caches the compatible host binary from GitHub Releases, then spawns it with `--dev-plugin <path>`. The Tauri app parses this arg, exposes a `get_dev_mode` IPC command, and routes plugin reads to the dev path. The frontend auto-navigates to the plugin view, with a refresh button for reloading.

**Tech Stack:** Rust (Tauri v2), TypeScript (Vue 3), Node.js (CLI tool), semver

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/lib.rs` | Modify | Add `DevPluginState`, parse `--dev-plugin`, add `get_dev_mode` command, modify `get_plugin`/`read_plugin_main` |
| `src/App.vue` | Modify | Check dev mode on startup, auto-navigate to PluginView |
| `src/stores/pluginStore.ts` | Modify | Add `injectDevPlugin()` method |
| `src/views/PluginView.vue` | Modify | Add refresh button with `:key` counter |
| `packages/action-quick-debug/package.json` | Create | npm package manifest |
| `packages/action-quick-debug/bin/run.js` | Create | CLI entry point |

---

### Task 1: Rust state + `--dev-plugin` parsing

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add DevPluginState struct and parsing**

Add after the existing `const HOST_VERSION`:

```rust
use std::sync::OnceLock;

static DEV_PLUGIN_PATH: OnceLock<String> = OnceLock::new();

pub fn get_dev_plugin_path() -> Option<&'static str> {
    DEV_PLUGIN_PATH.get().map(|s| s.as_str())
}
```

Inside `run()`, before `tauri::Builder::default()`, add arg parsing:

```rust
pub fn run() {
    // Parse --dev-plugin argument
    let args: Vec<String> = std::env::args().collect();
    if let Some(pos) = args.iter().position(|a| a == "--dev-plugin") {
        if let Some(path) = args.get(pos + 1) {
            if let Ok(canonical) = std::path::Path::new(path).canonicalize() {
                let _ = DEV_PLUGIN_PATH.set(canonical.to_string_lossy().to_string());
            }
        }
    }

    tauri::Builder::default()
    // ... rest unchanged
```

- [ ] **Step 2: Verify compilation**

```bash
cd src-tauri; cargo check
```
Expected: success

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(dev): parse --dev-plugin CLI argument"
```

---

### Task 2: `get_dev_mode` IPC command

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add DevPluginInfo struct and get_dev_mode command**

Add after `get_plugin_url` command:

```rust
#[derive(Serialize)]
struct DevPluginInfo {
    id: String,
    path: String,
    name: String,
    version: String,
    main: String,
    author: String,
    description: String,
    icon: String,
    min_host_version: String,
}

#[tauri::command]
fn get_dev_mode() -> Result<Option<DevPluginInfo>, String> {
    let dev_path = match crate::get_dev_plugin_path() {
        Some(p) => p.to_string(),
        None => return Ok(None),
    };

    let manifest_path = std::path::Path::new(&dev_path).join("plugin.json");
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("无法读取 plugin.json: {}", e))?;
    let manifest: PluginManifest = serde_json::from_str(&content)
        .map_err(|e| format!("plugin.json 解析失败: {}", e))?;

    manifest.validate()
        .map_err(|e| format!("plugin.json 校验失败: {}", e))?;

    Ok(Some(DevPluginInfo {
        id: manifest.id.clone(),
        path: dev_path,
        name: manifest.name,
        version: manifest.version,
        main: manifest.main,
        author: manifest.author,
        description: manifest.description,
        icon: manifest.icon,
        min_host_version: manifest.min_host_version,
    }))
}
```

- [ ] **Step 2: Register in invoke_handler**

Add `get_dev_mode` to the `generate_handler![]` list next to `get_plugin`:

```rust
get_dev_mode,
```

- [ ] **Step 3: Verify compilation**

```bash
cd src-tauri; cargo check
```
Expected: success

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(dev): add get_dev_mode IPC command"
```

---

### Task 3: Modify `get_plugin` and `read_plugin_main` for dev mode

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Modify `get_plugin` to check dev path first**

Replace the current `get_plugin` body:

```rust
#[tauri::command]
fn get_plugin(app: AppHandle, plugin_id: String) -> Result<InstalledPlugin, String> {
    // Check dev plugin first
    if let Some(dev_path) = crate::get_dev_plugin_path() {
        let manifest_path = std::path::Path::new(dev_path).join("plugin.json");
        if let Ok(content) = std::fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = PluginManifest::from_json(&content) {
                if manifest.id == plugin_id {
                    return Ok(InstalledPlugin {
                        manifest,
                        path: dev_path.to_string(),
                    });
                }
            }
        }
    }

    let manager = PluginManager::new(app.clone());
    manager
        .get_plugin(&plugin_id)
        .ok_or(format!("插件未找到: {}", plugin_id))
}
```

- [ ] **Step 2: Modify `read_plugin_main` to check dev path first**

Replace the current `read_plugin_main` body:

```rust
#[tauri::command]
fn read_plugin_main(app: AppHandle, plugin_id: String) -> Result<String, String> {
    // Check dev plugin first
    if let Some(dev_path) = crate::get_dev_plugin_path() {
        let manifest_path = std::path::Path::new(dev_path).join("plugin.json");
        if let Ok(content) = std::fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = PluginManifest::from_json(&content) {
                if manifest.id == plugin_id {
                    let file_path = std::path::Path::new(dev_path).join(&manifest.main);
                    return std::fs::read_to_string(&file_path)
                        .map_err(|e| format!("读取插件文件失败: {}", e));
                }
            }
        }
    }

    let manager = PluginManager::new(app.clone());
    let plugin = manager
        .get_plugin(&plugin_id)
        .ok_or(format!("插件未找到: {}", plugin_id))?;
    let full_path = std::path::Path::new(&plugin.path).join(&plugin.manifest.main);
    std::fs::read_to_string(&full_path)
        .map_err(|e| format!("读取插件文件失败: {}", e))
}
```

- [ ] **Step 3: Remove unused static import** if not already present

Check that `path::Path` is imported — it's already used in `get_plugin_url` so it should be fine.

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri; cargo check
```
Expected: success

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(dev): prefer dev plugin path in get_plugin and read_plugin_main"
```

---

### Task 4: Frontend dev mode startup

**Files:**
- Modify: `src/App.vue`
- Modify: `src/stores/pluginStore.ts`

- [ ] **Step 1: Add `injectDevPlugin` to pluginStore**

```typescript
// src/stores/pluginStore.ts — add inside the store definition

interface DevPluginInfo {
  id: string;
  path: string;
  name: string;
  version: string;
  main: string;
  author: string;
  description: string;
  icon: string;
  min_host_version: string;
}

function injectDevPlugin(info: DevPluginInfo): void {
  const plugin: InstalledPlugin = {
    id: info.id,
    name: info.name,
    version: info.version,
    author: info.author,
    description: info.description,
    icon: info.icon,
    main: info.main,
    path: info.path,
    keywords: [],
    permissions: [],
    minHostVersion: info.min_host_version,
  };
  // Remove existing plugin with same ID (if any), then insert at head
  const idx = plugins.value.findIndex(p => p.id === info.id);
  if (idx >= 0) plugins.value.splice(idx, 1);
  plugins.value.unshift(plugin);
}

return {
  plugins,
  loading,
  loadPlugins,
  installPlugin,
  uninstallPlugin,
  injectDevPlugin,
};
```

- [ ] **Step 2: Add dev mode check to App.vue**

In the `<script setup>` section of `src/App.vue`, add after the existing `onMounted`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { usePluginStore } from "./stores/pluginStore";

const pluginStore = usePluginStore();

onMounted(async () => {
  // Existing window-shown listener...
  unlisten = await listen<string | null>("window-shown", (event) => {
    // ... unchanged
  });

  // Dev mode check
  try {
    const devInfo = await invoke<DevPluginInfo | null>("get_dev_mode");
    if (devInfo) {
      pluginStore.injectDevPlugin(devInfo);
      appStore.selectPlugin(devInfo.id);
    }
  } catch (e) {
    console.error("Dev mode check failed:", e);
  }
});
```

Also add the `DevPluginInfo` interface at file level (or import from types):

```typescript
// Add near the top after imports
interface DevPluginInfo {
  id: string;
  path: string;
  name: string;
  version: string;
  main: string;
  author: string;
  description: string;
  icon: string;
  min_host_version: string;
}
```

- [ ] **Step 3: Verify build**

```bash
cd D:\project\action-quick; npx vite build
```
Expected: success

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/stores/pluginStore.ts
git commit -m "feat(dev): auto-navigate to dev plugin on startup"
```

---

### Task 5: PluginView refresh button

**Files:**
- Modify: `src/views/PluginView.vue`

- [ ] **Step 1: Add refresh button and `:key` binding**

Replace the template in `src/views/PluginView.vue`:

```vue
<template>
  <div class="plugin-view">
    <div class="plugin-header">
      <button class="back-btn" @click="appStore.backToSearch()">
        ← 返回
      </button>
      <span class="plugin-title">{{ currentPlugin?.name || '加载中...' }}</span>
      <button v-if="isDevMode" class="refresh-btn" @click="refresh" title="重新加载插件">
        ↻
      </button>
    </div>
    <PluginContainer
      v-if="appStore.selectedPluginId"
      :key="refreshKey"
      :plugin-id="appStore.selectedPluginId"
      :params="{ query: appStore.searchQuery, contextText: appStore.contextText }"
      @load="onPluginLoad"
      @error="onPluginError"
      @close="appStore.backToSearch()"
    />
  </div>
</template>
```

Add to `<script setup>`:

```typescript
import { ref, computed, inject } from 'vue';

const refreshKey = ref(0);
const isDevMode = ref(false);

async function checkDevMode() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const devInfo = await invoke<{ id: string } | null>('get_dev_mode');
    isDevMode.value = !!devInfo;
  } catch {
    isDevMode.value = false;
  }
}

function refresh() {
  refreshKey.value++;
}

onMounted(() => {
  checkDevMode();
});
```

Add `<style>` at the end:

```css
.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #999;
  padding: 4px 8px;
  border-radius: 4px;
  margin-left: auto;
  transition: color .15s;
}
.refresh-btn:hover {
  color: #333;
}
```

- [ ] **Step 2: Verify build**

```bash
cd D:\project\action-quick; npx vite build
```
Expected: success

- [ ] **Step 3: Commit**

```bash
git add src/views/PluginView.vue
git commit -m "feat(dev): add refresh button for dev plugin reload"
```

---

### Task 6: `@action-quick/debug` CLI package

**Files:**
- Create: `packages/action-quick-debug/package.json`
- Create: `packages/action-quick-debug/bin/run.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@action-quick/debug",
  "version": "0.1.0",
  "description": "ActionQuick plugin debug launcher",
  "bin": {
    "aq-debug": "bin/run.js"
  },
  "scripts": {
    "start": "node bin/run.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create bin/run.js**

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile, spawn } = require('child_process');
const os = require('os');

// --- Config ---
const CACHE_DIR = path.join(os.homedir(), '.action-quick', 'cache');
const GITHUB_REPO = 'action-quickly/action-quickly';

// --- Helpers ---

function pluginJsonPath() {
  const p = path.resolve(process.cwd(), 'plugin.json');
  if (!fs.existsSync(p)) {
    console.error('错误: 当前目录下未找到 plugin.json');
    console.error('请确保在插件项目的根目录下运行此命令');
    process.exit(1);
  }
  return p;
}

function parsePluginJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const manifest = JSON.parse(content);
    if (!manifest.id || !manifest.minHostVersion) {
      console.error('错误: plugin.json 缺少必填字段 id 或 minHostVersion');
      process.exit(1);
    }
    return manifest;
  } catch (e) {
    console.error('错误: plugin.json 解析失败:', e.message);
    process.exit(1);
  }
}

function getPlatform() {
  const map = {
    'win32': { platform: 'x86_64-pc-windows-msvc', ext: 'zip' },
    'darwin': { platform: 'x86_64-apple-darwin', ext: 'tar.gz' },
    'linux':  { platform: 'x86_64-unknown-linux-gnu', ext: 'tar.gz' },
  };
  return map[os.platform()];
}

function getBinaryName(ext) {
  return ext === 'zip' ? 'action-quick.exe' : 'action-quick';
}

function hostDir(version) {
  return path.join(CACHE_DIR, `host-v${version}`);
}

function isCached(version) {
  const plat = getPlatform();
  if (!plat) {
    console.error('错误: 不支持的操作系统:', os.platform());
    process.exit(1);
  }
  const binName = getBinaryName(plat.ext);
  return fs.existsSync(path.join(hostDir(version), binName));
}

function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

function sameMajor(a, b) {
  return a.split('.')[0] === b.split('.')[0];
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'action-quick-debug' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('JSON 解析失败: ' + e.message)); }
        } else {
          // Try fallback URL
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function findCompatibleRelease(minVersion) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`;
  const releases = await fetchJSON(url);
  if (!releases || !Array.isArray(releases)) return null;

  let best = null;
  for (const release of releases) {
    const tag = release.tag_name.replace(/^v/, '');
    if (sameMajor(tag, minVersion) && semverGte(tag, minVersion)) {
      if (!best || semverGte(tag, best)) {
        best = tag;
      }
    }
  }
  return best;
}

async function downloadRelease(version) {
  const plat = getPlatform();
  const dir = hostDir(version);
  fs.mkdirSync(dir, { recursive: true });

  const artifactName = `action-quick-${plat.platform}.${plat.ext}`;
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${artifactName}`;
  const dest = path.join(dir, artifactName);

  console.log(`下载 ActionQuick v${version}...`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`下载失败 (HTTP ${res.statusCode}): ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        // Extract
        if (plat.ext === 'zip') {
          // Fallback: if unzip not available, just assume the binary is there
          console.log('  下载完成，解压中...');
          const { execSync } = require('child_process');
          try {
            execSync(`powershell -Command "Expand-Archive -Path '${dest}' -DestinationPath '${dir}' -Force"`);
          } catch {
            // If powershell fails, maybe it's already extracted
          }
        } else {
          const { execSync } = require('child_process');
          execSync(`tar -xzf "${dest}" -C "${dir}"`);
        }
        // Remove archive
        try { fs.unlinkSync(dest); } catch {}
        resolve();
      });
    }).on('error', (err) => { file.close(); fs.unlinkSync(dest); reject(err); });
  });
}

// --- Main ---

async function main() {
  const manifest = parsePluginJson(pluginJsonPath());
  const plat = getPlatform();
  if (!plat) process.exit(1);

  const binName = getBinaryName(plat.ext);

  // Find compatible version
  console.log(`查找兼容 v${manifest.minHostVersion} 的最新版本...`);
  const version = await findCompatibleRelease(manifest.minHostVersion);
  if (!version) {
    console.error(`错误: 未找到兼容 v${manifest.minHostVersion} 的主程序版本`);
    process.exit(1);
  }

  // Download if not cached
  if (!isCached(version)) {
    await downloadRelease(version);
  }

  const binaryPath = path.join(hostDir(version), binName);
  if (!fs.existsSync(binaryPath)) {
    console.error(`错误: 主程序二进制未找到: ${binaryPath}`);
    process.exit(1);
  }

  console.log(`启动 ActionQuick v${version} (调试模式)...`);
  const child = spawn(binaryPath, ['--dev-plugin', process.cwd()], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error('错误:', e.message);
  process.exit(1);
});
```

- [ ] **Step 3: Test the package resolves**

```bash
cd packages/action-quick-debug; node -e "require('./bin/run.js')" 2>&1 | head -2
```
Expected: `错误: 当前目录下未找到 plugin.json` (because we're not in a plugin dir)

- [ ] **Step 4: Commit**

```bash
git add packages/action-quick-debug/
git commit -m "feat(dev): create @action-quick/debug CLI package"
```

---

## Self-Review Checklist

- **Spec coverage**: Every spec section maps to a task: Rust arg parsing (Task 1), get_dev_mode command (Task 2), get_plugin/read_plugin_main modification (Task 3), frontend auto-navigate (Task 4), refresh button (Task 5), CLI package (Task 6)
- **Placeholder scan**: No TBD/TODO/placeholder patterns
- **Type consistency**: `DevPluginInfo` struct/json naming matches between Rust and TypeScript
- **Edge cases**: Dev plugin not found, version not found, download failures all handled
