import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { SetupAnswers } from '@/types/setup';
import { deriveHealth, profileGaps, profileRules } from '@/engine/health';
import { isEnrolled } from '@/health/recommend';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { completedSetup, profileFrom } from './assemble';
import { editChapters, editMeasurements, editOf, editPath, editedRecord, editorOpens, editorState } from './edit';
import { keysOfChapter } from './fields';
import { COMPLEX, GLIFLOZIN_NO_DIABETES, JOIN, MINIMAL, NO_CLASSES, NO_CONDITIONS, withC } from './fixtures';
import { SAFETY_CHAPTERS, commitPage, pathFor } from './graph';
import { answersFromProfile, answersToEdit } from './prefill';
import { setupStateOf } from './state';

const TODAY = '2026-10-10';
const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026 };
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
const finished = (a: typeof MINIMAL) => completedSetup(fresh(), a, NOW, { ...CTX, hasSteps: false });
const opened = (data: AppData) => answersToEdit(data.settings.setup?.answers, data.profile!, data.settings, TODAY, CTX);

describe('which chapters an edit owns (board D79; Review Focus 1)', () => {
  it('adds Your medicines when the edit adds diabetes or blood pressure', () => {
    const was = GLIFLOZIN_NO_DIABETES;
    expect(editChapters(['health'], { ...was, conditions: { ...NO_CONDITIONS, diabetes: 'yes' } }, was)).toEqual(['health', 'medicines']);
    expect(editChapters(['health'], { ...was, conditions: { ...NO_CONDITIONS, bp: 'yes' } }, was)).toEqual(['health', 'medicines']);
    // Heart or kidney disease asks the blood-pressure medicines too (`bpMedicinesAsked`).
    expect(editChapters(['health'], { ...was, conditions: { ...NO_CONDITIONS, heart: 'yes' } }, was)).toEqual(['health', 'medicines']);
    expect(editChapters(['health'], { ...was, conditions: { ...NO_CONDITIONS, kidney: 'unsure' } }, was)).toEqual(['health', 'medicines']);
    expect(editChapters(['about'], was, was)).toEqual(['about']);
  });
});

describe('foot problems added in Your health (board D79; K-30)', () => {
  it('bring Your back and feet, for “Has a doctor or nurse (clinician) told you to keep weight off a foot?”', () => {
    const feet = { ...MINIMAL, conditions: { ...NO_CONDITIONS, feet: 'yes' as const } };
    expect(editChapters(['health'], feet, MINIMAL)).toEqual(['health', 'backFeet']);
    expect(editChapters(['health'], { ...feet, conditions: { ...NO_CONDITIONS, feet: 'unsure' } }, MINIMAL)).toEqual(['health', 'backFeet']);
    expect(editChapters(['health'], feet, feet)).toEqual(['health']);
  });

  it('a clinician’s limit outranks the foot chip: unticking feet keeps walks held and asks the limit again (H5-03, K5-02)', () => {
    const data = finished(withC({ feet: 'yes' }, { feetNumb: 'no', footWound: 'no', footRestriction: 'yes', clearance: 'none', priorDka: 'no' }));
    expect(data.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    const a = opened(data);
    const opens = editorOpens('health', data.profile);
    const unticked = editorState(opens, { ...a, conditions: { ...a.conditions, feet: 'no' } }, a, CTX);
    expect(unticked.chapters).toContain('backFeet');
    expect(unticked.pages).toContain('backFeet.history');
    const kept = editedRecord(data, editOf(unticked, a), TODAY, CTX);
    expect(kept.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(profileRules(kept.profile!).modifiers).toContain('FOOT');
    // Only the limit itself, answered No, releases the hold.
    const released = editorState(opens, { ...a, conditions: { ...a.conditions, feet: 'no' }, footRestriction: 'no' }, a, CTX);
    expect(editedRecord(data, editOf(released, a), TODAY, CTX).profile?.health.footStatus).toBe('healthy');
  });

  it('a record without diabetes keeps its eye treatment and foot wound through a Save of Your health (K5-02)', () => {
    const data = fresh();
    data.settings = { ...data.settings, onboardingComplete: true };
    data.profile = createDefaultProfile({
      weightKg: 70,
      health: { medicinesReviewed: true, hypertension: 'treated', retinopathy: 'recent_eye_treatment', footStatus: 'current_wound_or_active_charcot', clearance: 'none' },
    });
    const a = opened(data);
    // Saved as Save stores it, with the one question left answered: a ticked row makes the checklist answered, and its unticked rows No (B-08).
    const state = editorState(editorOpens('health', data.profile), { ...a, targets: 'no' }, a, CTX);
    expect(state.blocking).toEqual([]);
    const after = editedRecord(data, editOf(state, a), TODAY, CTX);
    expect(after.profile?.health.retinopathy).toBe('recent_eye_treatment');
    expect(after.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(profileRules(after.profile!).outcome).toBe('red');
  });

  it('an upgrader with back pain is asked it in the same edit, though the page waited before (journey §16)', () => {
    const v1 = answersFromProfile(createDefaultProfile({ weightKg: 70, pain: { areas: ['lowerBack'], worseWith: 'flexion' }, health: { medicinesReviewed: true } }), fresh().settings);
    const feet = { ...v1, conditions: { ...v1.conditions, feet: 'yes' as const } };
    expect(editPath(editChapters(['health'], feet, v1), feet, v1, CTX)).toContain('backFeet.history');
  });
});

describe('which pages an edit shows (journey §16)', () => {
  it('an upgrader editing About you sees About you only, never v2’s new safety questions', () => {
    const v1 = answersFromProfile(createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } }), fresh().settings);
    expect(editPath(['about'], v1, v1, CTX)).toEqual(['about.name', 'about.figure', 'about.body']);
  });

  it('a new foot answer brings its follow-ups, in this chapter and the next', () => {
    const feet = { ...COMPLEX, conditions: { ...COMPLEX.conditions, feet: 'yes' as const } };
    const path = editPath(['health'], feet, COMPLEX, CTX);
    expect(path).toEqual(expect.arrayContaining(['health.feet', 'backFeet.history']));
    expect(path).not.toContain('medicines.which');
  });

  it('Your back and feet with no pain answer shows the question that brings it, and the nerve history (H5-19)', () => {
    expect(editPath(['backFeet'], MINIMAL, MINIMAL, CTX)).toEqual(['health.conditions', 'backFeet.history']);
  });
});

describe('the record after an edit (journey §16)', () => {
  it('changes only what the edit changed, and keeps what another copy saved meanwhile (scan D-03; Review Focus 1)', () => {
    const data = finished(COMPLEX);
    const a = opened(data);
    const latest: AppData = { ...data, profile: { ...data.profile!, health: { ...data.profile!.health, footStatus: 'current_wound_or_active_charcot' } } };
    const after = editedRecord(latest, { chapters: ['about'], opened: a, answers: { ...a, weightKg: 70 }, skipped: [] }, TODAY, CTX);
    expect(after.profile?.weightKg).toBe(70);
    expect(after.settings.currentWeight).toBe(70);
    expect(after.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect({ ...after.profile, weightKg: 68 }).toEqual(latest.profile);
  });

  it('saving the three safety chapters, each answered, clears a pending review (H-DATA)', () => {
    const data = fresh();
    data.settings = { ...data.settings, onboardingComplete: true };
    data.profile = { ...profileFrom(COMPLEX, undefined, TODAY, CTX), needsHealthReview: true };
    const a = opened(data);
    // The review asks every safety question again (H5-10), and its page with whether they exercise now (H5-11): answered as COMPLEX did.
    const given: SetupAnswers = { ...a, ...Object.fromEntries(SAFETY_CHAPTERS.flatMap(keysOfChapter).map(k => [k, COMPLEX[k]])), focus: COMPLEX.focus, active: COMPLEX.active };
    const answers = pathFor(given).reduce<SetupAnswers>((x, id) => commitPage(id, x), given);
    const after = editedRecord(data, { chapters: SAFETY_CHAPTERS, opened: a, answers, skipped: [] }, TODAY, CTX);
    expect(after.profile?.needsHealthReview).toBe(false);
  });

  it('a pending review asks whether they exercise now, and stays pending until it is answered (H5-11)', () => {
    const data = fresh();
    data.settings = { ...data.settings, onboardingComplete: true, focus: 'stretch' };
    // Type 2 without clearance, and the default "exercises now", which would skip the light-work rule for the inactive.
    data.profile = createDefaultProfile({ needsHealthReview: true, health: { diabetes: 'type2', clearance: 'none' } });
    const a = opened(data);
    const safety: SetupAnswers = {
      conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2', clearance: 'none', targets: 'no',
      regular: 'no', priorDka: 'no', dizzy: 'no', glucoseMonitor: 'none', bpCuff: false,
    };
    const save = (answers: SetupAnswers) => {
      const s = editorState(editorOpens('health', data.profile), answers, a, CTX);
      return { s, after: editedRecord(data, editOf(s, a), TODAY, CTX) };
    };
    const unanswered = save({ ...a, ...safety });
    expect(unanswered.s.blocking).toContain('movement.focus');
    expect(unanswered.after.profile?.needsHealthReview).toBe(true);
    const answered = save({ ...a, ...safety, active: 'no' });
    expect(answered.s.blocking).toEqual([]);
    expect(answered.after.profile?.needsHealthReview).toBe(false);
    expect(profileRules(answered.after.profile!).lightOnly).toBe(true);
    // A focus changed on the review's own page is saved too, and the rest of Your movement stays as it was.
    const refocused = save({ ...a, ...safety, active: 'no', focus: 'move' });
    expect(refocused.after.settings.focus).toBe('move');
    expect(refocused.after.settings.setup?.skipped).toEqual(setupStateOf(data.settings, data.profile).skipped);
  });

  it('insulin added in Your medicines asks about lows and gives the engine its risk, though the stored answers lack the diabetes chip (H5-01)', () => {
    // A reviewed record without diabetes, restored with setup answers that lack the conditions.
    const p = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
    const { conditions: _lost, ...stored } = answersFromProfile(p, fresh().settings);
    void _lost;
    const data = fresh();
    data.profile = p;
    data.settings = { ...data.settings, onboardingComplete: true, setup: { stage: 'done', skipped: [], answers: stored } };
    const a = opened(data);
    const opens = editorOpens('medicines', p);
    const insulin: SetupAnswers = { ...a, regular: 'yes', classes: { ...NO_CLASSES, insulin: 'yes' }, glucoseMonitor: 'none', bpCuff: false };
    const asked = editorState(opens, insulin, a, CTX);
    // The follow-ups are asked, with the clinician limits diabetes brings, and Save waits for them before vouching for the medicines.
    expect(asked.blocking).toEqual(expect.arrayContaining(['health.limits', 'medicines.lows', 'medicines.ketones']));
    const answered = editorState(opens, { ...insulin, clearance: 'none', targets: 'no', insulinHow: 'basalOnly', lowsRisk: 'no', priorDka: 'no', ketoneTest: 'none' }, a, CTX);
    expect(answered.blocking).toEqual([]);
    const after = editedRecord(data, editOf(answered, a), TODAY, CTX);
    expect(after.profile?.health.diabetes).toBe('other');
    expect(deriveHealth(after.profile!.health).hypoRisk).toBe(true);
  });

  it('adding diabetes without its medicines never keeps the old review (Review Focus 1)', () => {
    const data = finished(GLIFLOZIN_NO_DIABETES);
    const a = opened(data);
    const after = editedRecord(data, { chapters: ['health'], opened: a, answers: { ...a, conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2' }, skipped: [] }, TODAY, CTX);
    expect(after.profile?.health.medicinesReviewed).toBe(false);
    expect(profileGaps(after.profile!).medicinesUnknown).toBe(true);
  });

  it('a save vouches only for what it changed: a review reopened meanwhile stays open (H-DATA; scan D-03)', () => {
    const data = finished(GLIFLOZIN_NO_DIABETES);
    const a = opened(data);
    // Another copy added diabetes meanwhile, so its medicines wait to be answered.
    const latest: AppData = { ...data, profile: { ...data.profile!, health: { ...data.profile!.health, diabetes: 'type2', medicinesReviewed: false } } };
    const after = editedRecord(latest, { chapters: ['medicines'], opened: a, answers: a, skipped: [] }, TODAY, CTX);
    expect(after.profile?.health.diabetes).toBe('type2');
    expect(after.profile?.health.medicinesReviewed).toBe(false);
    expect(profileGaps(after.profile!).medicinesUnknown).toBe(true);
    // A health review flagged meanwhile (a backup restored in another tab, say) waits for answers this copy hasn't shown.
    const flagged: AppData = { ...data, profile: { ...data.profile!, needsHealthReview: true } };
    expect(editedRecord(flagged, { chapters: SAFETY_CHAPTERS, opened: a, answers: a, skipped: [] }, TODAY, CTX).profile?.needsHealthReview).toBe(true);
  });

  it('joins the programme from Your movement (D81)', () => {
    const data = finished(MINIMAL);
    const a = opened(data);
    const after = editedRecord(data, { chapters: ['movement'], opened: a, answers: { ...a, programme: 'join', join: JOIN }, skipped: [] }, TODAY, CTX);
    expect(isEnrolled(after.settings, after.profile)).toBe(true);
    expect(after.settings.setup?.answers?.programme).toBe('joined');
  });

  it('never moves or clears the programme’s start date (D35; v1’s wizard rule)', () => {
    const data = finished({ ...MINIMAL, programme: 'join', join: JOIN });
    expect(data.settings.startDate).toBe(JOIN.startDate);
    const a = opened(data);
    for (const chapter of ['about', 'health', 'movement'] as const) {
      const after = editedRecord(data, { chapters: [chapter], opened: a, answers: { ...a, weightKg: 70, weeklyGoal: 90 }, skipped: [] }, TODAY, CTX);
      expect(after.settings.startDate, chapter).toBe(JOIN.startDate);
    }
    // Already in it, a Join answer joins nothing again: leaving and joining are Me → Goals' own actions.
    const again = editedRecord(data, { chapters: ['movement'], opened: a, answers: { ...a, programme: 'join', join: { ...JOIN, startDate: '2026-11-02' } }, skipped: [] }, TODAY, CTX);
    expect(again.settings.startDate).toBe(JOIN.startDate);
  });

  it('changes only the reminders the edit changed, keeping another copy’s (scan D-03)', () => {
    const water = { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };
    const data = finished({ ...MINIMAL, water, fluidLimit: 'no', quiet: { from: '22:00', to: '07:00' } });
    const a = opened(data);
    // Another copy changed the water reminder meanwhile.
    const latest: AppData = { ...data, settings: { ...data.settings, habits: { ...data.settings.habits, water: { ...data.settings.habits!.water!, everyMinutes: 90 } } } };
    const after = editedRecord(latest, { chapters: ['day'], opened: a, answers: { ...a, quiet: 'none' }, skipped: [] }, TODAY, CTX);
    expect(after.settings.habits?.water?.everyMinutes).toBe(90);
    expect(after.settings.habits?.quietHours).toBeUndefined();
    const timed = editedRecord(latest, { chapters: ['day'], opened: a, answers: { ...a, quiet: { from: '23:00', to: '06:00' } }, skipped: [] }, TODAY, CTX);
    expect(timed.settings.habits?.quietHours).toEqual({ from: '23:00', to: '06:00' });
    expect(timed.settings.habits?.water?.everyMinutes).toBe(90);
  });

  it('a fluid limit answered in Your day and coach reaches the engine, as Your health’s does (H5-04, K5-03)', () => {
    const data = finished(MINIMAL);
    const a = opened(data);
    expect(a.fluidLimit).toBeUndefined();
    const water = { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };
    for (const [answer, want] of [['yes', true], ['unsure', 'unsure'], ['no', false]] as const) {
      const state = editorState(editorOpens('day', data.profile), { ...a, water, fluidLimit: answer }, a, CTX);
      expect(state.chapters).toEqual(['day']);
      const after = editedRecord(data, editOf(state, a), TODAY, CTX);
      expect(after.profile?.health.fluidRestriction, answer).toBe(want);
      // The reminder follows it: on only with no limit.
      expect(after.settings.habits?.water?.enabled, answer).toBe(answer === 'no');
    }
  });

  it('keeps a chapter under Finish setting up only while a page in it is left', () => {
    const data = finished({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] });
    expect(data.settings.setup?.skipped).toEqual(['movement']);
    const a = opened(data);
    expect(editedRecord(data, { chapters: ['about'], opened: a, answers: a, skipped: [] }, TODAY, CTX).settings.setup?.skipped).toEqual(['movement']);
    expect(editedRecord(data, { chapters: ['movement'], opened: a, answers: { ...a, weeklyGoal: 60 }, skipped: [] }, TODAY, CTX).settings.setup?.skipped).toEqual([]);
  });
});

describe('what Save waits for in Me (H5-15, K5-04)', () => {
  it('a year that can’t be stored, or "No" to 18 or over, holds Save though the page could be left unanswered', () => {
    const data = finished(MINIMAL);
    const a = opened(data);
    const blocks = (answers: SetupAnswers) => editorState(editorOpens('about', data.profile), { ...a, ...answers }, a, CTX).blocking;
    expect(blocks({ birthYear: 195 })).toContain('about.name');
    expect(blocks({ birthYear: 2015 })).toContain('about.name');
    expect(blocks({ birthYear: 2008, adult: false })).toContain('about.name');
    expect(blocks({ birthYear: 2008 })).toContain('about.name');
    // Left empty, it can wait under Finish setting up; a year that can be stored saves.
    expect(blocks({})).toEqual([]);
    expect(blocks({ birthYear: 1958 })).toEqual([]);
    expect(blocks({ birthYear: 2008, adult: true })).toEqual([]);
  });
});

describe('the usual meal times Me shows (H5-26)', () => {
  it('an upgrader with after-meal walks and no stored times saves the day chapter unchanged, with the times it showed', () => {
    const data = fresh();
    data.settings = { ...data.settings, onboardingComplete: true, habits: { mealWalk: { enabled: true, meals: ['lunch'] } } };
    data.profile = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
    const a = opened(data);
    const state = editorState(editorOpens('day', data.profile), a, a, CTX);
    expect(state.pages).toContain('day.meals');
    expect(state.blocking).toEqual([]);
    expect(editedRecord(data, editOf(state, a), TODAY, CTX).settings.habits?.mealWalk?.finish).toEqual({ lunch: '13:30' });
  });
});

describe('food answers after a skipped eating pattern (H5-20; board D164)', () => {
  it('are kept as given and read back, and the profile takes them once the pattern is answered', async () => {
    const { chapterSections } = await import('@/screens/you/summaries');
    const skipped: SetupAnswers = { ...MINIMAL, pattern: undefined, allergies: undefined, foodLevel: 'meals', hardBefore: 'yes', skippedPages: ['food.pattern'] };
    const data = finished(skipped);
    // A food record needs its pattern (D82): none yet, and the answers wait in setup's own.
    expect(data.profile?.food).toBeUndefined();
    expect(data.settings.setup?.answers).toMatchObject({ foodLevel: 'meals', hardBefore: 'yes' });
    const logging = (d: AppData) => chapterSections(d.profile!, d.settings, TODAY).find(s => s.chapter === 'food')!.rows.find(r => r.label === 'Logging what you eat')!.value;
    expect(logging(data)).toBe('Meals only, no numbers');
    // Me → Your food: the pattern answered, the level and the screening answer go with it.
    const a = opened(data);
    const state = editorState(editorOpens('food', data.profile), { ...a, pattern: 'vegetarian', allergies: [] }, a, CTX);
    const after = editedRecord(data, editOf(state, a), TODAY, CTX);
    expect(after.profile?.food).toMatchObject({ pattern: 'vegetarian', level: 'meals', hardBefore: 'yes' });
    expect(logging(after)).toBe('Meals only, no numbers');
  });

  it('allergies, asked whatever the pattern, wait with them and are read back (K5-08; board D167)', async () => {
    const { chapterSections } = await import('@/screens/you/summaries');
    const skipped: SetupAnswers = { ...MINIMAL, pattern: undefined, allergies: ['peanut'], customAllergies: ['brinjal'], skippedPages: ['food.pattern'] };
    const data = finished(skipped);
    expect(data.profile?.food).toBeUndefined();
    const allergies = (d: AppData) => chapterSections(d.profile!, d.settings, TODAY).find(s => s.chapter === 'food')!.rows.find(r => r.label === 'Allergies')!.value;
    expect(allergies(data)).toBe('Peanuts, brinjal');
    const a = opened(data);
    const after = editedRecord(data, editOf(editorState(editorOpens('food', data.profile), { ...a, pattern: 'vegan' }, a, CTX), a), TODAY, CTX);
    expect(after.profile?.food).toMatchObject({ pattern: 'vegan', allergies: ['peanut'], customAllergies: ['brinjal'] });
  });
});

describe('the readings an edit makes (H5-14)', () => {
  it('only from a body measure this edit changed, in About you', () => {
    const data = finished({ ...MINIMAL, weightKg: 68, heightCm: 160 });
    const a = opened(data);
    expect(editMeasurements({ chapters: ['about'], opened: a, answers: { ...a, weightKg: 69 }, skipped: [] }, NOW).map(o => [o.kind, o.value])).toEqual([['weight', 69]]);
    // Unchanged here, whatever the record says now.
    expect(editMeasurements({ chapters: ['about'], opened: a, answers: a, skipped: [] }, NOW)).toEqual([]);
    expect(editMeasurements({ chapters: ['health'], opened: a, answers: { ...a, weightKg: 69 }, skipped: [] }, NOW)).toEqual([]);
  });
});

describe('raw answers another copy saved meanwhile (H5-13)', () => {
  it('an unrelated edit keeps them: only what the edit changed is written onto the answers as they are', () => {
    const data = finished(withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none', dizzy: 'no' }));
    // Copy A opens About you; copy B then changes heart disease from Yes to Not sure, which the engine reads the same.
    const a = opened(data);
    const b = opened(data);
    const bState = editorState(editorOpens('health', data.profile), { ...b, conditions: { ...b.conditions, heart: 'unsure' } }, b, CTX);
    const byB = editedRecord(data, editOf(bState, b), TODAY, CTX);
    expect(byB.settings.setup?.answers?.conditions?.heart).toBe('unsure');
    // Copy B also left the weekly goal unanswered in Your movement.
    const bMove = editorState(editorOpens('movement', byB.profile), { ...b, weeklyGoal: undefined }, b, CTX);
    const byB2 = editedRecord(byB, editOf(bMove, b), TODAY, CTX);
    expect(byB2.settings.setup?.answers?.skippedPages).toContain('movement.goal');
    // Copy A saves a name.
    const after = editedRecord(byB2, { chapters: ['about'], opened: a, answers: { ...a, name: 'Kai' }, skipped: [] }, TODAY, CTX);
    expect(after.settings.setup?.answers?.name).toBe('Kai');
    expect(after.settings.setup?.answers?.conditions?.heart).toBe('unsure');
    expect(after.settings.setup?.answers?.skippedPages).toContain('movement.goal');
  });
});

describe('a shown page half answered holds Save, with the reason at it (K5-15; board D157)', () => {
  const water = { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };
  const data = finished(MINIMAL);
  const a = opened(data);
  const blocking = (chapter: 'day' | 'food' | 'movement', answers: SetupAnswers, from = a) =>
    editorState(editorOpens(chapter, data.profile), answers, from, CTX).blocking;

  it('water turned on with no fluid answer, or after-meal walks with no meal', () => {
    expect(blocking('day', { ...a, water })).toEqual(['day.water']);
    expect(blocking('day', { ...a, mealWalk: { on: true, meals: [] } })).toContain('day.walks');
    expect(blocking('day', { ...a, water, fluidLimit: 'no' })).toEqual([]);
  });

  it('an answer taken away: allergies unticked would store them unknown', () => {
    expect(blocking('food', { ...a, allergies: undefined })).toContain('food.allergies');
  });

  it('a preference page left as it opened still waits under Finish setting up', () => {
    const noGoal = { ...a, weeklyGoal: undefined };
    const state = editorState(editorOpens('movement', data.profile), noGoal, noGoal, CTX);
    expect(state.left).toContain('movement.goal');
    expect(state.blocking).toEqual([]);
  });
});
