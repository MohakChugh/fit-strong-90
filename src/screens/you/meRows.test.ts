/**
 * Why Me holds a row's answer itself until it is stored (codex H4-04): the
 * store shows an answer before it is stored, so the row leaves its list at
 * once; in memory only it is never stored at all, and a refused write takes
 * it back. Me keeps the row, with why, on any answer that isn't stored.
 */
import { describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { createDefaultProfile } from '@/profile/defaults';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { notNow, setupProgress } = await import('@/setup/progress');
const unreviewed = createDefaultProfile({ weightKg: 70, needsHealthReview: true });
const open = () => setupProgress({ profile: unreviewed, settings: store.getState().settings }).map(c => c.chapter);

describe('a Finish setting up answer, as the store shows it before it is stored', () => {
  it('in memory only: gone from the list at once, and never stored', async () => {
    store.resetForTests();
    await store.start({ factory: undefined });
    expect(open()).toEqual(['health']);
    const saved = notNow('health');
    expect(open()).toEqual([]);
    expect((await saved).ok).toBe(false);
    // Still gone, though nothing was saved: only Me holding the row keeps it, with why.
    expect(open()).toEqual([]);
  });

  it('a refused write: gone at once, then back once it is refused', async () => {
    store.resetForTests();
    let refusing = false;
    const refuse = (name: string) => (refusing && name === 'settings' ? new DOMException('Refused.', 'UnknownError') : undefined);
    await store.start({ factory: fakeIndexedDB({ failWrite: refuse }) });
    expect(store.getState().status).not.toBe('unavailable');
    refusing = true;
    const saved = notNow('health');
    expect(open()).toEqual([]);
    expect((await saved).ok).toBe(false);
    expect(open()).toEqual(['health']);
  });
});
