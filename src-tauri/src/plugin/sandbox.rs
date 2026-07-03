// sandbox.rs — 独立窗口方案已废弃，改为 iframe 方案
// 插件在主窗口的 iframe 中运行，通过 postMessage 与主窗口通信
// 权限校验基于 plugin_id 参数，在 IPC 命令中直接检查
