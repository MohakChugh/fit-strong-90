/**
 * Why Me holds a row's answer itself until it is stored (codex H4-04): the
 * store shows an answer before it is stored, so the row leaves its list at
 * once; in memory only it is never stored at all, and a refused write takes
 * it back. Me keeps the row, with why, on any answer that isn't stored.
 *
 * The row answered is About you, new since v1. Your health, a safety gap, has
 * no "Not now" and stays listed whatever is stored for it (KH-08, board D80).
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
// Allergies answered ("No food allergies"): setup never passes over them (K5-08), and unanswered they keep Your food open too (H5-18).
const unreviewed = createDefaultProfile({ weightKg: 70, needsHealthReview: true, food: { pattern: 'vegetarian', avoid: [], allergies: [] } });
const open = () => setupProgress({ profile: unreviewed, settings: store.getState().settings }).map(c => c.chapter);
/** Set up, with About you passed over: a row "Not now" answers, beside the gap. */
const setUp = () => store.update(previous => ({ ...previous, settings: { ...previous.settings, onboardingComplete: true, setup: { stage: 'done', skipped: ['about'] } } }));

describe('a Finish setting up answer, as the store shows it before it is stored', () => {
  it('in memory only: gone from the list at once, and never stored', async () => {
    store.resetForTests();
    await store.start({ factory: undefined });
    // In memory only: shown, never stored.
    expect((await setUp()).ok).toBe(false);
    expect(open()).toEqual(['health', 'about']);
    const saved = notNow('about');
    expect(open()).toEqual(['health']);
    expect((await saved).ok).toBe(false);
    // Still gone, though nothing was saved: only Me holding the row keeps it, with why.
    expect(open()).toEqual(['health']);
    // The gap stays, even where "Not now" was answered for it (KH-08).
    const gap = notNow('health');
    expect(open()).toEqual(['health']);
    expect((await gap).ok).toBe(false);
    expect(open()).toEqual(['health']);
  });

  it('a refused write: gone at once, then back once it is refused', async () => {
    store.resetForTests();
    let refusing = false;
    const refuse = (name: string) => (refusing && name === 'settings' ? new DOMException('Refused.', 'UnknownError') : undefined);
    await store.start({ factory: fakeIndexedDB({ failWrite: refuse }) });
    expect(store.getState().status).not.toBe('unavailable');
    expect((await setUp()).ok).toBe(true);
    expect(open()).toEqual(['health', 'about']);
    refusing = true;
    const saved = notNow('about');
    expect(open()).toEqual(['health']);
    expect((await saved).ok).toBe(false);
    expect(open()).toEqual(['health', 'about']);
  });
});
