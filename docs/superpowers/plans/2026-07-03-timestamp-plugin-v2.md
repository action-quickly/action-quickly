# Timestamp Plugin v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `aq-timestamp` plugin with smart input, multiple output formats, custom editable templates, one-click copy, and compact UI.

**Architecture:** Single self-contained HTML file using the existing postMessage bridge. Token-based date formatter. Storage API for template persistence.

**Tech Stack:** Vanilla JS, CSS, plugin bridge (postMessage IPC), storage API.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `examples/plugins/timestamp/index.html` | **Rewrite** | Complete plugin: layout, styles, logic, bridge |
| `examples/plugins/timestamp/plugin.json` | No change | Manifest (already has `clipboard` + `storage` permissions) |

---

### Task 1: HTML Structure + CSS

**Files:**
- Rewrite: `examples/plugins/timestamp/index.html` (lines 1-100)

- [ ] **Step 1: Read current index.html**

Run: `Get-Content -LiteralPath "D:\project\action-quick\examples\plugins\timestamp\index.html"`

- [ ] **Step 2: Write HTML skeleton + CSS**

Replace the entire file with the new structure and styling.

CSS tokens: dark background (`#1a1a1e`), card surface (`#222226`), accent (`#4a9eff`), monospace font stack (`"JetBrains Mono", "Cascadia Code", monospace`).

Layout sections:
1. Live bar: `[当前: 1740960000 · 实时]`
2. Input: `[粘贴时间戳或日期...]` with auto-detect hint below
3. Output results: 5 rows (label + value + copy button)
4. Custom templates: list of (format string + rendered value + copy + edit/delete), plus "添加新模板" button
5. Error/info message line (hidden by default)

Required HTML structure:

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <style>/* all styles */</style>
</head>
<body>
  <div id="app">
    <div id="liveBar">
      <span class="label">当前:</span>
      <span class="value" id="liveTs">1740960000</span>
      <span class="dot" id="liveDot"></span>
      <span class="hint" id="liveHint">实时</span>
    </div>

    <div id="inputSection">
      <input id="inputField" placeholder="粘贴时间戳或日期..." />
      <div id="detectHint">自动检测: Unix 秒</div>
    </div>

    <div id="fixedOutputs">
      <div class="section-title">输出结果</div>
      <div id="outputList"></div>
    </div>

    <div id="templateSection">
      <div class="section-title">
        <span>自定义模板</span>
        <button id="addTemplateBtn">+ 添加新模板</button>
      </div>
      <div id="templateList"></div>
    </div>

    <div id="message"></div>
  </div>

  <script>/* all JS */</script>
</body>
</html>
```

CSS should match the dark compact C-style: rounded corners, subtle borders, monospace values, accent color for interactive elements, hover states on buttons.

- [ ] **Step 3: Verify structure renders**

Manual check: open in browser. Sections should be visible in correct order even without JS.

---

### Task 2: Bridge + Date Format Engine

**Files:**
- Modify: `examples/plugins/timestamp/index.html` (script section)

- [ ] **Step 1: Write IPC bridge (invoke + pending)**

```javascript
var ipcId = 0, pending = {};

function invoke(cmd, args) {
  return new Promise(function(resolve, reject) {
    var id = ++ipcId;
    pending[id] = { resolve: resolve, reject: reject };
    window.parent.postMessage({ source: 'action-quick-plugin', id: id, cmd: cmd, args: args || {} }, '*');
  });
}
```

- [ ] **Step 2: Write the formatDate function**

```javascript
function formatDate(date, fmt) {
  var map = {
    'yyyy': date.getFullYear(),
    'yy': String(date.getFullYear()).slice(2),
    'MM': pad(date.getMonth() + 1),
    'M': date.getMonth() + 1,
    'dd': pad(date.getDate()),
    'd': date.getDate(),
    'HH': pad(date.getHours()),
    'H': date.getHours(),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds()),
    'SSS': pad(date.getMilliseconds(), 3),
    'ZZ': timezoneOffset(date),
  };
  var result = fmt;
  for (var key in map) {
    result = result.split(key).join(map[key]);
  }
  return result;
}

function pad(n, width) {
  width = width || 2;
  n = String(n);
  while (n.length < width) n = '0' + n;
  return n;
}

function timezoneOffset(date) {
  var offset = -date.getTimezoneOffset();
  var sign = offset >= 0 ? '+' : '-';
  var h = pad(Math.floor(Math.abs(offset) / 60));
  var m = pad(Math.abs(offset) % 60);
  return sign + h + m;
}
```

- [ ] **Step 3: Write weekday name helper**

```javascript
var WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var WEEKDAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
```

- [ ] **Step 4: Write shorthand format functions**

```javascript
function formatISO(date) {
  return date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate())
    + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
    + '.' + pad(date.getMilliseconds(), 3) + 'Z';
}
// RFC 2822: Mon, 03 Mar 2025 04:00:00 +0000
function formatRFC(date) {
  var dow = WEEKDAYS_SHORT[date.getUTCDay()];
  var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getUTCMonth()];
  var d = pad(date.getUTCDate());
  var h = pad(date.getUTCHours());
  var m = pad(date.getUTCMinutes());
  var s = pad(date.getUTCSeconds());
  return dow + ', ' + d + ' ' + mon + ' ' + date.getUTCFullYear() + ' ' + h + ':' + m + ':' + s + ' +0000';
}
function formatUTC(date) {
  return formatRFC(date).replace(' +0000', ' GMT');
}
```

- [ ] **Step 5: Write relative time function**

```javascript
function formatRelative(date) {
  var now = Date.now();
  var diff = date.getTime() - now;
  var abs = Math.abs(diff);
  var suffix = diff >= 0 ? '后' : '前';
  var units = [
    [365 * 86400000, '年'],
    [30 * 86400000, '个月'],
    [7 * 86400000, '周'],
    [86400000, '天'],
    [3600000, '小时'],
    [60000, '分钟'],
  ];
  for (var i = 0; i < units.length; i++) {
    var val = Math.floor(abs / units[i][0]);
    if (val >= 1) return val + ' ' + units[i][1] + suffix;
  }
  return '刚刚';
}
```

- [ ] **Step 6: Quick manual test**

Open in browser, call `formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')` from console, verify output.

---

### Task 3: Smart Input + Auto-Detect + Parser

**Files:**
- Modify: `examples/plugins/timestamp/index.html` (script section)

- [ ] **Step 1: Write auto-detect parser**

```javascript
function parseInput(text) {
  text = text.trim();
  if (!text) return null;

  // If purely numeric, treat as Unix timestamp
  if (/^\d{10}$/.test(text)) return new Date(parseInt(text) * 1000);
  if (/^\d{13}$/.test(text)) return new Date(parseInt(text));
  if (/^\d+$/.test(text)) {
    // Unknown digit count. Try as seconds or ms
    var n = parseInt(text);
    return n > 1e12 ? new Date(n) : new Date(n * 1000);
  }

  // Try as date string
  var d = new Date(text);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function detectType(text) {
  if (/^\d{10}$/.test(text)) return 'Unix 秒';
  if (/^\d{13}$/.test(text)) return 'Unix 毫秒';
  if (/^\d+$/.test(text)) return '数字 (自动判断)';
  return '日期字符串';
}
```

- [ ] **Step 2: Test parser functions manually**

Open in browser console, call `parseInput('1740960000')` → Date object. `parseInput('abc')` → null. `detectType('1740960000')` → "Unix 秒".

---

### Task 4: Fixed Output Formats Rendering

**Files:**
- Modify: `examples/plugins/timestamp/index.html` (script section)

- [ ] **Step 1: Write renderFixedOutputs function**

```javascript
var FIXED_FORMATS = [
  { label: '本地时间', render: function(d) { return formatDate(d, 'yyyy-MM-dd HH:mm:ss'); } },
  { label: 'ISO 8601', render: formatISO },
  { label: 'Unix 秒',  render: function(d) { return String(Math.floor(d.getTime() / 1000)); } },
  { label: 'Unix 毫秒',render: function(d) { return String(d.getTime()); } },
  { label: '相对时间', render: formatRelative },
];

function copyText(text, btn) {
  invoke('clipboard_write', { text: text }).then(function() {
    var orig = btn.textContent;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1000);
  }).catch(function(err) {
    // silent — clipboard permission is declared
  });
}

function renderFixedOutputs(date) {
  var list = document.getElementById('outputList');
  list.innerHTML = '';
  FIXED_FORMATS.forEach(function(fmt) {
    var val = fmt.render(date);
    list.appendChild(createOutputRow(fmt.label, val));
  });
}

function createOutputRow(label, value) {
  var row = document.createElement('div');
  row.className = 'output-row';

  var lbl = document.createElement('span');
  lbl.className = 'output-label';
  lbl.textContent = label;

  var val = document.createElement('span');
  val.className = 'output-value';
  val.textContent = value;

  var btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.textContent = '📋';
  btn.title = '复制';
  btn.addEventListener('click', function() { copyText(value, btn); });

  row.appendChild(lbl);
  row.appendChild(val);
  row.appendChild(btn);
  return row;
}
```

- [ ] **Step 2: Write renderAll + clearOutputs + onInputChange**

```javascript
var currentDate = new Date();

function renderAll() {
  renderFixedOutputs(currentDate);
}

function clearOutputs() {
  document.getElementById('outputList').innerHTML = '';
  document.getElementById('templateList').innerHTML = '';
}

function onInputChange() {
  var text = document.getElementById('inputField').value;
  var hint = document.getElementById('detectHint');

  if (!text) {
    hint.textContent = '';
    currentDate = new Date();
    renderAll();
    return;
  }

  var date = parseInput(text);
  if (date) {
    currentDate = date;
    hint.textContent = '自动检测: ' + detectType(text);
    hint.className = '';
    renderAll();
  } else {
    hint.textContent = '⚠ 无法解析';
    hint.className = 'error';
    clearOutputs();
  }
}

document.getElementById('inputField').addEventListener('input', onInputChange);
```

`renderAll` only renders fixed outputs here. Template rendering will be added in Task 6.

- [ ] **Step 3: Test manually**

Type `1740960000` in input → hint shows "自动检测: Unix 秒", 5 output rows appear. Type `abc` → "⚠ 无法解析", outputs clear. Clear input → shows current time.

---

### Task 5: Copy Button CSS

- [ ] **Step 1: Add CSS for .copied state**

```css
.copy-btn { background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 6px; border-radius: 4px; color: #666; transition: all .15s; }
.copy-btn:hover { background: rgba(74,158,255,.1); color: #4a9eff; }
.copy-btn.copied { color: #4ade80; }
```

---

### Task 6: Custom Templates

**Files:**
- Modify: `examples/plugins/timestamp/index.html` (script section)

- [ ] **Step 1: Define default templates + state**

```javascript
var DEFAULT_TEMPLATES = [
  { format: 'yyyy-MM-dd HH:mm:ss' },
  { format: 'yyyy/MM/dd' },
  { format: 'ISO 8601' },
  { format: 'RFC 2822' },
  { format: 'UTC 字符串' },
  { format: 'yyyy-MM-dd' },
  { format: 'yyyy年M月d日 HH:mm:ss' },
  { format: 'HH:mm:ss' },
];

var userTemplates = [];
```

- [ ] **Step 2: Write template render function**

```javascript
function renderTemplates(date) {
  var list = document.getElementById('templateList');
  list.innerHTML = '';
  var templates = userTemplates.length > 0 ? userTemplates : DEFAULT_TEMPLATES;

  templates.forEach(function(t, i) {
    var row = document.createElement('div');
    row.className = 'template-row';

    var fmtSpan = document.createElement('span');
    fmtSpan.className = 'template-format';
    fmtSpan.textContent = t.format;
    fmtSpan.contentEditable = true;
    fmtSpan.addEventListener('blur', function() {
      t.format = fmtSpan.textContent.trim() || t.format;
      fmtSpan.textContent = t.format;
      renderTemplateValue(row, date, t);
      saveTemplates();
    });
    // Enter to save
    fmtSpan.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); fmtSpan.blur(); }
    });

    var valSpan = document.createElement('span');
    valSpan.className = 'template-value';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.addEventListener('click', function() {
      copyText(valSpan.textContent, copyBtn);
    });

    var delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', function() {
      userTemplates.splice(i, 1);
      renderTemplates(date);
      saveTemplates();
    });

    row.appendChild(fmtSpan);
    row.appendChild(valSpan);
    row.appendChild(copyBtn);
    row.appendChild(delBtn);
    list.appendChild(row);

    renderTemplateValue(row, date, t);
  });
}

function renderTemplateValue(row, date, t) {
  var valSpan = row.querySelector('.template-value');
  var fmt = t.format;
  var shorthand = {
    'ISO 8601': formatISO,
    'RFC 2822': formatRFC,
    'UTC 字符串': formatUTC,
  };
  if (shorthand[fmt]) {
    valSpan.textContent = shorthand[fmt](date);
  } else {
    valSpan.textContent = formatDate(date, fmt);
  }
}
```

- [ ] **Step 3: Wire "添加新模板" button**

```javascript
document.getElementById('addTemplateBtn').addEventListener('click', function() {
  userTemplates.push({ format: 'yyyy-MM-dd HH:mm:ss' });
  renderTemplates(currentDate);
  saveTemplates();
});
```

- [ ] **Step 4: Update renderAll to include templates**

Replace the existing `renderAll` function to also render templates:

```javascript
function renderAll() {
  renderFixedOutputs(currentDate);
  renderTemplates(currentDate);
}
```

- [ ] **Step 5: Test manually**

Default 8 templates visible. Edit a format string → rendered value updates. Add new template → appears. Delete → removed.

---

### Task 7: Persistence (Storage API)

- [ ] **Step 1: Write save/load template functions**

```javascript
function saveTemplates() {
  var data = userTemplates.length > 0 ? userTemplates : null;
  invoke('storage_set', { key: 'templates', value: data }).catch(function() {
    // silent — fall back to defaults
  });
}

function loadTemplates() {
  return invoke('storage_get', { key: 'templates' }).then(function(data) {
    if (data && Array.isArray(data) && data.length > 0) {
      userTemplates = data;
    }
  }).catch(function() {
    // silent — use defaults
  });
}
```

- [ ] **Step 2: Call loadTemplates on init**

```javascript
loadTemplates().then(function() {
  renderAll();
});
```

- [ ] **Step 3: Test manually**

Edit a template, refresh the plugin → edit should persist. Delete all custom templates → defaults return.

---

### Task 8: Live Counter + Context Auto-Fill

- [ ] **Step 1: Write live counter**

```javascript
var liveTimer = null;

function startLiveCounter() {
  updateLiveTs();
  liveTimer = setInterval(updateLiveTs, 1000);
}

function updateLiveTs() {
  document.getElementById('liveTs').textContent = Math.floor(Date.now() / 1000);
  var dot = document.getElementById('liveDot');
  dot.style.opacity = dot.style.opacity === '1' ? '0.3' : '1';
}

function stopLiveCounter() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}
```

- [ ] **Step 2: Handle context auto-fill from plugin-params**

```javascript
window.addEventListener('message', function(e) {
  var d = e.data;
  if (!d || d.source !== 'action-quick-host') return;

  // Bridge init script injection (cross-origin support)
  if (d.type === 'aq-init-bridge' && d.script) {
    try { eval(d.script); } catch(x) {} return;
  }

  // Context text auto-fill
  if (d.type === 'plugin-params' && d.params) {
    if (d.params.contextText) {
      document.getElementById('inputField').value = d.params.contextText.trim();
      onInputChange();
    }
    return;
  }

  // IPC response routing
  if (d.id && pending[d.id]) {
    var c = pending[d.id];
    delete pending[d.id];
    d.error ? c.reject(d.error) : c.resolve(d.result);
  }
});
```

- [ ] **Step 3: Init plugin on load**

```javascript
// Init
currentDate = new Date();
startLiveCounter();
loadTemplates().then(function() {
  renderAll();
});
```

---

### Task 9: Final Integration + Polish

- [ ] **Step 1: Handle empty state**

When input is empty, show current time in all outputs:

```javascript
function onInputChange() {
  var text = document.getElementById('inputField').value;
  var hint = document.getElementById('detectHint');

  if (!text) {
    hint.textContent = '';
    currentDate = new Date();
    renderAll();
    return;
  }
  // ... rest of handler
}
```

- [ ] **Step 2: Add error styling**

```css
#detectHint { font-size: 11px; color: #666; margin-top: 4px; transition: color .15s; }
#detectHint.error { color: #ff4d4d; }
```

- [ ] **Step 3: Final review of the complete file**

Check:
- All `invoke()` calls use correct command names (`clipboard_write`, `storage_set`, `storage_get`)
- All event listeners are wired
- No undefined variable references
- Relative time handles future dates correctly
- Copy feedback works
- Empty input shows current time
- Templates persist across loads
- Edge cases: invalid date, empty string, very large numbers

- [ ] **Step 4: Self-review against spec**

Walk through each section of the design spec and verify the implementation:
- [ ] Smart input auto-detect
- [ ] 5 fixed output formats
- [ ] 8 default custom templates
- [ ] Template edit/add/remove
- [ ] Clipboard copy with feedback
- [ ] Persistence via storage API
- [ ] Live counter
- [ ] Context auto-fill
- [ ] Error handling
