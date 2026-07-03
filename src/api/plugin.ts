import { invoke } from "@tauri-apps/api/core";
import type { InstalledPlugin } from "../types/plugin";

/** 社区索引中的插件信息（version 由 GitHub Actions 定时更新） */
export interface CommunityPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  repo: string;
  path: string; // 相对于 repo 的下载路径，如 "releases/latest/download/xxx.zip"
  tags: string[];
}

/** 插件检查更新结果 */
export interface UpdateCheckResult {
  pluginId: string;
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string;
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
  /** 下载并安装插件（安装时 Rust 侧检查 minHostVersion） */
  async downloadAndInstall(url: string): Promise<void> {
    const zipPath = await invoke<string>("aq_download_plugin", { url });
    await invoke("install_plugin", { zipPath });
  },
  /** 拼接社区插件的完整下载 URL */
  buildDownloadUrl(plugin: CommunityPlugin): string {
    return `${plugin.repo}/${plugin.path}`;
  },
  /** 检查单个插件是否有更新（直接对比索引版本，不下载文件） */
  checkUpdate(plugin: CommunityPlugin, installed: InstalledPlugin | null): UpdateCheckResult {
    if (!installed) {
      return {
        pluginId: plugin.id,
        hasUpdate: true,
        currentVersion: null,
        latestVersion: plugin.version,
      };
    }
    return {
      pluginId: plugin.id,
      hasUpdate: compareVersions(plugin.version, installed.version) > 0,
      currentVersion: installed.version,
      latestVersion: plugin.version,
    };
  },
};

/** 语义化版本比较：-1 (a<b), 0 (==), 1 (a>b) */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, "").split(".").map((s) => parseInt(s.trim()) || 0);
  const va = parse(a);
  const vb = parse(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const na = va[i] || 0;
    const nb = vb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
