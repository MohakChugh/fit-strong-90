/**
 * `useAddLink` through a hub-shaped caller (codex H2-06, D55): a link's
 * `?add=` opens the hub's own form on arrival and whenever a new one reaches
 * the hub while it is open, the same link again included; the address lets
 * each go; another metric's link opens nothing.
 */
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), set: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/hub/bp', search: router.params.size ? `?${router.params}` : '', state: null, key: 'default' }),
  // An address set from outside keeps the key it had (a hash typed or set by another page has none of its own).
  useSearchParams: () => [router.params, (next: (prev: URLSearchParams) => URLSearchParams) => {
    router.set();
    router.params = next(router.params);
  }],
}));

const { useAddLink } = await import('./hooks');

/** A hub-shaped caller: whether its form is open, and its Close. */
function Hub() {
  const [open, setOpen] = useAddLink(add => add === 'bloodPressure');
  return createElement('output', { 'data-open': String(open), onClick: () => setOpen(false) });
}
const form = (host: ReturnType<typeof render>) => host.all().find(n => n.type === 'output')!;
const isOpen = (host: ReturnType<typeof render>) => form(host).props['data-open'] === 'true';

describe('useAddLink', () => {
  it('opens on arrival with its own link, and lets the link go', () => {
    router.params = new URLSearchParams('add=bloodPressure');
    const host = render(createElement(Hub));
    expect(isOpen(host)).toBe(true);
    expect(router.params.has('add')).toBe(false);
  });

  it('a link reaching the hub while it is open opens the form, every time, and another metric’s never', async () => {
    router.params = new URLSearchParams();
    const host = render(createElement(Hub));
    expect(isOpen(host)).toBe(false);
    router.params = new URLSearchParams('add=bloodPressure');
    host.update(createElement(Hub));
    expect(isOpen(host)).toBe(true);
    expect(router.params.has('add')).toBe(false);
    await host.click(form(host));
    expect(isOpen(host)).toBe(false);
    // The same link again, after the first was let go.
    router.params = new URLSearchParams('add=bloodPressure');
    host.update(createElement(Hub));
    expect(isOpen(host)).toBe(true);
    await host.click(form(host));
    router.params = new URLSearchParams('add=glucose');
    host.update(createElement(Hub));
    expect(isOpen(host)).toBe(false);
    expect(router.params.has('add')).toBe(false);
  });
});
