# Create Plugin Scaffolder Design

**Date:** 2026-07-05
**Status:** Draft

## Problem

The current `create-action-quick-plugin` scaffolding tool:

- Supports `vanilla/vue/react/svelte` options but all generate identical vanilla JS templates
- No framework-specific templates (dependencies, build config, component structure)
- SDK (`@action-quick/sdk`) exists but is not used by the scaffolder
- Generated plugins use raw `postMessage` IPC instead of the SDK's `window.aq.*` bridge

## Solution

### 1. Simplify Framework Options

Reduce to two options:

| Option | Description |
|--------|-------------|
| `vanilla` | Plain HTML/CSS/JS, no build step. Same as current template. |
| `react` | React 18 + Vite + `vite-plugin-singlefile`, full build pipeline. |

### 2. React Plugin Template Structure

```
my-plugin/
├── plugin.json            # manifest, "main": "dist/index.html"
├── package.json           # react, react-dom, @action-quick/sdk, vite, vite-plugin-singlefile
├── vite.config.js         # Vite config with singlefile plugin
├── index.html             # Vite HTML entry
├── src/
│   ├── main.jsx           # React entry: init SDK bridge
│   ├── App.jsx            # Main component with example usage
│   └── App.css            # Styles
└── README.md
```

**`plugin.json`:**
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "",
  "description": "A React-based ActionQuick plugin",
  "icon": "icon.png",
  "main": "dist/index.html",
  "keywords": ["my-plugin"],
  "permissions": ["clipboard", "storage"],
  "minHostVersion": "0.2.0"
}
```

**`package.json` dependencies:**
- `react` (^18)
- `react-dom` (^18)
- `@action-quick/sdk` (linked locally)
- `vite` (^5)
- `vite-plugin-singlefile` (^2)
- `@vitejs/plugin-react` (^4)

**`vite.config.js`:** Uses `@vitejs/plugin-react` + `vite-plugin-singlefile` to produce a single `dist/index.html` with all JS/CSS inlined, suitable for iframe `srcdoc`.

**`src/App.jsx`:** Basic component demonstrating:
- Listen for plugin params (`query`, `contextText`) via `window.addEventListener('message')` + `plugin-params` event
- Clipboard read/write via `aq.clipboard`
- Storage get/set via `aq.storage`
- Notification via `aq.notification`

### 3. SDK Distribution (npm link)

- `@action-quick/sdk` (in `packages/sdk/`) stays in the monorepo
- Plugin developers run `npm link @action-quick/sdk` after scaffolding
- SDK package references `window.aq` (the bridge injected by the host)
- Plugin code: `import { aq } from '@action-quick/sdk'`

### 4. Vanilla Template Update

- Keep the current vanilla template but update `minHostVersion` to `0.2.0`
- Optionally add SDK import note in README

### 5. Files Changed

| File | Action |
|------|--------|
| `packages/create-action-quick-plugin/package.json` | Update description, add dependencies if needed |
| `packages/create-action-quick-plugin/bin/index.js` | Rewrite: framework selection, React template generation |
| `packages/create-action-quick-plugin/templates/react/` | Create: template files |
| `packages/sdk/package.json` | Build before linking (ensure dist/ exists) |

### 6. Non-goals

- No npm publishing of SDK or scaffolder
- No `vue`/`svelte` templates initially
- No plugin testing framework
- No HMR for plugin development (uses `aq-debug` manual refresh)

## Developer Workflow

```bash
# Scaffold
npx create-action-quick-plugin my-plugin react
cd my-plugin

# Install dependencies
npm install
npm link @action-quick/sdk

# Build the plugin (outputs dist/index.html)
npm run build

# Debug with ActionQuick
aq-debug

# Iterate: edit src/ → rebuild → refresh (↻ button in PluginView)
```

## Verification

- Run scaffolder → produces correct directory structure
- `npm run build` succeeds → outputs `dist/index.html` with inlined assets
- `aq-debug` loads the plugin and bridge APIs work
