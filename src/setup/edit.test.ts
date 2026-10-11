import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { SetupAnswers } from '@/types/setup';
import { profileGaps, profileRules } from '@/engine/health';
import { isEnrolled } from '@/health/recommend';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { completedSetup, profileFrom } from './assemble';
import { editChapters, editOf, editPath, editedRecord, editorOpens, editorState } from './edit';
import { keysOfChapter } from './fields';
import { COMPLEX, GLIFLOZIN_NO_DIABETES, JOIN, MINIMAL, NO_CONDITIONS } from './fixtures';
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
  it('bring Your back and feet, for “Has a clinician told you to keep weight off a foot?”', () => {
    const feet = { ...MINIMAL, conditions: { ...NO_CONDITIONS, feet: 'yes' as const } };
    expect(editChapters(['health'], feet, MINIMAL)).toEqual(['health', 'backFeet']);
    expect(editChapters(['health'], { ...feet, conditions: { ...NO_CONDITIONS, feet: 'unsure' } }, MINIMAL)).toEqual(['health', 'backFeet']);
    expect(editChapters(['health'], feet, feet)).toEqual(['health']);
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

  it('Your back and feet with no pain answer shows the question that brings it', () => {
    expect(editPath(['backFeet'], MINIMAL, MINIMAL, CTX)).toEqual(['health.conditions']);
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

  it('keeps a chapter under Finish setting up only while a page in it is left', () => {
    const data = finished({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] });
    expect(data.settings.setup?.skipped).toEqual(['movement']);
    const a = opened(data);
    expect(editedRecord(data, { chapters: ['about'], opened: a, answers: a, skipped: [] }, TODAY, CTX).settings.setup?.skipped).toEqual(['movement']);
    expect(editedRecord(data, { chapters: ['movement'], opened: a, answers: { ...a, weeklyGoal: 60 }, skipped: [] }, TODAY, CTX).settings.setup?.skipped).toEqual([]);
  });
});
