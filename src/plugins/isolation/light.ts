import type { IsolationLayer, IsolatedContainer } from './types';

export class LightIsolation implements IsolationLayer {
  createContainer(parent: HTMLElement): IsolatedContainer {
    const host = document.createElement('div');
    host.classList.add('plugin-host');
    host.style.cssText = 'width: 100%; height: 100%;';

    const shadow = host.attachShadow({ mode: 'open' });
    parent.appendChild(host);

    const eventListeners = new Map<string, EventListener[]>();

    return {
      root: shadow,
      destroy: () => {
        host.remove();
        eventListeners.clear();
      },
      getGlobalScope: () => window,
      addEventListener: (event: string, handler: EventListener) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event)!.push(handler);
        host.addEventListener(event, handler);
      },
      removeEventListener: (event: string, handler: EventListener) => {
        const handlers = eventListeners.get(event);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
        host.removeEventListener(event, handler);
      },
    };
  }
}
