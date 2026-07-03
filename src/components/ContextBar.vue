<script setup lang="ts">
import { useAppStore } from "../stores/appStore";

const appStore = useAppStore();
</script>

<template>
  <div v-if="appStore.contextText" class="context-bar">
    <svg class="context-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span class="context-label">选中:</span>
    <span class="context-text">{{ appStore.contextText }}</span>
    <button class="context-clear" @click="appStore.setContext(null)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.context-bar {
  display: flex;
  align-items: center;
  padding: 7px 16px;
  gap: 8px;
  background: var(--accent-bg);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  min-height: 34px;
}

.context-icon {
  color: var(--accent-text);
  flex-shrink: 0;
}

.context-label {
  color: var(--accent-text);
  font-weight: 500;
  flex-shrink: 0;
  font-size: 12px;
}

.context-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--tx-primary);
  font-size: 12px;
}

.context-clear {
  background: none;
  border: none;
  color: var(--tx-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.context-clear:hover {
  background: var(--bg-hover);
  color: var(--tx-secondary);
}
</style>
