import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

export interface AppConfig {
  shortcut: string;
  theme: string;
  developer_mode: boolean;
  plugin_source: string;
}

export const useConfigStore = defineStore("config", () => {
  const config = ref<AppConfig>({
    shortcut: "Alt+Space",
    theme: "system",
    developer_mode: false,
    plugin_source: "",
  });
  const loaded = ref(false);

  async function load() {
    try {
      config.value = await invoke<AppConfig>("get_app_config");
      loaded.value = true;
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  async function save(newConfig: AppConfig) {
    try {
      await invoke("save_app_config", { config: newConfig });
      config.value = newConfig;
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  return { config, loaded, load, save };
});
