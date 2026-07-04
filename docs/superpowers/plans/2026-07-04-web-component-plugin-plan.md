# Web Component 插件渲染系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将插件渲染系统从 iframe 迁移到 Web Component，实现分级隔离架构

**Architecture:** 采用 Hybrid 分级隔离方案（light/strict/worker），支持 HTML 和 Web Component 两种插件格式，完全向后兼容现有 iframe 插件

**Tech Stack:** Vue 3, TypeScript, Web Components API, Shadow DOM, Tauri IPC

---

## 文件结构

```
src/
├── components/
│   ├── PluginContainer.vue          # 插件容器主组件
│   ├── PluginErrorBoundary.vue      # 错误边界组件
│   └── PluginFrame.vue              # 现有 iframe 实现（保留）
├── plugins/
│   ├── isolation/
│   │   ├── types.ts                 # 隔离层类型定义
│   │   ├── light.ts                 # Light 隔离实现
│   │   ├── strict.ts                # Strict 隔离实现
│   │   └── worker.ts                # Worker 隔离实现
│   ├── bridge/
│   │   ├── types.ts                 # 桥接类型定义
│   │   ├── index.ts                 # 桥接主模块
│   │   └── global-api.ts            # 全局 API 注入
│   └── renderer/
│       ├── types.ts                 # 渲染器类型定义
│       ├── html-renderer.ts         # HTML 插件渲染器
│       └── wc-renderer.ts           # Web Component 渲染器
├── stores/
│   └── pluginStore.ts               # 插件状态管理（修改）
├── types/
│   └── plugin.d.ts                  # 插件类型定义（修改）
└── api/
    └── plugin.ts                    # 插件 API（修改）

packages/
└── sdk/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts                 # SDK 入口
        ├── bridge.ts                # 桥接通信
        ├── api/
        │   ├── clipboard.ts
        │   ├── storage.ts
        │   ├── http.ts
        │   ├── notification.ts
        │   └── ui.ts
        └── types/
            └── index.ts
```

---

## Task 1: 创建隔离层类型定义

**Files:**
- Create: `src/plugins/isolation/types.ts`

- [ ] **Step 1: 创建隔离层接口定义**

```typescript
// src/plugins/isolation/types.ts

export type IsolationLevel = 'light' | 'strict' | 'worker';

export interface IsolatedContainer {
  root: ShadowRoot | HTMLElement;
  destroy: () => void;
  getGlobalScope: () => any;
  addEventListener: (event: string, handler: EventListener) => void;
  removeEventListener: (event: string, handler: EventListener) => void;
}

export interface IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer;
}

export interface PluginRenderer {
  render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void>;
  destroy?: () => void;
}

// 前置类型引用（将在后续任务中定义）
interface InstalledPlugin {
  id: string;
  path: string;
  manifest: PluginManifest;
}

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  main: string;
  module?: string;
  permissions?: string[];
  sandbox?: {
    level?: IsolationLevel;
    allowDomAccess?: boolean;
  };
}

interface PluginBridge {
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
}
```

- [ ] **Step 2: 验证类型定义**

Run: `npx tsc --noEmit src/plugins/isolation/types.ts`
Expected: 无错误（或仅有前置类型未定义的警告）

- [ ] **Step 3: 提交**

```bash
git add src/plugins/isolation/types.ts
git commit -m "feat: add isolation layer type definitions"
```

---

## Task 2: 实现 Light 隔离层

**Files:**
- Create: `src/plugins/isolation/light.ts`
- Test: `src/plugins/isolation/__tests__/light.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
// src/plugins/isolation/__tests__/light.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LightIsolation } from '../light';

describe('LightIsolation', () => {
  let parent: HTMLElement;
  let isolation: LightIsolation;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    isolation = new LightIsolation();
  });

  it('should create Shadow DOM container', () => {
    const container = isolation.createContainer(parent);
    expect(container.root).toBeInstanceOf(ShadowRoot);
    expect(container.root.mode).toBe('open');
  });

  it('should append host element to parent', () => {
    isolation.createContainer(parent);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].classList.contains('plugin-host')).toBe(true);
  });

  it('should return window as global scope', () => {
    const container = isolation.createContainer(parent);
    expect(container.getGlobalScope()).toBe(window);
  });

  it('should remove host on destroy', () => {
    const container = isolation.createContainer(parent);
    container.destroy();
    expect(parent.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/isolation/__tests__/light.test.ts`
Expected: FAIL - Module not found

- [ ] **Step 3: 实现 LightIsolation**

```typescript
// src/plugins/isolation/light.ts
import type { IsolationLayer, IsolatedContainer } from './types';

export class LightIsolation implements IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer {
    const host = document.createElement('div');
    host.classList.add('plugin-host');
    host.style.cssText = 'width: 100%; height: 100%;';
    
    const shadow = host.attachShadow({ mode: 'open' });
    parent.appendChild(host);

    const eventListeners = new Map<string, EventListener[]>();

    return {
      root: shadow,
      destroy: () => {
        host.remove();
        eventListeners.clear();
      },
      getGlobalScope: () => window,
      addEventListener: (event: string, handler: EventListener) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event)!.push(handler);
        host.addEventListener(event, handler);
      },
      removeEventListener: (event: string, handler: EventListener) => {
        const handlers = eventListeners.get(event);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
        host.removeEventListener(event, handler);
      },
    };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/isolation/__tests__/light.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/plugins/isolation/light.ts src/plugins/isolation/__tests__/light.test.ts
git commit -m "feat: implement LightIsolation with Shadow DOM"
```

---

## Task 3: 创建桥接通信层

**Files:**
- Create: `src/plugins/bridge/types.ts`
- Create: `src/plugins/bridge/index.ts`
- Create: `src/plugins/bridge/global-api.ts`

- [ ] **Step 1: 创建桥接类型定义**

```typescript
// src/plugins/bridge/types.ts
export interface AQBridge {
  version: string;
  pluginId: string;
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
  clipboard: {
    read(): Promise<string>;
    write(text: string): Promise<void>;
  };
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };
  notification: {
    show(options: NotificationOptions): Promise<void>;
  };
  http: {
    get(url: string, options?: RequestOptions): Promise<Response>;
    post(url: string, body?: any, options?: RequestOptions): Promise<Response>;
  };
  ui: {
    showToast(message: string, type?: 'info' | 'success' | 'error'): void;
    showModal(options: ModalOptions): Promise<any>;
  };
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ModalOptions {
  title: string;
  content: string;
  buttons?: string[];
}

export interface AQMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  source: 'host' | 'plugin';
  cmd?: string;
  args?: any;
  result?: any;
  error?: string;
  event?: string;
  data?: any;
}
```

- [ ] **Step 2: 创建桥接主模块**

```typescript
// src/plugins/bridge/index.ts
import { invoke } from '@tauri-apps/api/core';
import type { AQBridge, AQMessage } from './types';

export class PluginBridgeImpl implements AQBridge {
  private pluginId: string;
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private pendingCalls = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private ipcId = 0;

  readonly version = '1.0.0';

  constructor(pluginId: string) {
    this.pluginId = pluginId;
    this.setupMessageListener();
  }

  private setupMessageListener() {
    window.addEventListener('message', (e: MessageEvent<AQMessage>) => {
      if (e.data?.source === 'action-quick-host' && e.data.id) {
        const pending = this.pendingCalls.get(e.data.id);
        if (pending) {
          if (e.data.error) {
            pending.reject(new Error(e.data.error));
          } else {
            pending.resolve(e.data.result);
          }
          this.pendingCalls.delete(e.data.id);
        }
      }
    });
  }

  async invoke<T>(cmd: string, args?: any): Promise<T> {
    const id = String(++this.ipcId);
    
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      
      window.parent.postMessage({
        source: 'action-quick-plugin',
        id,
        cmd,
        args: { ...args, pluginId: this.pluginId },
      } as AQMessage, '*');
    });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  emit(event: string, data?: any): void {
    window.parent.postMessage({
      source: 'action-quick-plugin',
      type: 'event',
      event,
      data,
    } as AQMessage, '*');
  }

  get clipboard() {
    return {
      read: () => this.invoke<string>('aq_clipboard_read'),
      write: (text: string) => this.invoke<void>('aq_clipboard_write', { text }),
    };
  }

  get storage() {
    return {
      get: (key: string) => this.invoke<any>('aq_storage_get', { key }),
      set: (key: string, value: any) => this.invoke<void>('aq_storage_set', { key, value }),
      delete: (key: string) => this.invoke<void>('aq_storage_delete', { key }),
    };
  }

  get notification() {
    return {
      show: (options: any) => this.invoke<void>('aq_notification', options),
    };
  }

  get http() {
    return {
      get: (url: string, options?: any) => this.invoke<Response>('aq_http_get', { url, ...options }),
      post: (url: string, body?: any, options?: any) => this.invoke<Response>('aq_http_post', { url, body, ...options }),
    };
  }

  get ui() {
    return {
      showToast: (message: string, type?: string) => {
        window.parent.postMessage({
          source: 'action-quick-plugin',
          type: 'toast',
          message,
         toastType: type,
        } as any, '*');
      },
      showModal: (options: any) => this.invoke<any>('aq_modal', options),
    };
  }
}

export type { AQBridge, AQMessage };
```

- [ ] **Step 3: 创建全局 API 注入器**

```typescript
// src/plugins/bridge/global-api.ts
import type { IsolatedContainer } from '../isolation/types';
import { PluginBridgeImpl } from './index';

export const PLUGIN_SDK_VERSION = '1.0.0';

export function createBridge(container: IsolatedContainer, pluginId: string): PluginBridgeImpl {
  return new PluginBridgeImpl(pluginId);
}

export function injectGlobalAPI(container: IsolatedContainer, pluginId: string): void {
  const globalScope = container.getGlobalScope();
  const bridge = createBridge(container, pluginId);

  globalScope.__AQ_BRIDGE__ = bridge;
  globalScope.aq = bridge;
}

export function removeGlobalAPI(container: IsolatedContainer): void {
  const globalScope = container.getGlobalScope();
  delete globalScope.__AQ_BRIDGE__;
  delete globalScope.aq;
}
```

- [ ] **Step 4: 提交**

```bash
git add src/plugins/bridge/
git commit -m "feat: implement PluginBridge communication layer"
```

---

## Task 4: 创建渲染器接口和 HTML 渲染器

**Files:**
- Create: `src/plugins/renderer/types.ts`
- Create: `src/plugins/renderer/html-renderer.ts`

- [ ] **Step 1: 创建渲染器类型**

```typescript
// src/plugins/renderer/types.ts
import type { IsolatedContainer } from '../isolation/types';
import type { InstalledPlugin } from '../../types/plugin';
import type { PluginBridge } from '../bridge/types';

export interface PluginRenderer {
  render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void>;
  destroy?: () => void;
}
```

- [ ] **Step 2: 实现 HTML 渲染器**

```typescript
// src/plugins/renderer/html-renderer.ts
import type { IsolatedContainer } from '../isolation/types';
import type { InstalledPlugin } from '../../types/plugin';
import type { PluginBridge } from '../bridge/types';
import type { PluginRenderer } from './types';
import { PLUGIN_SDK_VERSION } from '../bridge/global-api';

export class HTMLPluginRenderer implements PluginRenderer {
  private iframe: HTMLIFrameElement | null = null;

  async render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void> {
    const htmlContent = await this.loadHTMLContent(plugin);
    const injectedHTML = this.injectSDK(htmlContent, bridge);

    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts');
    this.iframe.sandbox.add('allow-same-origin');
    this.iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    this.iframe.srcdoc = injectedHTML;

    this.iframe.onload = () => {
      this.setupCommunication(bridge);
    };

    container.root.appendChild(this.iframe);
  }

  private async loadHTMLContent(plugin: InstalledPlugin): Promise<string> {
    const response = await fetch(`asset://localhost/${plugin.path}/${plugin.manifest.main}`);
    return response.text();
  }

  private injectSDK(html: string, bridge: PluginBridge): string {
    const sdkScript = `
      <script>
        window.__AQ_BRIDGE__ = ${JSON.stringify({
          version: PLUGIN_SDK_VERSION,
          pluginId: bridge.pluginId,
        })};
        window.aq = window.__AQ_BRIDGE__;
        
        // Escape 键处理
        if (!window.__AQ_ESCAPE_HANDLER__) {
          window.__AQ_ESCAPE_HANDLER__ = true;
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
              e.preventDefault();
              window.parent.postMessage({
                source: 'action-quick-plugin',
                type: 'key-escape'
              }, '*');
            }
          });
        }
      <\/script>
    `;

    if (html.includes('</head>')) {
      return html.replace('</head>', `${sdkScript}</head>`);
    }
    return sdkScript + html;
  }

  private setupCommunication(bridge: PluginBridge): void {
    if (!this.iframe?.contentWindow) return;

    // 监听插件消息
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.source === 'action-quick-plugin' && e.data.cmd) {
        this.handlePluginCommand(e.data, bridge);
      }
    });

    // 发送插件参数
    this.iframe.contentWindow.postMessage({
      source: 'action-quick-host',
      type: 'plugin-params',
      params: {
        pluginId: bridge.pluginId,
      },
    }, '*');
  }

  private async handlePluginCommand(message: any, bridge: PluginBridge): Promise<void> {
    if (!this.iframe?.contentWindow) return;

    try {
      const result = await bridge.invoke(message.cmd, message.args);
      this.iframe.contentWindow.postMessage({
        source: 'action-quick-host',
        id: message.id,
        result,
      }, '*');
    } catch (error) {
      this.iframe.contentWindow.postMessage({
        source: 'action-quick-host',
        id: message.id,
        error: String(error),
      }, '*');
    }
  }

  destroy(): void {
    this.iframe?.remove();
    this.iframe = null;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/plugins/renderer/types.ts src/plugins/renderer/html-renderer.ts
git commit -m "feat: implement HTML plugin renderer"
```

---

## Task 5: 创建 PluginContainer 组件

**Files:**
- Create: `src/components/PluginContainer.vue`
- Create: `src/components/PluginErrorBoundary.vue`

- [ ] **Step 1: 创建错误边界组件**

```vue
<!-- src/components/PluginErrorBoundary.vue -->
<template>
  <div v-if="error" class="plugin-error-boundary">
    <div class="error-icon">⚠️</div>
    <div class="error-message">{{ error.message }}</div>
    <div class="error-detail" v-if="error.detail">{{ error.detail }}</div>
    <div class="error-actions">
      <button v-if="error.recoverable" @click="retry">重试</button>
      <button @click="report">报告问题</button>
      <button @click="close">关闭</button>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface ErrorInfo {
  message: string;
  detail?: string;
  recoverable: boolean;
}

const props = defineProps<{
  error: ErrorInfo | null;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'report'): void;
  (e: 'close'): void;
}>();

function retry() {
  emit('retry');
}

function report() {
  emit('report');
}

function close() {
  emit('close');
}
</script>

<style scoped>
.plugin-error-boundary {
  padding: 20px;
  text-align: center;
  color: #666;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  font-size: 16px;
  margin-bottom: 8px;
}

.error-detail {
  font-size: 14px;
  color: #999;
  margin-bottom: 16px;
}

.error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.error-actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.error-actions button:hover {
  background: #f5f5f5;
}
</style>
```

- [ ] **Step 2: 创建 PluginContainer 组件**

```vue
<!-- src/components/PluginContainer.vue -->
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

    // 获取插件信息
    const plugin = await invoke<InstalledPlugin>('get_plugin', { pluginId: props.pluginId });

    // 创建隔离容器
    const isolation = new LightIsolation();
    container = isolation.createContainer(pluginRoot.value!);

    // 注入全局 API
    injectGlobalAPI(container, props.pluginId);

    // 创建渲染器
    renderer = new HTMLPluginRenderer();

    // 渲染插件
    await renderer.render(container, plugin, {
      invoke: async (cmd: string, args?: any) => {
        return invoke(cmd, { ...args, pluginId: props.pluginId });
      },
      on: (event: string, callback: (data: any) => void) => {
        container?.addEventListener(`aq:${event}`, ((e: CustomEvent) => callback(e.detail)) as EventListener);
      },
      emit: (event: string, data?: any) => {
        container?.root.host?.dispatchEvent(new CustomEvent(`aq:${event}`, { detail: data }));
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

// 监听参数变化
watch(() => props.params, (newParams) => {
  if (container) {
    container.root.host?.dispatchEvent(new CustomEvent('aq:params-change', {
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
```

- [ ] **Step 3: 提交**

```bash
git add src/components/PluginContainer.vue src/components/PluginErrorBoundary.vue
git commit -m "feat: implement PluginContainer component"
```

---

## Task 6: 集成到现有系统

**Files:**
- Modify: `src/views/PluginView.vue`
- Modify: `src/stores/appStore.ts`

- [ ] **Step 1: 修改 PluginView 使用新组件**

```vue
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
```

- [ ] **Step 2: 提交**

```bash
git add src/views/PluginView.vue
git commit -m "feat: integrate PluginContainer into PluginView"
```

---

## Task 7: 创建 SDK 包

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/bridge.ts`
- Create: `packages/sdk/src/api/clipboard.ts`
- Create: `packages/sdk/src/api/storage.ts`
- Create: `packages/sdk/src/types/index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@action-quick/sdk",
  "version": "1.0.0",
  "description": "Action-Quick Plugin SDK",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 SDK 入口**

```typescript
// packages/sdk/src/index.ts
export { getAQ } from './bridge';
export type { AQBridge } from './bridge';
export * from './api/clipboard';
export * from './api/storage';
export * from './api/http';
export * from './api/notification';
export * from './api/ui';
export * from './types';
```

- [ ] **Step 4: 创建桥接模块**

```typescript
// packages/sdk/src/bridge.ts
export interface AQBridge {
  version: string;
  pluginId: string;
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
  clipboard: {
    read(): Promise<string>;
    write(text: string): Promise<void>;
  };
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };
  notification: {
    show(options: any): Promise<void>;
  };
  http: {
    get(url: string, options?: any): Promise<any>;
    post(url: string, body?: any, options?: any): Promise<any>;
  };
  ui: {
    showToast(message: string, type?: 'info' | 'success' | 'error'): void;
    showModal(options: any): Promise<any>;
  };
}

declare global {
  interface Window {
    aq: AQBridge;
    __AQ_BRIDGE__: AQBridge;
  }
}

export function getAQ(): AQBridge {
  if (typeof window !== 'undefined' && window.aq) {
    return window.aq;
  }
  throw new Error('Action-Quick bridge not available. Make sure you are running inside Action-Quick.');
}
```

- [ ] **Step 5: 创建 API 模块**

```typescript
// packages/sdk/src/api/clipboard.ts
import { getAQ } from '../bridge';

export const clipboard = {
  read: () => getAQ().clipboard.read(),
  write: (text: string) => getAQ().clipboard.write(text),
};

// packages/sdk/src/api/storage.ts
import { getAQ } from '../bridge';

export const storage = {
  get: (key: string) => getAQ().storage.get(key),
  set: (key: string, value: any) => getAQ().storage.set(key, value),
  delete: (key: string) => getAQ().storage.delete(key),
};

// packages/sdk/src/api/http.ts
import { getAQ } from '../bridge';

export const http = {
  get: (url: string, options?: any) => getAQ().http.get(url, options),
  post: (url: string, body?: any, options?: any) => getAQ().http.post(url, body, options),
};

// packages/sdk/src/api/notification.ts
import { getAQ } from '../bridge';

export const notification = {
  show: (options: any) => getAQ().notification.show(options),
};

// packages/sdk/src/api/ui.ts
import { getAQ } from '../bridge';

export const ui = {
  showToast: (message: string, type?: 'info' | 'success' | 'error') => 
    getAQ().ui.showToast(message, type),
  showModal: (options: any) => getAQ().ui.showModal(options),
};
```

- [ ] **Step 6: 创建类型定义**

```typescript
// packages/sdk/src/types/index.ts
export interface PluginParams {
  pluginId: string;
  query?: string;
  contextText?: string;
  [key: string]: any;
}

export interface PluginDefinition<T = Record<string, any>> {
  name: string;
  version: string;
  description?: string;
  render: (params: T) => HTMLElement | Promise<HTMLElement>;
  onMount?: () => void;
  onUnmount?: () => void;
  onParamsChange?: (params: T) => void;
}

export function definePlugin<T extends Record<string, any>>(
  definition: PluginDefinition<T>
): PluginDefinition<T> {
  return definition;
}
```

- [ ] **Step 7: 提交**

```bash
git add packages/sdk/
git commit -m "feat: create @action-quick/sdk package"
```

---

## Task 8: 更新 Manifest 类型定义

**Files:**
- Modify: `src/types/plugin.d.ts`

- [ ] **Step 1: 添加 sandbox 字段到 manifest 类型**

```typescript
// src/types/plugin.d.ts
export type IsolationLevel = 'light' | 'strict' | 'worker';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  main: string;
  module?: string;
  keywords?: string[];
  context?: {
    text?: {
      pattern: string;
      label: string;
    };
  };
  permissions?: string[];
  minHostVersion?: string;
  sandbox?: {
    level?: IsolationLevel;
    allowDomAccess?: boolean;
  };
}

export interface InstalledPlugin extends PluginManifest {
  path: string;
}

export interface DesktopApp {
  name: string;
  path: string;
  target?: string | null;
  icon?: string | null;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/plugin.d.ts
git commit -m "feat: add sandbox field to plugin manifest type"
```

---

## Task 9: 运行完整测试

**Files:**
- Test: `src/plugins/**/*.test.ts`

- [ ] **Step 1: 运行所有测试**

Run: `npx vitest run`
Expected: 所有测试通过

- [ ] **Step 2: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 运行构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 4: 运行 tauri dev 验证**

Run: `npm run tauri dev`
Expected: 应用正常启动，插件可以加载

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: complete Web Component plugin rendering system"
```

---

## 验证清单

- [ ] Light 隔离级别正常工作
- [ ] 现有 HTML 插件无需修改即可运行
- [ ] 插件可以调用 clipboard、storage、notification 等 API
- [ ] 错误边界正常捕获和显示错误
- [ ] 插件参数变化可以正确传递
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 构建成功
