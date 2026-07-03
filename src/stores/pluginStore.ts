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

  return {
    plugins,
    loading,
    loadPlugins,
    installPlugin,
    uninstallPlugin,
  };
});
