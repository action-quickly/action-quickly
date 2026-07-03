<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";

const appStore = useAppStore();
const pluginUrl = ref<string>("");
const loading = ref(true);
const iframeRef = ref<HTMLIFrameElement | null>(null);

async function onMessage(event: MessageEvent) {
  if (!event.data || event.data.source !== "action-quick-plugin") return;

  if (event.data.type === "key-escape") {
    appStore.backToSearch();
    return;
  }

  const { id, cmd, args } = event.data;
  if (!cmd) return;

  try {
    const result = await invoke(cmd, { ...args, pluginId: appStore.selectedPluginId });
    iframeRef.value?.contentWindow?.postMessage(
      { source: "action-quick-host", id, result },
      "*"
    );
  } catch (error) {
    iframeRef.value?.contentWindow?.postMessage(
      { source: "action-quick-host", id, error: String(error) },
      "*"
    );
  }
}

async function loadPlugin() {
  if (!appStore.selectedPluginId) return;
  loading.value = true;
  try {
    pluginUrl.value = await invoke<string>("get_plugin_url", {
      pluginId: appStore.selectedPluginId,
    });
  } catch (e) {
    console.error("Failed to get plugin URL:", e);
  }
}

watch(() => appStore.selectedPluginId, loadPlugin, { immediate: true });

onMounted(() => {
  window.addEventListener("message", onMessage);
});

onUnmounted(() => {
  window.removeEventListener("message", onMessage);
});

const PLUGIN_INIT_SCRIPT = `
if (!window.__AQ_BRIDGE__) {
  window.__AQ_BRIDGE__ = true;
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      window.parent.postMessage({ source: 'action-quick-plugin', type: 'key-escape' }, '*');
    }
  });
}
`;

function onIframeLoad() {
  loading.value = false;

  const iframe = iframeRef.value;
  if (!iframe?.contentWindow) return;

  iframe.contentWindow.postMessage(
    {
      source: "action-quick-host",
      type: "plugin-params",
      params: {
        pluginId: appStore.selectedPluginId,
        query: appStore.searchQuery || null,
        contextText: appStore.contextText || null,
      },
    },
    "*"
  );

  try {
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc) {
      const script = iframeDoc.createElement("script");
      script.textContent = PLUGIN_INIT_SCRIPT;
      iframeDoc.head?.appendChild(script);
      return;
    }
  } catch {
  }

  iframe.contentWindow.postMessage(
    {
      source: "action-quick-host",
      type: "aq-init-bridge",
      script: PLUGIN_INIT_SCRIPT,
    },
    "*"
  );
}
</script>

<template>
  <div class="plugin-frame">
    <div class="plugin-header">
      <button class="back-btn" @click="appStore.backToSearch()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        返回
      </button>
      <span class="plugin-title">{{ appStore.selectedPluginId }}</span>
    </div>
    <div class="plugin-content">
      <div v-if="loading" class="loading">
        <span class="loading-indicator"></span>
        加载中...
      </div>
      <iframe
        v-if="pluginUrl"
        ref="iframeRef"
        :src="pluginUrl"
        class="plugin-iframe"
        sandbox="allow-scripts allow-same-origin"
        @load="onIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.plugin-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.plugin-header {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 44px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--tx-secondary);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--tx-primary);
}

.plugin-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--tx-primary);
  flex: 1;
}

.plugin-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tx-secondary);
  font-size: 14px;
}

.loading-indicator {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.plugin-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-surface);
}
</style>
