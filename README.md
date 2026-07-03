# ActionQuick

> 开源桌面效率工具，目标是完全替代 uTools。

核心特性：全局快捷呼出、关键词搜索、上下文触发、插件化扩展。即用即走，轻量高效。

## 技术栈

- **桌面壳**: Tauri 2 (Rust)
- **主程序前端**: Vue 3 + TypeScript + Vite
- **状态管理**: Pinia
- **插件运行时**: 独立 WebView 沙箱
- **插件开发**: 框架无关（Vue/React/Svelte/纯 JS 均可）
- **支持平台**: Windows + macOS

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（同时启动 Vite 和 Tauri）
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 全局快捷键

- `Alt+Space`: 呼出/隐藏主窗口
- `Esc`: 关闭窗口
- `↑↓`: 导航搜索结果
- `Enter`: 选择插件

## 项目结构

```
action-quick/
├── src/                    # 前端源码 (Vue 3)
│   ├── views/              # 页面视图
│   ├── components/         # UI 组件
│   ├── composables/        # 组合式函数
│   ├── stores/             # Pinia 状态管理
│   ├── api/                # Tauri IPC 封装
│   ├── types/              # TypeScript 类型定义
│   └── styles/             # 全局样式
├── src-tauri/              # Rust 后端
│   ├── src/                # Rust 源码
│   ├── capabilities/       # Tauri 权限配置
│   └── tauri.conf.json     # Tauri 配置
└── docs/                   # 文档
    └── plans/              # 设计文档
```

## 设计文档

详见 [docs/plans/2026-07-03-action-quick-design.md](docs/plans/2026-07-03-action-quick-design.md)

## License

MIT
