/**
 * ActionQuick Plugin SDK
 * 插件通过 postMessage 与主窗口通信，主窗口代理所有 Tauri IPC 调用
 */

/** 插件运行时参数 */
export interface PluginParams {
  pluginId: string;
  query: string | null;
  contextText: string | null;
}

// IPC 调用计数器
let ipcId = 0;
const pendingCalls: Record<number, { resolve: (v: any) => void; reject: (e: any) => void }> = {};

/** 通过 postMessage 调用主窗口代理的 Tauri IPC */
function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++ipcId;
    pendingCalls[id] = { resolve, reject };
    window.parent.postMessage({
      source: "action-quick-plugin",
      id,
      cmd,
      args: args || {},
    }, "*");
  });
}

// 监听主窗口的消息
if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "action-quick-host") return;

    // IPC 响应
    if (data.id && pendingCalls[data.id]) {
      const call = pendingCalls[data.id];
      delete pendingCalls[data.id];
      if (data.error) {
        call.reject(data.error);
      } else {
        call.resolve(data.result);
      }
      return;
    }

    // 接收插件参数
    if (data.type === "plugin-params") {
      params = data.params;
      window.dispatchEvent(new CustomEvent("aq-params-ready", { detail: params }));
    }

    // 主窗口请求注入桥接脚本（跨域时）
    if (data.type === "aq-init-bridge" && data.script) {
      try { eval(data.script); } catch (e) {}
    }
  });
}

/** 当前插件参数 */
let params: PluginParams | null = null;

/** 获取插件参数（监听事件方式） */
export function onParamsReady(callback: (params: PluginParams) => void): void {
  if (params) {
    callback(params);
  }
  window.addEventListener("aq-params-ready", (event: any) => {
    callback(event.detail);
  });
}

/** 剪贴板 API */
export const clipboard = {
  async write(text: string): Promise<void> {
    await invoke("aq_clipboard_write", { text });
  },
  async read(): Promise<string> {
    return invoke<string>("aq_clipboard_read");
  },
};

/** 系统通知 API */
export const notification = {
  async show(title: string, body?: string): Promise<void> {
    await invoke("aq_notification", { title, body });
  },
};

/** 文件读写 API */
export const fs = {
  async read(path: string): Promise<string> {
    return invoke<string>("aq_fs_read", { path });
  },
  async write(path: string, content: string): Promise<void> {
    await invoke("aq_fs_write", { path, content });
  },
};

/** HTTP 请求 API */
export const http = {
  async get(url: string): Promise<string> {
    return invoke<string>("aq_http_get", { url });
  },
  async post(url: string, body: string): Promise<string> {
    return invoke<string>("aq_http_post", { url, body });
  },
};

/** KV 存储 API */
export const storage = {
  async get(key: string): Promise<any> {
    const result = await invoke<any | null>("aq_storage_get", { key });
    return result;
  },
  async set(key: string, value: any): Promise<void> {
    await invoke("aq_storage_set", { key, value });
  },
  async delete(key: string): Promise<void> {
    await invoke("aq_storage_delete", { key });
  },
  async keys(): Promise<string[]> {
    return invoke<string[]>("aq_storage_keys");
  },
};

export default {
  onParamsReady,
  clipboard,
  notification,
  fs,
  http,
  storage,
};
