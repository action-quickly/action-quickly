import { usePluginStore } from "../stores/pluginStore";

export function usePlugins() {
  const pluginStore = usePluginStore();

  function refresh() {
    pluginStore.loadPlugins();
  }

  return {
    plugins: pluginStore.plugins,
    loading: pluginStore.loading,
    refresh,
  };
}
