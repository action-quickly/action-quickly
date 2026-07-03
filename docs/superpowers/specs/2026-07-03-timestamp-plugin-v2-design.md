# Timestamp Plugin v2 — Design Spec

## Overview

Redesign the `aq-timestamp` plugin with enriched functionality and a new compact UI. The plugin converts between Unix timestamps and human-readable dates, supporting multiple output formats, custom format templates, and one-click copy.

## Layout (方案 C — 极简灵动)

Single-column compact layout, top to bottom:

```
┌──────────────────────────────────┐
│ 当前: 1740960000  · 实时          │ ← live status bar
├──────────────────────────────────┤
│ [ 粘贴时间戳或日期...           ] │ ← smart input, auto-detect
│  ↳ 自动检测: Unix秒/毫秒/日期...  │
├──────────────────────────────────┤
│ 输出结果                         │
│ ┌────────────────────────────┐  │
│ │ 本地时间    2025-03-03... │📋│
│ │ ISO 8601    2025-03-03... │📋│
│ │ Unix 秒     1740960000    │📋│
│ │ Unix 毫秒   1740960000000 │📋│
│ │ 相对时间    2 个月前      │📋│
│ └────────────────────────────┘  │
├──────────────────────────────────┤
│ 自定义模板                       │
│ ┌────────────────────────────┐  │
│ │ yyyy-MM-dd HH:mm:ss   编辑 │  │
│ │ 2025-03-03 12:00:00    📋 │  │
│ ├────────────────────────────┤  │
│ │ yyyy/MM/dd            编辑 │  │
│ │ 2025/03/03             📋 │  │
│ ├────────────────────────────┤  │
│ │ RFC 2822              编辑 │  │
│ │ Mon, 03 Mar 2025...   📋 │  │
│ ├────────────────────────────┤  │
│ │ [+ 添加新模板]             │  │
│ └────────────────────────────┘  │
└──────────────────────────────────┘
```

## Features

### 1. Smart Input
- Single text input field
- Auto-detect: if the value is purely numeric (10-13 digits) → treat as Unix timestamp (seconds or milliseconds); otherwise → parse as date string via `new Date()`
- Results update on every input change (no button press needed)
- Placeholder text guides the user
- Detection hint displayed below the input

### 2. Fixed Output Formats
Always shows 5 formats for the current input value:
| Format | Example |
|--------|---------|
| 本地时间 (Local) | `2025-03-03 12:00:00` |
| ISO 8601 | `2025-03-03T04:00:00.000Z` |
| Unix 秒 | `1740960000` |
| Unix 毫秒 | `1740960000000` |
| 相对时间 | `2 个月前` |

Each row has a copy (📋) button that writes to clipboard.

### 3. Custom Templates
- 8 pre-filled default templates (editable):
  - `yyyy-MM-dd HH:mm:ss`
  - `yyyy/MM/dd`
  - `ISO 8601` (shorthand: `yyyy-MM-ddTHH:mm:ss.SSSZ`)
  - `RFC 2822` (shorthand: `ddd, DD MMM YYYY HH:mm:ss ZZ`)
  - `UTC 字符串` (shorthand: `ddd, DD MMM YYYY HH:mm:ss GMT`)
  - `仅日期` (`yyyy-MM-dd`)
  - `中文格式` (`yyyy年M月d日 HH:mm:ss`)
  - `仅时间` (`HH:mm:ss`)
- Each template line shows: format string (editable text) + rendered output (read-only) + copy button
- Click the format string to edit inline
- Changes persist via `storage` API
- "添加新模板" button appends a blank template row

### 4. Live Status Bar
- Shows current Unix timestamp in seconds
- Updates every second
- Compact: single line, no extra decoration

### 5. Clipboard Integration
- Each output line has a copy button
- Uses `invoke("clipboard_write", { text })` via plugin bridge
- Brief visual feedback on copy success

### 6. Context-Aware Launch
- When triggered from context (selected text matching `^\d{10}$|^\d{13}$`): the selected text auto-fills the input and triggers conversion
- No change needed to `plugin.json` context pattern

## Data Flow

```
User input text
    │
    ▼
Parser (auto-detect type)
    │
    ├─ numeric (10-13 digits) → parse as Unix timestamp
    │     10 digits → seconds → *1000
    │     13 digits → milliseconds → use as-is
    │
    └─ non-numeric → new Date(input)
    │
    ▼
Date object (validated)
    │
    ├─ Fixed formatters → render 5 output rows
    ├─ User templates → render each template
    └─ Relative time → compute diff
    │
    ▼
Render all rows + attach copy handlers
```

## Template Format Syntax

Use a simple token-based syntax (not strftime):

| Token | Meaning | Example |
|-------|---------|---------|
| `yyyy` | 4-digit year | `2025` |
| `yy` | 2-digit year | `25` |
| `MM` | 2-digit month | `03` |
| `M` | month (no padding) | `3` |
| `dd` | 2-digit day | `03` |
| `d` | day (no padding) | `3` |
| `HH` | 2-digit hour (24h) | `12` |
| `H` | hour (24h, no padding) | `12` |
| `mm` | 2-digit minute | `05` |
| `ss` | 2-digit second | `09` |
| `SSS` | milliseconds | `123` |
| `ddd` | short weekday | `Mon` |
| `dddd` | full weekday | `Monday` |
| `ZZ` | timezone offset | `+0800` |
| `GMT` | GMT string | `GMT` |

Shorthand templates (ISO 8601, RFC 2822, UTC) use fixed formatting functions and ignore the format string edits — user edits to those are treated as custom templates instead.

## Persistence

- Custom templates stored via `invoke("storage_set", { key: "templates", value: [...] })`
- Loaded on init via `invoke("storage_get", { key: "templates" })`
- Fall back to defaults if no stored data

## Error Handling

- Invalid date input: show "无效日期" in results area
- Copy failure: silent (no error shown, clipboard permission is declared)
- Storage read/write failure: fall back to defaults

## Plugin Manifest Changes

No changes to `plugin.json` required. Existing permissions (`clipboard`, `storage`) already cover all new features.

## Files Changed

- `examples/plugins/timestamp/index.html` — complete rewrite
- `docs/timestamp-ui-mockup.html` — remove after implementation (visual reference only)

## Constraints

- Self-contained single HTML file (no external deps, no build step)
- Inline `invoke()` bridge pattern (same as current plugin, not SDK)
- No new permissions required
- Must remain compatible with existing `aq-timestamp` plugin ID
