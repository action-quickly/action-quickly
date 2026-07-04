export interface AQBridge {
  version: string;
  pluginId: string;
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
  clipboard: {
    read(): Promise<string>;
    write(text: string): Promise<void>;
  };
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };
  notification: {
    show(options: any): Promise<void>;
  };
  http: {
    get(url: string, options?: any): Promise<any>;
    post(url: string, body?: any, options?: any): Promise<any>;
  };
  ui: {
    showToast(message: string, type?: 'info' | 'success' | 'error'): void;
    showModal(options: any): Promise<any>;
  };
}

declare global {
  interface Window {
    aq: AQBridge;
    __AQ_BRIDGE__: AQBridge;
  }
}

export function getAQ(): AQBridge {
  if (typeof window !== 'undefined' && window.aq) {
    return window.aq;
  }
  throw new Error('Action-Quick bridge not available. Make sure you are running inside Action-Quick.');
}