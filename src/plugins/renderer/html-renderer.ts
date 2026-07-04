import type { IsolatedContainer } from '../isolation/types';
import type { InstalledPlugin } from '../../types/plugin';
import type { PluginBridge } from '../isolation/types';
import type { PluginRenderer } from './types';
import { PLUGIN_SDK_VERSION } from '../bridge/global-api';

export class HTMLPluginRenderer implements PluginRenderer {
  private iframe: HTMLIFrameElement | null = null;

  async render(
    container: IsolatedContainer,
    plugin: InstalledPlugin,
    bridge: PluginBridge
  ): Promise<void> {
    const htmlContent = await this.loadHTMLContent(plugin);
    const injectedHTML = this.injectSDK(htmlContent, bridge);

    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts');
    this.iframe.sandbox.add('allow-same-origin');
    this.iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    this.iframe.srcdoc = injectedHTML;

    this.iframe.onload = () => {
      this.setupCommunication(bridge);
    };

    container.root.appendChild(this.iframe);
  }

  private async loadHTMLContent(plugin: InstalledPlugin): Promise<string> {
    const response = await fetch(`asset://localhost/${plugin.path}/${plugin.main}`);
    return response.text();
  }

  private injectSDK(html: string, bridge: PluginBridge): string {
    const sdkScript = `
      <script>
        window.__AQ_BRIDGE__ = ${JSON.stringify({
          version: PLUGIN_SDK_VERSION,
          pluginId: bridge.pluginId,
        })};
        window.aq = window.__AQ_BRIDGE__;
        
        // Escape 键处理
        if (!window.__AQ_ESCAPE_HANDLER__) {
          window.__AQ_ESCAPE_HANDLER__ = true;
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
              e.preventDefault();
              window.parent.postMessage({
                source: 'action-quick-plugin',
                type: 'key-escape'
              }, '*');
            }
          });
        }
      <\/script>
    `;

    if (html.includes('</head>')) {
      return html.replace('</head>', `${sdkScript}</head>`);
    }
    return sdkScript + html;
  }

  private setupCommunication(bridge: PluginBridge): void {
    if (!this.iframe?.contentWindow) return;

    // 监听插件消息
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.source === 'action-quick-plugin' && e.data.cmd) {
        this.handlePluginCommand(e.data, bridge);
      }
    });

    // 发送插件参数
    this.iframe.contentWindow.postMessage({
      source: 'action-quick-host',
      type: 'plugin-params',
      params: {
        pluginId: bridge.pluginId,
      },
    }, '*');
  }

  private async handlePluginCommand(message: any, bridge: PluginBridge): Promise<void> {
    if (!this.iframe?.contentWindow) return;

    try {
      const result = await bridge.invoke(message.cmd, message.args);
      this.iframe.contentWindow.postMessage({
        source: 'action-quick-host',
        id: message.id,
        result,
      }, '*');
    } catch (error) {
      this.iframe.contentWindow.postMessage({
        source: 'action-quick-host',
        id: message.id,
        error: String(error),
      }, '*');
    }
  }

  destroy(): void {
    this.iframe?.remove();
    this.iframe = null;
  }
}
