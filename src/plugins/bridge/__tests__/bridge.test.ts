/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginBridgeImpl } from '../index';

describe('PluginBridgeImpl', () => {
  let bridge: PluginBridgeImpl;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bridge = new PluginBridgeImpl('test-plugin');
    postMessageSpy = vi.spyOn(window.parent, 'postMessage');
  });

  afterEach(() => {
    bridge.destroy();
    vi.restoreAllMocks();
  });

  it('should initialize with pluginId', () => {
    expect(bridge.pluginId).toBe('test-plugin');
  });

  it('should have version 1.0.0', () => {
    expect(bridge.version).toBe('1.0.0');
  });

  describe('invoke', () => {
    it('should send message to parent', async () => {
      const promise = bridge.invoke('test-cmd', { arg: 'value' });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'action-quick-plugin',
          type: 'request',
          cmd: 'test-cmd',
          args: { arg: 'value', pluginId: 'test-plugin' },
        }),
        '*'
      );

      const messageEvent = new MessageEvent('message', {
        data: {
          source: 'action-quick-host',
          type: 'response',
          id: '1',
          result: 'success',
        },
      });
      window.dispatchEvent(messageEvent);

      await promise;
    });

    it('should resolve when response received', async () => {
      const promise = bridge.invoke<string>('test-cmd');

      const messageEvent = new MessageEvent('message', {
        data: {
          source: 'action-quick-host',
          type: 'response',
          id: '1',
          result: 'success',
        },
      });
      window.dispatchEvent(messageEvent);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should reject when error received', async () => {
      const promise = bridge.invoke('test-cmd');

      const messageEvent = new MessageEvent('message', {
        data: {
          source: 'action-quick-host',
          type: 'response',
          id: '1',
          error: 'Something went wrong',
        },
      });
      window.dispatchEvent(messageEvent);

      await expect(promise).rejects.toThrow('Something went wrong');
    });
  });

  describe('on', () => {
    it('should register event listener', () => {
      const callback = vi.fn();
      bridge.on('test-event', callback);

      const messageEvent = new MessageEvent('message', {
        data: {
          source: 'action-quick-host',
          type: 'event',
          id: '1',
          event: 'test-event',
          data: { payload: 'test' },
        },
      });
      window.dispatchEvent(messageEvent);

      expect(callback).toHaveBeenCalledWith({ payload: 'test' });
    });

    it('should support multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      bridge.on('test-event', callback1);
      bridge.on('test-event', callback2);

      const messageEvent = new MessageEvent('message', {
        data: {
          source: 'action-quick-host',
          type: 'event',
          id: '1',
          event: 'test-event',
          data: 'test-data',
        },
      });
      window.dispatchEvent(messageEvent);

      expect(callback1).toHaveBeenCalledWith('test-data');
      expect(callback2).toHaveBeenCalledWith('test-data');
    });
  });

  describe('emit', () => {
    it('should send event to parent', () => {
      bridge.emit('test-event', { key: 'value' });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'action-quick-plugin',
          type: 'event',
          event: 'test-event',
          data: { key: 'value' },
        }),
        '*'
      );
    });
  });

  describe('destroy', () => {
    it('should reject pending calls', async () => {
      const promise = bridge.invoke('test-cmd');
      bridge.destroy();

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });

    it('should clear event listeners', () => {
      const callback = vi.fn();
      bridge.on('test-event', callback);
      bridge.destroy();

      const messageEvent = new MessageEvent('message', {
        data: {
          source: 'action-quick-host',
          type: 'event',
          id: '1',
          event: 'test-event',
          data: 'test',
        },
      });
      window.dispatchEvent(messageEvent);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove window message listener on destroy', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const newBridge = new PluginBridgeImpl('test-plugin-2');
      expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));

      const addedHandler = addSpy.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1] as EventListener;

      newBridge.destroy();

      expect(removeSpy).toHaveBeenCalledWith('message', addedHandler);
    });
  });

  describe('clipboard', () => {
    it('should invoke clipboard read', async () => {
      const promise = bridge.clipboard.read();
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_clipboard_read',
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });

    it('should invoke clipboard write', async () => {
      const promise = bridge.clipboard.write('test text');
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_clipboard_write',
          args: expect.objectContaining({ text: 'test text' }),
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });
  });

  describe('storage', () => {
    it('should invoke storage get', async () => {
      const promise = bridge.storage.get('my-key');
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_storage_get',
          args: expect.objectContaining({ key: 'my-key' }),
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });

    it('should invoke storage set', async () => {
      const promise = bridge.storage.set('my-key', { value: 123 });
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_storage_set',
          args: expect.objectContaining({ key: 'my-key', value: { value: 123 } }),
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });

    it('should invoke storage delete', async () => {
      const promise = bridge.storage.delete('my-key');
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_storage_delete',
          args: expect.objectContaining({ key: 'my-key' }),
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });
  });

  describe('notification', () => {
    it('should invoke notification show', async () => {
      const promise = bridge.notification.show({ title: 'Test', body: 'Message' });
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_notification',
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });
  });

  describe('ui', () => {
    it('should send toast message', () => {
      bridge.ui.showToast('Hello', 'success');

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'action-quick-plugin',
          type: 'toast',
          message: 'Hello',
          toastType: 'success',
        }),
        '*'
      );
    });

    it('should invoke modal', async () => {
      const promise = bridge.ui.showModal({ title: 'Test', content: 'Content' });
      bridge.destroy();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'aq_modal',
        }),
        '*'
      );

      await expect(promise).rejects.toThrow('Bridge destroyed');
    });
  });
});
