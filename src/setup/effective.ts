/**
 * The profile every gate reads (journey §4, §6.1; boards D161, D197): the
 * stored profile, and no other (H5F-01 to H5F-04). Gates, readiness,
 * reminders and the session player all read it.
 * - While setup is unfinished, it carries the profile gap, so every movement
 *   holds, whatever profile is stored (H5-05): the draft's answers aren't
 *   read, since nothing moves until they're finished.
 * - While a clinical answer couldn't be stored, it's marked
 *   `clinicalUnsaved` for this session: every movement holds, water
 *   reminders pause and no session starts, until the save is tried again
 *   and stored, or its changes discarded.
 * A finished record, a completed v1 upgrade included, is read as it is.
 */
import { useSyncExternalStore } from 'react';
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { StoreFailure, type StoreResult } from '@/store/db';
import { getState, subscribe } from '@/store/useStore';
import { getSetupSession, type SetupSession } from './draft';
import { setupStateOf } from './state';

// ---- A clinical answer the device didn't store (board D197) ----

/**
 * Where a clinical answer is saved: Me's chapter editor, or the water sheet's
 * fluid limit (codex F-setup-02). Each one's refused save is its own, tried
 * again and lifted on its own: one stored by the other holds nothing of it.
 */
export type ClinicalPlace = 'chapter' | 'fluid';

/** Each place's clinical save refused, with its own write to try again, for the record it was made in (`StoreState.epoch`). */
const unsaved = new Map<ClinicalPlace, { retry: () => Promise<StoreResult>; epoch: number }>();
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version += 1;
  for (const listener of [...listeners]) listener();
};
/** Only the record's own: once a backup replaces it, or everything is deleted, its unsaved answers aren't this record's (H5F-09). */
const current = () => [...unsaved].filter(([, refused]) => refused.epoch === getState().epoch);

/** A clinical answer this session gave couldn't be stored: every movement holds until it is, or it's discarded. */
export const clinicalUnsaved = (): boolean => current().length > 0;
export const clinicalUnsavedVersion = (): number => version;
export function subscribeClinicalUnsaved(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
export function useClinicalUnsaved(): boolean {
  useSyncExternalStore(listener => {
    const stop = subscribe(listener);
    const off = subscribeClinicalUnsaved(listener);
    return () => { stop(); off(); };
  }, () => version, () => version);
  return clinicalUnsaved();
}

/**
 * A clinical save, from Me's chapter editor or the water sheet: `write`,
 * held until stored, so the stored profile, the one every gate reads, changes
 * only once it is, and a pending save can release nothing. Refused, or with
 * nothing to store to, the answers aren't the record's, so every gate holds
 * for this session until they're tried again and stored, or discarded. A
 * save for a record since replaced leaves nothing behind (H5F-09).
 */
export async function saveClinical(write: () => Promise<StoreResult>, place: ClinicalPlace = 'chapter'): Promise<StoreResult> {
  const epoch = getState().epoch;
  const saved = await write().catch((error: unknown): StoreResult => ({
    ok: false, failure: error instanceof StoreFailure ? error : new StoreFailure('unknown', 'The device did not keep it.', error),
  }));
  if (saved.ok) unsaved.delete(place);
  else unsaved.set(place, { retry: write, epoch });
  changed();
  return saved;
}

/** Try each refused clinical save again, each on its own: Readiness's and Profile & health's Try again. The first refusal is said. */
export function retryClinical(): Promise<StoreResult> | undefined {
  const refused = current();
  if (refused.length === 0) return undefined;
  return (async () => {
    let first: StoreResult | undefined;
    for (const [place, { retry }] of refused) {
      const saved = await saveClinical(retry, place);
      if (!saved.ok) first ??= saved;
    }
    return first ?? { ok: true as const, value: undefined };
  })();
}

/** Its changes not kept, from one place or every one: the record's own answers stand, and the gates read them again. */
export function discardClinical(place?: ClinicalPlace): void {
  if (place) unsaved.delete(place);
  else unsaved.clear();
  changed();
}

export function resetClinicalUnsavedForTests(): void {
  unsaved.clear();
  version = 0;
}

// ---- The profile a gate reads ----

export interface GateInput {
  profile?: UserProfile;
  settings: Pick<UserSettings, 'setup' | 'onboardingComplete' | 'habits' | 'currentWeight'>;
}

/**
 * The stored profile, or with none the default with its gap (as v1 read it);
 * with the gap while setup is unfinished, or setup's session went on without
 * saving; marked while a clinical save is refused.
 */
export function gateProfile(state: GateInput, session: SetupSession = getSetupSession()): UserProfile {
  const base = state.profile ?? createDefaultProfile({ weightKg: state.settings.currentWeight || 0, needsHealthReview: true });
  const unfinished = setupStateOf(state.settings, state.profile).stage !== 'done' || session.entered;
  const gapped = unfinished && base.needsHealthReview !== true ? { ...base, needsHealthReview: true } : base;
  return clinicalUnsaved() ? { ...gapped, clinicalUnsaved: true } : gapped;
}
