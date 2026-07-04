<!-- src/views/PluginView.vue -->
<template>
  <div class="plugin-view">
    <div class="plugin-header">
      <button class="back-btn" @click="appStore.backToSearch()">
        ← 返回
      </button>
      <span class="plugin-title">{{ currentPlugin?.name || '加载中...' }}</span>
      <button v-if="isDevMode" class="refresh-btn" @click="refresh" title="重新加载插件">
        ↻
      </button>
    </div>
    <PluginContainer
      v-if="appStore.selectedPluginId"
      :key="refreshKey"
      :plugin-id="appStore.selectedPluginId"
      :params="{ query: appStore.searchQuery, contextText: appStore.contextText }"
      @load="onPluginLoad"
      @error="onPluginError"
      @close="appStore.backToSearch()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import { usePluginStore } from '../stores/pluginStore';
import PluginContainer from '../components/PluginContainer.vue';

const appStore = useAppStore();
const pluginStore = usePluginStore();

const currentPlugin = computed(() => {
  if (!appStore.selectedPluginId) return null;
  return pluginStore.plugins.find(p => p.id === appStore.selectedPluginId);
});

function onPluginLoad() {
  console.log('Plugin loaded:', appStore.selectedPluginId);
}

function onPluginError(error: Error) {
  console.error('Plugin error:', error);
}

const refreshKey = ref(0);
const isDevMode = ref(false);

async function checkDevMode() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const devInfo = await invoke<{ id: string } | null>('get_dev_mode');
    isDevMode.value = !!devInfo;
  } catch {
    isDevMode.value = false;
  }
}

function refresh() {
  refreshKey.value++;
}

onMounted(() => {
  checkDevMode();
});
</script>

<style scoped>
.plugin-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plugin-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  padding: 4px 8px;
}

.back-btn:hover {
  color: #333;
}

.plugin-title {
  margin-left: 16px;
  font-weight: 500;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #999;
  padding: 4px 8px;
  border-radius: 4px;
  margin-left: auto;
  transition: color .15s;
}
.refresh-btn:hover {
  color: #333;
}
</style>
