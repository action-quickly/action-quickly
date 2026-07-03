<script setup lang="ts">
import { useAppStore } from "../stores/appStore";
import { useShortcut } from "../composables/useShortcut";
import PluginFrame from "../components/PluginFrame.vue";

const appStore = useAppStore();
const { register } = useShortcut();

register("escape", () => appStore.backToSearch());
</script>

<template>
  <div class="plugin-view">
    <PluginFrame />
  </div>
</template>

<style scoped>
.plugin-view {
  height: 100%;
  background: var(--bg-surface);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
</style>
