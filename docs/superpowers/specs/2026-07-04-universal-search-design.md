# Universal Search Design

## Overview

Expand the search from plugin-only to a universal launcher supporting calculator, URL opening, and local app search. Plugins retain higher priority through a weight multiplier in the ranking system.

## Architecture

### Approach: Lightweight Source Functions (Approach C)

Each search type is a plain function. No interfaces or classes. `useSearch` becomes a coordinator that calls each function, merges results, and ranks them.

### File Structure

**Frontend (`src/search/`):**
```
src/search/
├── calculator.ts    # Scientific calculator
├── url.ts           # URL auto-detection
├── apps.ts          # Local app search (calls Rust backend)
└── types.ts         # Shared types
```

**Rust backend (`src-tauri/src/`):**
```
src-tauri/src/apps/
├── mod.rs           # Shared DesktopApp struct + command
├── windows.rs       # Windows .lnk scanning + parsing
└── macos.rs         # macOS .app scanning
```

### Modified Files

- `src/types/plugin.d.ts` — Expand `SearchResultItem.type`
- `src/composables/useSearch.ts` — Coordinator calling each search function
- `src/components/ResultItem.vue` — Type badge display
- `src/stores/appStore.ts` — Add app list state
- `src/views/SearchView.vue` — Initialize app search on mount
- `src-tauri/src/lib.rs` — Register new commands
- `src-tauri/Cargo.toml` — Add `windows` crate (Windows only)
- `src-tauri/capabilities/default.json` — Ensure opener capability

### SearchResultItem Type Extension

```typescript
type: "plugin" | "calculator" | "url" | "app"
```

## Search Types

### 1. Calculator (Pure Frontend)

**Supported operations:**

| Category | Examples |
|----------|----------|
| Basic arithmetic | `128+3`, `100/3`, `12*5` |
| Power | `2^10`, `3**2` |
| Percentage | `15%200`, `200*15%` |
| Parentheses | `(1+2)*3` |
| Trigonometric | `sin(30)`, `cos(pi/4)`, `tan(45)` |
| Logarithmic | `log(100)`, `ln(e)` |
| Square root | `sqrt(144)`, `√2` |
| Absolute value | `abs(-5)` |
| Constants | `pi`, `e` |

**Detection logic:**
- Contains digits and operators (`+-*/^%`)
- Or contains math function names (`sin`, `cos`, `log`, etc.)
- Does not contain letters (except function names and constants)

**Implementation:**
- Use `math.js` library for expression evaluation (proven, handles scientific functions, operator precedence, implicit multiplication)
- Degree mode for trigonometric functions by default (sin(90) = 1, not sin(90 rad))
- Implicit multiplication rules: `2pi` → `2*pi`, `2(3+4)` → `2*(3+4)`, `(2)(3)` → `2*3`
- Constants: `pi` (3.14159...), `e` (2.71828...)

**Ranking:** Fixed at L1 layer (below exact plugin matches, above fuzzy matches).

### 2. URL Auto-Detection (Pure Frontend)

**Detection patterns:**
```typescript
const URL_PATTERNS = [
  /^(https?:\/\/)/i,                                    // http:// or https://
  /^(www\.)[a-zA-Z0-9]/i,                              // www. prefix
  /^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/,         // domain.tld format
];
```

**Supported formats:**
- `github.com` → auto-prepends `https://`
- `www.baidu.com` → `https://www.baidu.com`
- `https://example.com/path?q=1` → used directly

**Opening:** Uses existing `tauri-plugin-opener` via `plugin:opener|open_url`.

**Ranking:** Fixed at L1 layer.

### 3. Local App Search (Rust + Frontend)

**Lazy loading strategy:**
1. Search works immediately with plugins (<50ms)
2. Background scan starts on mount
3. Apps become searchable as scan completes
4. Results incrementally update via Tauri events

**Rust command: `list_desktop_apps`**

Scans for desktop shortcuts and returns app metadata:

```rust
struct DesktopApp {
    name: String,           // Display name (without .lnk/.app extension)
    path: String,           // Full path to shortcut/bundle
    target: Option<String>, // Resolved executable path
    icon: Option<String>,   // Icon path (if resolvable)
}
```

**Platform-specific scanning:**

**Windows:**
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`
- `%USERPROFILE%\Desktop\`
- `%PUBLIC%\Desktop\`
- Parse `.lnk` files using `windows` crate's `IShellLink` COM interface
- Resolve target path and icon from shortcut

**macOS:**
- `/Applications/`
- `~/Applications/`
- Read `.app` bundles directly
- Extract name and icon from `Info.plist`

**Event-driven incremental delivery:**
```rust
#[tauri::command]
async fn list_desktop_apps(app: AppHandle) -> Vec<DesktopApp> {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        // Batch 1: Fast scan of common locations
        let fast_results = scan_common_locations();
        handle.emit("apps-batch", &fast_results).unwrap();
        
        // Batch 2: Full scan including subdirectories
        let full_results = scan_all_shortcuts();
        handle.emit("apps-batch", &full_results).unwrap();
    });
    
    vec![]  // Return empty immediately
}
```

**Frontend:**
```typescript
let appList: DesktopApp[] = [];
let loaded = false;

export function initAppSearch() {
  invoke("list_desktop_apps");
  listen<DesktopApp[]>("apps-batch", (event) => {
    appList = event.payload;
    loaded = true;
  });
}

export function searchApps(query: string): SearchResultItem[] {
  if (!loaded || appList.length === 0) return [];
  // Fuzzy match against app names
}
```

**Ranking:** App results use the same scoring system as plugins (use count × 0.6 + recency × 0.4), but without the 1.5x plugin weight multiplier.

## Result Ranking & Merging

### Layer Definitions (Extended)

| Layer | Meaning | Examples |
|-------|---------|----------|
| L0 | Plugin exact match | Query = plugin name |
| L1 | Plugin prefix match / Calculator / URL | `128*` shows calculator |
| L2 | Plugin fuzzy match / App exact match | Pinyin match / App name match |
| L3 | Plugin context match | Clipboard is JSON → JSON formatter |
| L5 | Fallback (no query shows all) | Empty input lists all plugins |

### Merge Logic

```typescript
const results = computed(() => {
  const query = appStore.searchQuery;
  const items: SearchResultItem[] = [];
  
  // 1. Plugin search (existing logic, extracted)
  items.push(...searchPlugins(query, plugins));
  
  // 2. Calculator (fixed L1)
  const calc = searchCalculator(query);
  if (calc) items.push(calc);
  
  // 3. URL (fixed L1)
  const url = matchUrl(query);
  if (url) items.push(url);
  
  // 4. App search (fuzzy match)
  items.push(...searchApps(query, appList));
  
  // 5. Unified sort: layer asc → score desc
  return items
    .sort((a, b) => a.layer - b.layer || b.score - a.score)
    .slice(0, 20);  // Limit to 20 results
});
```

### Plugin Priority Weight

- Plugin results get `score *= 1.5` multiplier
- Ensures plugins rank higher than other types at equal match quality

## UI Changes

### ResultItem Type Badges

Each result shows a type badge on the right side:

| Type | Badge Text | Badge Style |
|------|-----------|-------------|
| `plugin` | (no badge) | — |
| `calculator` | 计算 | accent color background |
| `url` | 网址 | gray background |
| `app` | 应用 | blue background |

### Calculator Result Display

- `name`: Shows the result (e.g., `384`)
- `description`: Shows the original expression (e.g., `128*3`)

### App Icons

- Windows: Load from resolved .lnk icon path
- macOS: Read from .app bundle
- Fallback: First letter placeholder

## Dependencies

### Frontend
- `math.js` or custom parser for calculator (TBD during implementation)
- No new dependencies for URL detection (regex only)

### Rust
- `windows` crate (Windows only) for .lnk COM interface parsing
- Existing `tauri-plugin-opener` for URL opening
- `std::process::Command` for launching apps (if needed)

## Error Handling

- Calculator: Catch parse/evaluation errors silently (return null)
- URL: Invalid URLs simply don't match (return null)
- App scan: Emit empty batch on failure, log error to stderr
- App launch: Use `std::process::Command::new(&target).spawn()`, show notification on failure

## Security Considerations

- App scanning only reads shortcut files, no executable code execution
- URL opening uses Tauri's built-in opener plugin (sandboxed)
- App launching uses `std::process::Command` with the resolved target path only

## Testing Strategy

- Calculator: Unit test expression parser with edge cases
- URL: Unit test regex patterns
- App search: Integration test with mock app list
- Ranking: Unit test merge/sort logic
- E2E: Manual test on Windows and macOS
