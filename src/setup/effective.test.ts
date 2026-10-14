import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { DailyCheckIn, Mode } from '@/types/checkin';
import type { HealthProfile, UserProfile } from '@/types/profile';
import type { SetupAnswers } from '@/types/setup';
import { profileGaps } from '@/engine/health';
import { PERMISSION_TEXT, permission, readinessFor } from '@/engine/permission';
import { CLINICAL_UNSAVED, CLINICAL_UNSAVED_RELEASE, TREAT, evaluateCheckIn } from '@/engine/readiness';
import { createDefaultProfile } from '@/profile/defaults';
import { waterBlock } from '@/reminders/water';
import { StoreFailure, type StoreResult } from '@/store/db';
import { fakeIndexedDB } from '@/store/fakeIdb';
import * as store from '@/store/useStore';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { toDateString } from '@/lib/utils';
import { deviceClinical, walkInput, walkRefusal } from '@/walk/gate';
import { lookedAround } from './assemble';
import type { SetupSession } from './draft';
import { clinicalUnsaved, discardClinical, gateProfile, resetClinicalUnsavedForTests, retryClinical, saveClinical } from './effective';
import { NO_CONDITIONS } from './fixtures';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

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

describe('the profile every gate reads while setup is unfinished (H5-05; boards D161, D197)', () => {
  it('a v1 record left part-way holds every movement for the profile gap, whatever it stores; its draft isn’t read', () => {
    const data = partway(WOUND);
    expect(held(REVIEWED)).toBe(false);
    const p = gateProfile(data, NONE);
    expect(p.needsHealthReview).toBe(true);
    expect(p.health).toBe(REVIEWED.health);
    expect(held(p)).toBe(true);
  });

  it('so it is after Look around first', () => {
    const looked = lookedAround(partway(WOUND));
    expect(looked.settings.setup?.stage).toBe('lookAround');
    const p = gateProfile(looked, NONE);
    expect([p.needsHealthReview, p.health]).toEqual([true, REVIEWED.health]);
    expect(held(p)).toBe(true);
  });

  it('and while setup goes on without saving, on a finished record (B-07)', () => {
    const data = fresh();
    const finished = { ...data, profile: REVIEWED, settings: { ...data.settings, onboardingComplete: true } };
    const p = gateProfile(finished, { unsaved: true, entered: true, answers: WOUND, at: 'review' });
    expect([p.needsHealthReview, p.health]).toEqual([true, REVIEWED.health]);
  });

  it('a completed v1 upgrade is read as it is', () => {
    const data = fresh();
    const upgraded = { ...data, profile: REVIEWED, settings: { ...data.settings, onboardingComplete: true } };
    expect(gateProfile(upgraded, NONE)).toBe(REVIEWED);
  });

  it('the walk’s gate reads the same profile', () => {
    const data = partway(WOUND);
    const clinical = deviceClinical({ profile: data.profile, settings: data.settings, checkIns: [] });
    expect(clinical.profile.needsHealthReview).toBe(true);
    expect(walkRefusal(walkInput(clinical, NOW), 'start')).toBeDefined();
  });
});

// ---- A clinical save the device refused: held for this session (board D197) ----

const KNOWN: Partial<HealthProfile> = { medicinesReviewed: true, bpMedicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' };
const done = (profile: UserProfile) => ({ profile, settings: { ...fresh().settings, onboardingComplete: true } });
const today = (over: Partial<DailyCheckIn> = {}): DailyCheckIn =>
  ({ date: toDateString(NOW), urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
/** A mode's answer with today's check-in as stored, its readiness worked out for the profile asked. */
const ask = (profile: UserProfile, mode: Mode, checkIn: DailyCheckIn = today()) =>
  permission({ profile, now: NOW, checkIn: { ...checkIn, readiness: evaluateCheckIn(profile, checkIn) } }, mode);
const refused = (): Promise<StoreResult> => Promise.resolve({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') });
const stored = (): Promise<StoreResult> => Promise.resolve({ ok: true, value: undefined });
const healthy = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN } });

describe('a clinical save the device refused (board D197; H5F-01 to H5F-04)', () => {
  beforeEach(() => resetClinicalUnsavedForTests());

  it('holds every movement, saying that alone, and pauses water reminders, until tried again and stored', async () => {
    const record = done(healthy);
    expect(ask(gateProfile(record, NONE), 'walk').allowed).toBe(true);
    let ok = false;
    expect((await saveClinical(() => (ok ? stored() : refused()))).ok).toBe(false);
    const gate = gateProfile(record, NONE);
    expect([gate.clinicalUnsaved, gate.health]).toEqual([true, healthy.health]);
    for (const mode of MODES) {
      const p = ask(gate, mode);
      expect([p.allowed, p.disposition, p.reasons, p.release, p.restrictions, p.needsCheckIn], mode)
        .toEqual([false, 'hold', [PERMISSION_TEXT.unsaved], CLINICAL_UNSAVED_RELEASE, [], false]);
      // Before today's check-in too: a check-in can't lift the pause, so none is asked for first (board D224).
      const first = permission({ profile: gate, now: NOW }, mode);
      expect([first.reasons, first.needsCheckIn], mode).toEqual([[PERMISSION_TEXT.unsaved], false]);
    }
    expect(waterBlock(gate, undefined)).toBe('Paused until your health answers are saved, since some answers need a fluid limit.');
    // The day's answer, with a check-in or without one yet, says that alone, and at least as cautiously as amber.
    for (const day of [evaluateCheckIn(gate, today()), readinessFor({ profile: gate, now: NOW })]) {
      expect([day.outcome, day.disposition, day.reasons.map(r => r.message), day.release]).toEqual(['amber', 'hold', [CLINICAL_UNSAVED], CLINICAL_UNSAVED_RELEASE]);
    }
    // Refused again: still held.
    expect((await retryClinical())?.ok).toBe(false);
    expect(clinicalUnsaved()).toBe(true);
    ok = true;
    expect((await retryClinical())?.ok).toBe(true);
    expect(clinicalUnsaved()).toBe(false);
    expect(gateProfile(record, NONE)).toBe(healthy);
  });

  it('discarded, the record’s own answers stand, and nothing is left to try again', async () => {
    await saveClinical(refused);
    discardClinical();
    expect(clinicalUnsaved()).toBe(false);
    expect(retryClinical()).toBeUndefined();
    expect(ask(gateProfile(done(healthy), NONE), 'walk').allowed).toBe(true);
  });

  it('a save on its way changes nothing any gate reads: only one stored does', async () => {
    let settle!: (r: StoreResult) => void;
    const telling = saveClinical(() => new Promise<StoreResult>(resolve => { settle = resolve; }));
    expect(clinicalUnsaved()).toBe(false);
    expect(gateProfile(done(healthy), NONE)).toBe(healthy);
    settle({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') });
    await telling;
    expect(clinicalUnsaved()).toBe(true);
  });

  it('a write that throws is refused like any other, its own reason kept', async () => {
    const saved = await saveClinical(() => Promise.reject(new StoreFailure('conflict', 'Changed elsewhere')));
    expect(saved.ok ? undefined : saved.failure.message).toBe('Changed elsewhere');
    expect(clinicalUnsaved()).toBe(true);
  });

  it('an emergency still says call now, and the day’s own decisions stand before the pause, a low treated; nothing else is advised (H5F-02; board D224)', async () => {
    const onInsulin = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { ...KNOWN, diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', fluidRestriction: false } });
    await saveClinical(refused);
    const gate = gateProfile(done(onInsulin), NONE);
    // An emergency is as it is without the pause, every word of it: nothing about starting later beside "call now".
    const chest = today({ emergency: ['chest'] });
    expect(ask(gate, 'walk', chest).disposition).toBe('emergency');
    expect(ask(gate, 'walk', chest)).toEqual(ask(onInsulin, 'walk', chest));
    const reading = (value: number) => today({ glucose: { value, unit: 'mg/dL', measuredAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(), source: 'meter' } });
    const low = readinessFor({ profile: gate, now: NOW, checkIn: { ...reading(60), readiness: evaluateCheckIn(gate, reading(60)) } });
    expect(low.actions).toEqual([TREAT]);
    // The low as it is, its re-check when it is due, then the pause.
    expect(low.reasons.map(r => r.message)).toEqual([expect.stringContaining('Glucose 60 mg/dL, from 54 to 69 mg/dL, is a low.'), CLINICAL_UNSAVED]);
    expect(low.recheckAt).toBe(evaluateCheckIn(onInsulin, reading(60)).recheckAt);
    // A high reading still holds, in its own words; its water advice isn't given from answers that may not be the person's:
    // a fluid limit may be among them.
    expect(evaluateCheckIn(onInsulin, reading(350)).actions.join(' ')).toContain('Drink some water');
    const high = evaluateCheckIn(gate, reading(350));
    expect([high.actions, high.reasons.map(r => r.message), high.disposition, high.awaitingReading])
      .toEqual([[], [expect.stringContaining('Glucose above 300 mg/dL: no exercise session until it is lower.'), CLINICAL_UNSAVED], 'hold', true]);
    // With no reading yet, it doesn't ask for one either: nothing starts until the answers are saved.
    expect(evaluateCheckIn(onInsulin, today()).awaitingReading).toBe(true);
    const none = evaluateCheckIn(gate, today());
    expect([none.awaitingReading, none.notices, none.reasons.map(r => r.message), none.release]).toEqual([false, [], [CLINICAL_UNSAVED], CLINICAL_UNSAVED_RELEASE]);
  });

  it('a save for a record since replaced leaves nothing behind (H5F-09)', async () => {
    store.resetForTests();
    const fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    await saveClinical(refused);
    expect(clinicalUnsaved()).toBe(true);
    // Everything deleted, in another copy of the app: a new record.
    const { openDb } = await import('@/store/db');
    const { commitChange } = await import('@/store/snapshot');
    const tab = await openDb(fake);
    expect((await commitChange(tab, undefined, () => ({ change: { reset: true, schemaVersion: 6 } }))).ok).toBe(true);
    tab.close();
    expect((await store.reload()).ok).toBe(true);
    expect(clinicalUnsaved()).toBe(false);
    expect(retryClinical()).toBeUndefined();
    // One refused as the record is replaced under it is not the new record's either.
    let settle!: (r: StoreResult) => void;
    const telling = saveClinical(() => new Promise<StoreResult>(resolve => { settle = resolve; }));
    const again = await openDb(fake);
    expect((await commitChange(again, undefined, () => ({ change: { reset: true, schemaVersion: 6 } }))).ok).toBe(true);
    again.close();
    expect((await store.reload()).ok).toBe(true);
    settle({ ok: false, failure: new StoreFailure('conflict', store.REPLACED) });
    await telling;
    expect(clinicalUnsaved()).toBe(false);
    store.resetForTests();
  });
});

describe('clinical saves from two places (codex F-setup-02)', () => {
  beforeEach(() => resetClinicalUnsavedForTests());

  it('each place’s refusal is its own: one stored lifts only its own, Try again tries every one, and Discard drops them all', async () => {
    const tries = { chapter: 0, fluid: 0 };
    let ok = false;
    const write = (place: keyof typeof tries) => () => { tries[place] += 1; return ok ? stored() : refused(); };
    await saveClinical(write('fluid'), 'fluid');
    await saveClinical(write('chapter'));
    expect(clinicalUnsaved()).toBe(true);
    // The chapter's own save, stored, leaves the fluid limit's refusal standing.
    expect((await saveClinical(stored)).ok).toBe(true);
    expect(clinicalUnsaved()).toBe(true);
    // Try again tries the fluid limit's own write, and says its refusal.
    expect((await retryClinical())?.ok).toBe(false);
    expect(tries).toEqual({ chapter: 1, fluid: 2 });
    expect(clinicalUnsaved()).toBe(true);
    // Both refused, both are tried; stored, nothing is held.
    await saveClinical(write('chapter'));
    ok = true;
    expect((await retryClinical())?.ok).toBe(true);
    expect(tries).toEqual({ chapter: 3, fluid: 3 });
    expect(clinicalUnsaved()).toBe(false);
    // Discarded, from one place or all.
    ok = false;
    await saveClinical(write('fluid'), 'fluid');
    await saveClinical(write('chapter'));
    discardClinical('fluid');
    expect(clinicalUnsaved()).toBe(true);
    discardClinical();
    expect(clinicalUnsaved()).toBe(false);
    expect(retryClinical()).toBeUndefined();
  });
});
