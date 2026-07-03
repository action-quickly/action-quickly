# Action Quick — UI Redesign

Date: 2026-07-03

## Overview

Complete visual redesign of Action Quick, a keyboard-driven quick launcher (uTools/Raycast-like). The design balances "terminal precision" (developer character) with "spacious comfort" (modern app refinement) across 6 interchangeable themes.

---

## 1. Layout System

### 1.1 Window Structure

```
┌──────────────────────────────────┐
│ ❯ search plugins...       [≡]    │  ← header (52px)
├──────────────────────────────────┤
│ 📎 context text here        ✕   │  ← context bar (optional, 34px)
├──────────────────────────────────┤
│ ┃ H  Hello World           sys   │
│ ┃ C  Clipboard Tools       json  │  ← result items
│ ┃ T  Text Transformer            │     (5 items per screen)
│ ┃ B  Base64 Codec          text  │
│ ┃ R  Regex Tester                │
└──────────────────────────────────┘
```

### 1.2 Key Measurements

| Element | Value | Rationale |
|---------|-------|-----------|
| Search header height | **52px** | Between A(48) and B(64) — roomy but not wasteful |
| Search text | **17px / 500** / -0.01em letter-spacing | Prominent but not oversized |
| Search input area | 8px 14px padding inside bg-raised | Inset feel, distinct from header |
| Context bar height | **34px** | Compact, secondary info |
| Result item padding | **9px 14px** (horizontal generous, vertical efficient) | Breathes L/R, scrolls fast |
| Item gap | **6px** | Clean separation without wasted space |
| Icon size | **34×34**, rounded 7px | Visible but not dominant |
| Selected indicator | **3px left border** + background shift + icon scale(1.06) | Clear, tactile |
| Badge radius | **3px** (code-like, not soft) | Terminal character |
| Window radius | **12px** | Modern, understated |
| Item radius | **8px** | |
| Content padding (market) | **14px** | |

### 1.3 Density Target

**5 result items per screen** — 4 is too sparse, 6 is too dense for the "premium but efficient" goal.

---

## 2. Typography

### 2.1 Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont,
             'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI',
             Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
--font-mono: 'DM Mono', 'SF Mono', 'Cascadia Code',
             'JetBrains Mono', Consolas, monospace;
```

### 2.2 Type Scale

| Role | Font | Size / Weight | Details |
|------|------|---------------|---------|
| Search text | Inter | 17px / 500 / -0.01em | Main input |
| Header title | Inter | 12px / 500 | Plugin name in plugin view header |
| Item name | Inter | 14px / 500 | Primary result text |
| Item description | Inter | 12px / 400 / var(--tx2) | Secondary result text |
| Meta data | DM Mono | 11px | Version, permissions, paths |
| Badge label | DM Mono | 10px / 500 | System, context tags |
| Section title | DM Mono | 10px / 600 / uppercase / 0.06em | Market view headings |
| Context label | Inter | 12px / 500 | "selected:" label |
| Context text | Inter | 12px / 400 | The actual selected text |

### 2.3 Terminal Characters

- **`❯`** — Search prompt prefix, accent color, 16px
- **`●`** — Status indicator (optional, used sparingly)
- Section, badge, and action labels in lowercase English: `plugin manager`, `system`, `json`, `install`, `remove`, `reload`
- This gives a deliberate developer-tool personality

---

## 3. Color System

### 3.1 Architecture

6 themes, each defined as a set of CSS custom properties on `[data-theme="..."]`:

```
violet-dark    │  amber-dark    │  indigo-dark
violet-light   │  amber-light   │  indigo-light
```

### 3.2 CSS Variable Contract

Every theme MUST define these 10 variables:

```css
--bg-surface    /* main background */
--bg-raised     /* cards, inputs, hover base */
--bg-hover      /* hover state (if different from raised) */
--tx-primary    /* primary text */
--tx-secondary  /* secondary/description text */
--tx-muted      /* placeholder, hints */
--accent        /* accent color for borders, buttons, selection indicator */
--accent-text   /* accent color for text (lighter for readability on dark bg) */
--accent-bg     /* translucent accent for backgrounds */
--border        /* border color */
--danger        /* destructive actions (uninstall, delete) */
```

### 3.3 Theme Definitions

#### Dark Violet
```css
--bg-surface: #1a1a1e;  --bg-raised: #242428;
--tx-primary: #eee;     --tx-secondary: #9e9ea6;  --tx-muted: #66666e;
--accent: #8b5cf6;      --accent-text: #a78bfa;
--accent-bg: rgba(139,92,246,0.12);
--border: rgba(255,255,255,0.06);
--danger: #f87171;
```

#### Dark Amber
```css
--bg-surface: #13130f;  --bg-raised: #1d1d18;
--tx-primary: #f0ede6;  --tx-secondary: #8a877e;   --tx-muted: #5a5852;
--accent: #f59e0b;      --accent-text: #fbbf24;
--accent-bg: rgba(245,158,11,0.1);
--border: rgba(255,255,255,0.05);
--danger: #f87171;
```

#### Dark Indigo
```css
--bg-surface: #0f1117;  --bg-raised: #191b22;
--tx-primary: #e8ecf0;  --tx-secondary: #7a8596;   --tx-muted: #4a5568;
--accent: #6366f1;      --accent-text: #818cf8;
--accent-bg: rgba(99,102,241,0.1);
--border: rgba(255,255,255,0.06);
--danger: #f87171;
```

#### Light Violet
```css
--bg-surface: #f8f7f4;  --bg-raised: #f0efec;
--tx-primary: #1a1a1e;  --tx-secondary: #6b6b72;   --tx-muted: #9e9ea6;
--accent: #7c5cfc;      --accent-text: #6d4fe0;
--accent-bg: rgba(124,92,252,0.08);
--border: rgba(0,0,0,0.07);
--danger: #dc2626;
```

#### Light Amber
```css
--bg-surface: #faf8f4;  --bg-raised: #f2f0ea;
--tx-primary: #1a1a18;  --tx-secondary: #6b6a62;   --tx-muted: #9e9d94;
--accent: #d97706;      --accent-text: #b45309;
--accent-bg: rgba(217,119,6,0.08);
--border: rgba(0,0,0,0.07);
--danger: #dc2626;
```

#### Light Indigo
```css
--bg-surface: #f5f6f9;  --bg-raised: #edeef2;
--tx-primary: #0f1117;  --tx-secondary: #5c6677;   --tx-muted: #8a94a6;
--accent: #4f46e5;      --accent-text: #4338ca;
--accent-bg: rgba(79,70,229,0.08);
--border: rgba(0,0,0,0.07);
--danger: #dc2626;
```

---

## 4. Theme Switching

### 4.1 Mechanism

- Store current theme ID in Pinia `appStore.theme`
- Set `data-theme` attribute on `<html>` element via watcher in `App.vue`
- All theme variables defined in `:root[data-theme="..."]` blocks in `global.css`
- No runtime CSS injection — purely class-based switching

### 4.2 Theme Selector UI

Located at the top of the **Market view** (plugin management), accessible via the grid icon in the search bar.

```
┌──────────────────────────────────┐
│ ← back    plugin manager         │
├──────────────────────────────────┤
│                                  │
│ Theme                            │
│ [● Violet] [ Amber ] [ Indigo ] │  ← color swatches
│ [● Dark  ] [ Light ]             │  ← mode toggle
│                                  │
│ Install from directory           │
│ ...                              │
│                                  │
│ Installed plugins                │
│ ...                              │
└──────────────────────────────────┘
```

Theme selector controls:
- Three color direction pills/swatches: Violet / Amber / Indigo
- Two mode pills: Dark / Light
- Combined theme ID derived from both selections (e.g., `violet-dark`)
- Active state uses accent color
- Changes apply immediately, no reload needed

---

## 5. Component Changes

### 5.1 global.css
- Replace existing CSS variables with the 6 theme blocks
- Add `--font-mono` token
- Remove hardcoded colors from scrollbar, selection

### 5.2 SearchInput.vue
- Keep as-is (already updated with SVG icon)
- No functional changes

### 5.3 ResultItem.vue
- Selected state: 3px left border + bg shift + icon scale(1.06)
- Badges use DM Mono
- Meta container for badges on the right

### 5.4 ResultList.vue
- Empty state text in Chinese: "输入关键词，快速启动" / "按 Esc 关闭 · 方向键切换"
- Uses SVG icon matching search icon style

### 5.5 ContextBar.vue
- Keep as-is (already redesigned with SVG)
- No functional changes

### 5.6 SearchView.vue
- Keep updated layout
- No functional changes

### 5.7 PluginView.vue
- Keep as-is
- No functional changes

### 5.8 PluginFrame.vue
- Keep as-is (already redesigned with spinner and SVG back button)
- No functional changes

### 5.9 MarketView.vue
- **Add theme selector section** at the top (before "install from directory")
- Theme selector: 3 color direction pills + 2 mode pills
- Persist selected theme in appStore
- Rest of the layout already updated

### 5.10 App.vue
- Add watcher on `appStore.theme` → set `document.documentElement.dataset.theme`
- No other changes

### 5.11 appStore.ts
- Add `theme` ref with default `"violet-dark"`
- Add `setTheme(id: string)` action

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/styles/global.css` | Major — replace vars with 6 theme blocks |
| `src/stores/appStore.ts` | Minor — add `theme` state + `setTheme` |
| `src/App.vue` | Minor — add theme watcher |
| `src/views/MarketView.vue` | Moderate — add theme selector section |
| `src/components/*` | Minimal — verify all use CSS vars |

---

## 7. Out of Scope

- Window chrome/transparency settings
- Plugin iframe content theming (plugins style themselves)
- Animation system beyond 120ms transitions
- Custom font loading (uses system/Google Fonts via existing setup)

---

## 8. Success Criteria

1. All 6 themes render correctly with no hardcoded colors visible
2. Theme switching works instantly, no flash or layout shift
3. All views (Search, Plugin, Market) properly reflect theme changes
4. Theme persists across view switches (within session)
5. Layout matches approved B+C fusion spec:
   - 52px header, 17px search text, 5 items per screen
   - ❯ prompt, DM Mono metadata, lowercase English labels
