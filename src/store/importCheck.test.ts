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

  it('leaves out a list of deleted readings that cannot be read, and keeps the rest of what was deleted (R5-01)', () => {
    for (const readings of [[5], 'x', [null]]) {
      const raw = file({ settings: { ...settings, deleted: { observations: ['x'], sessions: ['s'], readings } } });
      expect(preview(raw).unreadableFields).toEqual(['settings.deleted.readings']);
      expect(() => planImport(raw, 'replace', emptySnapshot())).toThrow(/could not be read/);
      // What else was deleted still stays deleted.
      expect(planImport(raw, 'replace', emptySnapshot(), { allowRejected: true }).change.settings?.replace?.deleted).toEqual({ observations: ['x'], sessions: ['s'] });
    }
    expect(preview(file({ settings: { ...settings, deleted: 'all' } })).unreadableFields).toEqual(['settings.deleted']);
    const deleted = { observations: ['x'], sessions: ['s'], readings: ['2026-10-07|glucose|1791342000000|600|mg/dL'] };
    expect(preview(file({ settings: { ...settings, deleted } })).unreadableFields).toEqual([]);
  });

  it('leaves out walk choices or deleted record keys that cannot be read, keeping the rest of what was deleted (Plan 6 Task 1)', () => {
    for (const walk of [{ saveRoutes: 'yes', map: 'on' }, { saveRoutes: true }, { saveRoutes: false, map: 'off', stepCardSeen: 'once' }]) {
      expect(preview(file({ settings: { ...settings, walk } })).unreadableFields).toEqual(['settings.walk']);
    }
    expect(preview(file({ settings: { ...settings, walk: { saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true } } })).unreadableFields).toEqual([]);
    for (const records of [{ routes: 'walk-aaaa' }, { diaries: ['d1'] }, { routes: [7] }]) {
      const raw = file({ settings: { ...settings, deleted: { observations: ['x'], records } } });
      expect(preview(raw).unreadableFields).toEqual(['settings.deleted.records']);
      expect(planImport(raw, 'replace', emptySnapshot(), { allowRejected: true }).change.settings?.replace?.deleted).toEqual({ observations: ['x'] });
    }
    expect(preview(file({ settings: { ...settings, deleted: { records: { routes: ['walk-aaaa'], meals: [] } } } })).unreadableFields).toEqual([]);
  });

  it('leaves out a Home layout this build cannot draw, so Home falls back to its defaults (journey §7.6)', () => {
    const home = { order: { move: ['workout', 'walk'], eat: ['food'], check: ['glucose'], learn: [] }, hidden: ['sleep'] };
    expect(preview(file({ settings: { ...settings, home } })).unreadableFields).toEqual([]);
    for (const bad of [{ ...home, hidden: ['mood'] }, { ...home, order: { ...home.order, eat: ['walk'] } }, 'grid']) {
      const raw = file({ settings: { ...settings, home: bad } });
      expect(preview(raw).unreadableFields).toEqual(['settings.home']);
      expect(planImport(raw, 'replace', emptySnapshot(), { allowRejected: true }).change.settings?.replace).toEqual(settings);
    }
  });

  it('reads the categories Me has offered for Home, and leaves out a list it cannot read (journey §5.1)', () => {
    expect(preview(file({ settings: { ...settings, homeOffered: ['glucose', 'water'] } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, homeOffered: ['mood'] } })).unreadableFields).toEqual(['settings.homeOffered']);
  });

  it('reads what Finish setting up was told, chapter by chapter', () => {
    expect(preview(file({ settings: { ...settings, setup: { declined: ['health', 'food'] } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, setup: { declined: ['everything'] } } })).unreadableFields).toEqual(['settings.setup.declined']);
  });

  it('reads the display settings, and leaves out a text size this build does not offer', () => {
    expect(preview(file({ settings: { ...settings, display: { reduceMotion: true, reduceTransparency: false, textScale: 1.3 } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, display: { textScale: 7 } } })).unreadableFields).toEqual(['settings.display']);
  });

  it('reads a calendar file’s event times, and leaves out the file’s record when they cannot be read', () => {
    const entry = { at: '2026-10-07T19:00:00.000+05:30', until: '2027-01-05', events: 1, titles: ['Glass of water'] };
    expect(preview(file({ settings: { ...settings, habits: { calendarExport: { water: { ...entry, minutes: [600] } } } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, habits: { calendarExport: { water: { ...entry, minutes: ['9am'] } } } } })).unreadableFields).toEqual(['settings.habits.calendarExport']);
  });

  it('reads how the last backup left and whether it was checked', () => {
    expect(preview(file({ settings: { ...settings, habits: { lastExportAt: 'x', lastExportVia: 'share', lastCheckedExportAt: 'x' } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, habits: { lastExportVia: 'email' } } })).unreadableFields).toEqual(['settings.habits.lastExportVia']);
  });

  it('reads the weekly goal’s history, v1’s undated goal included, and leaves out one that cannot be read (B-16)', () => {
    const history = [{ from: '', goal: 120 }, { from: '2026-10-12', goal: 150 }, { from: '2026-10-19' }];
    expect(preview(file({ settings: { ...settings, weeklyMovementGoalHistory: history } })).unreadableFields).toEqual([]);
    for (const bad of [[{ from: 'soon', goal: 90 }], [{ goal: 90 }], [{ from: '2026-10-12', goal: 0 }], 'weekly']) {
      expect(preview(file({ settings: { ...settings, weeklyMovementGoalHistory: bad } })).unreadableFields).toEqual(['settings.weeklyMovementGoalHistory']);
    }
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

describe('setup in a backup file, read field by field (journey §18.1; D-08; Review Focus 5)', () => {
  const setup = {
    stage: 'open', skipped: [], declined: ['food'],
    draft: { at: 'health.conditions', answers: { figure: 'female', conditions: { diabetes: 'unsure', bp: 'no' }, weightKg: 72 } },
  };

  it('keeps a setup this build can read, Plan 4’s Not now included', () => {
    expect(preview(file({ settings: { ...settings, setup } })).unreadableFields).toEqual([]);
    expect(planImport(file({ settings: { ...settings, setup } }), 'replace', emptySnapshot()).change.settings?.replace?.setup).toEqual(setup);
  });

  it('keeps every "Not sure" setup offers, the four new ones included (K5-09), and a metformin year emptied (H5-21)', () => {
    const unsure = { ...setup, draft: { at: 'backFeet.history', answers: { kidneyTreatment: 'unsure', eyeTreatment: 'unsure', footWound: 'unsure', footRestriction: 'unsure', metforminSince: '' } } };
    expect(preview(file({ settings: { ...settings, setup: unsure } })).unreadableFields).toEqual([]);
  });

  it('leaves out, by name, a page this build lacks or an answer of the wrong kind, and keeps the rest', () => {
    const odd = { ...setup, draft: { at: 'health.somewhere', answers: { ...setup.draft.answers, conditions: { diabetes: 'maybe' } } } };
    expect(preview(file({ settings: { ...settings, setup: odd } })).unreadableFields)
      .toEqual(['settings.setup.draft.at', 'settings.setup.draft.answers.conditions']);
    const { change } = planImport(file({ settings: { ...settings, setup: odd } }), 'replace', emptySnapshot(), { allowRejected: true });
    expect(change.settings?.replace?.setup).toEqual({ ...setup, draft: { answers: { figure: 'female', weightKg: 72 } } });
    expect(preview(file({ settings: { ...settings, setup: { stage: 'done', skipped: ['nowhere'] } } })).unreadableFields).toEqual(['settings.setup.skipped']);
  });

  it('keeps answers a newer build added, as it keeps unknown fields', () => {
    expect(preview(file({ settings: { ...settings, setup: { stage: 'done', skipped: [], answers: { someNewQuestion: 'x' } } } })).unreadableFields).toEqual([]);
  });

  it('reads chapter 7’s answers: canonical allergens, the person’s own words and the screening answer (board D82)', () => {
    const answers = { pattern: 'jain', allergies: ['peanut', 'shellfish'], customAllergies: ['brinjal'], foodLevel: 'estimates', hardBefore: 'preferNot' };
    expect(preview(file({ settings: { ...settings, setup: { stage: 'done', skipped: [], answers } } })).unreadableFields).toEqual([]);
    for (const [field, bad] of [['allergies', ['brinjal']], ['customAllergies', ['']], ['hardBefore', 'maybe'], ['pattern', 'paleo']] as const) {
      expect(preview(file({ settings: { ...settings, setup: { stage: 'done', skipped: [], answers: { ...answers, [field]: bad } } } })).unreadableFields, field)
        .toEqual([`settings.setup.answers.${field}`]);
    }
  });
});

describe('the profile’s v2 fields (journey §18.1)', () => {
  const profile = {
    ...createDefaultProfile({ weightKg: 70 }), name: 'Asha', waistCm: 92,
    pain: { areas: ['lowerBack'], worseWith: 'flexion', preference: 'untested', neuroHistory: 'unsure' },
  };
  it('reads the name, the waist and the nerve history', () => {
    expect(preview(file({ settings, profile })).unreadableFields).toEqual([]);
    expect(preview(file({ settings, profile: { ...profile, name: 42 } })).unreadableFields).toEqual(['profile.name']);
    expect(preview(file({ settings, profile: { ...profile, name: 'x'.repeat(61) } })).unreadableFields).toEqual(['profile.name']);
    expect(preview(file({ settings, profile: { ...profile, waistCm: 'wide' } })).unreadableFields).toEqual(['profile.waistCm']);
    // A pain answer that can't be read leaves the pain answers out whole, as any other would.
    expect(preview(file({ settings, profile: { ...profile, pain: { ...profile.pain, neuroHistory: 'maybe' } } })).unreadableFields).toEqual(['profile.pain']);
  });
});

describe('food preferences in an import file (journey §18.1, B-13)', () => {
  const profile = (food: unknown) => ({ ...createDefaultProfile({ weightKg: 70 }), food });
  const food = { pattern: 'jain', avoid: ['mushrooms'], region: 'west', level: 'estimates', hardBefore: 'preferNot', allergies: ['peanut', 'treeNut'] };
  it('reads setup’s food answers whole', () => {
    expect(preview(file({ settings, profile: profile(food) })).unreadableFields).toEqual([]);
    expect(planImport(file({ settings, profile: profile(food) }), 'replace', emptySnapshot()).change.profile?.food).toEqual(food);
    // An empty list is the answer "No food allergies".
    expect(preview(file({ settings, profile: profile({ ...food, allergies: [] }) })).unreadableFields).toEqual([]);
  });
  it('leaves the food preferences out whole when any of them can’t be read, so meal ideas ask again rather than drop an allergy', () => {
    const bad = [
      { level: 'lots' }, { allergies: 'peanut' }, { allergies: ['brinjal'] }, { allergies: [7] }, { hardBefore: 'sometimes' }, { pattern: 'paleo' },
      { region: 'everywhere' }, { avoid: 'mushrooms' },
    ];
    for (const over of bad) {
      expect(preview(file({ settings, profile: profile({ ...food, ...over }) })).unreadableFields, JSON.stringify(over)).toEqual(['profile.food']);
    }
  });
});

describe('the food fields Plan 7 adds (journey §18.1, B-13)', () => {
  const profile = (food: unknown) => ({ ...createDefaultProfile({ weightKg: 70 }), food });
  const food = {
    pattern: 'jain', avoid: ['mushrooms'], level: 'estimates', hardBefore: 'no', allergies: ['peanut'], customAllergies: ['brinjal'],
    careTeamTargets: { kcal: 1600, setOn: '2026-10-01' }, logReminder: { meal: 'lunch', at: '14:30' },
  };
  it('reads them with the rest of the food preferences', () => {
    expect(preview(file({ settings, profile: profile(food) })).unreadableFields).toEqual([]);
    expect(planImport(file({ settings, profile: profile(food) }), 'replace', emptySnapshot()).change.profile?.food).toEqual(food);
  });
  it('leaves the food preferences out whole when any of them can’t be read, so meal ideas ask again rather than drop an allergy', () => {
    const bad = [
      { customAllergies: 'brinjal' }, { customAllergies: [''] }, { customAllergies: ['x'.repeat(61)] },
      { careTeamTargets: { kcal: -5, setOn: '2026-10-01' } }, { careTeamTargets: { kcal: 1600 } },
      { logReminder: { meal: 'brunch', at: '11:00' } }, { logReminder: { meal: 'lunch', at: '2pm' } },
    ];
    for (const over of bad) {
      expect(preview(file({ settings, profile: profile({ ...food, ...over }) })).unreadableFields, JSON.stringify(over)).toEqual(['profile.food']);
    }
  });
});
