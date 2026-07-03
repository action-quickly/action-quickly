# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved UI redesign: B+C fusion layout, 6 color themes, and theme switching.

**Architecture:** CSS custom properties for theming, switched via `data-theme` attribute on `<html>`. All existing components use CSS variables, so they automatically adapt. Theme state managed in Pinia appStore, applied via watcher in App.vue.

**Tech Stack:** Vue 3, Pinia, CSS Custom Properties, Tauri v2

---

### Task 1: Define all 6 theme variable blocks in global.css

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the 6 theme blocks + base styles**

Replace the current `src/styles/global.css` with:

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Display", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "DM Mono", "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace;
  --easing: cubic-bezier(0.16, 1, 0.3, 1);
  --transition-fast: 120ms var(--easing);
  --transition: 200ms var(--easing);
  --radius: 12px;
  --radius-sm: 8px;
  --radius-xs: 6px;
}

/* ========== VIOLET DARK ========== */
:root, :root[data-theme="violet-dark"] {
  --bg-surface: #1a1a1e;
  --bg-raised: #242428;
  --bg-hover: #2d2d32;
  --tx-primary: #eeeeee;
  --tx-secondary: #9e9ea6;
  --tx-muted: #66666e;
  --accent: #8b5cf6;
  --accent-text: #a78bfa;
  --accent-bg: rgba(139, 92, 246, 0.12);
  --border: rgba(255, 255, 255, 0.06);
  --danger: #f87171;
  --danger-bg: rgba(248, 113, 113, 0.12);
}

/* ========== AMBER DARK ========== */
:root[data-theme="amber-dark"] {
  --bg-surface: #13130f;
  --bg-raised: #1d1d18;
  --bg-hover: #272722;
  --tx-primary: #f0ede6;
  --tx-secondary: #8a877e;
  --tx-muted: #5a5852;
  --accent: #f59e0b;
  --accent-text: #fbbf24;
  --accent-bg: rgba(245, 158, 11, 0.1);
  --border: rgba(255, 255, 255, 0.05);
  --danger: #f87171;
  --danger-bg: rgba(248, 113, 113, 0.12);
}

/* ========== INDIGO DARK ========== */
:root[data-theme="indigo-dark"] {
  --bg-surface: #0f1117;
  --bg-raised: #191b22;
  --bg-hover: #23262e;
  --tx-primary: #e8ecf0;
  --tx-secondary: #7a8596;
  --tx-muted: #4a5568;
  --accent: #6366f1;
  --accent-text: #818cf8;
  --accent-bg: rgba(99, 102, 241, 0.1);
  --border: rgba(255, 255, 255, 0.06);
  --danger: #f87171;
  --danger-bg: rgba(248, 113, 113, 0.12);
}

/* ========== VIOLET LIGHT ========== */
:root[data-theme="violet-light"] {
  --bg-surface: #f8f7f4;
  --bg-raised: #f0efec;
  --bg-hover: #e8e7e2;
  --tx-primary: #1a1a1e;
  --tx-secondary: #6b6b72;
  --tx-muted: #9e9ea6;
  --accent: #7c5cfc;
  --accent-text: #6d4fe0;
  --accent-bg: rgba(124, 92, 252, 0.08);
  --border: rgba(0, 0, 0, 0.07);
  --danger: #dc2626;
  --danger-bg: rgba(220, 38, 38, 0.08);
}

/* ========== AMBER LIGHT ========== */
:root[data-theme="amber-light"] {
  --bg-surface: #faf8f4;
  --bg-raised: #f2f0ea;
  --bg-hover: #eae8e0;
  --tx-primary: #1a1a18;
  --tx-secondary: #6b6a62;
  --tx-muted: #9e9d94;
  --accent: #d97706;
  --accent-text: #b45309;
  --accent-bg: rgba(217, 119, 6, 0.08);
  --border: rgba(0, 0, 0, 0.07);
  --danger: #dc2626;
  --danger-bg: rgba(220, 38, 38, 0.08);
}

/* ========== INDIGO LIGHT ========== */
:root[data-theme="indigo-light"] {
  --bg-surface: #f5f6f9;
  --bg-raised: #edeef2;
  --bg-hover: #e4e5ea;
  --tx-primary: #0f1117;
  --tx-secondary: #5c6677;
  --tx-muted: #8a94a6;
  --accent: #4f46e5;
  --accent-text: #4338ca;
  --accent-bg: rgba(79, 70, 229, 0.08);
  --border: rgba(0, 0, 0, 0.07);
  --danger: #dc2626;
  --danger-bg: rgba(220, 38, 38, 0.08);
}

/* ========== BASE STYLES ========== */
html, body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--tx-primary);
  background: transparent;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  user-select: none;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

* {
  box-sizing: border-box;
}

::selection {
  background: var(--accent-bg);
  color: var(--accent-text);
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
```

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: add 6 theme variable blocks to global.css"
```

---

### Task 2: Add theme state to appStore

**Files:**
- Modify: `src/stores/appStore.ts`

- [ ] **Step 1: Add `theme` state and `setTheme` action**

Add a `theme` ref with default `"violet-dark"` and a `setTheme` action:

```typescript
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ViewType } from "../types/plugin";

export const useAppStore = defineStore("app", () => {
  const currentView = ref<ViewType>("search");
  const searchQuery = ref("");
  const contextText = ref<string | null>(null);
  const selectedPluginId = ref<string | null>(null);
  const theme = ref("violet-dark");

  function switchView(view: ViewType) {
    currentView.value = view;
  }

  function setQuery(query: string) {
    searchQuery.value = query;
  }

  function setContext(text: string | null) {
    contextText.value = text;
  }

  function selectPlugin(pluginId: string) {
    selectedPluginId.value = pluginId;
    currentView.value = "plugin";
  }

  function backToSearch() {
    currentView.value = "search";
    selectedPluginId.value = null;
  }

  function setTheme(id: string) {
    theme.value = id;
  }

  return {
    currentView,
    searchQuery,
    contextText,
    selectedPluginId,
    theme,
    switchView,
    setQuery,
    setContext,
    selectPlugin,
    backToSearch,
    setTheme,
  };
});
```

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/stores/appStore.ts
git commit -m "feat: add theme state to appStore"
```

---

### Task 3: Wire theme to document in App.vue

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Add watcher that sets `data-theme` on `<html>`**

Import `watch` from Vue, add a watcher after the existing logic:

```typescript
import { onMounted, onUnmounted, watch } from "vue";
```

Add after the `onUnmounted` block:

```typescript
watch(
  () => appStore.theme,
  (val) => {
    document.documentElement.dataset.theme = val;
  },
  { immediate: true }
);
```

Full `script setup` after changes:

```typescript
<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "./stores/appStore";
import SearchView from "./views/SearchView.vue";
import PluginView from "./views/PluginView.vue";
import MarketView from "./views/MarketView.vue";

const appStore = useAppStore();

let unlisten: UnlistenFn | null = null;

onMounted(async () => {
  unlisten = await listen<string | null>("window-shown", (event) => {
    const contextText = event.payload;
    if (appStore.currentView === "search") {
      appStore.setQuery("");
      appStore.setContext(contextText || null);
    }
  });
});

onUnmounted(() => {
  unlisten?.();
});

watch(
  () => appStore.theme,
  (val) => {
    document.documentElement.dataset.theme = val;
  },
  { immediate: true }
);
</script>
```

Template and style remain unchanged.

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat: wire theme state to document data-theme"
```

---

### Task 4: Add theme selector to MarketView

**Files:**
- Modify: `src/views/MarketView.vue`

- [ ] **Step 1: Add theme selector section at top of market body**

Add a theme selector before the "install from directory" section. Add the following to the `<script setup>` (no new imports needed — `useAppStore` already imported):

The theme IDs to use:
- `violet-dark`, `violet-light`
- `amber-dark`, `amber-light`
- `indigo-dark`, `indigo-light`

Define a themes array in script (add before `register`):

```typescript
const themes = [
  { id: "violet-dark", label: "紫罗兰", mode: "dark", color: "#8b5cf6" },
  { id: "violet-light", label: "紫罗兰", mode: "light", color: "#7c5cfc" },
  { id: "amber-dark", label: "琥珀", mode: "dark", color: "#f59e0b" },
  { id: "amber-light", label: "琥珀", mode: "light", color: "#d97706" },
  { id: "indigo-dark", label: "靛蓝", mode: "dark", color: "#6366f1" },
  { id: "indigo-light", label: "靛蓝", mode: "light", color: "#4f46e5" },
];

const colorGroups = ["紫罗兰", "琥珀", "靛蓝"];
```

Add the theme selector template between the `<div class="market-body">` opening and the first `<section>`:

```html
<section class="section">
  <h2 class="section-title">主题</h2>
  <div class="theme-selector">
    <div class="theme-colors">
      <button
        v-for="group in colorGroups"
        :key="group"
        class="theme-pill"
        :class="{ active: appStore.theme.includes(group) }"
        @click="switchColorGroup(group)"
      >
        <span
          class="theme-dot"
          :style="{ background: themes.find(t => t.label === group && appStore.theme.includes(t.mode))?.color }"
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
```

Add methods in the `<script setup>` block:

```typescript
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
```

Add the theme selector CSS to the `<style scoped>` block:

```css
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
```

Also update the section title styling to work better (already uses `--tx-muted` from previous redesign).

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/views/MarketView.vue
git commit -m "feat: add theme selector to MarketView"
```

---

### Task 5: Refine SearchView layout per spec

**Files:**
- Modify: `src/views/SearchView.vue`
- Modify: `src/components/SearchInput.vue`
- Modify: `src/components/ResultItem.vue`
- Modify: `src/components/ResultList.vue`
- Modify: `src/components/ContextBar.vue`
- Modify: `src/components/PluginFrame.vue`
- Modify: `src/views/PluginView.vue`

- [ ] **Step 1: Update SearchView.vue**

The current file already has the correct structure from the previous redesign. Verify it matches the spec:
- Search header: 52px (matches current padding/height design)
- Search input uses `--tx-muted` for icon, `--tx-primary` for text
- Grid icon uses `--tx-muted`, hover uses `--tx-secondary`

Update the shadow to use updated tokens:

```css
.search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}

.settings-btn {
  background: none;
  border: none;
  color: var(--tx-muted);
  cursor: pointer;
  padding: 0 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast);
}

.settings-btn:hover {
  color: var(--tx-secondary);
}
```

- [ ] **Step 2: Update SearchInput.vue — keep existing, verify tokens**

Current file already uses `--tx-muted` for icon, `--accent-text` for focus state.
Verify placeholder is `--tx-muted` (already done).
Search text is 17px — change from 18px to 17px per spec.

```css
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
```

- [ ] **Step 3: Update ResultItem.vue — verify selected state and tokens**

Current file already has left-border accent, icon scale, and badge styling. Verify all token names:

```css
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

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--tx-primary);
}

.item-desc {
  font-size: 12px;
  color: var(--tx-secondary);
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

.item-badge.context {
  background: rgba(128, 128, 128, 0.08);
  color: var(--tx-secondary);
}
```

- [ ] **Step 4: Update ResultList.vue — verify empty state**

Current file already uses SVG icon and Chinese copy. Verify tokens:

```css
.empty-icon { color: var(--tx-muted); opacity: 0.5; }
.empty-title { color: var(--tx-secondary); }
.empty-hint { color: var(--tx-muted); }
```

- [ ] **Step 5: Update ContextBar.vue — verify tokens**

Current file already uses SVG icons. Verify:
- Icon uses `--accent-text`
- Label uses `--accent-text`
- Text uses `--tx-primary`
- Clear button uses `--tx-muted`

- [ ] **Step 6: Update PluginFrame.vue — verify tokens**

Loading spinner uses `--accent` for top border. Header uses `--border`.

- [ ] **Step 7: Update PluginView.vue — verify tokens**

```css
.plugin-view {
  height: 100%;
  background: var(--bg-surface);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
```

- [ ] **Step 8: Verify build**

Run: `npx vite build 2>&1`

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit all component/view changes**

```bash
git add src/views/SearchView.vue src/components/SearchInput.vue src/components/ResultItem.vue src/components/ResultList.vue src/components/ContextBar.vue src/components/PluginFrame.vue src/views/PluginView.vue
git commit -m "feat: refine component layout per B+C fusion spec"
```

---

### Task 6: Update App.vue padding and index.html title

**Files:**
- Modify: `src/App.vue`
- Modify: `index.html`

- [ ] **Step 1: Update App.vue padding**

```css
.app-root {
  height: 100vh;
  width: 100vw;
  padding: 0;
}
```

Zero padding (the window radius is handled by the view components themselves).

- [ ] **Step 2: Update index.html title**

```html
<title>Action Quick</title>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.vue index.html
git commit -m "chore: update app padding and title"
```

---

### Task 7: Clean up temp mockup files

**Files:**
- Delete: `temp-design-mockup.html`
- Delete: `temp-design-mockup2.html`
- Delete: `temp-design-colors.html`
- Delete: `temp-design-colors-02.html`

- [ ] **Step 1: Remove mockup files**

```bash
Remove-Item -LiteralPath "temp-design-mockup.html", "temp-design-mockup2.html", "temp-design-colors.html", "temp-design-colors-02.html"
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove design exploration mockups"
```

---

### Verification

- [ ] **Final: Full build check**

Run: `npx vue-tsc --noEmit && npx vite build 2>&1`

Expected: Both type check and build pass with no errors.
