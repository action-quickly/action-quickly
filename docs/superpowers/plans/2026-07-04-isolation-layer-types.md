# Isolation Layer Type Definitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create foundational type definitions for the Web Component plugin rendering system with tiered isolation architecture.

**Architecture:** This task establishes the type system for the isolation layer, defining interfaces for containers, renderers, and plugin bridges. These types will be used by all subsequent tasks in the plugin system migration from iframes to Web Components.

**Tech Stack:** TypeScript, Vue 3, Vite, Tauri

---

## File Structure

```
src/
└── plugins/
    └── isolation/
        └── types.ts          # Type definitions for isolation layer
```

## Task 1: Create Isolation Layer Type Definitions

**Files:**
- Create: `src/plugins/isolation/types.ts`

- [ ] **Step 1: Create the types file with exact content**

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

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit src/plugins/isolation/types.ts`
Expected: 无错误（或仅有前置类型未定义的警告）

- [ ] **Step 3: Commit**

```bash
git add src/plugins/isolation/types.ts
git commit -m "feat: add isolation layer type definitions"
```

---

## Self-Review

1. **Spec coverage:** The plan implements the exact type definitions specified in the task description.
2. **Placeholder scan:** No placeholders - all code is provided.
3. **Type consistency:** Types are self-contained and don't depend on external definitions.