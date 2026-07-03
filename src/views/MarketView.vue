<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAppStore } from "../stores/appStore";
import { usePluginStore } from "../stores/pluginStore";
import { useConfigStore, type AppConfig } from "../stores/configStore";
import { useShortcut } from "../composables/useShortcut";
import { pluginApi, type CommunityPlugin } from "../api/plugin";

const appStore = useAppStore();
const pluginStore = usePluginStore();
const configStore = useConfigStore();
const { register } = useShortcut();

const message = ref("");
const installPath = ref("");
const activeTab = ref<"plugins" | "community" | "settings">("plugins");
const communityPlugins = ref<CommunityPlugin[]>([]);
const communityLoading = ref(false);
const installing = ref<string | null>(null);

const editConfig = ref<AppConfig>({
  shortcut: "Alt+Space",
  theme: "system",
  developer_mode: false,
  plugin_source: "",
});

register("escape", () => appStore.switchView("search"));

const themes = [
  { id: "violet-dark", label: "紫罗兰", mode: "dark", color: "#8b5cf6" },
  { id: "violet-light", label: "紫罗兰", mode: "light", color: "#7c5cfc" },
  { id: "amber-dark", label: "琥珀", mode: "dark", color: "#f59e0b" },
  { id: "amber-light", label: "琥珀", mode: "light", color: "#d97706" },
  { id: "indigo-dark", label: "靛蓝", mode: "dark", color: "#6366f1" },
  { id: "indigo-light", label: "靛蓝", mode: "light", color: "#4f46e5" },
];

const colorGroups = ["紫罗兰", "琥珀", "靛蓝"];

function switchColorGroup(group: string) {
  const currentMode = appStore.theme.endsWith("-light") ? "light" : "dark";
  const match = themes.find(t => t.label === group && t.mode === currentMode);
  if (match) appStore.setTheme(match.id);
}

function switchMode(mode: string) {
  const currentGroup = themes.find(t => t.id === appStore.theme)?.label || "紫罗兰";
  const match = themes.find(t => t.label === currentGroup && t.mode === mode);
  if (match) appStore.setTheme(match.id);
}

onMounted(async () => {
  await Promise.all([
    pluginStore.loadPlugins(),
    configStore.load(),
  ]);
  editConfig.value = { ...configStore.config };
});

async function refresh() {
  await pluginStore.loadPlugins();
  message.value = `已加载 ${pluginStore.plugins.length} 个插件`;
}

async function installFromDir() {
  if (!installPath.value.trim()) {
    message.value = "请输入插件目录路径";
    return;
  }
  try {
    await pluginApi.installFromDir(installPath.value.trim());
    await pluginStore.loadPlugins();
    message.value = "安装成功";
    installPath.value = "";
  } catch (e) {
    message.value = "安装失败: " + e;
  }
}

async function uninstall(id: string) {
  try {
    await pluginApi.uninstall(id);
    await pluginStore.loadPlugins();
    message.value = "已卸载: " + id;
  } catch (e) {
    message.value = "卸载失败: " + e;
  }
}

async function loadCommunity() {
  communityLoading.value = true;
  try {
    const url = configStore.config.plugin_source ||
      "https://raw.githubusercontent.com/action-quick/plugins/main/index.json";
    communityPlugins.value = await pluginApi.fetchCommunityIndex(url);
  } catch (e) {
    message.value = "加载社区索引失败: " + e;
  } finally {
    communityLoading.value = false;
  }
}

async function installFromCommunity(plugin: CommunityPlugin) {
  installing.value = plugin.id;
  try {
    await pluginApi.downloadAndInstall(plugin.download);
    await pluginStore.loadPlugins();
    message.value = "安装成功: " + plugin.name;
  } catch (e) {
    message.value = "安装失败: " + e;
  } finally {
    installing.value = null;
  }
}

function isInstalled(pluginId: string): boolean {
  return pluginStore.plugins.some((p) => p.id === pluginId);
}

async function saveConfig() {
  await configStore.save(editConfig.value);
  message.value = "配置已保存";
}
</script>

<template>
  <div class="market-view">
    <div class="market-header">
      <button class="back-btn" @click="appStore.switchView('search')">← 返回</button>
      <span class="title">插件管理</span>
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'plugins' }" @click="activeTab = 'plugins'">已安装</button>
        <button class="tab" :class="{ active: activeTab === 'community' }" @click="activeTab = 'community'; loadCommunity()">社区</button>
        <button class="tab" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">设置</button>
      </div>
    </div>

    <div class="market-body">
      <section class="section">
        <h2 class="section-title">主题</h2>
        <div class="theme-selector">
          <div class="theme-colors">
            <button
              v-for="group in colorGroups"
              :key="group"
              class="theme-pill"
              :class="{ active: themes.find(t => t.id === appStore.theme)?.label === group }"
              @click="switchColorGroup(group)"
            >
              <span
                class="theme-dot"
                :style="{ background: themes.find(t => t.label === group && t.mode === (appStore.theme.endsWith('-light') ? 'light' : 'dark'))?.color }"
              ></span>
              {{ group }}
            </button>
          </div>
          <div class="theme-modes">
            <button
              class="mode-pill"
              :class="{ active: appStore.theme.endsWith('-dark') }"
              @click="switchMode('dark')"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              暗色
            </button>
            <button
              class="mode-pill"
              :class="{ active: appStore.theme.endsWith('-light') }"
              @click="switchMode('light')"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              亮色
            </button>
          </div>
        </div>
      </section>
      <!-- 已安装 -->
      <template v-if="activeTab === 'plugins'">
        <div class="install-section">
          <h3>从目录安装（开发测试）</h3>
          <div class="install-row">
            <input v-model="installPath" placeholder="输入插件目录路径" class="path-input" />
            <button @click="installFromDir">安装</button>
          </div>
          <div class="install-row" style="margin-top: 8px;">
            <button class="refresh-btn" @click="refresh">刷新列表</button>
          </div>
          <p v-if="message" class="message">{{ message }}</p>
        </div>

        <div class="plugin-list-section">
          <h3>已安装插件 ({{ pluginStore.plugins.length }})</h3>
          <div v-if="pluginStore.plugins.length === 0" class="empty">暂无已安装插件</div>
          <div v-else class="plugin-list">
            <div v-for="p in pluginStore.plugins" :key="p.id" class="plugin-card">
              <div class="plugin-info">
                <div class="plugin-name">{{ p.name }} <span class="version">v{{ p.version }}</span></div>
                <div class="plugin-desc">{{ p.description }}</div>
                <div class="plugin-perms">权限: {{ p.permissions.join(", ") || "无" }}</div>
              </div>
              <button class="uninstall-btn" @click="uninstall(p.id)">卸载</button>
            </div>
          </div>
        </div>
      </template>

      <!-- 社区 -->
      <template v-if="activeTab === 'community'">
        <div class="community-section">
          <div class="community-header">
            <h3>社区插件</h3>
            <button class="refresh-btn" @click="loadCommunity" :disabled="communityLoading">
              {{ communityLoading ? "加载中..." : "刷新" }}
            </button>
          </div>
          <div v-if="communityPlugins.length === 0 && !communityLoading" class="empty">
            暂无社区插件，请检查插件源配置
          </div>
          <div v-else class="plugin-list">
            <div v-for="p in communityPlugins" :key="p.id" class="plugin-card">
              <div class="plugin-info">
                <div class="plugin-name">{{ p.name }} <span class="version">v{{ p.version }}</span></div>
                <div class="plugin-desc">{{ p.description }}</div>
                <div class="plugin-perms">{{ p.tags.join(" · ") }}</div>
              </div>
              <button
                v-if="isInstalled(p.id)"
                class="installed-btn"
                disabled
              >已安装</button>
              <button
                v-else
                class="install-btn"
                @click="installFromCommunity(p)"
                :disabled="installing === p.id"
              >{{ installing === p.id ? "安装中..." : "安装" }}</button>
            </div>
          </div>
          <p v-if="message" class="message">{{ message }}</p>
        </div>
      </template>

      <!-- 设置 -->
      <template v-if="activeTab === 'settings'">
        <div class="settings-section">
          <h3>通用设置</h3>
          <div class="setting-row">
            <label>快捷键</label>
            <input v-model="editConfig.shortcut" class="setting-input" />
          </div>
          <div class="setting-row">
            <label>主题</label>
            <select v-model="editConfig.theme" class="setting-input">
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div class="setting-row">
            <label>开发者模式</label>
            <input type="checkbox" v-model="editConfig.developer_mode" />
          </div>
          <div class="setting-row">
            <label>插件源 URL</label>
            <input v-model="editConfig.plugin_source" class="setting-input" />
          </div>
          <button class="save-btn" @click="saveConfig">保存配置</button>
          <p v-if="message" class="message">{{ message }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.market-view { height: 100%; background: var(--bg-surface); border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); overflow: hidden; display: flex; flex-direction: column; }
.market-header { display: flex; align-items: center; padding: 0 16px; height: 48px; border-bottom: 1px solid var(--border); gap: 12px; }
.back-btn, .refresh-btn { background: none; border: none; color: var(--tx-secondary); cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px; font-family: inherit; }
.back-btn:hover, .refresh-btn:hover { background: var(--bg-hover); color: var(--tx-primary); }
.title { font-size: 14px; font-weight: 500; flex: 1; }
.tabs { display: flex; gap: 4px; }
.tab { background: none; border: none; color: var(--tx-secondary); cursor: pointer; font-size: 13px; padding: 4px 12px; border-radius: 4px; font-family: inherit; }
.tab.active { background: var(--accent-bg); color: var(--accent); }
.tab:hover { background: var(--bg-hover); }
.market-body { flex: 1; overflow-y: auto; padding: 16px; }
.install-section, .community-section, .settings-section { margin-bottom: 24px; }
h3 { font-size: 14px; margin-bottom: 8px; color: var(--tx-primary); }
.install-row { display: flex; gap: 8px; }
.path-input, .setting-input { flex: 1; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--tx-primary); font-size: 13px; font-family: inherit; outline: none; }
.path-input:focus, .setting-input:focus { border-color: var(--accent); }
.install-row button { background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: inherit; }
.install-row button:hover { opacity: 0.9; }
.message { margin-top: 8px; font-size: 12px; color: var(--tx-secondary); }
.empty { color: var(--tx-secondary); font-size: 13px; padding: 16px 0; }
.plugin-list { display: flex; flex-direction: column; gap: 8px; }
.plugin-card { display: flex; align-items: center; padding: 12px; background: var(--bg-hover); border-radius: 8px; gap: 12px; }
.plugin-info { flex: 1; min-width: 0; }
.plugin-name { font-size: 14px; font-weight: 500; }
.version { font-size: 11px; color: var(--tx-secondary); font-weight: normal; }
.plugin-desc { font-size: 12px; color: var(--tx-secondary); margin-top: 2px; }
.plugin-perms { font-size: 11px; color: var(--accent); margin-top: 4px; }
.uninstall-btn { background: rgba(255,80,80,0.2); color: #ff6464; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; }
.uninstall-btn:hover { background: rgba(255,80,80,0.3); }
.install-btn { background: var(--accent); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; }
.install-btn:hover { opacity: 0.9; }
.install-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.installed-btn { background: rgba(100,200,100,0.2); color: #64c864; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-family: inherit; }
.community-header { display: flex; align-items: center; justify-content: space-between; }
.setting-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.setting-row label { font-size: 13px; color: var(--tx-primary); width: 120px; flex-shrink: 0; }
.setting-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--accent); }
.save-btn { background: var(--accent); color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: inherit; margin-top: 8px; }
.save-btn:hover { opacity: 0.9; }

.section { margin-bottom: 20px; }
.section-title { font-size: 14px; font-weight: 500; margin-bottom: 10px; color: var(--tx-primary); }

/* Theme selector */
.theme-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.theme-colors {
  display: flex;
  gap: 6px;
}

.theme-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  color: var(--tx-secondary);
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.theme-pill:hover {
  border-color: var(--accent);
  color: var(--tx-primary);
}

.theme-pill.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent-text);
}

.theme-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.theme-modes {
  display: flex;
  gap: 4px;
  background: var(--bg-raised);
  border-radius: 20px;
  padding: 3px;
  border: 1px solid var(--border);
}

.mode-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--tx-muted);
  padding: 4px 10px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.mode-pill.active {
  background: var(--bg-surface);
  color: var(--tx-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.mode-pill:hover:not(.active) {
  color: var(--tx-secondary);
}
</style>
