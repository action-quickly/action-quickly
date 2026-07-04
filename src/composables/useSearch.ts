import { computed } from "vue";
import { usePluginStore } from "../stores/pluginStore";
import { useAppStore } from "../stores/appStore";
import { useStatsStore } from "../stores/statsStore";
import { matchPinyinInitials } from "../utils/pinyin";
import { searchCalculator } from "../search/calculator";
import { matchUrl } from "../search/url";
import { searchApps } from "../search/apps";
import type { SearchResultItem, InstalledPlugin } from "../types/plugin";

/**
 * 搜索匹配层级
 * L0: 精确关键词命中（插件）
 * L1: 前缀关键词命中（插件）/ 计算器 / URL
 * L2: 模糊/拼音首字母命中（插件）/ App 匹配
 * L3: 上下文规则命中（插件）
 * L5: 兜底，展示全部插件
 */
const LAYER_EXACT = 0;
const LAYER_PREFIX = 1;
const LAYER_FUZZY = 2;
const LAYER_CONTEXT = 3;
const LAYER_FALLBACK = 5;

export function useSearch() {
  const pluginStore = usePluginStore();
  const appStore = useAppStore();
  const statsStore = useStatsStore();

  /**
   * 匹配插件关键词，返回匹配层级
   * 未命中返回 null
   */
  function matchKeywords(
    plugin: InstalledPlugin,
    query: string
  ): number | null {
    if (!query) return null;

    const q = query.toLowerCase();

    // 检查所有关键词
    for (const keyword of plugin.keywords) {
      const kw = keyword.toLowerCase();

      // L0: 精确匹配
      if (kw === q) return LAYER_EXACT;

      // L1: 前缀匹配
      if (kw.startsWith(q)) return LAYER_PREFIX;
    }

    // L2: 模糊匹配关键词
    for (const keyword of plugin.keywords) {
      const kw = keyword.toLowerCase();
      if (kw.includes(q)) return LAYER_FUZZY;
    }

    // L2: 名称模糊匹配
    if (plugin.name.toLowerCase().includes(q)) return LAYER_FUZZY;

    // L2: 拼音首字母匹配
    if (matchPinyinInitials(q, plugin.name)) return LAYER_FUZZY;
    for (const keyword of plugin.keywords) {
      if (matchPinyinInitials(q, keyword)) return LAYER_FUZZY;
    }

    return null;
  }

  /**
   * 检查上下文匹配
   * 返回匹配的 label，未匹配返回 null
   */
  function matchContext(
    plugin: InstalledPlugin,
    contextText: string
  ): string | null {
    if (!contextText || !plugin.context?.text) return null;

    try {
      const regex = new RegExp(plugin.context.text.pattern);
      if (regex.test(contextText)) {
        return plugin.context.text.label;
      }
    } catch {
      // 正则无效，跳过
    }
    return null;
  }

  /**
   * 计算同层级内的排序分数
   * score = useCountScore * 0.6 + recencyScore * 0.4
   */
  function calcScore(pluginId: string): number {
    const maxCount = statsStore.getMaxUseCount();
    const useCountScore = statsStore.getUseCountScore(pluginId, maxCount);
    const recencyScore = statsStore.getRecencyScore(pluginId);
    return useCountScore * 0.6 + recencyScore * 0.4;
  }

  /**
   * Search plugins only (extracted for reuse).
   */
  function searchPlugins(
    query: string,
    contextText: string | null,
    plugins: InstalledPlugin[]
  ): SearchResultItem[] {
    const items: SearchResultItem[] = [];

    for (const plugin of plugins) {
      let layer: number | null = null;
      let contextLabel: string | undefined;

      // 1. 尝试关键词匹配
      if (query) {
        layer = matchKeywords(plugin, query.toLowerCase());
      }

      // 2. 关键词未命中，尝试上下文匹配
      if (layer === null && contextText) {
        const label = matchContext(plugin, contextText);
        if (label) {
          layer = LAYER_CONTEXT;
          contextLabel = label;
        }
      }

      // 3. 都未命中
      if (layer === null) {
        // 有查询输入但未命中 → 不显示
        if (query) continue;
        // 无查询输入 → 兜底显示
        layer = LAYER_FALLBACK;
      }

      const score = calcScore(plugin.id);

      // Plugin priority weight: 1.5x multiplier
      items.push({
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        icon: plugin.icon,
        path: plugin.path,
        type: "plugin",
        layer,
        score: score * 1.5, // Plugin weight multiplier
        contextLabel,
      });
    }

    return items;
  }

  const results = computed<SearchResultItem[]>(() => {
    const query = appStore.searchQuery.trim();
    const contextText = appStore.contextText;
    const plugins = pluginStore.plugins;

    if (plugins.length === 0) return [];

    const items: SearchResultItem[] = [];

    // 1. Plugin search (with 1.5x weight multiplier)
    items.push(...searchPlugins(query, contextText, plugins));

    // 2. Calculator (fixed L1)
    const calc = searchCalculator(query);
    if (calc) items.push(calc);

    // 3. URL (fixed L1)
    const url = matchUrl(query);
    if (url) items.push(url);

    // 4. App search (fuzzy match, no weight multiplier)
    items.push(...searchApps(query));

    // 5. Unified sort: layer asc → score desc
    return items
      .sort((a, b) => a.layer - b.layer || b.score - a.score)
      .slice(0, 20);
  });

  return { results };
}
