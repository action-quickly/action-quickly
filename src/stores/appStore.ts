import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { ViewType } from "../types/plugin";

export type ThemeId =
  | "violet-dark" | "violet-light"
  | "amber-dark" | "amber-light"
  | "indigo-dark" | "indigo-light";

function loadTheme(): ThemeId {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("action-quick-theme");
    if (stored && ["violet-dark","violet-light","amber-dark","amber-light","indigo-dark","indigo-light"].includes(stored)) {
      return stored as ThemeId;
    }
  }
  return "violet-dark";
}

export const useAppStore = defineStore("app", () => {
  const currentView = ref<ViewType>("search");
  const searchQuery = ref("");
  const contextText = ref<string | null>(null);
  const selectedPluginId = ref<string | null>(null);
  const theme = ref<ThemeId>(loadTheme());

  watch(theme, (val) => {
    try { localStorage.setItem("action-quick-theme", val); } catch {}
  });

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

  function setTheme(id: ThemeId) {
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
