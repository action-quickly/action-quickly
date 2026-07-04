import type { IsolatedContainer } from '../isolation/types';
import { PluginBridgeImpl } from './index';

export const PLUGIN_SDK_VERSION = '1.0.0';

export function createBridge(_container: IsolatedContainer, pluginId: string): PluginBridgeImpl {
  return new PluginBridgeImpl(pluginId);
}

export function injectGlobalAPI(container: IsolatedContainer, pluginId: string): void {
  const globalScope = container.getGlobalScope();
  const bridge = createBridge(container, pluginId);

  globalScope.__AQ_BRIDGE__ = bridge;
  globalScope.aq = bridge;
}

export function removeGlobalAPI(container: IsolatedContainer): void {
  const globalScope = container.getGlobalScope();
  delete globalScope.__AQ_BRIDGE__;
  delete globalScope.aq;
}
