export interface PluginParams {
  pluginId: string;
  query?: string;
  contextText?: string;
  [key: string]: any;
}

export interface PluginDefinition<T = Record<string, any>> {
  name: string;
  version: string;
  description?: string;
  render: (params: T) => HTMLElement | Promise<HTMLElement>;
  onMount?: () => void;
  onUnmount?: () => void;
  onParamsChange?: (params: T) => void;
}

export function definePlugin<T extends Record<string, any>>(
  definition: PluginDefinition<T>
): PluginDefinition<T> {
  return definition;
}