export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  main: string;
  module?: string;
  keywords: string[];
  context?: {
    text?: {
      pattern: string;
      label: string;
    };
  };
  permissions: string[];
  minHostVersion: string;
  sandbox?: {
    level?: 'light' | 'strict' | 'worker';
    allowDomAccess?: boolean;
  };
}

export interface InstalledPlugin extends PluginManifest {
  path: string;
}

export interface SearchResultItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  path?: string;
  type: "plugin" | "calculator" | "url" | "app";
  layer: number; // 0-5 优先级层级
  score: number; // 同层级内的排序分数
  contextLabel?: string; // 上下文匹配标签（如 "JSON"）
}

/// 插件使用统计
export interface PluginStat {
  pluginId: string;
  useCount: number;
  lastUsed: number; // 时间戳
}

export type ViewType = "search" | "plugin" | "market";
