import { describe, expect, it } from 'vitest';
import { showBadge, type BadgeHost } from './badge';

function host(overrides: Partial<Record<'set' | 'clear', () => Promise<void>>> = {}) {
  const calls: string[] = [];
  const badge: BadgeHost = {
    setAppBadge: (n?: number) => { calls.push(`set(${n === undefined ? '' : n})`); return overrides.set?.() ?? Promise.resolve(); },
    clearAppBadge: () => { calls.push('clear'); return overrides.clear?.() ?? Promise.resolve(); },
  };
  return { badge, calls };
}

describe('showBadge', () => {
  it('shows a count', () => {
    const { badge, calls } = host();
    showBadge(3, badge);
    expect(calls).toEqual(['set(3)']);
  });

  it('clears at zero through clearAppBadge, never setAppBadge(0) or a dot', () => {
    for (const count of [0, -2, Number.NaN]) {
      const { badge, calls } = host();
      showBadge(count, badge);
      expect(calls, String(count)).toEqual(['clear']);
    }
  });

  it('shows whole numbers only', () => {
    const { badge, calls } = host();
    showBadge(2.7, badge);
    expect(calls).toEqual(['set(2)']);
  });

  it('does nothing where the Badging API does not exist', () => {
    expect(() => showBadge(2, {})).not.toThrow();
    expect(() => showBadge(0, {})).not.toThrow();
    expect(() => showBadge(2, undefined)).not.toThrow();
  });

  it('swallows a refusal, which is not the user\'s problem', async () => {
    const refused = host({ set: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')) });
    showBadge(1, refused.badge);
    const clearRefused = host({ clear: () => Promise.reject(new Error('no')) });
    showBadge(0, clearRefused.badge);
    // An unhandled rejection would fail this test run.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(refused.calls).toEqual(['set(1)']);
  });

  it('survives a method that throws synchronously', () => {
    const throwing: BadgeHost = { setAppBadge: () => { throw new Error('insecure context'); } };
    expect(() => showBadge(1, throwing)).not.toThrow();
  });
});
