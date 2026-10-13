/**
 * Codex P8S-10, through the real store: an energy entry deleted with
 * estimates on, then counts-free chosen. Recently deleted's row, Restore's
 * name and what Restore says all come from `recentRow`, read with the
 * person's choice as it is now (`RecentlyDeleted` reads `countsFree(profile)`
 * as it draws).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { countsFree } from '@/food/level';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import type { DisplayPrefs } from './format';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { recentEntries } = await import('@/store/recent');
const { recentRow } = await import('./recentRows');

const prefs: DisplayPrefs = { glucose: 'mg/dL', mass: 'kg', length: 'cm', hba1c: '%', b12: 'pg/mL', vitaminD: 'ng/mL', hour12: true };
/** What Recently deleted shows now: each row's title and detail, from the choice as it is now. */
const shown = () => recentEntries(store.getState().contentState, Date.now())
  .map(e => recentRow(e, prefs, '2026-10-08', countsFree(store.getState().profile)))
  .map(r => `${r.title} ${r.detail}`).join(' | ');

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});

describe('Recently deleted follows counts-free as it is now (P8S-10)', () => {
  it('an energy entry deleted with estimates on shows no figure once counts-free is chosen', async () => {
    const profile = createDefaultProfile({ food: { level: 'estimates' } } as never);
    expect((await store.setProfile(profile)).ok).toBe(true);
    const energy = await store.addObservation({ kind: 'activeEnergy', value: 85, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: '2026-10-08T07:00:00+05:30' });
    if (!energy.ok) throw energy.failure;
    expect((await store.deleteRecord({ kind: 'reading', id: energy.value.id })).ok).toBe(true);
    expect(shown()).toMatch(/85/);
    expect((await store.setProfile({ ...profile, food: { ...profile.food, level: 'meals' } as never })).ok).toBe(true);
    expect(shown()).not.toMatch(/85|kcal/);
  });
});
