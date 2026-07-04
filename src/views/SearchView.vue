<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useAppStore } from "../stores/appStore";
import { usePluginStore } from "../stores/pluginStore";
import { useStatsStore } from "../stores/statsStore";
import { useSearch } from "../composables/useSearch";
import { useShortcut } from "../composables/useShortcut";
import { hideWindow } from "../api/window";
import { initAppSearch } from "../search/apps";
import SearchInput from "../components/SearchInput.vue";
import ResultList from "../components/ResultList.vue";
import ContextBar from "../components/ContextBar.vue";
import type { SearchResultItem } from "../types/plugin";

const appStore = useAppStore();
const pluginStore = usePluginStore();
const statsStore = useStatsStore();
const { results } = useSearch();
const { register } = useShortcut();

const resultListRef = ref<InstanceType<typeof ResultList> | null>(null);

function onSelect(item: SearchResultItem) {
  if (item.type === "plugin") {
    statsStore.recordUse(item.id);
    appStore.selectPlugin(item.id);
  } else if (item.type === "url") {
    // Open URL via Tauri opener plugin
    const url = item.description; // fullUrl stored in description
    if (url) {
      window.open(url, "_blank");
    }
  } else if (item.type === "app") {
    // Launch desktop app
    if (item.path) {
      // Use Tauri shell or process command to launch
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("hide_window");
      });
      // For now, apps are informational - will add launch in future
    }
  } else if (item.type === "calculator") {
    // Copy result to clipboard
    import("@tauri-apps/api/core").then(({ invoke }) => {
      navigator.clipboard.writeText(item.name).catch(() => {});
    });
  }
}

function onWindowKeyDown(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    resultListRef.value?.moveDown();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    resultListRef.value?.moveUp();
  } else if (e.key === "Enter") {
    e.preventDefault();
    resultListRef.value?.selectCurrent();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onWindowKeyDown);
  register("escape", () => hideWindow());
  await pluginStore.loadPlugins();
  // Initialize background app scanning (non-blocking)
  initAppSearch();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onWindowKeyDown);
});
</script>

<template>
  <div class="search-view">
    <div class="search-header">
      <SearchInput />
      <button class="settings-btn" @click="appStore.switchView('market')" title="插件管理">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>
    </div>
    <ContextBar />
    <ResultList
      ref="resultListRef"
      :items="results"
      @select="onSelect"
    />
  </div>
</template>

<style scoped>
.search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}

.settings-btn {
  background: none;
  border: none;
  color: var(--tx-muted);
  cursor: pointer;
  padding: 0 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast);
}

.settings-btn:hover {
  color: var(--tx-secondary);
}
</style>
