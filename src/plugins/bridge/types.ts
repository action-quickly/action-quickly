export interface PluginBridge {
  pluginId: string;
  invoke<T>(cmd: string, args?: any): Promise<T>;
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
}

export interface AQBridge extends PluginBridge {
  version: string;
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
    show(options: NotificationOptions): Promise<void>;
  };
  http: {
    get(url: string, options?: RequestOptions): Promise<Response>;
    post(url: string, body?: any, options?: RequestOptions): Promise<Response>;
  };
  ui: {
    showToast(message: string, type?: 'info' | 'success' | 'error'): void;
    showModal(options: ModalOptions): Promise<any>;
  };
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ModalOptions {
  title: string;
  content: string;
  buttons?: string[];
}

export interface AQMessage {
  id?: string;
  type: 'request' | 'response' | 'event';
  source: 'action-quick-host' | 'action-quick-plugin';
  cmd?: string;
  args?: any;
  result?: any;
  error?: string;
  event?: string;
  data?: any;
}
