import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { createDefaultProfile } from '@/profile/defaults';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

import { JOIN } from '@/setup/fixtures';

const store = await import('@/store/useStore');
const { changeDisplay, changeHabits, changeProfile, forgetCalendarEvents, joinProgramme, leaveProgramme, recordBackupCheck, recordCalendarExport, recordExport, setFluidRestriction } = await import('./write');
const { fluidRestriction } = await import('@/reminders/water');
const { backupMark, backupNudge } = await import('@/reminders/backup');
const { isEnrolled } = await import('@/health/recommend');

let factory = fakeIndexedDB();

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  factory = fakeIndexedDB();
  await store.start({ factory });
});

/** Read everything back from the device, so the test sees what was stored, not what was published. */
async function reloadFromDevice() {
  expect((await store.reload()).ok).toBe(true);
  return store.getState();
}

describe('changeHabits', () => {
  it('keeps both of two changes made in the same moment', async () => {
    const water = changeHabits(h => ({ ...h, water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' } }));
    const sitting = changeHabits(h => ({ ...h, sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '18:00' } }));
    expect((await water).ok).toBe(true);
    expect((await sitting).ok).toBe(true);

    const habits = (await reloadFromDevice()).settings.habits;
    expect(habits?.water?.enabled).toBe(true);
    expect(habits?.sittingBreak?.enabled).toBe(true);
  });

  it('records what the backup covered without touching the habits', async () => {
    await changeHabits(h => ({ ...h, inApp: false }));
    await recordExport({ at: '2026-10-08T10:00:00.000+05:30', revision: 41 });
    const habits = (await reloadFromDevice()).settings.habits;
    expect(habits).toEqual({ inApp: false, lastExportAt: '2026-10-08T10:00:00.000+05:30', lastExportSeq: 41 });
  });

  it('drops an older revision when a backup has none, so a new time never borrows an old coverage', async () => {
    await recordExport({ at: '2026-10-01T10:00:00.000+05:30', revision: 41 });
    await recordExport({ at: '2026-10-08T10:00:00.000+05:30' });
    const habits = (await reloadFromDevice()).settings.habits;
    expect(habits).toEqual({ lastExportAt: '2026-10-08T10:00:00.000+05:30' });
  });

  it('counts nothing as new right after a backup, and any later stored change as new (F27)', async () => {
    const made = await store.exportRecord();
    if (!made.ok) throw new Error('export failed');
    expect((await recordExport({ at: made.value.exportedAt, revision: made.value.revision })).ok).toBe(true);
    const month = new Date(Date.parse(made.value.exportedAt) + 31 * 86_400_000);
    // Every record dated long before the backup: only the revision can tell.
    const span = { first: Date.parse('2026-01-01T00:00:00Z'), last: Date.parse('2026-01-02T00:00:00Z') };
    const nudge = () => {
      const state = store.getState();
      return backupNudge(month, backupMark(state.settings.habits), span, state.revision).due;
    };
    expect(store.getState().revision).toBe(made.value.revision + 1);
    expect(nudge()).toBe(false);
    await changeProfile(p => ({ ...p, weightKg: 81 }));
    expect(nudge()).toBe(true);
  });

  it('counts a settings edit after the backup as new', async () => {
    const made = await store.exportRecord();
    if (!made.ok) throw new Error('export failed');
    await recordExport({ at: made.value.exportedAt, revision: made.value.revision });
    await store.setSettings({ theme: 'dark' });
    const state = store.getState();
    expect(state.revision).toBeGreaterThan(made.value.revision + 1);
    const month = new Date(Date.parse(made.value.exportedAt) + 31 * 86_400_000);
    expect(backupNudge(month, backupMark(state.settings.habits), { first: 0, last: 1 }, state.revision).due).toBe(true);
  });
});

describe('changeProfile', () => {
  it('gives someone with no profile the defaults, marked for review', async () => {
    expect(store.getState().profile).toBeUndefined();
    expect((await changeProfile(p => ({ ...p, figure: 'female' }))).ok).toBe(true);
    const profile = (await reloadFromDevice()).profile;
    expect(profile?.figure).toBe('female');
    expect(profile?.needsHealthReview).toBe(true);
  });

  it('changes only what it is asked to', async () => {
    await changeProfile(p => ({ ...p, figure: 'female' }));
    await changeProfile(p => ({ ...p, food: { pattern: 'vegetarian', avoid: ['peanuts'] } }));
    const profile = (await reloadFromDevice()).profile;
    expect(profile?.figure).toBe('female');
    expect(profile?.food).toEqual({ pattern: 'vegetarian', avoid: ['peanuts'] });
  });
});

describe('setFluidRestriction', () => {
  const water = { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };

  it('keeps the answer on the profile, never writes the old copy, and turns water off for a limit or for not knowing', async () => {
    await changeHabits(h => ({ ...h, fluidLimit: false, water }));
    expect((await setFluidRestriction('unsure')).ok).toBe(true);
    const after = await reloadFromDevice();
    expect(after.profile?.health.fluidRestriction).toBe('unsure');
    // Left exactly as it was: the profile's answer is the one read first.
    expect(after.settings.habits?.fluidLimit).toBe(false);
    expect(fluidRestriction(after.profile, after.settings.habits)).toBe('unsure');
    expect(after.settings.habits?.water?.enabled).toBe(false);
  });

  it('does not create the old copy where there was none', async () => {
    expect((await setFluidRestriction(true)).ok).toBe(true);
    const after = await reloadFromDevice();
    expect(after.profile?.health.fluidRestriction).toBe(true);
    expect(after.settings.habits && 'fluidLimit' in after.settings.habits).toBeFalsy();
  });

  it('turns water on with its setup in the same write when there is no limit', async () => {
    expect((await setFluidRestriction(false, water)).ok).toBe(true);
    const after = await reloadFromDevice();
    expect(after.profile?.health.fluidRestriction).toBe(false);
    expect(after.settings.habits?.water).toEqual(water);
  });
});

describe('joining and leaving the programme', () => {
  const joined = createDefaultProfile({ weightKg: 80, trainingDays: ['monday', 'wednesday', 'friday'] });

  it('joins with the programme answers and a start date', async () => {
    await store.setSettings({ startDate: '', focus: 'stretch' });
    expect((await joinProgramme({ ...JOIN, startDate: '2026-10-12' })).ok).toBe(true);
    const after = await reloadFromDevice();
    expect(after.settings.startDate).toBe('2026-10-12');
    expect(after.profile?.trainingDays).toEqual(JOIN.days);
    expect(isEnrolled(after.settings, after.profile)).toBe(true);
    // Joining is not a change of focus.
    expect(after.settings.focus).toBe('stretch');
  });

  it('is never joined by choosing Build strength', async () => {
    await store.setProfile(joined);
    await store.setSettings({ startDate: '', focus: 'stretch' });
    await store.setSettings({ focus: 'strength' });
    const after = await reloadFromDevice();
    expect(after.settings.startDate).toBe('');
    expect(isEnrolled(after.settings, after.profile)).toBe(false);
  });

  it('leaves by clearing the start date, keeping every record and answer', async () => {
    await joinProgramme({ ...JOIN, startDate: '2026-10-12' });
    await store.addObservation({ kind: 'water', value: 250, unit: 'mL', at: '2026-10-08T10:00:00.000+05:30', scope: 'dayTotal' } as never);
    const before = await reloadFromDevice();
    expect((await leaveProgramme()).ok).toBe(true);
    const after = await reloadFromDevice();
    expect(after.settings.startDate).toBe('');
    expect(isEnrolled(after.settings, after.profile)).toBe(false);
    expect(after.profile).toEqual(before.profile);
    expect(after.observations.length).toBe(before.observations.length);
  });
});

describe('recordCalendarExport / forgetCalendarEvents (D-01)', () => {
  const water = { at: '2026-09-01T10:00:00.000+05:30', until: '2026-11-30', events: 6, titles: ['Glass of water'] };
  const walk = { at: '2026-10-08T10:00:00.000+05:30', until: '2027-01-06', events: 1, titles: ['Walk after dinner'] };

  it('remembers each file made, alongside the habits, keeping the older events of habits a new file leaves out', async () => {
    await changeHabits(h => ({ ...h, inApp: false }));
    expect((await recordCalendarExport({ water })).ok).toBe(true);
    expect((await recordCalendarExport({ mealWalk: walk })).ok).toBe(true);
    expect((await reloadFromDevice()).settings.habits).toEqual({ inApp: false, calendarExport: { water, mealWalk: walk } });
  });

  it('forgets only the events the person says they deleted', async () => {
    await recordCalendarExport({ water, mealWalk: walk });
    expect((await forgetCalendarEvents(['water'])).ok).toBe(true);
    expect((await reloadFromDevice()).settings.habits?.calendarExport).toEqual({ mealWalk: walk });
    expect((await forgetCalendarEvents(['mealWalk'])).ok).toBe(true);
    expect((await reloadFromDevice()).settings.habits).not.toHaveProperty('calendarExport');
  });
});

describe('changeDisplay', () => {
  it('changes one display setting and keeps the others', async () => {
    await changeDisplay(d => ({ ...d, reduceMotion: true }));
    await changeDisplay(d => ({ ...d, textScale: 1.3 }));
    expect((await reloadFromDevice()).settings.display).toEqual({ reduceMotion: true, textScale: 1.3 });
  });
});

describe('the backup ledger (B-25)', () => {
  it('records how the backup left; a new backup is not checked until its own file is', async () => {
    await recordExport({ at: '2026-10-01T10:00:00.000+05:30', revision: 3, via: 'download' });
    await recordBackupCheck('2026-10-01T10:00:00.000+05:30');
    expect((await reloadFromDevice()).settings.habits?.lastCheckedExportAt).toBe('2026-10-01T10:00:00.000+05:30');
    await recordExport({ at: '2026-10-08T10:00:00.000+05:30', revision: 9, via: 'share' });
    const habits = (await reloadFromDevice()).settings.habits;
    expect(habits?.lastExportVia).toBe('share');
    expect(habits?.lastCheckedExportAt).toBeUndefined();
  });
  it('checks only the latest backup: another file’s time changes nothing (Review Focus 5)', async () => {
    await recordExport({ at: '2026-10-08T10:00:00.000+05:30', revision: 9, via: 'share' });
    await recordBackupCheck('2026-10-01T10:00:00.000+05:30');
    expect((await reloadFromDevice()).settings.habits?.lastCheckedExportAt).toBeUndefined();
  });
  it('a check never counts as new data for the backup nudge (Review Focus 5)', async () => {
    const made = await store.exportRecord();
    if (!made.ok) throw new Error('export failed');
    await recordExport({ at: made.value.exportedAt, revision: made.value.revision, via: 'share' });
    await recordBackupCheck(made.value.exportedAt);
    const month = new Date(Date.parse(made.value.exportedAt) + 31 * 86_400_000);
    const span = { first: Date.parse('2026-01-01T00:00:00Z'), last: Date.parse('2026-01-02T00:00:00Z') };
    const due = () => {
      const s = store.getState();
      return backupNudge(month, backupMark(s.settings.habits), span, s.revision).due;
    };
    expect(store.getState().settings.habits?.lastCheckedExportAt).toBe(made.value.exportedAt);
    expect(due()).toBe(false);
    await changeProfile(p => ({ ...p, weightKg: 81 }));
    expect(due()).toBe(true);
  });
});
