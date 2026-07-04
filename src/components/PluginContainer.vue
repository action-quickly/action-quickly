<template>
  <div class="plugin-container" :data-plugin-id="pluginId">
    <PluginErrorBoundary
      :error="error"
      @retry="loadPlugin"
      @close="handleClose"
    >
      <div v-if="loading" class="plugin-loading">
        <div class="loading-spinner"></div>
        <span>加载插件中...</span>
      </div>
      <div v-else ref="pluginRoot" class="plugin-root" />
    </PluginErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import PluginErrorBoundary from './PluginErrorBoundary.vue';
import { LightIsolation } from '../plugins/isolation/light';
import { injectGlobalAPI, removeGlobalAPI } from '../plugins/bridge/global-api';
import { HTMLPluginRenderer } from '../plugins/renderer/html-renderer';
import type { IsolatedContainer } from '../plugins/isolation/types';
import type { InstalledPlugin } from '../types/plugin';
import type { PluginRenderer } from '../plugins/renderer/types';

interface ErrorInfo {
  message: string;
  detail?: string;
  recoverable: boolean;
}

const props = defineProps<{
  pluginId: string;
  isolation?: 'light' | 'strict' | 'worker';
  params?: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'load'): void;
  (e: 'error', error: Error): void;
  (e: 'close'): void;
}>();

const pluginRoot = ref<HTMLElement>();
const loading = ref(true);
const error = ref<ErrorInfo | null>(null);

let container: IsolatedContainer | null = null;
let renderer: PluginRenderer | null = null;

async function loadPlugin() {
  try {
    loading.value = true;
    error.value = null;

    const plugin = await invoke<InstalledPlugin>('get_plugin', { pluginId: props.pluginId });

    const isolation = new LightIsolation();
    container = isolation.createContainer(pluginRoot.value!);

    injectGlobalAPI(container, props.pluginId);

    renderer = new HTMLPluginRenderer();

    await renderer.render(container, plugin, {
      pluginId: props.pluginId,
      invoke: async (cmd: string, args?: any) => {
        return invoke(cmd, { ...args, pluginId: props.pluginId });
      },
      on: (event: string, callback: (data: any) => void) => {
        container?.addEventListener(`aq:${event}`, ((e: CustomEvent) => callback(e.detail)) as EventListener);
      },
      emit: (event: string, data?: any) => {
        const host = container?.root as ShadowRoot;
        host?.host?.dispatchEvent(new CustomEvent(`aq:${event}`, { detail: data }));
      },
    });

    loading.value = false;
    emit('load');
  } catch (err) {
    loading.value = false;
    error.value = {
      message: `插件加载失败: ${props.pluginId}`,
      detail: String(err),
      recoverable: true,
    };
    emit('error', err as Error);
  }
}

function handleClose() {
  emit('close');
}

watch(() => props.params, (newParams) => {
  if (container) {
    const host = container.root as ShadowRoot;
    host?.host?.dispatchEvent(new CustomEvent('aq:params-change', {
      detail: newParams,
    }));
  }
}, { deep: true });

onMounted(() => {
  loadPlugin();
});

onUnmounted(() => {
  renderer?.destroy?.();
  if (container) {
    removeGlobalAPI(container);
    container.destroy();
  }
});
</script>

<style scoped>
.plugin-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.plugin-root {
  width: 100%;
  height: 100%;
}

.plugin-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
