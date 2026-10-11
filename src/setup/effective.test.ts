import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { DailyCheckIn, Mode } from '@/types/checkin';
import type { Step } from '@/types/plan';
import type { HealthProfile, UserProfile } from '@/types/profile';
import type { SetupAnswers } from '@/types/setup';
import { profileChanges } from '@/components/profile/wizardSteps';
import { getMeta } from '@/data/catalog';
import { deriveHealth, profileGaps } from '@/engine/health';
import { PERMISSION_TEXT, permission } from '@/engine/permission';
import { UNSAVED_PLAN, planningProfile } from '@/engine/candidates';
import { profileOnlyReadiness } from '@/engine/readiness';
import { buildSessionPlan } from '@/engine/session';
import { buildStretchPlan } from '@/engine/stretch';
import { createDefaultProfile } from '@/profile/defaults';
import { StoreFailure, type StoreResult } from '@/store/db';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { deviceClinical, walkInput, walkRefusal } from '@/walk/gate';
import { lookedAround } from './assemble';
import type { SetupSession } from './draft';
import { discardSave, gateCandidates, gateProfile, refusedSaves, resetPendingEditsForTests, retrySave, saveClinicalEdit } from './effective';
import { NO_CONDITIONS } from './fixtures';

const NOW = new Date('2026-10-10T09:00:00+05:30');
const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];
const NONE: SetupSession = { unsaved: false, entered: false, answers: {} };
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
/** Held for the profile gap in every mode: the hold no check-in can answer (`profileGaps`). */
const held = (p: UserProfile) => profileGaps(p).healthUnreviewed && MODES.every(mode => !permission({ profile: p, now: NOW }, mode).allowed);

/** v1 stored health before its last Welcome step: a reviewed profile on a record that never finished setting up. */
const REVIEWED = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { medicinesReviewed: true, bpMedicinesReviewed: true, clearance: 'vigorous' } });
const WOUND: SetupAnswers = { conditions: { ...NO_CONDITIONS, feet: 'yes' }, feetNumb: 'yes', footWound: 'now' };
const partway = (answers: SetupAnswers): AppData => {
  const data = fresh();
  return { ...data, profile: REVIEWED, settings: { ...data.settings, onboardingComplete: false, setup: { stage: 'open', draft: { at: 'health.feet', answers } } } };
};

describe('the profile every gate reads while setup is unfinished (H5-05; board D161)', () => {
  it('a v1 record left part-way is held for the profile gap, with the draft’s stricter answers counting at once', () => {
    const data = partway(WOUND);
    expect(held(REVIEWED)).toBe(false);
    const p = gateProfile(data, NOW, NONE);
    expect(p.needsHealthReview).toBe(true);
    expect(p.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(held(p)).toBe(true);
  });

  it('so it is after Look around first', () => {
    const looked = lookedAround(partway(WOUND));
    expect(looked.settings.setup?.stage).toBe('lookAround');
    const p = gateProfile(looked, NOW, NONE);
    expect(p.needsHealthReview).toBe(true);
    expect(p.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(held(p)).toBe(true);
  });

  it('a draft’s answer looser than the record’s never loosens it', () => {
    const data = partway({ conditions: { ...NO_CONDITIONS }, regular: 'no' });
    const onInsulin = { ...REVIEWED, health: { ...REVIEWED.health, diabetes: 'type2' as const, insulin: 'injections_or_pump' as const } };
    const p = gateProfile({ ...data, profile: onInsulin }, NOW, NONE);
    expect(p.health.diabetes).toBe('type2');
    expect(deriveHealth(p.health).hypoRisk).toBe(true);
  });

  it('answers kept this session only count as a draft’s do (B-07)', () => {
    const data = partway({});
    const p = gateProfile(data, NOW, { unsaved: true, entered: true, answers: WOUND, at: 'review' });
    expect(p.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(p.needsHealthReview).toBe(true);
  });

  it('a completed v1 upgrade is read as it is', () => {
    const data = fresh();
    const upgraded = { ...data, profile: REVIEWED, settings: { ...data.settings, onboardingComplete: true } };
    expect(gateProfile(upgraded, NOW, NONE)).toBe(REVIEWED);
  });

  it('the walk’s gate reads the same profile', () => {
    const data = partway(WOUND);
    const clinical = deviceClinical({ profile: data.profile, settings: data.settings, checkIns: [] });
    expect(clinical.profile.needsHealthReview).toBe(true);
    expect(walkRefusal(walkInput(clinical, NOW), 'start')).toBeDefined();
  });
});

// ---- A save in Me on its way, or refused: the engine runs on each candidate (board D168) ----

const DATE = '2026-10-10';
const KNOWN: Partial<HealthProfile> = { medicinesReviewed: true, bpMedicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' };
const done = (profile: UserProfile) => ({ profile, settings: { ...fresh().settings, onboardingComplete: true } });
const fine = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
/** A check-in as stored, with a readiness the gate works out again for each candidate. */
const ask = (profile: UserProfile, mode: Mode, checkIn: DailyCheckIn = fine()) =>
  permission({ profile, now: NOW, checkIn: { ...checkIn, readiness: profileOnlyReadiness(createDefaultProfile()) } }, mode);
const refused = (): Promise<StoreResult> => Promise.resolve({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') });
const stored = (): Promise<StoreResult> => Promise.resolve({ ok: true, value: undefined });
/** A write that waits until the test says how it went. */
function slow() {
  let settle!: (r: StoreResult) => void;
  const promise = new Promise<StoreResult>(resolve => { settle = resolve; });
  return { write: () => promise, settle };
}
const save = (from: UserProfile, to: UserProfile, write: () => Promise<StoreResult>) => saveClinicalEdit(profileChanges(from, to), write);
const movements = (steps: Step[]) => steps.filter((s): s is Extract<Step, { kind: 'hold' | 'drill' }> => s.kind === 'hold' || s.kind === 'drill');

describe('a save in Me on its way, or refused (H5-08; boards D162, D168)', () => {
  const healed = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN } });
  const wounded = { ...healed, health: { ...healed.health, footStatus: 'current_wound_or_active_charcot' as const } };
  beforeEach(() => resetPendingEditsForTests());

  it('each keeps its own identity: a stored save retires only itself, and a refused one stays until discarded (H5R-04)', async () => {
    const record = done(healed);
    const walk = () => ask(gateProfile(record, NOW, NONE), 'walk').allowed;
    expect(walk()).toBe(true);
    const wound = slow();
    const telling = save(healed, wounded, wound.write);
    expect(walk()).toBe(false);
    // Another save, of something else, stored meanwhile.
    expect((await save(healed, { ...healed, name: 'Kai' }, stored)).saved.ok).toBe(true);
    expect(walk()).toBe(false);
    wound.settle({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') });
    const { id } = await telling;
    expect(refusedSaves().map(s => s.id)).toEqual([id]);
    expect(walk()).toBe(false);
    discardSave(id);
    expect(walk()).toBe(true);
  });

  it('tried again, a refused save is replaced by the new try; stored, it goes', async () => {
    let ok = false;
    const write = () => (ok ? stored() : refused());
    const { id } = await save(healed, wounded, write);
    const again = await retrySave(id)!;
    expect(refusedSaves().map(s => s.id)).toEqual([again.id]);
    ok = true;
    expect((await retrySave(again.id)!).saved.ok).toBe(true);
    expect(refusedSaves()).toEqual([]);
  });

  it('a release waits until it’s stored; a refused release releases nothing', async () => {
    const record = done(wounded);
    const healing = slow();
    const releasing = save(wounded, healed, healing.write);
    expect(ask(gateProfile(record, NOW, NONE), 'walk').allowed).toBe(false);
    healing.settle({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') });
    await releasing;
    expect(ask(gateProfile(record, NOW, NONE), 'walk').allowed).toBe(false);
  });

  it('asks for a check-in only when one answers every candidate’s refusal', async () => {
    // Diabetes added without its medicines: no check-in answers that.
    await save(healed, { ...healed, health: { ...healed.health, diabetes: 'type2', medicinesReviewed: false } }, refused);
    const p = permission({ profile: gateProfile(done(healed), NOW, NONE), now: NOW }, 'walk');
    expect([p.allowed, p.needsCheckIn]).toEqual([false, false]);
    expect(p.reasons).toEqual(expect.arrayContaining([PERMISSION_TEXT.noCheckIn, PERMISSION_TEXT.medicinesUnknown]));
  });

  it('a refused save of another chapter never pins a gap the review has since cleared (H5R-18)', async () => {
    const unreviewed = { ...healed, needsHealthReview: true };
    await save(unreviewed, { ...unreviewed, name: 'Kai' }, refused);
    // The review, stored.
    const record = done(healed);
    expect(gateCandidates(record, NOW, NONE).every(p => !profileGaps(p).healthUnreviewed)).toBe(true);
    expect(ask(gateProfile(record, NOW, NONE), 'walk').allowed).toBe(true);
  });
});

describe('the engine on each candidate, through its real rules (H5R-05 to H5R-08)', () => {
  beforeEach(() => resetPendingEditsForTests());
  const stretch = (profile: UserProfile, focus: 'backHips' | 'hipsLegs') =>
    buildStretchPlan({ profile, date: DATE, startDate: '2026-09-24', sessions: [], focus, minutes: 15, checkIn: fine(), recentCheckIns: [] });

  it('sciatica added on its way: the nerve gate stays closed, so nothing pulls on the nerve longer than it allows (H5R-05)', async () => {
    const before = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN }, pain: { areas: ['lowerBack'], worseWith: 'unknown', preference: 'untested' }, ladder: { hinge: 2, squat: 2, neuralGate: true } });
    const after: UserProfile = { ...before, pain: { ...before.pain, areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { ...before.ladder, neuralGate: false } };
    const longPull = (p: UserProfile) => movements(stretch(p, 'hipsLegs').steps).filter(s => (getMeta(s.exerciseId)?.flags.sciaticTension ?? 0) >= 2 && (s.kind !== 'hold' || s.holdSeconds > 30));
    // What the record alone would plan.
    expect(longPull(before).length).toBeGreaterThan(0);
    const telling = slow();
    const saving = save(before, after, telling.write);
    expect(longPull(gateProfile(done(before), NOW, NONE))).toEqual([]);
    telling.settle({ ok: true, value: undefined });
    await saving;
  });

  it('a refused “Not sure” about what makes the back worse keeps the known direction for every plan (H5R-06)', async () => {
    const flexion = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN }, pain: { areas: ['lowerBack'], worseWith: 'flexion', preference: 'untested' } });
    const unsure: UserProfile = { ...flexion, pain: { ...flexion.pain, worseWith: 'unknown' } };
    await save(flexion, unsure, refused);
    const gate = gateProfile(done(flexion), NOW, NONE);
    // The engine plans with the candidate that still knows bending makes it worse (stretch.ts's end-range rule reads it).
    expect(planningProfile(gate, p => profileOnlyReadiness(p))?.pain.worseWith).toBe('flexion');
    expect(stretch(gate, 'backHips')).toEqual(stretch(flexion, 'backHips'));
  });

  it('blood pressure treated, then a refused change: the cool-down stays, and where neither profile covers the other, nothing starts (H5R-07)', async () => {
    const treated = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN, hypertension: 'treated', betaBlocker: false, diuretic: false } });
    await save(treated, { ...treated, health: { ...treated.health, hypertension: 'untreated' } }, refused);
    for (const mode of MODES) expect(ask(gateProfile(done(treated), NOW, NONE), mode).codes, mode).toContain('COOL');
    // Not yet cleared for vigorous exercise: untreated also locks it, so neither candidate is at least as strict as the other.
    resetPendingEditsForTests();
    const moderate = { ...treated, health: { ...treated.health, clearance: 'moderate' as const } };
    await save(moderate, { ...moderate, health: { ...moderate.health, hypertension: 'untreated' } }, refused);
    for (const mode of MODES) {
      const p = ask(gateProfile(done(moderate), NOW, NONE), mode);
      expect([p.allowed, p.reasons], mode).toEqual([false, [PERMISSION_TEXT.unsaved]]);
    }
  });

  it('a cool-down on its way counts at once: every candidate’s restrictions, the record’s and the save’s', async () => {
    const untreated = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN, hypertension: 'untreated', betaBlocker: false, diuretic: false } });
    await save(untreated, { ...untreated, health: { ...untreated.health, hypertension: 'treated' } }, refused);
    for (const mode of MODES) expect(ask(gateProfile(done(untreated), NOW, NONE), mode).codes, mode).toContain('COOL');
  });

  it('where no candidate covers the other, each plan is empty and says why (board D168)', async () => {
    const moderate = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN, clearance: 'moderate', hypertension: 'treated', betaBlocker: false, diuretic: false } });
    await save(moderate, { ...moderate, health: { ...moderate.health, hypertension: 'untreated' } }, refused);
    const gate = gateProfile(done(moderate), NOW, NONE);
    const guided = buildSessionPlan({ profile: gate, date: DATE, startDate: '2026-09-24', sessions: [], checkIn: fine(), recentCheckIns: [], focusOverride: 'upperB' });
    expect([guided.kind, guided.changes, guided.steps]).toEqual(['none', [UNSAVED_PLAN], []]);
    expect(stretch(gate, 'backHips')).toMatchObject({ kind: 'none', changes: [UNSAVED_PLAN], steps: [] });
  });

  it('lows possible, and a meter on its way: no intervals while the record has none (H5R-08)', async () => {
    const health: Partial<HealthProfile> = { ...KNOWN, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', glucoseMonitor: 'none' };
    const none = createDefaultProfile({ weightKg: 70, needsHealthReview: false, equipment: 'fullGym', health });
    const meter: UserProfile = { ...none, health: { ...none.health, glucoseMonitor: 'meter' } };
    const reading = fine({ glucose: { value: 150, unit: 'mg/dL', measuredAt: new Date(NOW.getTime() - 5 * 60_000).toISOString() } });
    const cardio = (p: UserProfile) => buildSessionPlan({ profile: p, date: DATE, startDate: '2026-09-24', sessions: [], checkIn: reading, recentCheckIns: [], focusOverride: 'upperB' }).cardio?.format;
    expect(cardio(meter)).toBe('intervals');
    const telling = slow();
    const saving = save(none, meter, telling.write);
    expect(cardio(gateProfile(done(none), NOW, NONE))).not.toBe('intervals');
    telling.settle({ ok: true, value: undefined });
    await saving;
  });
});
