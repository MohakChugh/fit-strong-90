import { describe, expect, it, vi } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserProfile } from '@/types/profile';
import type { WizardResult } from '@/components/profile/ProfileWizard';
import { fakeIndexedDB } from '@/store/fakeIdb';

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

/** What a wizard opened from `opened` returns once the person changed `edit`. */
const wizard = (opened: UserProfile, edit: (p: UserProfile) => UserProfile, useMetric = true): WizardResult =>
  ({ profile: edit(structuredClone(opened)), startDate: '', useMetric, opened: { profile: opened, useMetric } });

describe('two open copies saving the profile wizard (D-03)', () => {
  it('a body edit in one keeps the health answers the other saved meanwhile', async () => {
    const factory = fakeIndexedDB();
    const b = await copy(factory);
    await b.store.setProfile(createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false } }));
    const a = await copy(factory);
    const openedInA = a.store.getState().profile!;

    const openedInB = b.store.getState().profile!;
    expect((await b.write.saveProfileAnswers(wizard(openedInB, p => ({
      ...p, weightKg: 76, health: { ...p.health, footStatus: 'current_wound_or_active_charcot', fluidRestriction: true },
    })), { startDate: false })).ok).toBe(true);
    expect((await b.write.changeProfile(p => ({ ...p, food: { pattern: 'vegan', avoid: ['paneer'] } }))).ok).toBe(true);

    expect((await a.write.saveProfileAnswers(wizard(openedInA, p => ({ ...p, pain: { ...p.pain, areas: ['lowerBack'] } })), { startDate: false })).ok).toBe(true);

    expect((await a.store.reload()).ok).toBe(true);
    const { profile, settings } = a.store.getState();
    expect(profile?.pain.areas).toEqual(['lowerBack']);
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
    const openedInA = a.store.getState().profile!;
    await b.write.saveProfileAnswers(wizard(b.store.getState().profile!, p => ({ ...p, health: { ...p.health, footStatus: 'current_wound_or_active_charcot' } })), { startDate: false });

    const joined = wizard(openedInA, p => ({ ...p, trainingDays: ['monday', 'thursday'] }));
    expect((await a.write.joinProgramme(joined, '2026-10-12')).ok).toBe(true);

    expect((await a.store.reload()).ok).toBe(true);
    const { profile, settings } = a.store.getState();
    expect(profile?.trainingDays).toEqual(['monday', 'thursday']);
    expect(profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(settings.startDate).toBe('2026-10-12');
  });
});
