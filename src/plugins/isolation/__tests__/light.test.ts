/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LightIsolation } from '../light';

describe('LightIsolation', () => {
  let parent: HTMLElement;
  let isolation: LightIsolation;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    isolation = new LightIsolation();
  });

  it('should create Shadow DOM container', () => {
    const container = isolation.createContainer(parent);
    expect(container.root).toBeInstanceOf(ShadowRoot);
    expect((container.root as ShadowRoot).mode).toBe('open');
  });

  it('should append host element to parent', () => {
    isolation.createContainer(parent);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].classList.contains('plugin-host')).toBe(true);
  });

  it('should return window as global scope', () => {
    const container = isolation.createContainer(parent);
    expect(container.getGlobalScope()).toBe(window);
  });

  it('should remove host on destroy', () => {
    const container = isolation.createContainer(parent);
    container.destroy();
    expect(parent.children.length).toBe(0);
  });

  it('should add event listener to host element', () => {
    const container = isolation.createContainer(parent);
    const handler = vi.fn();
    container.addEventListener('click', handler);

    const host = parent.children[0] as HTMLElement;
    host.dispatchEvent(new Event('click'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should remove event listener from host element', () => {
    const container = isolation.createContainer(parent);
    const handler = vi.fn();
    container.addEventListener('click', handler);
    container.removeEventListener('click', handler);

    const host = parent.children[0] as HTMLElement;
    host.dispatchEvent(new Event('click'));
    expect(handler).not.toHaveBeenCalled();
  });
});
