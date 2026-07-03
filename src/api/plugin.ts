import { invoke } from "@tauri-apps/api/core";
import type { InstalledPlugin } from "../types/plugin";

export interface CommunityPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  repo: string;
  download: string;
  tags: string[];
}

export const pluginApi = {
  async list(): Promise<InstalledPlugin[]> {
    return invoke<InstalledPlugin[]>("list_plugins");
  },
  async install(zipPath: string): Promise<void> {
    await invoke("install_plugin", { zipPath });
  },
  async installFromDir(sourceDir: string): Promise<void> {
    await invoke("install_plugin_from_dir", { sourceDir });
  },
  async uninstall(pluginId: string): Promise<void> {
    await invoke("uninstall_plugin", { pluginId });
  },
  async getUrl(pluginId: string): Promise<string> {
    return invoke<string>("get_plugin_url", { pluginId });
  },
  /** 从社区索引获取插件列表 */
  async fetchCommunityIndex(sourceUrl: string): Promise<CommunityPlugin[]> {
    const resp = await fetch(sourceUrl);
    return resp.json();
  },
  /** 下载 zip 到临时目录并安装 */
  async downloadAndInstall(url: string): Promise<void> {
    // 通过 Rust 侧下载
    const zipPath = await invoke<string>("aq_download_plugin", { url });
    await invoke("install_plugin", { zipPath });
  },
};
