/**
 * The profile every gate reads (journey §4, §6.1; boards D161, D162, D168).
 *
 * While answers are on their way, it carries every profile the person might
 * have, and the engine runs on each (`engine/candidates.ts`):
 * - setup unfinished (Look around first, a v1 Welcome left part-way, a session
 *   that went on without saving): the record's and the draft's, both with the
 *   profile gap, whatever the record holds (H5-05);
 * - a save in Me on its way, or refused: the record's as it is, and the
 *   record's with that save's own changes (H5-08). A refusal doesn't unsay
 *   what the person said, so a refused save stays until it is tried again or
 *   discarded.
 * A finished record, a completed v1 upgrade included, with nothing on its way
 * is read as it is.
 */
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { withProfileChanges, type ProfileChange } from '@/components/profile/wizardSteps';
import { planningProfile } from '@/engine/candidates';
import { profileOnlyReadiness } from '@/engine/readiness';
import { toDateString } from '@/lib/utils';
import { createDefaultProfile } from '@/profile/defaults';
import { StoreFailure, type StoreResult } from '@/store/db';
import { getState } from '@/store/useStore';
import { healthFrom, painFrom } from './assemble';
import { getSetupSession, type SetupSession } from './draft';
import { answersOf, setupStateOf } from './state';

// ---- A save in Me on its way to being stored, or refused (H5-08, H5R-04; boards D162, D168) ----

/** One save from Me: the profile changes it owns, and its write, to try again. */
export interface Submission {
  id: number;
  changes: readonly ProfileChange[];
  refused: boolean;
  write: () => Promise<StoreResult>;
}

const saves = new Map<number, Submission>();
let savesEpoch = 0;
let lastId = 0;
let savesVersion = 0;
const savesListeners = new Set<() => void>();
/** Saves of a record a backup has since replaced are that record's (H5-07). */
const held = () => {
  if (savesEpoch !== getState().epoch) {
    saves.clear();
    savesEpoch = getState().epoch;
  }
  return saves;
};
const savesChanged = () => {
  savesVersion += 1;
  for (const listener of [...savesListeners]) listener();
};
export const subscribePendingEdits = (listener: () => void): (() => void) => {
  savesListeners.add(listener);
  return () => void savesListeners.delete(listener);
};
export const pendingEditsVersion = (): number => savesVersion;

/**
 * Store a save from Me (Profile & health): `changes`, what it changes on the
 * profile, count for every gate from the tap, beside the record as it is, so
 * a stricter answer applies at once and a release waits until it's stored
 * (D162). A stored write retires only this save (H5R-04). A refused one
 * stays until it's tried again, `replaces` naming it, or discarded.
 */
export async function saveClinicalEdit(changes: readonly ProfileChange[], write: () => Promise<StoreResult>, replaces?: number): Promise<{ saved: StoreResult; id: number }> {
  const id = ++lastId;
  held().set(id, { id, changes, refused: false, write });
  savesChanged();
  const saved = await write().catch((error: unknown): StoreResult => ({ ok: false, failure: new StoreFailure('unknown', 'The device did not keep it.', error) }));
  if (replaces !== undefined) held().delete(replaces);
  if (saved.ok) held().delete(id);
  else held().set(id, { id, changes, refused: true, write });
  savesChanged();
  return { saved, id };
}

/** The saves the device refused, for Profile & health to offer again. */
export const refusedSaves = (): Submission[] => [...held().values()].filter(s => s.refused);

/** Try a refused save again. */
export function retrySave(id: number): Promise<{ saved: StoreResult; id: number }> | undefined {
  const save = held().get(id);
  return save ? saveClinicalEdit(save.changes, save.write, id) : undefined;
}

/** The person chose not to keep a refused save: the record's own answers stand. */
export function discardSave(id: number): void {
  if (held().delete(id)) savesChanged();
}

export function resetPendingEditsForTests(): void {
  saves.clear();
  savesEpoch = 0;
  lastId = 0;
}

// ---- The profile a gate reads ----

export interface GateInput {
  profile?: UserProfile;
  settings: Pick<UserSettings, 'setup' | 'onboardingComplete' | 'habits' | 'currentWeight'>;
}

/**
 * Every profile the person might have: the record's, or with nothing stored
 * the default with its gap (as v1 read it); while setup is unfinished, that
 * with the gap, and with the draft's answers on it; and the record's with
 * each save from Me on its way.
 */
export function gateCandidates(state: GateInput, now: Date = new Date(), session: SetupSession = getSetupSession()): UserProfile[] {
  const base = state.profile ?? createDefaultProfile({ weightKg: state.settings.currentWeight || 0, needsHealthReview: true });
  const setup = setupStateOf(state.settings, state.profile);
  const unfinished = setup.stage !== 'done' || session.entered;
  const stored: UserProfile = unfinished ? { ...base, needsHealthReview: true } : base;
  const out = [stored];
  if (unfinished) {
    const answers = session.unsaved ? session.answers : answersOf(setup);
    out.push({ ...stored, health: healthFrom(answers, base.health, toDateString(now)), pain: painFrom(answers, base.pain) });
  }
  for (const save of held().values()) out.push(withProfileChanges(stored, save.changes));
  return out;
}

/**
 * The profile every gate reads. With answers on their way it carries them
 * all as `candidates`, which the engine evaluates. What is read off the
 * profile itself (which questions a check-in asks, a walk's prompts) is the
 * candidate at least as strict as the rest, or the newest when none is, and
 * then every mode holds until the answers are saved.
 */
export function gateProfile(state: GateInput, now: Date = new Date(), session: SetupSession = getSetupSession()): UserProfile {
  const all = gateCandidates(state, now, session);
  if (all.length === 1) return all[0];
  const newest: UserProfile = { ...all[all.length - 1], candidates: all };
  const primary = planningProfile(newest, p => profileOnlyReadiness(p)) ?? newest;
  return { ...primary, candidates: all };
}
