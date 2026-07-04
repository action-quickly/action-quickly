import type { AQBridge, AQMessage } from './types';

export class PluginBridgeImpl implements AQBridge {
  pluginId: string;
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private pendingCalls = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private ipcId = 0;
  private messageHandler: ((e: MessageEvent<AQMessage>) => void) | null = null;

  readonly version = '1.0.0';

  constructor(pluginId: string) {
    this.pluginId = pluginId;
    this.setupMessageListener();
  }

  private setupMessageListener() {
    this.messageHandler = (e: MessageEvent<AQMessage>) => {
      if (e.data?.source !== 'action-quick-host' || !e.data.id) return;

      if (e.data.type === 'event' && e.data.event) {
        const listeners = this.eventListeners.get(e.data.event);
        if (listeners) {
          for (const listener of listeners) {
            listener(e.data.data);
          }
        }
        return;
      }

      const pending = this.pendingCalls.get(e.data.id);
      if (pending) {
        if (e.data.error) {
          pending.reject(new Error(e.data.error));
        } else {
          pending.resolve(e.data.result);
        }
        this.pendingCalls.delete(e.data.id);
      }
    };
    window.addEventListener('message', this.messageHandler);
  }

  async invoke<T>(cmd: string, args?: any): Promise<T> {
    const id = String(++this.ipcId);
    
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      
      window.parent.postMessage({
        source: 'action-quick-plugin',
        type: 'request',
        id,
        cmd,
        args: { ...args, pluginId: this.pluginId },
      } as AQMessage, '*');
    });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  emit(event: string, data?: any): void {
    window.parent.postMessage({
      source: 'action-quick-plugin',
      type: 'event',
      id: String(++this.ipcId),
      event,
      data,
    } as AQMessage, '*');
  }

  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    for (const { reject } of this.pendingCalls.values()) {
      reject(new Error('Bridge destroyed'));
    }
    this.pendingCalls.clear();
    this.eventListeners.clear();
  }

  get clipboard() {
    return {
      read: () => this.invoke<string>('aq_clipboard_read'),
      write: (text: string) => this.invoke<void>('aq_clipboard_write', { text }),
    };
  }

  get storage() {
    return {
      get: (key: string) => this.invoke<any>('aq_storage_get', { key }),
      set: (key: string, value: any) => this.invoke<void>('aq_storage_set', { key, value }),
      delete: (key: string) => this.invoke<void>('aq_storage_delete', { key }),
    };
  }

  get notification() {
    return {
      show: (options: any) => this.invoke<void>('aq_notification', options),
    };
  }

  get http() {
    return {
      get: (url: string, options?: any) => this.invoke<Response>('aq_http_get', { url, ...options }),
      post: (url: string, body?: any, options?: any) => this.invoke<Response>('aq_http_post', { url, body, ...options }),
    };
  }

  get ui() {
    return {
      showToast: (message: string, type?: string) => {
        window.parent.postMessage({
          source: 'action-quick-plugin',
          type: 'toast',
          message,
          toastType: type,
        } as any, '*');
      },
      showModal: (options: any) => this.invoke<any>('aq_modal', options),
    };
  }
}

export type { AQBridge, AQMessage };
