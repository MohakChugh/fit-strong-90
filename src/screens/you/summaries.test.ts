import { describe, expect, it } from 'vitest';
import { shortDay } from './dates';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import { newObservation } from '@/health/observation';
import { formatClock } from '@/reminders/time';
import type { ImportPreview } from '@/store/transfer';
import {
  AVOID_MAX_ITEMS,
  addAvoid,
  conditionsLine,
  countsSentence,
  everyLabel,
  foodLine,
  habitLine,
  habitsLine,
  listOf,
  plural,
  previewLines,
  profileSections,
  recordCounts,
  reviewNeeded,
} from './summaries';

const owner = createDefaultProfile({
  weightKg: 82.4,
  heightCm: 178,
  trainingDays: ['monday', 'thursday', 'saturday'],
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
  health: { diabetes: 'type2', hypertension: 'treated', sglt2i: 'unsure', metformin: true, metforminSince: '2019', medicinesReviewed: true },
});

describe('words', () => {
  it('lists things the way a person does', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['water'])).toBe('water');
    expect(listOf(['water', 'walks'])).toBe('water and walks');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('counts with the right noun', () => {
    expect(plural(1, 'reading')).toBe('1 reading');
    expect(plural(3, 'reading')).toBe('3 readings');
  });

  it('says how often in plain words', () => {
    expect(everyLabel(30)).toBe('Every 30 minutes');
    expect(everyLabel(60)).toBe('Every hour');
    expect(everyLabel(90)).toBe('Every 1½ hours');
    expect(everyLabel(120)).toBe('Every 2 hours');
  });
});

describe('the profile, read back', () => {
  it('sums up the conditions that shape the app', () => {
    expect(conditionsLine(undefined)).toBe('Not set up yet');
    expect(conditionsLine(createDefaultProfile())).toBe('No conditions recorded');
    expect(conditionsLine(owner)).toBe('Type 2 diabetes · Blood pressure, treated · Lower back · Sciatica, left leg');
    expect(conditionsLine(createDefaultProfile({ health: { kidneyDisease: 'ckd', heartOrVascularDisease: true } })))
      .toBe('Heart or circulation · Kidney disease');
  });

  it('shows each answer as it was given, in the units the user chose', () => {
    const [about, training, body, health] = profileSections(owner, true);
    expect(about.rows).toContainEqual({ label: 'Weight', value: '82.4 kg' });
    expect(profileSections(owner, false)[0].rows).toContainEqual({ label: 'Weight', value: '181.7 lb' });
    expect(training.rows).toContainEqual({ label: 'Training days', value: 'Mon, Thu, Sat' });
    expect(body.rows).toEqual([
      { label: 'Pain or past injury', value: 'Lower back, Sciatica' },
      { label: 'Which leg', value: 'Left' },
      { label: 'Worse with', value: 'Sitting or bending forward' },
    ]);
    expect(health.rows).toContainEqual({ label: 'SGLT2 inhibitor', value: 'Not sure' });
    expect(health.rows).toContainEqual({ label: 'Metformin', value: 'Yes, since 2019' });
  });

  it('reads back the eye and foot answers that stop vigorous effort and walking', () => {
    const healthOf = (profile: ReturnType<typeof createDefaultProfile>) => profileSections(profile, true).find(s => s.title === 'Health')!.rows;
    const health = (h: object) => healthOf(createDefaultProfile({ health: { diabetes: 'type2', medicinesReviewed: true, ...h } }));
    expect(health({ footStatus: 'current_wound_or_active_charcot', retinopathy: 'severe_or_proliferative' })).toEqual(expect.arrayContaining([
      { label: 'Your feet today', value: 'Current wound' },
      { label: 'Diabetic eye disease (retinopathy)', value: 'Severe' },
    ]));
    // Asked with diabetes only, so only read back with it.
    expect(healthOf(createDefaultProfile()).map(r => r.label)).not.toContain('Your feet today');
  });

  it('ties each section to the wizard step that edits it', () => {
    expect(profileSections(owner, true).map(section => [section.title, section.step])).toEqual([
      ['About you', 'about'], ['Training', 'about'], ['Back and legs', 'body'], ['Health', 'health'],
    ]);
  });

  it('shows when the programme started, which editing Training can change', () => {
    const training = profileSections(owner, true, { programme: true, startDate: '2026-09-28' })[1];
    expect(training.rows[0]).toEqual({ label: 'Started', value: shortDay('2026-09-28') });
    expect(profileSections(owner, true, { programme: true })[1].rows.map(r => r.label)).not.toContain('Started');
  });

  it('does not show training defaults to someone outside the programme', () => {
    const sections = profileSections(owner, true, { programme: false });
    expect(sections.map(section => section.title)).toEqual(['About you', 'Back and legs', 'Health']);
    expect(sections[0].rows.map(row => row.label)).not.toContain('Experience');
  });

  it('reads back the fluid-limit answer, and an SGLT2 inhibitor taken without diabetes', () => {
    const health = (over: Parameters<typeof createDefaultProfile>[0]) => profileSections(createDefaultProfile(over), true)[3].rows;
    expect(health({})).toContainEqual({ label: 'Fluid limit from your care team', value: 'Not answered yet' });
    expect(health({ health: { fluidRestriction: 'unsure' } })).toContainEqual({ label: 'Fluid limit from your care team', value: 'Not sure' });
    expect(health({ health: { sglt2i: true } })).toContainEqual({ label: 'SGLT2 inhibitor', value: 'Yes' });
    // Asked of everyone, and an untouched No is not an answer (B08).
    expect(health({})).toContainEqual({ label: 'SGLT2 inhibitor', value: 'Not answered yet' });
    expect(health({ health: { medicinesReviewed: true } })).toContainEqual({ label: 'SGLT2 inhibitor', value: 'No' });
  });

  it('reads back the blood-pressure medicines for heart or kidney disease too, unconfirmed until answered', () => {
    const rows = (over: Parameters<typeof createDefaultProfile>[0]) => profileSections(createDefaultProfile(over), true)[3].rows;
    expect(rows({ health: { heartOrVascularDisease: true } })).toContainEqual({ label: 'Beta-blocker', value: 'No, not yet confirmed' });
    expect(rows({ health: { kidneyDisease: 'ckd', bpMedicinesReviewed: true } })).toContainEqual({ label: 'Diuretic or water pill', value: 'No' });
    expect(rows({}).map(r => r.label)).not.toContain('Beta-blocker');
  });

  it('says a weight was never entered rather than showing zero', () => {
    expect(profileSections(createDefaultProfile(), true)[0].rows[0]).toEqual({ label: 'Weight', value: 'Not entered' });
  });

  it('asks diabetes questions only of someone with diabetes, and never reads an unanswered one as no', () => {
    const none = profileSections(createDefaultProfile(), true)[3].rows.map(r => r.label);
    expect(none).not.toContain('Insulin');
    const unanswered = profileSections(createDefaultProfile({ health: { diabetes: 'type2' } }), true)[3].rows;
    expect(unanswered).toContainEqual({ label: 'Metformin', value: 'Not answered yet' });
  });

  it('marks unreviewed medicine answers as unconfirmed, so a default never reads as a plain no', () => {
    const unreviewed = createDefaultProfile({ health: { diabetes: 'type2', insulin: 'none', sulfonylureaOrMeglitinide: false } });
    const rows = profileSections(unreviewed, true)[3].rows;
    expect(rows).toContainEqual({ label: 'Insulin', value: 'None, not yet confirmed' });
    expect(rows).toContainEqual({ label: 'Sulfonylurea or meglitinide', value: 'No, not yet confirmed' });
    expect(rows).toContainEqual({ label: 'Metformin', value: 'Not answered yet' });
    expect(profileSections(owner, true)[3].rows).toContainEqual({ label: 'Insulin', value: 'None' });
  });

  it('flags answers that need a second look', () => {
    expect(reviewNeeded(owner)).toBeUndefined();
    expect(reviewNeeded(createDefaultProfile({ needsHealthReview: true }))).toBe('health');
    expect(reviewNeeded(createDefaultProfile({ health: { diabetes: 'type2' } }))).toBe('medicines');
    // Without diabetes, an SGLT2 question never answered still needs its answer.
    expect(reviewNeeded(createDefaultProfile())).toBe('sglt2');
    expect(reviewNeeded(createDefaultProfile({ health: { medicinesReviewed: true } }))).toBeUndefined();
    expect(reviewNeeded(undefined)).toBeUndefined();
  });
});

describe('food preferences', () => {
  it('reads back the pattern and what is left out', () => {
    expect(foodLine(undefined)).toBe('Not set');
    expect(foodLine({ pattern: 'eggetarian', avoid: [] })).toBe('Vegetarian, with eggs');
    expect(foodLine({ pattern: 'vegetarian', avoid: ['peanuts', 'mushrooms'] })).toBe('Vegetarian · leaves out peanuts and mushrooms');
  });

  it('adds a food to leave out as typed, tidily, and only once', () => {
    expect(addAvoid([], '  Peanuts   and   cashews ')).toEqual(['Peanuts and cashews']);
    expect(addAvoid(['Peanuts'], 'peanuts')).toEqual(['Peanuts']);
    expect(addAvoid(['Peanuts'], '   ')).toEqual(['Peanuts']);
    expect(addAvoid([], 'x'.repeat(200))[0].length).toBe(60);
    const full = Array.from({ length: AVOID_MAX_ITEMS }, (_, i) => `food ${i}`);
    expect(addAvoid(full, 'one more')).toEqual(full);
  });
});

describe('habit lines', () => {
  const healthy = createDefaultProfile({ weightKg: 80 });
  const habits: HabitSettings = {
    water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' },
    sittingBreak: { enabled: false, everyMinutes: 30, from: '09:00', to: '18:00' },
    mealWalk: { enabled: true, meals: ['dinner', 'lunch'], finish: { lunch: '13:30', dinner: '20:30' } },
  };

  it('says when each habit reminds, in the user\'s own times', () => {
    expect(habitLine('water', habits, healthy, formatClock)).toBe('Every 2 hours, 11:00 to 21:00');
    expect(habitLine('mealWalk', habits, healthy, formatClock)).toBe('After lunch (13:30) and dinner (20:30)');
    expect(habitLine('sittingBreak', habits, healthy, formatClock)).toBe('Off');
    expect(habitLine('water', { water: { ...habits.water!, from: '09:00', to: '11:00' } }, healthy, formatClock)).toBe('At 11:00');
  });

  it('describes a window across midnight as it was set, not as a whole day (D-11)', () => {
    const late = { sittingBreak: { enabled: true, everyMinutes: 60, from: '22:00', to: '02:00' } };
    expect(habitLine('sittingBreak', late, healthy, formatClock)).toBe('Every hour, 23:00 to 02:00');
  });

  it('gives the reason water is off instead of its times', () => {
    const ckd = createDefaultProfile({ health: { kidneyDisease: 'ckd' } });
    expect(habitLine('water', habits, ckd, formatClock)).toMatch(/kidney disease/);
  });

  it('says when quiet hours leave a habit nothing', () => {
    const quiet = { ...habits, quietHours: { from: '10:00', to: '22:00' } };
    expect(habitLine('water', quiet, healthy, formatClock)).toBe('On, but no reminder time is left outside quiet hours');
  });

  it('sums up what is on for the You list', () => {
    expect(habitsLine(undefined, healthy)).toBe('All off');
    expect(habitsLine(habits, healthy)).toBe('Water and walks after meals');
    expect(habitsLine(habits, createDefaultProfile({ health: { heartOrVascularDisease: true } }))).toBe('Walks after meals');
  });
});

describe('the record', () => {
  const at = '2026-10-08T08:00:00.000+05:30';
  const reading = (id: string, kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) =>
    newObservation({ id: `${id}:${kind === 'bloodPressureSystolic' ? 'systolic' : 'diastolic'}`, kind, value, scope: 'pointInTime', source: 'manual', at, context: `bp:${id}` });

  it('counts a blood-pressure reading once, though it is stored as two halves', () => {
    const observations = [
      reading('r1', 'bloodPressureSystolic', 128), reading('r1', 'bloodPressureDiastolic', 82),
      newObservation({ kind: 'glucose', value: 110, scope: 'pointInTime', source: 'manual', at }),
    ];
    const counts = recordCounts({ observations, sessions: [{}, {}], checkIns: [{}], bodyMetrics: [], personalRecords: [] });
    expect(counts).toEqual({ readings: 2, sessions: 2, checkIns: 1, bodyMetrics: 0, personalRecords: 0 });
    expect(countsSentence(counts)).toBe('2 readings, 2 sessions and 1 check-in');
    expect(countsSentence({ readings: 0, sessions: 0, checkIns: 0, bodyMetrics: 0, personalRecords: 0 })).toBe('nothing yet');
  });

  it('lists what a backup holds, one line per kind, blood pressure as readings', () => {
    const preview: ImportPreview = {
      ok: true, observations: { glucose: 12, bloodPressureSystolic: 8, bloodPressureDiastolic: 8, water: 3 },
      unreadableObservations: 0, sessions: 20, checkIns: 15, personalRecords: 0, bodyMetrics: 2, focusOverrides: 0,
      hasSettings: true, hasProfile: true, alreadyHere: 0, isEmpty: false,
    };
    expect(previewLines(preview)).toEqual([
      { label: 'Blood glucose', count: 12 },
      { label: 'Blood pressure', count: 8 },
      { label: 'Water', count: 3 },
      { label: 'Sessions', count: 20 },
      { label: 'Check-ins', count: 15 },
      { label: 'Body measurements', count: 2 },
    ]);
  });
});

describe('habit lines, with an open foot wound (content re-check R03)', () => {
  const wound = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, footStatus: 'current_wound_or_active_charcot' } });
  const habits = { sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '10:00' }, mealWalk: { enabled: true, meals: ['dinner' as const], finish: { dinner: '19:00' } } };

  it('says why a standing or walking habit is off, even one turned on before', () => {
    expect(habitLine('sittingBreak', habits, wound)).toMatch(/foot wound/);
    expect(habitLine('mealWalk', habits, wound)).toMatch(/foot wound/);
    expect(habitsLine(habits, wound)).toBe('All off');
  });
});
