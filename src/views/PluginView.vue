<!-- src/views/PluginView.vue -->
<template>
  <div class="plugin-view">
    <div class="plugin-header">
      <button class="back-btn" @click="appStore.backToSearch()">
        ← 返回
      </button>
      <span class="plugin-title">{{ currentPlugin?.name || '加载中...' }}</span>
    </div>
    <PluginContainer
      v-if="appStore.selectedPluginId"
      :plugin-id="appStore.selectedPluginId"
      :params="{ query: appStore.searchQuery, contextText: appStore.contextText }"
      @load="onPluginLoad"
      @error="onPluginError"
      @close="appStore.backToSearch()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
</style>
