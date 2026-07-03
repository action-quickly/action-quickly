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
