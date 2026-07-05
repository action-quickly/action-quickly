# ActionQuick

> 开源桌面效率工具，目标是完全替代 uTools。

核心特性：全局快捷呼出、关键词搜索、上下文触发、插件化扩展。即用即走，轻量高效。

## 下载安装

前往 [Releases](https://github.com/action-quickly/action-quickly/releases) 下载最新版本：

- **Windows**: `ActionQuick_0.1.0_x64-setup.exe`
- **macOS (Intel)**: `ActionQuick_0.1.0_x64.app.tar.gz`
- **macOS (Apple Silicon)**: `ActionQuick_0.1.0_aarch64.app.tar.gz`

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Alt+Space` | 呼出/隐藏主窗口 |
| `↑` `↓` | 导航搜索结果 |
| `Enter` | 选择插件 |
| `Esc` | 关闭窗口/返回搜索 |

## 使用方式

1. 按 `Alt+Space` 呼出搜索框
2. 输入关键词搜索已安装插件
3. 或在任意应用中选中文本后呼出，自动推荐匹配插件

## 插件开发

### 创建插件

```bash
npx create-action-quick-plugin my-plugin
```

或手动创建 `plugin.json`：

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "author": "your-name",
  "description": "插件描述",
  "icon": "icon.png",
  "main": "index.html",
  "keywords": ["my", "插件"],
  "permissions": ["clipboard"],
  "minHostVersion": "0.1.0"
}
```

### 通信协议

插件在主窗口的 iframe 中运行，通过 `postMessage` 与主程序通信：

```javascript
// 调用主程序能力
function invoke(cmd, args) {
  return new Promise((resolve, reject) => {
    const id = ++ipcId;
    pendingCalls[id] = { resolve, reject };
    window.parent.postMessage({
      source: "action-quick-plugin",
      id, cmd, args: args || {}
    }, "*");
  });
}

// 示例：写入剪贴板
invoke("aq_clipboard_write", { text: "hello" });

// 示例：读取 KV 存储
invoke("aq_storage_get", { key: "history" });
```

### 可用 API

| 命令 | 权限 | 说明 |
|---|---|---|
| `aq_clipboard_write` | clipboard | 写入剪贴板 |
| `aq_clipboard_read` | clipboard | 读取剪贴板 |
| `aq_notification` | notification | 系统通知 |
| `aq_fs_read` | fs:read | 读文件 |
| `aq_fs_write` | fs:write | 写文件 |
| `aq_http_get` | http | HTTP GET |
| `aq_http_post` | http | HTTP POST |
| `aq_storage_get` | storage | 读取 KV |
| `aq_storage_set` | storage | 写入 KV |
| `aq_storage_delete` | storage | 删除 KV |
| `aq_storage_keys` | storage | 列出所有 key |

### 发布插件

1. 将插件推送到 GitHub 仓库
2. 在仓库中添加 `.github/workflows/release.yml`（参考示例插件）
3. 手动触发 release workflow，自动打包并发布
4. 在 [awsome-plugins](https://github.com/action-quickly/awsome-plugins) 仓库提交 PR 收录插件

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2 (Rust) |
| 主程序前端 | Vue 3 + TypeScript + Vite |
| 状态管理 | Pinia |
| 插件运行时 | iframe 沙箱 + postMessage |
| 插件开发 | 框架无关（Vue/React/Svelte/纯 JS 均可） |
| 支持平台 | Windows + macOS |

## 项目结构

```
action-quick/
├── src/                    # 前端源码 (Vue 3)
│   ├── views/              # 页面视图
│   ├── components/         # UI 组件
│   ├── composables/        # 组合式函数
│   ├── stores/             # Pinia 状态管理
│   ├── api/                # Tauri IPC 封装
│   ├── utils/              # 工具函数
│   └── types/              # TypeScript 类型定义
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── plugin/         # 插件管理
│   │   ├── permission/     # 权限系统
│   │   ├── context.rs      # 上下文获取
│   │   ├── commands.rs     # IPC 命令
│   │   ├── config.rs       # 配置管理
│   │   └── version.rs      # 版本比较
│   └── capabilities/       # Tauri 权限配置
├── packages/
│   ├── sdk/                # 插件 SDK (@action-quick/sdk)
│   └── create-action-quick-plugin/  # 脚手架工具
├── examples/plugins/       # 示例插件 (git submodules)
├── community/              # 社区插件索引 (git submodule)
└── docs/plans/             # 设计文档
```

## 开发

```bash
# 克隆项目（含子模块）
git clone --recursive https://github.com/action-quickly/action-quickly.git

# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 设计文档

详见 [docs/plans/2026-07-03-action-quick-design.md](docs/plans/2026-07-03-action-quick-design.md)

## License

MIT
