import { describe, expect, it } from 'vitest';
import { profileFrom } from '@/setup/assemble';
import { COMPLEX, MINIMAL, UNSURE } from '@/setup/fixtures';
import { reviewRecord } from '@/setup/review';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import type { AppData } from '@/types';
import { shortDate, shortDay } from './dates';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import { newObservation } from '@/health/observation';
import { formatClock } from '@/reminders/time';
import type { ImportPreview } from '@/store/transfer';
import {
  AVOID_MAX_ITEMS,
  addAvoid,
  chapterSections,
  conditionsLine,
  countsSentence,
  everyLabel,
  copyLine,
  foodLine,
  privacyLine,
  staleLine,
  habitLine,
  habitsLine,
  listOf,
  plural,
  previewLines,
  recordCounts,
  reviewNeeded,
  keepsOpenLine,
  routeNotes,
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

  // v1's read-back rules, kept by Profile & health's chapters (ported from v1's Profile & health tests; B08, H-DATA).
  const S1 = { ...migrateData({ version: CURRENT_VERSION } as AppData).settings, useMetric: true };
  const chapters = (p: ReturnType<typeof createDefaultProfile>, s = S1) =>
    Object.fromEntries(chapterSections(p, s, '2026-10-10').map(c => [c.chapter, Object.fromEntries(c.rows.map(r => [r.label, r.value]))]));

  it('shows each answer as it was given, in the units the user chose', () => {
    const rows = chapters(owner);
    expect(rows.about.Weight).toBe('82.4 kg');
    expect(chapters(owner, { ...S1, useMetric: false }).about).toMatchObject({ Weight: '181.7 lb', Height: '5 ft 10 in' });
    expect(rows.backFeet).toEqual({ 'Pain or past injury': 'Lower back, Sciatica', 'Which leg': 'Left', 'Worse with': 'Sitting or bending forward' });
    expect(rows.medicines).toMatchObject({ 'A “-gliflozin” medicine': 'Not sure', Metformin: 'Yes, since 2019' });
    expect(chapterSections(owner, S1, '2026-10-10').map(c => c.chapter)).toEqual(['about', 'health', 'medicines', 'backFeet', 'movement', 'food', 'day']);
  });

  it('reads back the eye and foot answers that stop vigorous effort and walking', () => {
    const health = chapters(createDefaultProfile({ health: { diabetes: 'type2', medicinesReviewed: true, footStatus: 'current_wound_or_active_charcot', retinopathy: 'severe_or_proliferative' } })).health;
    expect(health).toMatchObject({ 'Your feet today': 'Current wound', 'Diabetic eye disease (retinopathy)': 'Severe' });
    // Asked with diabetes, or once answered, so only read back then.
    expect(Object.keys(chapters(createDefaultProfile()).health)).not.toContain('Your feet today');
  });

  it('shows the programme only for someone in it, with the day it started, and never its defaults', () => {
    expect(chapters(owner, { ...S1, startDate: '2026-09-28' }).movement['The 12-week programme']).toBe(`Joined, from ${shortDay('2026-09-28')}`);
    expect(chapters(owner).movement['The 12-week programme']).toBe('Not joined');
    const labels = Object.values(chapters(owner)).flatMap(rows => Object.keys(rows));
    for (const v1Only of ['Experience', 'Training days', 'Session length', 'Where you train']) expect(labels).not.toContain(v1Only);
  });

  it('reads back the fluid-limit answer, and a “-gliflozin” taken without diabetes', () => {
    expect(chapters(createDefaultProfile()).health['Fluid limit from your care team']).toBe('Not answered yet');
    expect(chapters(createDefaultProfile({ health: { fluidRestriction: 'unsure' } })).health['Fluid limit from your care team']).toBe('Not sure');
    expect(chapters(createDefaultProfile({ health: { sglt2i: true } })).medicines['A “-gliflozin” medicine']).toBe('Yes');
    // Asked of everyone, and an untouched No is not an answer (B08).
    expect(chapters(createDefaultProfile()).medicines['A “-gliflozin” medicine']).toBe('Not answered yet');
    expect(chapters(createDefaultProfile({ health: { medicinesReviewed: true } })).medicines['A “-gliflozin” medicine']).toBe('No');
  });

  it('reads back the blood-pressure medicines for heart or kidney disease too, unconfirmed until answered', () => {
    expect(chapters(createDefaultProfile({ health: { heartOrVascularDisease: true } })).medicines['Beta-blocker']).toBe('No, not yet confirmed');
    expect(chapters(createDefaultProfile({ health: { kidneyDisease: 'ckd', bpMedicinesReviewed: true } })).medicines['Water tablet (diuretic)']).toBe('No');
    expect(Object.keys(chapters(createDefaultProfile()).medicines)).not.toContain('Beta-blocker');
  });

  it('says a weight was never entered rather than showing zero', () => {
    expect(chapters(createDefaultProfile()).about.Weight).toBe('Not entered');
  });

  it('asks diabetes questions only of someone with diabetes, and never reads an unanswered one as no', () => {
    expect(Object.keys(chapters(createDefaultProfile()).medicines)).not.toContain('Insulin');
    expect(chapters(createDefaultProfile({ health: { diabetes: 'type2' } })).medicines.Metformin).toBe('Not answered yet');
  });

  it('marks unreviewed medicine answers as unconfirmed, so a default never reads as a plain no', () => {
    const rows = chapters(createDefaultProfile({ health: { diabetes: 'type2', insulin: 'none', sulfonylureaOrMeglitinide: false } })).medicines;
    expect(rows).toMatchObject({ Insulin: 'None, not yet confirmed', 'A tablet that can cause lows': 'No, not yet confirmed', Metformin: 'Not answered yet' });
    expect(chapters(owner).medicines.Insulin).toBe('None');
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
    expect(counts).toEqual({ readings: 2, sessions: 2, checkIns: 1, bodyMetrics: 0, personalRecords: 0, routes: 0 });
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

describe('privacyLine (B-24)', () => {
  it('says the standard privacy copy in full: where the records are, what map pictures share, and when anything leaves', () => {
    expect(privacyLine('iPhone')).toBe('Your records are stored on this iPhone. Optional map pictures share the area shown and your internet address with OpenStreetMap. Backups and calendar files leave only when you share them.');
  });
});

describe('routes in the record’s counts (Plan 6 Task 14)', () => {
  it('counts routes with the record', () => {
    expect(countsSentence({ readings: 2, sessions: 0, checkIns: 0, bodyMetrics: 0, personalRecords: 0, routes: 1 })).toBe('2 readings and 1 route');
    expect(recordCounts({ observations: [], sessions: [], checkIns: [], bodyMetrics: [], personalRecords: [], records: { routes: [{}, {}] } }).routes).toBe(2);
    expect(recordCounts({ observations: [], sessions: [], checkIns: [], bodyMetrics: [], personalRecords: [] }).routes).toBe(0);
  });
});

describe('calendar copies, as Reminders lists them (A-78)', () => {
  const AT = '2026-10-08T10:00:00.000+05:30';
  it('names the events, how many a day, when the file was added and until when', () => {
    expect(copyLine({ names: ['Glass of water'], events: 6, at: AT, until: '2027-01-06' }))
      .toEqual({ title: 'Glass of water', detail: `6 a day · added ${shortDate(AT)} · until ${shortDay('2027-01-06')}` });
    expect(copyLine({ names: ['Walk after lunch', 'Walk after dinner'], events: 2, at: AT, until: '2027-01-06' }).title).toBe('Walk after lunch and Walk after dinner');
    expect(copyLine({ names: ['Walk after dinner'], events: 1, at: AT, until: '2027-01-06' }).detail).toMatch(/^Once a day · added /);
  });
  it('says what changed for each copy that may be out of date', () => {
    expect(staleLine([
      { habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 0 },
      { habit: 'sittingBreak', names: ['Stand up and move'], inCalendar: 2, now: 1 },
    ])).toBe('Glass of water: 6 a day in Calendar, none now. Stand up and move: 2 a day in Calendar, once a day now.');
    // Only the words changed: a glass size, a precaution (codex H4-05).
    expect(staleLine([{ habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 6, wording: true }])).toBe('Glass of water: 6 a day in Calendar, still worded as before your change.');
  });
});

describe('chapterSections: Profile & health by chapter (journey §16; Plan 5)', () => {
  const S = { ...migrateData({ version: CURRENT_VERSION } as AppData).settings, useMetric: true };
  const read = (p: Parameters<typeof chapterSections>[0]) =>
    Object.fromEntries(chapterSections(p, S, '2026-10-10').map(c => [c.chapter, Object.fromEntries(c.rows.map(r => [r.label, r.value]))]));

  it('reads each chapter back from the record, in v1’s words where v1 named them', () => {
    const rows = read(profileFrom(COMPLEX, undefined, '2026-10-10', { thisYear: 2026 }));
    expect(rows.about).toMatchObject({ Name: 'Asha', Born: '1958', Height: '158 cm', Weight: '68 kg' });
    expect(rows.health).toMatchObject({ Diabetes: 'Type 2', 'High blood pressure': 'Treated', 'Fluid limit from your care team': 'No' });
    expect(rows.medicines).toMatchObject({ Insulin: 'Injections or pump, several times a day', Metformin: 'Yes, since 2015' });
    expect(rows.backFeet).toMatchObject({ 'Pain or past injury': 'Lower back, Sciatica', 'Which leg': 'Left' });
    expect(rows.food).toMatchObject({ 'What you eat': 'Vegetarian', Allergies: 'Peanuts' });
  });

  it('says Not sure where it was said (V-J17)', () => {
    expect(read(profileFrom(UNSURE, undefined, '2026-10-10', { thisYear: 2026 })).medicines.Insulin).toBe('Not sure');
  });

  it('names the person’s own allergy words beside the chips (board D82)', () => {
    const p = profileFrom({ ...COMPLEX, customAllergies: ['brinjal'] }, undefined, '2026-10-10', { thisYear: 2026 });
    expect(read(p).food.Allergies).toBe('Peanuts, brinjal');
    expect(read({ ...p, food: { pattern: 'vegan', avoid: [], allergies: [] } }).food.Allergies).toBe('None');
    expect(read({ ...p, food: { pattern: 'vegan', avoid: [] } }).food.Allergies).toBe('None given');
  });

  // Every row of a whole run, read back from what finishing stores: a row shown where it shouldn't be, or missing, fails.
  const whole = (a: typeof MINIMAL, metric = true) => {
    const { profile, settings } = reviewRecord(a, { settings: { ...S, useMetric: metric } }, '2026-10-10', { thisYear: 2026 });
    return Object.fromEntries(chapterSections(profile, settings, '2026-10-10').map(c => [c.chapter, Object.fromEntries(c.rows.map(r => [r.label, r.value]))]));
  };

  it('the minimal run: nothing asked is read back as an answer it wasn’t (journey §1.2)', () => {
    expect(whole(MINIMAL)).toEqual({
      about: { Name: 'Not given', 'Body for the exercise demos': 'Either', Height: 'Not entered', Weight: 'Not entered' },
      health: {
        Diabetes: 'None', 'High blood pressure': 'None', 'Heart or circulation': 'No', 'Kidney disease': 'No',
        'Fluid limit from your care team': 'Not answered yet', 'Cleared for exercise': 'Not yet',
      },
      medicines: { 'A “-gliflozin” medicine': 'No', 'Dizzy when you stand up': 'No', 'Glucose meter or sensor': 'None', 'Home blood-pressure cuff': 'No' },
      backFeet: { 'Pain or past injury': 'None' },
      movement: { 'What you’d most like to do': 'Not sure yet', 'Exercise now': 'Yes', 'Weekly goal': 'No goal', 'The 12-week programme': 'Not joined' },
      food: { 'What you eat': 'Vegetarian', Allergies: 'None', 'Logging what you eat': 'Meal ideas only' },
      day: { Reminders: 'All off', 'Quiet hours': 'None', 'Reminders come': 'In the app', 'Voice coach': 'On' },
    });
  });

  it('the complex run: the eyes, feet, medicines, leg and reminders it answered', () => {
    const rows = whole(COMPLEX);
    expect(rows.health).toEqual({
      Diabetes: 'Type 2', 'High blood pressure': 'Treated', 'Heart or circulation': 'No', 'Kidney disease': 'No', 'Fluid limit from your care team': 'No',
      'Diabetic eye disease (retinopathy)': 'None or mild', 'Nerve damage in your feet': 'No', 'Your feet today': 'Healthy', 'Cleared for exercise': 'For moderate exercise',
    });
    expect(rows.medicines).toEqual({
      Insulin: 'Injections or pump, several times a day', 'A tablet that can cause lows': 'No', 'A “-gliflozin” medicine': 'No', Metformin: 'Yes, since 2015',
      'Ketoacidosis, or low insulin': 'No', 'Beta-blocker': 'No', 'Water tablet (diuretic)': 'No', 'Dizzy when you stand up': 'No',
      'Glucose meter or sensor': 'Meter', 'Home blood-pressure cuff': 'Yes',
    });
    expect(rows.backFeet).toEqual({ 'Pain or past injury': 'Lower back, Sciatica', 'Which leg': 'Left', 'Worse with': 'Sitting or bending forward', 'A nerve damaged in the past': 'No' });
    expect(rows.movement).toEqual({ 'What you’d most like to do': 'Stretch more', 'Exercise now': 'No', 'Weekly goal': '90 minutes a week', 'The 12-week programme': 'Not joined' });
    expect(rows.food['Logging what you eat']).toBe('Meals, with calorie and carb estimates');
    expect(rows.day).toEqual({ Reminders: 'Water and walks after meals', 'Quiet hours': '10:00 pm to 7:00 am', 'Reminders come': 'In the app', 'Voice coach': 'On' });
  });

  it('in feet, inches and pounds when those are the units chosen', () => {
    expect(whole({ ...COMPLEX, metric: false, waistCm: 80 }, false).about).toEqual({
      Name: 'Asha', Born: '1958', 'Body for the exercise demos': 'Female figure', Height: '5 ft 2 in', Weight: '149.9 lb', Waist: '31 in',
    });
    expect(whole({ ...COMPLEX, waistCm: 80 }).about.Waist).toBe('80 cm');
  });

  it('as a calendar file, with the voice coach off, when those were chosen', () => {
    expect(whole({ ...MINIMAL, delivery: 'calendar', voice: { muted: true } }).day).toMatchObject({ 'Reminders come': 'As a calendar file', 'Voice coach': 'Off' });
  });
});

describe('the Food row on Me (Plan 7)', () => {
  it('names allergies and the logging level, after what the person eats', () => {
    expect(foodLine({ pattern: 'jain', avoid: [], allergies: ['peanut'], customAllergies: ['brinjal'], level: 'meals' })).toBe('Jain · allergic to peanut and brinjal · meals only, no numbers');
    expect(foodLine({ pattern: 'vegetarian', avoid: ['mushrooms'], level: 'estimates' })).toBe('Vegetarian · leaves out mushrooms · meals with estimates');
    expect(foodLine({ pattern: 'vegan', avoid: [], level: 'ideas' })).toBe('Vegan');
    expect(foodLine({ pattern: 'vegetarian', avoid: ['mushrooms'], allergies: ['milk'] })).toBe('Vegetarian · allergic to milk · leaves out mushrooms');
  });
});

describe('what Replace keeps (journey §4.6, H6-03)', () => {
  it('says today’s safety answers stay, before anything changes', () => {
    expect(keepsOpenLine('iPhone')).toBe('Today’s safety answers on this iPhone stay, with the readings they depend on: a backup never clears them.');
  });
});

describe('routes in a restore (journey §18.3, B-26, Review Focus 4, H6-05)', () => {
  it('says before anything happens that a phone that keeps no routes won’t take the file’s', () => {
    expect(routeNotes({ records: { routes: 3 }, refusedStores: ['routes'], replaceRemoves: {} })).toEqual(['The file’s 3 routes won’t be added, because this phone doesn’t keep routes.']);
    expect(routeNotes({ records: { routes: 3 }, refusedStores: ['routes'], replaceRemoves: {} }, false)).toEqual(['The file’s 3 routes won’t be added, because this phone doesn’t keep routes.']);
  });

  it('says how a phone not asked yet takes them: it asks, and the file can be restored again', () => {
    expect(routeNotes({ records: { routes: 1 }, refusedStores: ['routes'], replaceRemoves: {} }, 'unasked')).toEqual([
      'The file’s 1 route won’t be added, because this phone hasn’t been asked yet whether to keep routes. To add them, turn on Keep walk routes in Me → Data, then restore the file again.',
    ]);
  });

  it('says that replacing from a file without routes removes this phone’s', () => {
    expect(routeNotes({ records: {}, refusedStores: [], replaceRemoves: { routes: 2 } })).toEqual(['Replacing removes this phone’s 2 routes, which the file doesn’t hold.']);
  });

  it('says nothing when the file’s routes are simply added', () => {
    expect(routeNotes({ records: { routes: 1 }, refusedStores: [], replaceRemoves: {} }, true)).toEqual([]);
  });

  it('says the file’s routes from before an erase stay erased (B-05)', () => {
    expect(routeNotes({ records: { routes: 2 }, refusedStores: [], refusedRecords: { routes: 2 }, replaceRemoves: {} }, true)).toEqual([
      'The file’s 2 routes are from before you erased routes on this phone, so they stay erased.',
    ]);
    expect(routeNotes({ records: { routes: 3 }, refusedStores: [], refusedRecords: { routes: 1 }, replaceRemoves: {} }, true)).toEqual([
      '1 route in the file is from before you erased routes on this phone, so it stays erased.',
    ]);
  });

  it('says this phone’s routes go too when the file’s are refused', () => {
    expect(routeNotes({ records: { routes: 3 }, refusedStores: ['routes'], replaceRemoves: { routes: 2 } })).toEqual([
      'The file’s 3 routes won’t be added, because this phone doesn’t keep routes.',
      'Replacing removes this phone’s 2 routes too.',
    ]);
  });
});
