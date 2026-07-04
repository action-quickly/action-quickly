<script setup lang="ts">
import { computed } from "vue";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SearchResultItem } from "../types/plugin";

const props = defineProps<{
  item: SearchResultItem;
  selected: boolean;
  index: number;
}>();

const emit = defineEmits<{
  select: [];
}>();

const iconUrl = computed(() => {
  if (!props.item.icon) return null;
  if (props.item.icon.startsWith("data:") || props.item.icon.startsWith("http")) {
    return props.item.icon;
  }
  if (props.item.path) {
    const basePath = props.item.path.replace(/\\/g, "/");
    const fullPath = `${basePath}/${props.item.icon}`;
    return convertFileSrc(fullPath);
  }
  return null;
});

function onImgError(e: Event) {
  const target = e.target as HTMLImageElement;
  target.style.display = "none";
}
</script>

<template>
  <div
    class="result-item"
    :class="{ selected }"
    @click="emit('select')"
    :data-index="index"
  >
    <div class="item-icon">
      <img v-if="iconUrl" :src="iconUrl" :alt="item.name" @error="onImgError" />
      <span v-else class="icon-placeholder">{{ item.name.charAt(0) }}</span>
    </div>
    <div class="item-content">
      <div class="item-name">{{ item.name }}</div>
      <div class="item-desc">{{ item.description }}</div>
    </div>
    <div class="item-meta">
      <div v-if="item.type === 'calculator'" class="item-badge calculator">计算</div>
      <div v-if="item.type === 'url'" class="item-badge url">网址</div>
      <div v-if="item.type === 'app'" class="item-badge app">应用</div>
      <div v-if="item.contextLabel" class="item-badge context">{{ item.contextLabel }}</div>
    </div>
  </div>
</template>

<style scoped>
.result-item {
  display: flex;
  align-items: center;
  padding: 9px 14px 9px 13px;
  gap: 12px;
  cursor: pointer;
  margin: 0 8px;
  border-radius: var(--radius-sm);
  border-left: 3px solid transparent;
  transition: background var(--transition-fast), border-color var(--transition-fast);
  margin-bottom: 6px;
}

.result-item.selected {
  background: var(--accent-bg);
  border-left-color: var(--accent);
}

.result-item:hover {
  background: var(--bg-hover);
}

.result-item.selected:hover {
  background: var(--accent-bg);
}

.item-icon {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: var(--bg-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  transition: transform var(--transition-fast);
}

.result-item.selected .item-icon {
  transform: scale(1.06);
}

.item-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent-text);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--tx-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-desc {
  font-size: 12px;
  color: var(--tx-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.item-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.item-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 3px;
  font-weight: 500;
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

.item-badge.system {
  background: var(--accent-bg);
  color: var(--accent-text);
}

.item-badge.calculator {
  background: var(--accent-bg);
  color: var(--accent-text);
}

.item-badge.url {
  background: rgba(128, 128, 128, 0.12);
  color: var(--tx-secondary);
}

.item-badge.app {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.item-badge.context {
  background: rgba(128, 128, 128, 0.08);
  color: var(--tx-secondary);
}
</style>
