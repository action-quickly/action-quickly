import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { InstalledPlugin } from "../types/plugin";

export const usePluginStore = defineStore("plugin", () => {
  const plugins = ref<InstalledPlugin[]>([]);
  const loading = ref(false);

  async function loadPlugins() {
    loading.value = true;
    try {
      plugins.value = await invoke<InstalledPlugin[]>("list_plugins");
    } catch (e) {
      console.error("Failed to load plugins:", e);
      plugins.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function installPlugin(zipPath: string) {
    await invoke("install_plugin", { zipPath });
    await loadPlugins();
  }

  async function uninstallPlugin(pluginId: string) {
    await invoke("uninstall_plugin", { pluginId });
    await loadPlugins();
  }

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
});
