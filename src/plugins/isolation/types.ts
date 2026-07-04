// src/plugins/isolation/types.ts

export type IsolationLevel = 'light' | 'strict' | 'worker';

export interface IsolatedContainer {
  root: ShadowRoot | HTMLElement;
  destroy: () => void;
  getGlobalScope: () => any;
  addEventListener: (event: string, handler: EventListener) => void;
  removeEventListener: (event: string, handler: EventListener) => void;
}

export interface IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer;
}

export interface PluginRenderer {
  render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void>;
  destroy?: () => void;
}

// 前置类型引用（将在后续任务中定义）
interface InstalledPlugin {
  id: string;
  path: string;
  manifest: PluginManifest;
}

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  main: string;
  module?: string;
  permissions?: string[];
  sandbox?: {
    level?: IsolationLevel;
    allowDomAccess?: boolean;
  };
}

interface PluginBridge {
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
}