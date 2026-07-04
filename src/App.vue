<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "./stores/appStore";
import { usePluginStore } from "./stores/pluginStore";
import SearchView from "./views/SearchView.vue";
import PluginView from "./views/PluginView.vue";
import MarketView from "./views/MarketView.vue";

const appStore = useAppStore();
const pluginStore = usePluginStore();

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

let unlisten: UnlistenFn | null = null;

onMounted(async () => {
  unlisten = await listen<string | null>("window-shown", (event) => {
    const contextText = event.payload;
    if (appStore.currentView === "search") {
      appStore.setQuery("");
      appStore.setContext(contextText || null);
    }
  });

  // Dev mode: auto-navigate to dev plugin if running with --dev-plugin
  try {
    const devInfo = await invoke<DevPluginInfo | null>("get_dev_mode");
    if (devInfo) {
      pluginStore.injectDevPlugin(devInfo);
      appStore.selectPlugin(devInfo.id);
    }
  } catch (e) {
    console.error("Dev mode check failed:", e);
  }
});

onUnmounted(() => {
  unlisten?.();
});

watch(
  () => appStore.theme,
  (val) => {
    document.documentElement.dataset.theme = val;
  },
  { immediate: true }
);
</script>

<template>
  <div class="app-root">
    <SearchView v-if="appStore.currentView === 'search'" />
    <PluginView v-else-if="appStore.currentView === 'plugin'" />
    <MarketView v-else-if="appStore.currentView === 'market'" />
  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  width: 100vw;
  padding: 0;
}
</style>
