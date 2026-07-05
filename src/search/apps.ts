import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { SearchResultItem } from "../types/plugin";
import type { DesktopApp } from "./types";
import { matchPinyinInitials } from "../utils/pinyin";

const LAYER_APP_EXACT = 2; // L2 per spec: App exact match

let appList: DesktopApp[] = [];
let loaded = false;

/**
 * Initialize app search by calling the Rust backend and listening for batch events.
 * Apps become searchable as scan completes.
 */
export function initAppSearch(): void {
  invoke("list_desktop_apps").catch((err) => {
    console.error("Failed to init app search:", err);
  });

  listen<DesktopApp[]>("apps-batch", (event) => {
    appList = event.payload;
    loaded = true;
  });
}

/**
 * Search installed desktop apps by fuzzy matching against app names.
 * Uses the same scoring system as plugins (use count × 0.6 + recency × 0.4),
 * but without the plugin weight multiplier.
 * Returns empty array if apps haven't loaded yet.
 */
export function searchApps(query: string): SearchResultItem[] {
  if (!loaded || appList.length === 0) return [];
  if (!query) return [];

  const q = query.toLowerCase();
  const items: SearchResultItem[] = [];

  for (const app of appList) {
    const name = app.name.toLowerCase();
    let score = 0;

    // Exact match
    if (name === q) {
      score = 1.0;
    }
    // Prefix match
    else if (name.startsWith(q)) {
      score = 0.9;
    }
    // Contains match
    else if (name.includes(q)) {
      score = 0.7;
    }
    // Pinyin initials match
    else if (matchPinyinInitials(q, app.name)) {
      score = 0.5;
    }
    else {
      continue;
    }

    items.push({
      id: `app-${app.name}`,
      name: app.name,
      description: app.target || app.path,
      icon: app.icon || "",
      path: app.target || app.path,
      type: "app",
      layer: LAYER_APP_EXACT,
      score,
    });
  }

  return items;
}
