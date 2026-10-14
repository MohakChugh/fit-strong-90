import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@/test/host';

const walk = vi.hoisted(() => ({ peek: null as null | { href: '/walk/live' | '/walk/summary' } }));
vi.mock('@/walk/persist', () => ({ peekWalk: () => walk.peek }));
const { Fallback } = await import('./ErrorBoundary');

afterEach(() => { walk.peek = null; });

describe('a screen that didn’t load (P8-28, K8-14)', () => {
  it('promises only what is true, and offers the way back to an unsaved walk', () => {
    walk.peek = { href: '/walk/summary' };
    const h = render(createElement(Fallback, { download: true }));
    expect(h.text()).toContain('Your saved records are safe.');
    expect(h.text()).not.toContain('Nothing you entered has been lost');
    expect(h.all().find(n => n.type === 'a')?.props.href).toBe('#/walk/summary');
    h.unmount();
  });

  it('with no walk under way, has no such link', () => {
    const h = render(createElement(Fallback, {}));
    expect(h.all().some(n => n.type === 'a')).toBe(false);
    h.unmount();
  });
});
