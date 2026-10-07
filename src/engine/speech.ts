/**
 * Sizes prep and setup time to the narration, so instructions finish before
 * "Begin" (spec §6.3 rule 2). Uses the same text builders as the narrator.
 */

import type { WorkoutSession } from '@/types';
import type { Side } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { nameOf } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { detailFor, mobilityPrepText, setupLines, type SetupRx } from '@/session/script';
import { estimateSpeechMs } from '@/voice/estimate';
import { packPace } from '@/voice/packs';

export interface SpeechSizer {
  prepSeconds(exerciseId: string, sides: Side[] | null, floor: number): number;
  setupSeconds(exerciseId: string, rx: SetupRx | undefined, floor: number, cap?: number): number;
}

/** How many earlier sessions included each exercise. */
export function exposureCounter(sessions: WorkoutSession[]): (id: string) => number {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const ids = new Set<string>([...s.sets.map(x => x.exerciseId), ...(s.mobility ?? []).map(m => m.exerciseId)]);
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return id => counts.get(id) ?? 0;
}

export function createSpeechSizer(profile: UserProfile, sessions: WorkoutSession[]): SpeechSizer {
  const seen = exposureCounter(sessions);
  // A recorded pack speaks at its own pace; the rate slider only affects the device voice.
  const pace = packPace(profile.voice.pack);
  const speechMs = (text: string) => pace ? estimateSpeechMs(text, 0.85) * pace : estimateSpeechMs(text, profile.voice.rate || 0.85);
  return {
    prepSeconds(id, sides, floor) {
      const text = mobilityPrepText(nameOf(id), sides?.[0], getCoaching(id), detailFor(profile, seen(id)));
      return Math.min(18, Math.max(floor, Math.ceil(speechMs(text) / 1000) + 1));
    },
    setupSeconds(id, rx, floor, cap = 100) {
      const lines = setupLines(id, nameOf(id), rx, getCoaching(id), detailFor(profile, seen(id)));
      const ms = lines.filter(l => l.priority <= 2).reduce((t, l) => t + speechMs(l.text), 0);
      return Math.min(cap, Math.max(floor, Math.ceil(ms / 1000) + 3));
    },
  };
}
