import { defineStore } from "pinia";
import { ref } from "vue";
import type { PluginStat } from "../types/plugin";

const STORAGE_KEY = "action-quick:plugin-stats";

export const useStatsStore = defineStore("stats", () => {
  const stats = ref<Map<string, PluginStat>>(new Map());

  // 从 localStorage 加载
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr: PluginStat[] = JSON.parse(raw);
        stats.value = new Map(arr.map((s) => [s.pluginId, s]));
      }
    } catch {
      stats.value = new Map();
    }
  }

  // 保存到 localStorage
  function save() {
    const arr = Array.from(stats.value.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // 记录插件使用
  function recordUse(pluginId: string) {
    const existing = stats.value.get(pluginId);
    const stat: PluginStat = {
      pluginId,
      useCount: (existing?.useCount || 0) + 1,
      lastUsed: Date.now(),
    };
    stats.value.set(pluginId, stat);
    save();
  }

  // 获取使用次数分数（归一化到 0-1）
  function getUseCountScore(pluginId: string, maxCount: number): number {
    const stat = stats.value.get(pluginId);
    if (!stat || maxCount === 0) return 0;
    return stat.useCount / maxCount;
  }

  // 获取最近使用时间分数（指数衰减）
  function getRecencyScore(pluginId: string): number {
    const stat = stats.value.get(pluginId);
    if (!stat) return 0;
    const daysSince = (Date.now() - stat.lastUsed) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / 7);
  }

  // 获取最大使用次数（用于归一化）
  function getMaxUseCount(): number {
    let max = 0;
    for (const stat of stats.value.values()) {
      if (stat.useCount > max) max = stat.useCount;
    }
    return max;
  }

  // 初始化
  load();

  return {
    stats,
    load,
    save,
    recordUse,
    getUseCountScore,
    getRecencyScore,
    getMaxUseCount,
  };
});
