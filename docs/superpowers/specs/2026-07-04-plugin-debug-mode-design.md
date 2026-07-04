# Plugin Debug Mode

独立插件调试系统，允许插件开发者在自己的仓库中通过 `npx @action-quick/debug` 启动一个直接加载本地插件的主程序实例，实现完整的端到端调试。

## 架构总览

```
┌──────────────────────┐     ┌────────────────────────────┐
│  插件仓库              │     │  @action-quick/debug (CLI) │
│  ├── plugin.json      │────▶│  1. 读取 plugin.json       │
│  ├── index.html       │     │  2. 查询 GitHub Releases   │
│  └── ...              │     │  3. 下载/缓存 host 二进制   │
│                        │     │  4. spawn --dev-plugin <cwd>│
│  npm run dev /         │     └──────────┬─────────────────┘
│  npx @action-quick/debug│              │
└──────────────────────┘                 ▼
                               ┌────────────────────────────┐
                               │  主程序 (ActionQuick)       │
                               │  --dev-plugin /path/to/plugin│
                               │                            │
                               │  1. main.rs 解析 --dev-plugin│
                               │  2. get_dev_mode() 返回信息 │
                               │  3. App.vue 直接跳转 PluginView│
                               │  4. iframe 加载本地源码      │
                               └────────────────────────────┘
```

## 1. Rust 端：--dev-plugin 参数

### 参数解析

在 `src-tauri/src/main.rs` 中，`main()` 调用 `run()` 之前解析 `std::env::args()`：

```
action-quick --dev-plugin /home/user/my-plugin
```

找到 `--dev-plugin` 后，将后续参数作为插件**目录**路径（即包含 `plugin.json` 的目录），存入 `std::sync::OnceLock<String>` 全局静态变量。路径需要 `std::fs::canonicalize` 转为绝对路径。

### 新增 IPC 命令

```rust
#[derive(Serialize)]
struct DevPluginInfo {
    id: String,
    path: String,
    manifest: PluginManifest,  // 从 dev 目录 plugin.json 读取
}

#[tauri::command]
fn get_dev_mode() -> Result<Option<DevPluginInfo>, String>
```

- 正常启动 → 返回 `Ok(None)`
- 调试模式 → 读取 dev 目录 `plugin.json`，返回 `Ok(Some(...))`
- dev 目录不存在或 `plugin.json` 无效 → 返回 `Err("...")`

### 修改现有命令

以下命令需处理 dev 插件路径（当 pluginId 匹配 dev 插件时，从 dev 路径读取而非 `~/.action-quick/plugins/`）：

| 命令 | 修改内容 |
|------|----------|
| `get_plugin` | 如果 ID 匹配 dev 插件，从 dev 路径构造 InstalledPlugin 返回（dev 优先于已安装的同 ID 插件）|
| `read_plugin_main` | 如果 ID 匹配 dev 插件，从 dev 路径读取文件 |

`list_plugins` **不修改** — dev 插件不混入已安装列表，避免干扰。

## 2. 前端：调试模式启动与刷新

### 启动跳转

`App.vue` 在 `onMounted` 中新增：

```typescript
const devInfo = await invoke('get_dev_mode');
if (devInfo) {
  // 构造合成 InstalledPlugin 注入 pluginStore
  pluginStore.injectDevPlugin(devInfo);
  // 直接跳转到 PluginView
  appStore.selectPlugin(devInfo.id);
}
```

`pluginStore` 新增 `injectDevPlugin(devInfo)` 方法，将 dev 插件插入 `plugins` 列表头部。如果已存在同 ID 的已安装插件，dev 插件覆盖之。

### PluginView 刷新按钮

在 PluginView header 中新增一个刷新按钮（↻ 图标），点击后：

```
刷新 → emit('refresh') → PluginContainer 重新创建 renderer → iframe srcdoc 重新加载
```

实现方式：PluginContainer 上添加一个 `:key` 属性绑定到刷新计数器，计数器递增时 Vue 自动销毁重建组件。

## 3. `@action-quick/debug` CLI 包

位置：`packages/action-quick-debug/`（主仓库内）或独立仓库。

### 功能流程

```
1. 读取 plugin.json
   - 校验 id、minHostVersion 等必要字段
   - 失败时输出友好错误

2. 版本匹配 (GitHub Releases API)
   - GET /repos/action-quickly/action-quickly/releases?per_page=100
   - 解析 semver，筛选 >=minHostVersion 且 major 相同的最新版本
   - 缓存路径: ~/.action-quick/cache/host-v{version}/
   - 已缓存则跳过下载

3. 宿主二进制路径
   - Windows: ~/.action-quick/cache/host-v{version}/action-quick.exe
   - macOS:   ~/.action-quick/cache/host-v{version}/ActionQuick.app
   - Linux:   ~/.action-quick/cache/host-v{version}/action-quick

4. 启动
   child_process.spawn(binaryPath, ['--dev-plugin', process.cwd()])
```

### package.json

```json
{
  "name": "@action-quick/debug",
  "version": "0.1.0",
  "bin": { "aq-debug": "bin/run.js" },
  "dependencies": {
    "semver": "^7.0.0",
    "node-fetch": "^3.0.0"
  }
}
```

### 使用方式

插件开发者在插件仓库中：

```bash
# 直接运行（无需安装）
npx @action-quick/debug

# 或安装为 dev 依赖
npm install -D @action-quick/debug
# package.json 添加
"scripts": { "dev": "aq-debug" }
npm run dev
```

### 发行包下载 URL

格式需与 CI/CD release artifact 命名一致：

```
https://github.com/action-quickly/action-quickly/releases/download/v{version}/action-quick-{platform}-{arch}.{ext}
```

示例：`v0.1.0` → `action-quick-x86_64-pc-windows-msvc.zip`（Windows）、`action-quick-x86_64-apple-darwin.tar.gz`（macOS）、`action-quick-x86_64-unknown-linux-gnu.tar.gz`（Linux）。

> 注：实际 artifact 命名需在实现时确认 CI/CD 配置后再定，此处为占位约定。

## 非功能性需求

- **缓存复用**：已下载的 host 版本不重复下载，检测 `~/.action-quick/cache/host-v{version}/` 目录存在即跳过
- **错误提示**：Version fetch 失败、二进制不存在、`plugin.json` 无效等场景输出中文友好错误信息
- **跨平台**：CLI 包在 Windows/macOS/Linux 上一致工作，通过 `process.platform` + `process.arch` 选择对应 artifact

## 不包含的范围（明确排除）

- 文件监听自动刷新（后续可加）
- WebSocket HMR（后续可加）
- 多插件同时调试
- 插件构建/打包功能（`aq-debug` 只管调试，不负责打包发布）
- 调试工具自身的自动更新
