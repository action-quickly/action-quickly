import type { IsolatedContainer } from '../isolation/types';
import type { InstalledPlugin } from '../../types/plugin';
import type { PluginBridge } from '../bridge/types';

export interface PluginRenderer {
  render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void>;
  destroy?: () => void;
}
