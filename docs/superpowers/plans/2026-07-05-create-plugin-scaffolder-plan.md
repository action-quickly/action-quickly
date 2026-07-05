# Create Plugin Scaffolder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `create-action-quick-plugin` to generate a proper React-based plugin scaffold with Vite build and SDK integration.

**Architecture:** Two parts: (1) template files under `templates/react/` for the React scaffold; (2) rewrite `bin/index.js` to select and copy templates. SDK stays in monorepo, used via `npm link`.

**Tech Stack:** Node.js (ESM), React 18, Vite 5, vite-plugin-singlefile

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/create-action-quick-plugin/package.json` | Modify | No changes needed (already ESM + bin) |
| `packages/create-action-quick-plugin/templates/react/package.json` | Create | React deps + SDK reference |
| `packages/create-action-quick-plugin/templates/react/vite.config.js` | Create | Vite + React + singlefile config |
| `packages/create-action-quick-plugin/templates/react/index.html` | Create | Vite HTML entry |
| `packages/create-action-quick-plugin/templates/react/src/main.jsx` | Create | React entry point |
| `packages/create-action-quick-plugin/templates/react/src/App.jsx` | Create | Main component with SDK demo |
| `packages/create-action-quick-plugin/templates/react/src/App.css` | Create | Styles |
| `packages/create-action-quick-plugin/templates/react/plugin.json` | Create | Plugin manifest |
| `packages/create-action-quick-plugin/templates/react/README.md` | Create | Dev instructions |
| `packages/create-action-quick-plugin/templates/vanilla/` | Create | Move existing inline templates to files |
| `packages/create-action-quick-plugin/bin/index.js` | Modify | Rewrite to copy from template dirs |
| `packages/sdk/` | Ensure built | Run `npm run build` so dist/ exists |

---

### Task 1: Build the SDK

**Files:**
- Modify: `packages/sdk/` (build output)

- [ ] **Step 1: Build SDK**

```bash
cd packages/sdk; npm run build
```

Expected: `dist/index.js`, `dist/index.d.ts`, and other module files are created.

- [ ] **Step 2: Verify SDK dist exists**

```bash
ls packages/sdk/dist/
```

Expected: multiple `.js` and `.d.ts` files.

- [ ] **Step 3: npm link the SDK globally**

```bash
cd packages/sdk; npm link
```

Expected: `@action-quick/sdk` is available globally for linking.

---

### Task 2: Create React template files

**Files:**
- Create: `packages/create-action-quick-plugin/templates/react/package.json`
- Create: `packages/create-action-quick-plugin/templates/react/vite.config.js`
- Create: `packages/create-action-quick-plugin/templates/react/index.html`
- Create: `packages/create-action-quick-plugin/templates/react/src/main.jsx`
- Create: `packages/create-action-quick-plugin/templates/react/src/App.jsx`
- Create: `packages/create-action-quick-plugin/templates/react/src/App.css`
- Create: `packages/create-action-quick-plugin/templates/react/plugin.json`
- Create: `packages/create-action-quick-plugin/templates/react/README.md`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/create-action-quick-plugin/templates/react/src
```

- [ ] **Step 2: Create `templates/react/package.json`**

```json
{
  "name": "my-plugin",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@action-quick/sdk": "^1.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.14",
    "vite-plugin-singlefile": "^2.0.3"
  }
}
```

Note: Versions are pinned to known-stable ranges. The `name` will be replaced by the scaffolder.

- [ ] **Step 3: Create `templates/react/vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 4: Create `templates/react/index.html`**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PLUGIN_NAME</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

`PLUGIN_NAME` is a placeholder replaced by the scaffolder.

- [ ] **Step 5: Create `templates/react/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create `templates/react/src/App.jsx`**

```jsx
import { useState, useEffect } from 'react';

function App() {
  const [params, setParams] = useState({ query: null, contextText: null });
  const [result, setResult] = useState('');

  useEffect(() => {
    function handleMessage(e) {
      const d = e.data;
      if (d && d.type === 'plugin-params') {
        setParams({ query: d.params.query, contextText: d.params.contextText });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  async function handleClipboard() {
    try {
      await window.aq.clipboard.write('Hello from React plugin!');
      setResult('✓ 已写入剪贴板');
    } catch (e) {
      setResult('✗ ' + e);
    }
  }

  async function handleNotification() {
    try {
      await window.aq.notification.show({ title: 'React Plugin', body: '来自插件通知' });
      setResult('✓ 通知已发送');
    } catch (e) {
      setResult('✗ ' + e);
    }
  }

  return (
    <div className="app">
      <h1>PLUGIN_NAME</h1>
      <div className="card">
        <strong>插件参数</strong>
        <p>query: {params.query || '(无)'}</p>
        <p>contextText: {params.contextText || '(无)'}</p>
      </div>
      <div className="card">
        <strong>操作</strong>
        <div className="actions">
          <button onClick={handleClipboard}>写入剪贴板</button>
          <button onClick={handleNotification}>发送通知</button>
        </div>
      </div>
      {result && <div className="result">{result}</div>}
    </div>
  );
}

export default App;
```

`PLUGIN_NAME` is a placeholder replaced by the scaffolder.

- [ ] **Step 7: Create `templates/react/src/App.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", sans-serif; background: rgba(30,30,35,0.95); color: #e8e8e8; padding: 24px; height: 100vh; }
.app { display: flex; flex-direction: column; gap: 16px; }
h1 { font-size: 20px; }
.card { background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; font-size: 13px; }
.card p { margin-top: 4px; color: #999; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
button { background: #4a9eff; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; }
button:hover { background: #3a8ee5; }
.result { background: rgba(74,158,255,0.1); padding: 12px 16px; border-radius: 8px; font-size: 13px; }
```

- [ ] **Step 8: Create `templates/react/plugin.json`**

```json
{
  "id": "PLUGIN_ID",
  "name": "PLUGIN_NAME",
  "version": "1.0.0",
  "author": "",
  "description": "A React-based ActionQuick plugin",
  "icon": "icon.png",
  "main": "dist/index.html",
  "keywords": ["PLUGIN_ID"],
  "permissions": ["clipboard", "storage", "notification"],
  "minHostVersion": "0.2.0"
}
```

`PLUGIN_ID` and `PLUGIN_NAME` are placeholders replaced by the scaffolder.

- [ ] **Step 9: Create `templates/react/README.md`**

```markdown
# PLUGIN_NAME

ActionQuick 插件

## 开发

```bash
npm install
npm link @action-quick/sdk
npm run build
aq-debug
```

## 构建

```bash
npm run build
# 输出 dist/index.html（单文件，可直接加载）
```
```

- [ ] **Step 10: Commit templates**

```bash
git add packages/create-action-quick-plugin/templates/
git commit -m "feat: add React plugin template files"
```

---

### Task 3: Rewrite the scaffolder

**Files:**
- Modify: `packages/create-action-quick-plugin/bin/index.js`
- Create: `packages/create-action-quick-plugin/templates/vanilla/plugin.json`
- Create: `packages/create-action-quick-plugin/templates/vanilla/index.html`
- Create: `packages/create-action-quick-plugin/templates/vanilla/README.md`

- [ ] **Step 1: Create vanilla template files**

Create `templates/vanilla/plugin.json`:
```json
{
  "id": "PLUGIN_ID",
  "name": "PLUGIN_NAME",
  "version": "1.0.0",
  "author": "",
  "description": "A new ActionQuick plugin",
  "icon": "icon.png",
  "main": "index.html",
  "keywords": ["PLUGIN_ID"],
  "permissions": ["clipboard"],
  "minHostVersion": "0.2.0"
}
```

Create `templates/vanilla/index.html`:
```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PLUGIN_NAME</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; background: rgba(30,30,35,0.95); color: #e8e8e8; padding: 24px; height: 100vh; display: flex; flex-direction: column; gap: 16px; }
    h1 { font-size: 20px; }
    .params { background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #999; }
    .params code { color: #4a9eff; }
    button { background: #4a9eff; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-family: inherit; }
    button:hover { background: #3a8ee5; }
    .result { background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; font-size: 13px; min-height: 40px; }
  </style>
</head>
<body>
  <h1>PLUGIN_NAME</h1>
  <div class="params" id="params">加载参数中...</div>
  <button id="actionBtn">写入剪贴板</button>
  <div class="result" id="result">结果将显示在这里</div>

  <script>
    var paramsEl = document.getElementById('params');
    var resultEl = document.getElementById('result');

    window.addEventListener('message', function(e) {
      var d = e.data;
      if (!d || d.source !== 'action-quick-host') return;
      if (d.type === 'aq-init-bridge' && d.script) { try { eval(d.script); } catch(x){} return; }
      if (d.type === 'plugin-params') {
        paramsEl.innerHTML = 'query: <code>' + (d.params.query || '无') + '</code><br>contextText: <code>' + (d.params.contextText || '无') + '</code>';
      }
    });

    document.getElementById('actionBtn').addEventListener('click', function() {
      window.aq.clipboard.write('Hello from PLUGIN_ID!')
        .then(function() { resultEl.textContent = '已写入剪贴板'; })
        .catch(function(e) { resultEl.textContent = '错误: ' + e; });
    });
  </script>
</body>
</html>
```

Create `templates/vanilla/README.md`:
```markdown
# PLUGIN_NAME

ActionQuick 插件: PLUGIN_NAME

## 开发

```bash
aq-debug
```

## 权限

- clipboard: 剪贴板读写
```
```

- [ ] **Step 2: Rewrite `bin/index.js`**

Replace the entire file:

```javascript
#!/usr/bin/env node

import { mkdir, cp, readFile, writeFile, readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const FRAMEWORKS = ['vanilla', 'react'];

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function placeholderReplacer(name, pluginId) {
  return (content) =>
    content
      .replace(/PLUGIN_NAME/g, name)
      .replace(/PLUGIN_ID/g, pluginId);
}

async function copyTemplate(srcDir, destDir, transformContent) {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      const subdir = join(destDir, entry.name);
      await mkdir(subdir, { recursive: true });
      await copyTemplate(srcPath, destPath, transformContent);
    } else {
      const content = await readFile(srcPath, 'utf-8');
      await writeFile(destPath, transformContent(content));
    }
  }
}

async function main() {
  console.log('\n🚀 ActionQuick Plugin Scaffolder\n');

  let name = process.argv[2];
  if (!name) {
    name = await ask('插件名称 (如 my-plugin): ');
    if (!name) {
      console.error('插件名称不能为空');
      process.exit(1);
    }
  }

  const pluginId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  let framework = process.argv[3];
  if (!framework || !FRAMEWORKS.includes(framework)) {
    console.log('可选框架: ' + FRAMEWORKS.join(', '));
    framework = await ask('选择框架 (默认 vanilla): ');
    if (!framework || !FRAMEWORKS.includes(framework)) {
      framework = 'vanilla';
    }
  }

  const targetDir = resolve(process.cwd(), name);
  if (existsSync(targetDir)) {
    console.error(`目录已存在: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\n创建插件: ${pluginId} (${framework})`);
  console.log(`目录: ${targetDir}\n`);

  const templateDir = join(TEMPLATES_DIR, framework);
  if (!existsSync(templateDir)) {
    console.error(`错误: 未找到框架模板 ${framework}`);
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });
  const transform = placeholderReplacer(name, pluginId);
  await copyTemplate(templateDir, targetDir, transform);

  console.log('  ✓ 所有文件已创建');

  if (framework === 'react') {
    console.log('\n📦 下一步:');
    console.log(`  cd ${name}`);
    console.log('  npm install');
    console.log('  npm link @action-quick/sdk');
    console.log('  npm run build');
    console.log('  aq-debug');
  } else {
    console.log('\n📦 下一步:');
    console.log(`  cd ${name}`);
    console.log('  aq-debug');
  }
}

main().catch((e) => {
  console.error('错误:', e.message);
  process.exit(1);
});
```

- [ ] **Step 3: Verify scaffolder works**

```bash
cd /tmp; node D:/project/action-quick/packages/create-action-quick-plugin/bin/index.js test-plugin react
```

Expected: Creates `test-plugin/` directory with React template files, placeholders replaced.

- [ ] **Step 4: Verify Vite build works in scaffolded project**

```bash
cd /tmp/test-plugin; npm install; npm link @action-quick/sdk; npm run build
```

Expected: Vite builds successfully, outputs `dist/index.html`.

- [ ] **Step 5: Clean up test directory**

```bash
rm -rf /tmp/test-plugin
```

- [ ] **Step 6: Commit**

```bash
git add packages/create-action-quick-plugin/
git commit -m "feat: rewrite scaffolder with template files and React support"
```

---

### Task 4: Update vanilla template and cleanup

**Files:**
- Delete: `packages/plugin-sdk/` (redundant, `packages/sdk/` is the canonical SDK)

- [ ] **Step 1: Remove redundant plugin-sdk package**

Verify it's not referenced anywhere first:
```bash
rg "@action-quick/plugin-sdk" --files
```

If no references found:
```bash
git rm -r packages/plugin-sdk/
```

- [ ] **Step 2: Update monorepo plan summary**

No change needed — the summary already tracks both SDK packages as existing.

- [ ] **Step 3: Verify final state**

```bash
cd D:/project/action-quick; npm test
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git rm -r packages/plugin-sdk/
git commit -m "chore: remove redundant plugin-sdk package"
```

---

## Self-Review

- **Spec coverage**: Spec says "React template with Vite + vite-plugin-singlefile" (Task 2), "SDK via npm link" (Task 1), "scaffolder rewritten" (Task 3), "vanilla template updated" (Task 3 built into template files). All covered.
- **Placeholder scan**: No TBD/TODO. Template files use `PLUGIN_NAME`/`PLUGIN_ID` placeholders that are clearly replaced by the scaffolder.
- **Type consistency**: Template files use `window.aq.*` API matching `@action-quick/sdk`'s `AQBridge` interface. No naming conflicts.
- **Template file list**: All template files are explicitly created in Task 2 steps. No missing files.
