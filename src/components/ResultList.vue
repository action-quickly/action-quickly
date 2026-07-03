<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { SearchResultItem } from "../types/plugin";
import ResultItem from "./ResultItem.vue";

const props = defineProps<{
  items: SearchResultItem[];
}>();

const emit = defineEmits<{
  select: [item: SearchResultItem];
}>();

const selectedIndex = ref(0);

function selectItem(item: SearchResultItem) {
  emit("select", item);
}

function moveUp() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
    scrollToSelected();
  }
}

function moveDown() {
  if (selectedIndex.value < props.items.length - 1) {
    selectedIndex.value++;
    scrollToSelected();
  }
}

function scrollToSelected() {
  nextTick(() => {
    const el = document.querySelector(".result-item.selected") as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  });
}

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0;
  }
);

defineExpose({ moveUp, moveDown, selectCurrent: () => {
  if (props.items[selectedIndex.value]) {
    selectItem(props.items[selectedIndex.value]);
  }
}});
</script>

<template>
  <div class="result-list">
    <div v-if="items.length === 0" class="empty-state">
      <svg class="empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <p class="empty-title">输入关键词，快速启动</p>
      <p class="empty-hint">按 Esc 关闭窗口 · 方向键切换选项</p>
    </div>
    <div v-else class="result-items">
      <ResultItem
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :index="index"
        :selected="index === selectedIndex"
        @select="selectItem(item)"
      />
    </div>
  </div>
</template>

<style scoped>
.result-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 0 32px;
  text-align: center;
}

.empty-icon {
  color: var(--tx-muted);
  opacity: 0.5;
}

.empty-title {
  color: var(--tx-secondary);
  font-size: 14px;
  margin: 0;
}

.empty-hint {
  color: var(--tx-muted);
  font-size: 12px;
  margin: 0;
}
</style>
