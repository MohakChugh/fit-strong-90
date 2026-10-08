import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { statusOn } from '@/health/status';
import { emptySnapshot } from './snapshot';
import { TRANSFER_FORMAT, planImport, previewImport } from './transfer';

const file = (over: Record<string, unknown>) => ({
  format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-07T19:00:00.000+05:30', schemaVersion: 5,
  observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
  ...over,
});
const settings = { onboardingComplete: true, theme: 'dark', useMetric: true, startDate: '' };
const water = { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };

const preview = (raw: unknown) => {
  const p = previewImport(raw);
  if (!p.ok) throw new Error(p.reason);
  return p;
};

describe('settings in an import file are read field by field (D-08)', () => {
  it('leaves out a status that is not a list, names it, and the rest still restores', () => {
    const raw = file({ settings: { ...settings, statusPeriods: 'flare' } });
    expect(preview(raw).unreadableFields).toEqual(['settings.statusPeriods']);
    const { change } = planImport(raw, 'replace', emptySnapshot(), { allowRejected: true });
    expect(change.settings?.replace).toEqual(settings);
    // What broke Today and Habits on every launch.
    expect(() => statusOn(change.settings?.replace?.statusPeriods, '2026-10-08')).not.toThrow();
  });

  it('leaves out reminders that cannot be read, keeping the ones that can', () => {
    expect(preview(file({ settings: { ...settings, habits: 'on' } })).unreadableFields).toEqual(['settings.habits']);
    const raw = file({ settings: { ...settings, habits: { water: { ...water, from: '9am' }, sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '18:00' }, inApp: 'yes' } } });
    expect(preview(raw).unreadableFields).toEqual(['settings.habits.water', 'settings.habits.inApp']);
    const { change } = planImport(raw, 'replace', emptySnapshot(), { allowRejected: true });
    expect(change.settings?.replace?.habits).toEqual({ sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '18:00' } });
    // A reminder missing its end time is as unreadable as one with a wrong one.
    expect(preview(file({ settings: { ...settings, habits: { water: { ...water, to: undefined } } } })).unreadableFields).toEqual(['settings.habits.water']);
  });

  it('leaves out a value outside the set, and a number that is not one', () => {
    expect([...preview(file({ settings: { ...settings, theme: 'neon', currentWeight: 'heavy', focus: 'sleep' } })).unreadableFields ?? []].sort())
      .toEqual(['settings.currentWeight', 'settings.focus', 'settings.theme']);
  });

  it('needs the same explicit choice as unreadable records before anything is written', () => {
    expect(() => planImport(file({ settings: { ...settings, statusPeriods: 'flare' } }), 'replace', emptySnapshot())).toThrow(/could not be read/);
  });

  it('a real export reads back whole, with nothing left out', () => {
    const exported = {
      ...settings, focus: 'move', statusPeriods: [{ kind: 'flare', from: '2026-10-01', to: '2026-10-03', planShift: 'kept' }],
      habits: { water, quietHours: { from: '22:00', to: '07:00' }, inApp: false, lastExportAt: '2026-10-07T19:00:00.000+05:30', lastExportSeq: 12,
        calendarExport: { water: { at: '2026-10-07T19:00:00.000+05:30', until: '2027-01-05', events: 6, titles: ['Glass of water'] } } },
      walkDefaults: { gps: true, steps: false }, deleted: { observations: ['x'] }, dailyStepsGoalHistory: [{ from: '2026-10-01', goal: 6000 }],
    };
    const raw = file({ settings: exported, profile: createDefaultProfile({ weightKg: 70, health: { diabetes: 'type2', metformin: true, fluidRestriction: 'unsure' } }) });
    expect(preview(raw).unreadableFields).toEqual([]);
    expect(planImport(raw, 'replace', emptySnapshot()).change.settings?.replace).toEqual(exported);
  });
});

describe('the profile in an import file (D-08)', () => {
  it('leaves out every health answer when one cannot be read, so the app asks them again', () => {
    const raw = file({ settings, profile: { ...createDefaultProfile({ weightKg: 70 }), health: { ...createDefaultProfile().health, footStatus: 'sore' } } });
    expect(preview(raw).unreadableFields).toEqual(['profile.health']);
    expect(preview(raw).hasProfile).toBe(false);
    expect(planImport(raw, 'replace', emptySnapshot(), { allowRejected: true }).change.profile).toBeUndefined();
  });

  it('leaves out a preference that cannot be read and keeps the answers', () => {
    const raw = file({ settings, profile: { ...createDefaultProfile({ weightKg: 70 }), voice: { rate: 'fast' }, trainingDays: ['someday'] } });
    expect(preview(raw).unreadableFields).toEqual(['profile.trainingDays', 'profile.voice']);
    const { change } = planImport(raw, 'replace', emptySnapshot(), { allowRejected: true });
    expect(change.profile?.weightKg).toBe(70);
    expect(change.profile?.voice.rate).toBe(createDefaultProfile().voice.rate);
    expect(change.profile?.trainingDays).toEqual(createDefaultProfile().trainingDays);
  });
});
