import { describe, expect, it, vi } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { editedRecord } from '@/setup/edit';
import { JOIN } from '@/setup/fixtures';
import { answersToEdit } from '@/setup/prefill';
import { setupStateOf } from '@/setup/state';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

/** Another open copy of the app — a second tab — on the same database. */
async function copy(factory: IDBFactory) {
  vi.resetModules();
  const store = await import('@/store/useStore');
  const write = await import('./write');
  store.resetForTests();
  await store.start({ factory, broadcast: null });
  return { store, write };
}

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
type Copy = Awaited<ReturnType<typeof copy>>;
/** The answers Profile & health's chapter editor opens with in this copy. */
const opened = ({ store }: Copy) => {
  const { settings, profile } = store.getState();
  return answersToEdit(setupStateOf(settings, profile).answers, profile!, settings, TODAY, CTX);
};

describe('two open copies saving Profile & health (D-03)', () => {
  it('a chapter saved in one keeps what the other saved meanwhile, in the profile and the settings', async () => {
    const factory = fakeIndexedDB();
    const b = await copy(factory);
    await b.store.setProfile(createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false } }));
    const a = await copy(factory);
    const openedInA = opened(a);

    // B: a new weight in About you, then a foot wound, a fluid limit and food elsewhere.
    const openedInB = opened(b);
    expect((await b.store.update(d => editedRecord(d, { chapters: ['about'], opened: openedInB, answers: { ...openedInB, weightKg: 76 }, skipped: [] }, TODAY, CTX))).ok).toBe(true);
    expect((await b.write.changeProfile(p => ({
      ...p, health: { ...p.health, footStatus: 'current_wound_or_active_charcot', fluidRestriction: true }, food: { pattern: 'vegan', avoid: ['paneer'] },
    }))).ok).toBe(true);

    // A, opened before any of that: a name in About you, as the chapter editor saves it.
    expect((await a.store.update(d => editedRecord(d, { chapters: ['about'], opened: openedInA, answers: { ...openedInA, name: 'Sam' }, skipped: [] }, TODAY, CTX))).ok).toBe(true);

    expect((await a.store.reload()).ok).toBe(true);
    const { profile, settings } = a.store.getState();
    expect(profile?.name).toBe('Sam');
    expect(profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(profile?.health.fluidRestriction).toBe(true);
    expect(profile?.food).toEqual({ pattern: 'vegan', avoid: ['paneer'] });
    expect(profile?.weightKg).toBe(76);
    expect(settings.currentWeight).toBe(76);
  });

  it('joining the programme in one keeps the answers the other saved meanwhile', async () => {
    const factory = fakeIndexedDB();
    const b = await copy(factory);
    await b.store.setProfile(createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false } }));
    const a = await copy(factory);
    await b.write.changeProfile(p => ({ ...p, health: { ...p.health, footStatus: 'current_wound_or_active_charcot' } }));

    expect((await a.write.joinProgramme({ ...JOIN, days: ['monday', 'thursday'], startDate: '2026-10-12' })).ok).toBe(true);

    expect((await a.store.reload()).ok).toBe(true);
    const { profile, settings } = a.store.getState();
    expect(profile?.trainingDays).toEqual(['monday', 'thursday']);
    expect(profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(settings.startDate).toBe('2026-10-12');
  });
});
