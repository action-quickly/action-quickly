# ActionQuick 设计文档

> 开源桌面效率工具，目标是完全替代 uTools。

## 1. 项目概述

### 定位

ActionQuick 是一个开源的桌面效率工具，核心价值：全局快捷呼出、关键词搜索、上下文触发、插件化扩展。即用即走，轻量高效。

### 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2 (Rust) |
| 主程序前端 | Vue 3 + TypeScript + Vite |
| 插件运行时 | 独立 WebView 沙箱 |
| 插件开发 | 框架无关（Vue/React/Svelte/纯 JS 均可） |
| 插件 SDK | `@action-quick/plugin-sdk` (npm 包) |
| 数据存储 | SQLite (主程序) + KV API (插件) |
| 支持平台 | Windows + macOS（Linux 后期） |

### 整体架构

```
┌─────────────────────────────────────────────┐
│              ActionQuick 主程序               │
│  ┌─────────────┐    ┌──────────────────┐    │
│  │  Rust Core  │    │  Vue 3 主界面     │    │
│  │  - 快捷键    │◄──►│  - 搜索框        │    │
│  │  - 窗口管理  │ IPC│  - 结果列表      │    │
│  │  - 权限校验  │    │  - 插件市场入口  │    │
│  │  - 插件加载  │    └──────────────────┘    │
│  │  - 能力网关  │                            │
│  └──────┬──────┘    ┌──────────────────┐    │
│         │           │  插件 WebView     │    │
│         └──────────►│  (独立沙箱)       │    │
│           能力注入   │  Vue/React/...    │    │
│                      └──────────────────┘    │
└─────────────────────────────────────────────┘
```

核心设计：主程序的 Rust 层负责所有系统能力，通过 Tauri IPC 暴露给主界面和插件 WebView。插件运行在独立 WebView 中，无法直接调用系统 API，必须通过 SDK 走 IPC，经过权限校验后由 Rust 层执行。

## 2. 核心交互流程

### 主交互流程

```
用户按 Alt+Space
    │
    ▼
主窗口显示（搜索框 + 结果列表）
    │
    ├─ 场景1: 直接输入关键词
    │   ▼
    │   实时匹配插件（按 keywords 匹配）
    │   ▼
    │   上下箭头选择 → 回车
    │   ▼
    │   打开插件 WebView，传入 query 参数
    │
    └─ 场景2: 选中内容后呼出（上下文触发）
        ▼
        Rust 层模拟 Ctrl+C 获取选中文本
        ▼
        主界面顶部显示选中文本 + 推荐插件
        ▼
        选择插件 → 打开插件 WebView，传入 context 参数
```

### 窗口行为

- **呼出即聚焦**：按快捷键，窗口出现在鼠标当前位置附近（或上次位置），输入框自动聚焦
- **失焦隐藏**：点击窗口外区域，窗口自动隐藏（不销毁），下次呼出秒开
- **Esc 关闭**：按 Esc 隐藏窗口
- **插件窗口**：进入插件后，插件界面替换主界面内容（同窗口内切换 WebView），返回时回到搜索框

### 插件匹配规则

插件在 `plugin.json` 中声明触发条件：

```json
{
  "name": "json-formatter",
  "keywords": ["json", "格式化", "format"],
  "context": {
    "text": {
      "pattern": "^\\s*[\\[\\{]",
      "label": "检测到 JSON"
    }
  }
}
```

- **keywords**：精确匹配 + 模糊匹配（拼音首字母也支持）
- **context.text.pattern**：选中文本匹配正则则推荐该插件，显示 `label`
- 无关键词无上下文匹配时，显示全部插件列表

## 3. 插件系统设计

### 插件结构

一个插件是一个标准目录，打包后为 `.zip`：

```
json-formatter/
├── plugin.json          # 插件清单（必需）
├── dist/                # 前端构建产物（必需）
│   ├── index.html
│   └── assets/
├── icon.png             # 插件图标（必需）
└── README.md            # 文档（可选）
```

### plugin.json 清单规范

```json
{
  "id": "json-formatter",
  "name": "JSON 格式化",
  "version": "1.0.0",
  "author": "xxx",
  "description": "格式化、压缩、校验 JSON",
  "icon": "icon.png",
  "main": "dist/index.html",
  "keywords": ["json", "格式化"],
  "context": {
    "text": {
      "pattern": "^\\s*[\\[\\{]",
      "label": "JSON"
    }
  },
  "permissions": ["clipboard", "storage", "notification"],
  "minHostVersion": "0.1.0"
}
```

### 权限模型

声明式权限，插件在 `permissions` 中声明所需能力，安装时展示给用户确认：

| 权限 | 说明 |
|---|---|
| `clipboard` | 读写剪贴板 |
| `storage` | 使用 KV 存储（隔离） |
| `notification` | 发送系统通知 |
| `fs:read` | 读取文件 |
| `fs:write` | 写入文件 |
| `shell:exec` | 执行系统命令 |
| `http` | 发起网络请求 |
| `window` | 操作主窗口（大小、位置、隐藏） |

运行时 IPC 调用前，Rust 层校验当前插件是否声明了对应权限，未声明则拒绝并返回错误。

### 插件 SDK

`@action-quick/plugin-sdk` 封装所有 IPC 调用，插件通过 `window.aq` 全局对象或 import 使用：

```typescript
import { clipboard, storage, notification, context } from '@action-quick/plugin-sdk'

// 获取主程序传入的参数
const { query, contextText } = context.getParams()

// 调用系统能力（需声明权限）
await clipboard.writeText(result)
await storage.set('history', [...])
notification.show({ title: '完成', body: '已复制到剪贴板' })
```

### 插件加载流程

```
用户选择插件
    │
    ▼
Rust 层读取 plugin.json，校验权限
    │
    ▼
创建独立 WebView，加载 dist/index.html
    │
    ▼
注入 SDK preload 脚本（绑定当前插件 ID）
    │
    ▼
WebView 就绪后，通过 IPC 传入 query/context 参数
    │
    ▼
插件运行，所有系统能力调用走 IPC → 权限校验 → 执行
```

## 4. Rust 核心模块

### 模块划分

```
src-tauri/src/
├── main.rs              # 入口
├── commands/            # IPC 命令处理（暴露给前端）
│   ├── clipboard.rs     # 剪贴板读写
│   ├── storage.rs       # 插件 KV 存储
│   ├── fs.rs            # 文件读写
│   ├── shell.rs         # 命令执行
│   ├── http.rs          # 网络请求代理
│   ├── notification.rs  # 系统通知
│   └── window.rs        # 窗口管理
├── plugin/              # 插件管理
│   ├── manager.rs       # 加载、卸载、列表
│   ├── manifest.rs      # plugin.json 解析校验
│   └── sandbox.rs       # WebView 创建与隔离
├── permission/          # 权限系统
│   ├── checker.rs       # 运行时权限校验
│   └── store.rs         # 插件权限持久化
├── shortcut/            # 全局快捷键
│   └── handler.rs       # 注册、监听、分发
├── context/             # 上下文获取
│   └── selection.rs     # 模拟 Ctrl+C 获取选中文本
├── search/              # 插件搜索匹配
│   └── matcher.rs       # 关键词 + 拼音 + 上下文匹配
└── storage/             # 主程序数据层
    └── db.rs            # SQLite 连接管理
```

### 核心流程的 Rust 侧实现

**全局快捷键呼出：**
```
tauri-plugin-global-shortcut 注册 Alt+Space
  → 显示主窗口
  → 窗口定位到鼠标附近
  → 聚焦搜索框
```

**上下文获取：**
```
呼出时若用户按住修饰键（或配置开启上下文模式）
  → 模拟 Ctrl+C
  → 读取剪贴板内容
  → 返回给前端作为 contextText
```

**插件 WebView 创建：**
```
WebviewWindowBuilder::new(app, plugin_id, url)
  → 设置 isolated 上下文
  → 注入 preload 脚本初始化 SDK
  → 绑定插件 ID 到窗口 label
  → IPC 调用时通过窗口 label 反查插件 ID → 校验权限
```

### IPC 调用链路

```
插件 JS 调用 sdk.clipboard.writeText("xxx")
  → invoke("plugin_clipboard_write", { text: "xxx" })
  → Rust command 接收
  → 从窗口 label 获取 plugin_id
  → permission::checker::check(plugin_id, "clipboard")
  → 通过 → 执行写入 → 返回 Ok
  → 拒绝 → 返回 PermissionDenied 错误
```

### 依赖的 Tauri 插件

| 插件 | 用途 |
|---|---|
| `tauri-plugin-global-shortcut` | 全局快捷键 |
| `tauri-plugin-clipboard-manager` | 剪贴板 |
| `tauri-plugin-dialog` | 文件选择对话框 |
| `tauri-plugin-notification` | 系统通知 |
| `tauri-plugin-store` | 主程序配置存储 |
| `tauri-plugin-http` | HTTP 请求代理 |
| `tauri-plugin-sql` | SQLite 数据库 |

## 5. 前端主程序设计

### 目录结构

```
src/
├── main.ts                 # 应用入口
├── App.vue                 # 根组件
├── views/
│   ├── SearchView.vue      # 搜索主界面
│   ├── PluginView.vue      # 插件容器（承载插件 WebView）
│   └── MarketView.vue      # 插件管理/安装界面
├── components/
│   ├── SearchInput.vue     # 搜索输入框
│   ├── ResultList.vue      # 匹配结果列表
│   ├── ResultItem.vue      # 单条结果
│   ├── ContextBar.vue      # 上下文提示条（显示选中文本）
│   └── PluginFrame.vue     # 插件 WebView 容器
├── composables/
│   ├── useShortcut.ts      # 快捷键监听
│   ├── useSearch.ts        # 搜索匹配逻辑
│   ├── useContext.ts       # 上下文获取
│   └── usePlugins.ts       # 插件列表管理
├── stores/
│   ├── pluginStore.ts      # 已安装插件状态（Pinia）
│   └── appStore.ts         # 全局状态（窗口模式、当前视图）
├── api/                    # 封装 Tauri IPC 调用
│   ├── plugin.ts
│   ├── clipboard.ts
│   └── window.ts
└── types/                  # TypeScript 类型定义
    └── plugin.d.ts
```

### 视图切换状态机

```
┌─────────┐  输入/选择插件   ┌──────────┐
│ Search  │ ──────────────► │ Plugin   │
│ (搜索框) │                 │ (插件运行)│
└─────────┘ ◄────────────── └──────────┘
    │           Esc/返回
    │
    │  打开插件管理
    ▼
┌─────────┐
│ Market  │
└─────────┘
```

- `appStore.currentView` 控制当前显示的视图
- 搜索 → 插件：记录选中的插件，切换到 PluginView，加载 WebView
- 插件 → 搜索：销毁/隐藏插件 WebView，回到 SearchView，清空或保留搜索词

### 搜索界面交互细节

```
┌──────────────────────────────────┐
│  🔍  输入关键词或选择插件...      │  ← SearchInput（自动聚焦）
├──────────────────────────────────┤
│  📋 选中: {"name":"test"...}     │  ← ContextBar（有上下文时显示）
├──────────────────────────────────┤
│  {}  JSON 格式化        JSON     │  ← ResultItem
│  🔤 翻译                        │
│  📷 颜色拾取器                   │
│  ⌨  Base64 编码                  │
└──────────────────────────────────┘
```

- 搜索框输入时实时过滤 `useSearch` 返回匹配结果
- 上下文条出现时，匹配 `context` 规则的插件排到最前并高亮标签
- 键盘导航：`↑↓` 选择，`Enter` 确认，`Esc` 关闭

### 插件 WebView 容器

`PluginFrame.vue` 使用 Tauri 2 的 Webview 组件嵌入插件页面：

- 通过 `WebviewWindow` 加载插件 `dist/index.html`
- 窗口 label 设为 `plugin:{pluginId}`，Rust 侧据此反查插件
- 插件加载完成后通过 IPC 传入 `{ query, contextText }`
- 顶部显示返回按钮 + 插件名称

## 6. 插件分发与开发体验

### 插件安装流程

```
用户获取插件 .zip 文件（从社区索引仓库下载或本地）
    │
    ▼
拖拽到主程序 / 或插件管理界面点击"安装"
    │
    ▼
Rust 层解压，读取 plugin.json
    │
    ▼
展示插件信息 + 权限列表
    ┌────────────────────────────┐
    │ JSON 格式化 v1.0.0          │
    │ 作者: xxx                   │
    │ 所需权限:                   │
    │  • 剪贴板读写               │
    │  • 本地存储                 │
    │        [取消]  [确认安装]   │
    └────────────────────────────┘
    │
    ▼
用户确认 → 复制到插件目录 → 写入权限记录 → 注册到插件列表
    │
    ▼
安装完成，立即可用
```

### 插件目录结构

```
~/.action-quick/
├── plugins/
│   ├── json-formatter/
│   │   ├── plugin.json
│   │   ├── dist/
│   │   └── icon.png
│   ├── translator/
│   └── base64/
├── storage/              # 插件 KV 数据
│   ├── json-formatter.db
│   └── translator.db
└── config.json           # 主程序配置（快捷键、主题等）
```

### 社区插件索引

维护一个 GitHub 仓库 `action-quick/plugins`，结构：

```
plugins/
├── index.json            # 插件列表
└── README.md             # 说明
```

`index.json` 示例：

```json
[
  {
    "id": "json-formatter",
    "name": "JSON 格式化",
    "version": "1.0.0",
    "author": "xxx",
    "description": "格式化、压缩、校验 JSON",
    "repo": "https://github.com/xxx/aq-json-formatter",
    "download": "https://github.com/xxx/aq-json-formatter/releases/download/v1.0.0/json-formatter.zip",
    "tags": ["开发", "JSON"]
  }
]
```

主程序插件管理界面拉取该索引，展示可用插件列表，点击安装即下载 `.zip` 并走安装流程。

### 插件开发体验

提供脚手架工具 `create-action-quick-plugin`：

```bash
npm create action-quick-plugin@latest my-plugin
```

交互式选择框架（Vue/React/Svelte/vanilla），生成项目模板：

```
my-plugin/
├── plugin.json
├── package.json
├── src/
│   └── main.ts
├── vite.config.ts        # 配置构建到 dist/
└── README.md
```

开发模式：`npm run dev` 启动 Vite dev server，主程序通过"开发者模式"加载 `http://localhost:5173`，支持热更新。

### 插件版本管理

- `plugin.json` 的 `version` 字段
- 主程序记录已安装版本，索引仓库有新版本时提示更新
- 更新 = 重新下载安装（覆盖），保留 KV 存储数据

## 7. 数据层与配置

### 主程序数据存储

使用 SQLite 存储主程序数据，通过 `tauri-plugin-sql`：

```sql
-- 已安装插件
CREATE TABLE plugins (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    version     TEXT NOT NULL,
    path        TEXT NOT NULL,
    installed_at INTEGER NOT NULL,
    enabled     INTEGER DEFAULT 1
);

-- 插件权限记录
CREATE TABLE plugin_permissions (
    plugin_id   TEXT NOT NULL,
    permission  TEXT NOT NULL,
    granted_at  INTEGER NOT NULL,
    PRIMARY KEY (plugin_id, permission)
);

-- 插件使用统计（用于排序推荐）
CREATE TABLE plugin_stats (
    plugin_id   TEXT PRIMARY KEY,
    use_count   INTEGER DEFAULT 0,
    last_used   INTEGER
);
```

### 插件 KV 存储

每个插件独立一个 SQLite 文件 `~/.action-quick/storage/{plugin_id}.db`：

```sql
CREATE TABLE kv (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);
```

API：

```typescript
sdk.storage.get(key): Promise<any>
sdk.storage.set(key, value): Promise<void>
sdk.storage.delete(key): Promise<void>
sdk.storage.keys(): Promise<string[]>
```

### 主程序配置

`~/.action-quick/config.json`：

```json
{
  "shortcut": "Alt+Space",
  "contextMode": "auto",
  "window": {
    "width": 750,
    "height": 500,
    "position": "cursor"
  },
  "theme": "system",
  "developerMode": false,
  "pluginSource": "https://raw.githubusercontent.com/action-quick/plugins/main/index.json"
}
```

### 搜索排序算法（多级优先级模型）

搜索结果分为多个优先级层级，层级之间是严格的优先关系（高层级永远排在低层级之前），同层级内再用相关性分数排序。

```
Layer 0 (最高):  精确关键词命中
Layer 1:         前缀关键词命中
Layer 2:         模糊/拼音关键词命中
Layer 3:         上下文(context)规则命中
Layer 4:         系统应用/命令（非插件）
Layer 5 (最低):  无命中，展示全部插件
```

| 层级 | 来源 | 说明 |
|---|---|---|
| L0 | 插件 keywords | 用户输入完全等于某个 keyword |
| L1 | 插件 keywords | 用户输入是某个 keyword 的前缀 |
| L2 | 插件 keywords | 模糊匹配 / 拼音首字母匹配 |
| L3 | 插件 context | 选中文本匹配插件的 `context.text.pattern` |
| L4 | 系统 | 系统应用、计算器等内置命令 |
| L5 | 兜底 | 无输入时展示已启用插件列表 |

核心原则：
- 插件 keyword 命中 > 插件 context 命中：用户主动输入意图优先于被动上下文
- 插件 context 命中 > 系统应用：插件是核心，系统应用是补充
- 同层级内按使用频率 + 最近使用排序

同层级内排序：

```
sameLayerScore = useCountScore * 0.6 + recencyScore * 0.4
```

- `useCountScore`：使用次数归一化到 [0, 1]
- `recencyScore`：最近使用时间指数衰减，`e^(-daysSinceLastUse / 7)`

排序流程：

```
输入 query + contextText
    │
    ▼
遍历所有已启用插件 + 系统应用
    │
    ├─ 插件: 检查 keywords 匹配 → 分配 L0/L1/L2
    ├─ 插件: 未命中 keyword 但 contextText 匹配 context.pattern → L3
    ├─ 插件: 都未命中 → L5
    └─ 系统应用: 匹配名称 → L4
    │
    ▼
按层级升序排列，同层级按 sameLayerScore 降序
    │
    ▼
返回结果列表
```

特殊情况：

- **无输入 + 有上下文**（选中文本后呼出）：L3 插件排最前，L5 插件排其后，不显示 L4 系统应用
- **有输入 + 有上下文**：正常走层级排序，L3 插件依然参与但排在 keyword 命中的插件之后

## 8. 错误处理与安全

### 错误处理策略

Rust 侧 IPC 命令统一返回 `Result<T, AppError>`：

```rust
#[derive(Debug, Serialize)]
#[serde(tag = "kind")]
pub enum AppError {
    PermissionDenied { permission: String },
    PluginNotFound { plugin_id: String },
    InvalidManifest { reason: String },
    StorageError { message: String },
    FileSystemError { message: String },
    NetworkError { message: String },
    InvalidArgument { message: String },
    Internal { message: String },
}
```

前端 SDK 统一捕获并转为可读错误：

```typescript
try {
  await sdk.clipboard.writeText(text)
} catch (err) {
  // err.kind === 'PermissionDenied'
  // err.permission === 'clipboard'
}
```

关键错误场景处理：

| 场景 | 处理 |
|---|---|
| 插件 manifest 缺字段 | 安装时拒绝，提示具体缺失字段 |
| 插件 IPC 调用未声明权限 | 返回 `PermissionDenied`，前端 SDK 弹提示 |
| 插件 WebView 崩溃 | 捕获崩溃事件，显示错误页 + 返回按钮 |
| 插件加载超时（5s） | 显示"插件加载超时" + 重试按钮 |
| KV 存储读写失败 | 返回 `StorageError`，不影响其他插件 |
| 主程序数据库损坏 | 启动时检测，尝试备份 + 重建 |

### 安全策略

**WebView 隔离：**
- 每个插件独立 `WebviewWindow`，label 为 `plugin:{id}`
- 禁用 Node.js 集成（Tauri 2 默认安全）
- 插件只能通过 IPC 通信，无法直接调用 Rust API
- CSP 策略：只允许加载插件自身资源 + 主程序注入的 SDK

**权限运行时校验：**
```
每次 IPC 调用 →
  1. 获取调用来源窗口 label → 解析 plugin_id
  2. 查 plugin_permissions 表
  3. 未声明 → 返回 PermissionDenied
  4. 声明但用户未授权 → 返回 PermissionDenied
  5. 通过 → 执行
```

**shell:exec 权限特殊处理：**
- 声明 `shell:exec` 的插件安装时额外警告（红色提示）
- 仅允许执行白名单内命令，或弹窗二次确认

### 插件卸载清理

```
卸载插件
  → 删除 plugins/{id}/ 目录
  → 删除 storage/{id}.db
  → 删除 plugin_permissions 记录
  → 删除 plugin_stats 记录
  → 从 plugins 表移除
```

## 9. 测试策略

**Rust 侧：**
- 单元测试：权限校验、manifest 解析、搜索匹配算法、KV 存储读写
- 集成测试：插件加载流程、IPC 命令链路
- 使用 `tempfile` crate 创建临时目录隔离测试

**前端侧：**
- 组件测试：Vitest + Vue Test Utils，覆盖搜索框、结果列表、上下文条
- 状态测试：Pinia store 的状态流转
- E2E 测试：暂不引入（Tauri E2E 成本高，手动测试为主）

**插件 SDK：**
- 单元测试：mock IPC 调用，验证参数序列化
- 集成测试：用一个示例插件验证完整链路

## 10. 项目里程碑

```
M1: 骨架搭建（1-2 周）
    ├─ Tauri 2 + Vue 3 项目初始化
    ├─ 全局快捷键呼出/隐藏主窗口
    ├─ 搜索界面 UI（搜索框 + 空列表）
    └─ 窗口失焦隐藏、Esc 关闭

M2: 插件系统核心（2-3 周）
    ├─ plugin.json 解析校验
    ├─ 插件 WebView 加载与隔离
    ├─ 插件 SDK npm 包（IPC 封装）
    ├─ 权限声明与运行时校验
    └─ 本地拖拽安装

M3: 搜索与上下文（1-2 周）
    ├─ 关键词 + 拼音匹配
    ├─ 多级优先级排序算法
    ├─ 模拟 Ctrl+C 获取选中文本
    ├─ 上下文规则匹配
    └─ 使用统计与排序优化

M4: 系统能力完善（1-2 周）
    ├─ 剪贴板、通知、文件读写 IPC
    ├─ 插件 KV 存储
    ├─ 主程序配置（快捷键、主题）
    └─ 插件卸载与清理

M5: 分发与开发体验（1-2 周）
    ├─ 社区插件索引仓库
    ├─ 插件管理界面（安装/卸载/启用禁用）
    ├─ create-action-quick-plugin 脚手架
    ├─ 开发者模式（加载 localhost）
    └─ 示例插件 3-5 个（翻译、JSON、Base64、颜色拾取）

M6: 打磨发布（1 周）
    ├─ Windows + macOS 打包
    ├─ README 与文档
    └─ 首个 release 版本
```

### 内置示例插件（M5）

| 插件 | 演示能力 |
|---|---|
| JSON 格式化 | context 触发 + 剪贴板 |
| 翻译 | context 触发 + http 权限 |
| Base64 编解码 | keyword 触发 + 剪贴板 |
| 颜色拾取器 | keyword 触发 + 纯 UI |
| 时间戳转换 | keyword 触发 + storage |
