/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
    expect(container.root.mode).toBe('open');
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
});
