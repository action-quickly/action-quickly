import type { InstalledPlugin, PluginManifest } from '../../types/plugin';

export type { InstalledPlugin, PluginManifest };
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

export interface PluginBridge {
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
}
