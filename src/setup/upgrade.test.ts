import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { Mode } from '@/types/checkin';
import type { HealthProfile, UserProfile } from '@/types/profile';
import { CHAPTER_IDS, CONDITION_IDS, type SetupAnswers } from '@/types/setup';
import { permission } from '@/engine/permission';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { profileFrom } from './assemble';
import { editOf, editedRecord, editorOpens, editorState } from './edit';
import { answersFromProfile, answersToEdit } from './prefill';

const TODAY = '2026-10-08';
const NOW = new Date('2026-10-08T09:00:00+05:30');
const CTX = { thisYear: 2026 };
const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];

/** codex-acceptance.md's envelope: every persona starts from it. */
const ENVELOPE_HEALTH: Partial<HealthProfile> = {
  diabetes: 'none', insulin: 'none', sulfonylureaOrMeglitinide: false, sglt2i: false, metformin: false, priorDkaOrInsulinDeficiency: false,
  medicinesReviewed: true, highHypoRisk: false, hypertension: 'none', betaBlocker: false, diuretic: false, heartOrVascularDisease: false,
  kidneyDisease: 'none', retinopathy: 'none_or_mild', peripheralNeuropathy: 'no', footStatus: 'healthy', dizzyOnStandingOrAutonomicNeuropathy: false,
  glucoseMonitor: 'none', glucoseUnit: 'mg/dL', ketoneTest: 'none', bpMonitor: false, currentlyActive: true, clearance: 'vigorous',
};
const persona = (health: Partial<HealthProfile>, extra: Partial<UserProfile> = {}): UserProfile => createDefaultProfile({
  weightKg: 78, heightCm: 175, birthYear: 1982, experience: 'beginner', trainingDays: ['monday', 'thursday', 'saturday'], sessionMinutes: 45,
  equipment: 'homeNone', goals: ['flexible'], ladder: { hinge: 2, squat: 2, neuralGate: false }, voice: { muted: true, checked: true },
  figure: 'male', needsHealthReview: false, ...extra, health: { ...ENVELOPE_HEALTH, ...health },
});
const BACK = { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' } as const;

const PERSONAS: Record<string, UserProfile> = {
  P01: persona({ diabetes: 'type2', metformin: true, metforminSince: '2019', glucoseMonitor: 'meter', hypertension: 'treated', bpMonitor: true },
    { equipment: 'fullGym', pain: { ...BACK, areas: [...BACK.areas] }, food: { pattern: 'vegetarian', avoid: [], region: 'north' } }),
  P02: persona({}, { trainingDays: [], weightKg: 65 }),
  P03: persona({ diabetes: 'type2', sulfonylureaOrMeglitinide: true, metformin: true, metforminSince: '2023', glucoseMonitor: 'meter' }),
  P04: persona({ diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', metformin: true, metforminSince: '2022', glucoseMonitor: 'meter' }),
  P05: persona({ diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' }),
  P06: persona({}, { pain: { ...BACK, areas: [...BACK.areas] } }),
};

const recordOf = (p: UserProfile): AppData => {
  const data = migrateData({ version: CURRENT_VERSION } as AppData);
  return { ...data, profile: p, settings: { ...data.settings, onboardingComplete: true, startDate: '2026-09-24', focus: 'stretch' } };
};

describe('an upgrade from v1 changes nothing the engine reads (journey §6.6; A-36)', () => {
  for (const [name, p] of Object.entries(PERSONAS)) {
    it(`${name}: its answers give back the same profile`, () => {
      expect(profileFrom(answersFromProfile(p, recordOf(p).settings), p, TODAY, CTX)).toEqual(p);
    });

    // A real Save also stores a shown checklist's unticked rows as No (B-08): that's an answer the person gives.
    // This checks the part nobody gives: the answers read back from the record, saved as they are, change nothing.
    it(`${name}: every chapter saved with the answers it opened with keeps the profile and every permission`, () => {
      const data = recordOf(p);
      const opened = answersToEdit(undefined, p, data.settings, TODAY, CTX);
      for (const chapter of CHAPTER_IDS.filter(c => c !== 'welcome')) {
        const after = editedRecord(data, { chapters: [chapter], opened, answers: opened, skipped: [] }, TODAY, CTX);
        expect(after.profile, chapter).toEqual(p);
        for (const mode of MODES) expect(permission({ profile: after.profile!, now: NOW }, mode), `${chapter} ${mode}`).toEqual(permission({ profile: p, now: NOW }, mode));
      }
    });
  }
});

/** Records without diabetes that hold an eye or foot value only an answer put there (K5-02): Your health's rows open empty for them. */
const HOLDS_WITHOUT_DIABETES: Record<string, UserProfile> = {
  'eye treatment, no diabetes': persona({ retinopathy: 'recent_eye_treatment' }),
  'moderate eye disease, no diabetes': persona({ retinopathy: 'moderate' }),
  'a foot wound, no diabetes': persona({ footStatus: 'current_wound_or_active_charcot' }),
  'numb feet not sure, no diabetes': persona({ peripheralNeuropathy: 'unsure' }),
};

/**
 * The questions v1 never asked, answered as the record already says: with no
 * limits or targets, no other condition, no regular medicine, no monitor, no
 * nerve damaged, no foot limit and no food allergies.
 */
function asRecorded(p: UserProfile, a: SetupAnswers): SetupAnswers {
  const h = p.health;
  return {
    ...a,
    conditions: Object.fromEntries(CONDITION_IDS.map(id => [id, a.conditions?.[id] ?? 'no'])),
    clearance: a.clearance ?? h.clearance, targets: a.targets ?? 'no', regular: a.regular ?? 'no',
    glucoseMonitor: a.glucoseMonitor ?? h.glucoseMonitor, bpCuff: a.bpCuff ?? h.bpMonitor,
    neuroHistory: a.neuroHistory ?? 'no', footRestriction: a.footRestriction ?? 'no', programme: a.programme ?? 'notNow', allergies: a.allergies ?? [],
  };
}

describe('a Save in Me, committed as the editor stores it, weakens nothing the engine reads (K5-16; K5-02, board D163)', () => {
  for (const [name, p] of Object.entries({ ...PERSONAS, ...HOLDS_WITHOUT_DIABETES })) {
    it(`${name}: each chapter, its checklists' unticked rows stored as No, keeps the health record and every permission`, () => {
      const data = recordOf(p);
      const opened = answersToEdit(undefined, p, data.settings, TODAY, CTX);
      for (const chapter of CHAPTER_IDS.filter(c => c !== 'welcome')) {
        const state = editorState(editorOpens(chapter, p), asRecorded(p, opened), opened, CTX);
        expect(state.blocking, chapter).toEqual([]);
        const after = editedRecord(data, editOf(state, opened), TODAY, CTX);
        // A medicine row shown unticked and saved is the answer No (B-08): it vouches for the stored No, and nothing else moves.
        const { bpMedicinesReviewed: _vouched, ...health } = after.profile!.health;
        void _vouched;
        const { bpMedicinesReviewed: _was, ...before } = p.health;
        void _was;
        expect(health, chapter).toEqual(before);
        for (const mode of MODES) expect(permission({ profile: after.profile!, now: NOW }, mode), `${chapter} ${mode}`).toEqual(permission({ profile: p, now: NOW }, mode));
      }
    });
  }
});
