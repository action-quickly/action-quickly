# Web Component 插件渲染系统设计

## 概述

本设计文档描述了将 Action-Quick 的插件渲染系统从 iframe 迁移到 Web Component 的方案。采用分级隔离架构，在性能、安全性和开发体验之间取得平衡。

**目标**:
- 性能: 减少 iframe 开销，提升插件加载和切换速度
- 隔离性: 根据插件信任级别提供可配置的隔离策略
- 通信效率: 替代 postMessage，提供更直接的 API 访问
- 开发体验: 提供类型安全的 SDK，降低插件开发门槛

**关键决策**:
- 采用 Hybrid 分级隔离方案（light/strict/worker）
- 支持 HTML 和 Web Component 两种插件格式
- 完全向后兼容现有 iframe 插件

## 架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    宿主应用 (Vue + Tauri)                     │
├─────────────────────────────────────────────────────────────┤
│  PluginContainer (Vue Component)                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PluginBridge (通信层)                                │  │
│  │  ┌─────────────┬─────────────┬─────────────────────┐ │  │
│  │  │ Global API  │ ES Module   │ Custom Events       │ │  │
│  │  │ (window.aq) │ (import)    │ (异步通知)          │ │  │
│  │  └─────────────┴─────────────┴─────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  IsolationLayer (隔离层)                              │  │
│  │  ┌──────────┬──────────┬───────────────────────────┐ │  │
│  │  │ light    │ strict   │ worker                    │ │  │
│  │  │ Shadow   │ Shadow   │ Web Worker                │ │  │
│  │  │ DOM      │ DOM +    │ + MessageChannel          │ │  │
│  │  │          │ JS Proxy │                           │ │  │
│  │  └──────────┴──────────┴───────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PluginRenderer (渲染层)                              │  │
│  │  ┌─────────────────┬───────────────────────────────┐ │  │
│  │  │ HTML Plugin     │ Web Component Plugin          │ │  │
│  │  │ (iframe srcdoc) │ (Custom Element)              │ │  │
│  │  └─────────────────┴───────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 职责 | 依赖 |
|------|------|------|
| `PluginContainer` | Vue 组件，管理插件生命周期 | Vue 3 Composition API |
| `PluginBridge` | 通信层，提供 API 注入和消息路由 | Tauri IPC |
| `IsolationLayer` | 隔离层，根据级别选择隔离策略 | Shadow DOM / JS Proxy / Worker |
| `PluginRenderer` | 渲染层，支持 HTML 和 Web Component 两种格式 | Custom Elements API |
| `PluginSDK` | 插件端 SDK，提供类型安全的 API | ES Module |

### 数据流

```
用户操作 → PluginContainer → IsolationLayer → PluginRenderer
                ↑                                    ↓
                │                                    │
           PluginBridge ←──── Custom Events ←──── Plugin Code
                ↓
           Tauri IPC → Rust 后端
```

## 组件设计

### PluginContainer

```typescript
// PluginContainer.vue props
interface PluginContainerProps {
  pluginId: string;
  isolation?: 'light' | 'strict' | 'worker';
  params?: Record<string, any>;
}

// PluginContainer.vue emits
interface PluginContainerEmits {
  (e: 'load'): void;
  (e: 'error', error: Error): void;
  (e: 'params-change', params: any): void;
}
```

**生命周期**:
1. `mount` → `loadPlugin()`
2. `createContainer()` → 根据隔离级别创建容器
3. `injectBridge()` → 注入通信桥接
4. `renderContent()` → 渲染插件内容
5. `unmount` → 清理资源

### 隔离级别

#### Light 级别 (Shadow DOM only)

- **隔离方式**: Shadow DOM 样式封装
- **JS 隔离**: 无（共享全局作用域）
- **适用场景**: 内部/可信插件
- **性能**: ⭐⭐⭐

```typescript
class LightIsolation implements IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer {
    const host = document.createElement('div');
    host.classList.add('plugin-host');
    const shadow = host.attachShadow({ mode: 'open' });
    parent.appendChild(host);
    
    return {
      root: shadow,
      destroy: () => host.remove(),
      getGlobalScope: () => window,
    };
  }
}
```

#### Strict 级别 (Shadow DOM + JS Proxy)

- **隔离方式**: Shadow DOM + JS Proxy 沙箱
- **JS 隔离**: 通过 Proxy 拦截危险操作
- **适用场景**: 第三方插件
- **性能**: ⭐⭐

```typescript
class StrictIsolation implements IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer {
    const host = document.createElement('div');
    host.classList.add('plugin-host');
    const shadow = host.attachShadow({ mode: 'closed' });
    parent.appendChild(host);
    
    const restrictedGlobal = this.createRestrictedGlobal(shadow);
    
    return {
      root: shadow,
      destroy: () => {
        host.remove();
        this.cleanupProxies();
      },
      getGlobalScope: () => restrictedGlobal,
    };
  }
  
  private createRestrictedGlobal(shadow: ShadowRoot): typeof window {
    return new Proxy(window, {
      get(target, prop) {
        if (BLOCKED_PROPS.includes(prop as string)) {
          throw new SecurityError(`Access denied: ${String(prop)}`);
        }
        return Reflect.get(target, prop);
      },
      set(target, prop, value) {
        if (BLOCKED_SET_PROPS.includes(prop as string)) {
          throw new SecurityError(`Cannot set: ${String(prop)}`);
        }
        return Reflect.set(target, prop, value);
      }
    });
  }
}
```

**拦截规则**:

| 操作 | 允许 | 禁止 |
|------|------|------|
| DOM 读取 | `querySelector`, `getElementById` | `document.write`, `document.cookie` |
| DOM 修改 | `element.classList`, `element.style` | `element.outerHTML`, `element.innerHTML` (可配置) |
| 网络请求 | 通过 `aq.http` API | 直接 `fetch` (可配置) |
| 存储访问 | 通过 `aq.storage` API | 直接 `localStorage` |

**拦截属性列表**:

```typescript
// 禁止读取的属性
const BLOCKED_PROPS = [
  'cookie',        // 防止访问 cookies
  'domain',        // 防止访问域名
  'designMode',    // 防止启用设计模式
  'execCommand',   // 防止执行命令
  'forms',         // 防止直接访问表单
  'all',           // 防止访问 all 集合
];

// 禁止设置的属性
const BLOCKED_SET_PROPS = [
  'cookie',        // 防止修改 cookies
  'domain',        // 防止修改域名
  'designMode',    // 防止启用设计模式
  'innerHTML',     // 可配置：防止 XSS 攻击
  'outerHTML',     // 可配置：防止 DOM 替换
];
```

#### Worker 级别 (Web Worker)

- **隔离方式**: Web Worker 独立执行环境
- **JS 隔离**: 完全隔离（Worker 内无法访问 DOM）
- **适用场景**: 高风险插件（执行不可信代码、`shell:exec` 等）
- **性能**: ⭐

**UI 渲染机制**: Worker 本身无法操作 DOM，通过以下方式实现 UI 更新：

1. **消息传递**: Worker 通过 `postMessage` 发送 UI 指令（DOM 操作序列），主线程执行实际渲染
2. **OffscreenCanvas**: 对于 Canvas 类插件，Worker 直接操作 `OffscreenCanvas`，主线程显示结果
3. **Virtual DOM diff**: Worker 内维护虚拟 DOM，计算 diff 后只传输变更部分

```typescript
class WorkerIsolation implements IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer {
    const worker = new Worker(PLUGIN_WORKER_URL);
    const channel = new MessageChannel();
    
    const container = document.createElement('div');
    container.classList.add('plugin-worker-container');
    parent.appendChild(container);
    
    // Worker → 主线程: UI 指令队列
    const uiQueue: UIInstruction[] = [];
    
    channel.port1.onmessage = (e) => {
      if (e.data.type === 'ui-update') {
        // 主线程执行 DOM 操作
        this.executeUIUpdate(container, e.data.instructions);
      }
    };
    
    worker.postMessage({ type: 'init', port: channel.port2 }, [channel.port2]);
    
    return {
      root: container,
      destroy: () => {
        worker.terminate();
        channel.port1.close();
        container.remove();
      },
      getGlobalScope: () => this.createWorkerProxy(worker, channel.port1),
    };
  }
  
  private createWorkerProxy(worker: Worker, port: MessagePort): any {
    return {
      // DOM 操作代理：发送指令到主线程执行
      document: {
        createElement: (tag: string) => {
          const id = ++this.elementId;
          port.postMessage({ type: 'dom', action: 'createElement', tag, id });
          return this.createElementProxy(id, port);
        },
        querySelector: (selector: string) => {
          const id = ++this.elementId;
          port.postMessage({ type: 'dom', action: 'querySelector', selector, id });
          return this.createElementProxy(id, port);
        },
      },
      setTimeout: (...args) => {
        const id = ++this.timerId;
        port.postMessage({ type: 'timer', action: 'setTimeout', id, args });
        return id;
      },
    };
  }
}
```

### 隔离级别选择

```typescript
function getIsolationLevel(plugin: InstalledPlugin): IsolationLevel {
  // 1. 优先使用 manifest 中的配置
  if (plugin.manifest.sandbox?.level) {
    return plugin.manifest.sandbox.level;
  }
  
  // 2. 根据权限自动判断
  const highRiskPerms = ['fs:write', 'shell:exec', 'http'];
  const hasHighRisk = plugin.manifest.permissions?.some(p => 
    highRiskPerms.includes(p)
  );
  
  if (hasHighRisk) return 'strict';
  
  // 3. 默认使用 light
  return 'light';
}
```

## 通信桥接

### 全局 API 注入

```typescript
function injectGlobalAPI(container: IsolatedContainer, pluginId: string) {
  const globalScope = container.getGlobalScope();
  
  globalScope.__AQ_BRIDGE__ = {
    version: PLUGIN_SDK_VERSION,
    pluginId,
    invoke: async (cmd: string, args?: any) => {
      return await invoke(cmd, { ...args, pluginId });
    },
    on: (event: string, callback: Function) => {
      container.addEventListener(`aq:${event}`, (e) => callback(e.detail));
    },
    emit: (event: string, data?: any) => {
      container.dispatchEvent(new CustomEvent(`aq:${event}`, { detail: data }));
    }
  };
  
  globalScope.aq = globalScope.__AQ_BRIDGE__;
}
```

### 插件端 SDK

```typescript
// @action-quick/sdk
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

export function getAQ(): AQBridge {
  if (typeof window !== 'undefined' && window.aq) {
    return window.aq;
  }
  throw new Error('Action-Quick bridge not available');
}
```

### 消息协议

```typescript
interface AQMessage {
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

## 插件渲染器

### HTML 插件渲染

> **说明**: HTML 插件仍然在 Shadow DOM 内使用 `iframe srcdoc` 渲染。这保证了：
> 1. 完全向后兼容现有 HTML 插件（零修改）
> 2. Shadow DOM 提供样式隔离（iframe 内的样式不影响宿主）
> 3. iframe 的 `sandbox` 属性提供 JS 隔离（可配置级别）

```typescript
class HTMLPluginRenderer implements PluginRenderer {
  async render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void> {
    const htmlContent = await this.loadHTMLContent(plugin);
    const injectedHTML = this.injectSDK(htmlContent, bridge);
    
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-same-origin');
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.srcdoc = injectedHTML;
    
    iframe.onload = () => {
      this.setupCommunication(iframe, bridge);
    };
    
    container.root.appendChild(iframe);
  }
  
  private injectSDK(html: string, bridge: PluginBridge): string {
    const sdkScript = this.generateSDKScript(bridge);
    return html.replace('</head>', `${sdkScript}</head>`);
  }
}
```

### Web Component 插件渲染

```typescript
class WebComponentPluginRenderer implements PluginRenderer {
  async render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void> {
    const pluginModule = await import(plugin.moduleURL);
    const tagName = `aq-plugin-${plugin.id}`;
    
    if (!customElements.get(tagName)) {
      const pluginFactory = pluginModule.default;
      const CustomElement = pluginFactory(bridge);
      customElements.define(tagName, CustomElement);
    }
    
    const element = document.createElement(tagName);
    element.setAttribute('plugin-id', plugin.id);
    
    container.root.appendChild(element);
  }
}
```

### Web Component 插件示例

```typescript
import { definePlugin, aq } from '@action-quick/sdk';

export default definePlugin({
  name: 'hello',
  version: '1.0.0',
  
  render(params) {
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Hello, ${params.query || 'World'}!</h1>
      <button id="copy-btn">复制文本</button>
    `;
    
    container.querySelector('#copy-btn').addEventListener('click', async () => {
      await aq.clipboard.write('Hello from plugin!');
      aq.ui.showToast('已复制到剪贴板', 'success');
    });
    
    return container;
  }
});
```

## 迁移策略

### 向后兼容

现有 iframe 插件**零修改**即可运行。

### 自动检测

```typescript
function detectPluginFormat(plugin: InstalledPlugin): PluginFormat {
  if (plugin.manifest.module) {
    return 'web-component';
  }
  
  const hasModule = plugin.manifest.main?.endsWith('.js') || 
                    plugin.manifest.main?.endsWith('.mjs');
  
  if (hasModule) return 'web-component';
  
  return 'html';
}
```

### 渐进式迁移

1. **阶段 1 (立即)**: 现有 HTML 插件无需修改，使用兼容层
2. **阶段 2 (可选)**: 插件可以开始使用 SDK API
3. **阶段 3 (未来)**: 新插件推荐使用 Web Component 格式

### Manifest 扩展

```json
{
  "id": "hello",
  "name": "Hello 示例插件",
  "version": "1.1.0",
  "main": "index.html",
  "module": "dist/index.js",
  "sandbox": {
    "level": "light",
    "allowDomAccess": true
  }
}
```

## 错误处理

### 错误类型

| 类型 | 描述 | 可恢复 | 处理方式 |
|------|------|--------|----------|
| `LOAD_FAILED` | 插件加载失败 | 是 | 重试 |
| `SANDBOX_VIOLATION` | 沙箱违规操作 | 否 | 阻止并记录 |
| `IPC_ERROR` | 通信错误 | 是 | 重试 |
| `PERMISSION_DENIED` | 权限不足 | 否 | 请求权限 |

### 错误边界

```vue
<template>
  <div v-if="error" class="plugin-error-boundary">
    <div class="error-message">{{ error.message }}</div>
    <div class="error-actions">
      <button v-if="error.recoverable" @click="retry">重试</button>
      <button @click="report">报告问题</button>
    </div>
  </div>
  <slot v-else />
</template>
```

## 测试策略

### 单元测试

- `IsolationLayer`: 测试三种隔离级别的创建和销毁
- `PluginBridge`: 测试 API 注入和消息路由
- `PluginRenderer`: 测试 HTML 和 Web Component 渲染

### 集成测试

- `PluginContainer`: 测试完整生命周期
- 错误处理: 测试各种错误场景

### E2E 测试

- 插件加载和渲染
- 插件功能正常工作
- 错误处理和恢复

## 实现计划

### Phase 1: 基础架构

1. 创建 `IsolationLayer` 接口和 `LightIsolation` 实现
2. 创建 `PluginBridge` 通信层
3. 创建 `PluginContainer` Vue 组件

### Phase 2: 渲染器

1. 实现 `HTMLPluginRenderer`
2. 实现 `WebComponentPluginRenderer`
3. 集成到 `PluginContainer`

### Phase 3: SDK

1. 创建 `@action-quick/sdk` 包
2. 实现核心 API (clipboard, storage, http, etc.)
3. 添加 TypeScript 类型定义

### Phase 4: 隔离增强

1. 实现 `StrictIsolation` (JS Proxy 沙箱)
2. 实现 `WorkerIsolation` (Web Worker)
3. 添加性能监控

### Phase 5: 测试和文档

1. 编写单元测试和集成测试
2. 编写 E2E 测试
3. 编写插件开发文档

## 附录

### 相关文件

- `src/components/PluginFrame.vue` - 现有 iframe 实现
- `src-tauri/src/plugin/manager.rs` - 插件管理器
- `src-tauri/src/commands.rs` - Tauri 命令
- `src/types/plugin.d.ts` - 插件类型定义

### 参考资源

- [Web Components MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
- [Shadow DOM MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [Custom Elements MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)
- [Web Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
