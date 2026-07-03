<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "./stores/appStore";
import SearchView from "./views/SearchView.vue";
import PluginView from "./views/PluginView.vue";
import MarketView from "./views/MarketView.vue";

const appStore = useAppStore();

let unlisten: UnlistenFn | null = null;

onMounted(async () => {
  unlisten = await listen<string | null>("window-shown", (event) => {
    const contextText = event.payload;
    if (appStore.currentView === "search") {
      appStore.setQuery("");
      appStore.setContext(contextText || null);
    }
  });
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
  padding: 8px;
}
</style>
