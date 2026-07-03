<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
import { useAppStore } from "../stores/appStore";

const appStore = useAppStore();
const inputRef = ref<HTMLInputElement | null>(null);

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  appStore.setQuery(target.value);
}

function focusInput() {
  nextTick(() => {
    inputRef.value?.focus();
  });
}

onMounted(() => {
  focusInput();
});

defineExpose({ focusInput });
</script>

<template>
  <div class="search-input-wrapper">
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
    <input
      ref="inputRef"
      :value="appStore.searchQuery"
      @input="onInput"
      type="text"
      placeholder="搜索插件或输入关键词..."
      class="search-input"
      spellcheck="false"
    />
  </div>
</template>

<style scoped>
.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 52px;
  gap: 12px;
  flex: 1;
}

.search-icon {
  color: var(--tx-muted);
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.search-input-wrapper:focus-within .search-icon {
  color: var(--accent-text);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--tx-primary);
  font-size: 17px;
  font-family: inherit;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.search-input::placeholder {
  color: var(--tx-muted);
  font-weight: 400;
}
</style>
