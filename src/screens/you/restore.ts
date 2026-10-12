import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { answersOf, setupStateOf } from '@/setup/state';
import { countsSentence, listOf, recordCounts } from './summaries';

type RecordState = Parameters<typeof recordCounts>[0];

/**
 * While an import is being written, the restore flow belongs to it (Codex
 * screens re-check N04): its sheet cannot be closed and no other file can be
 * chosen, so a completion can never land on a different file's preview.
 */
export function restoreLocked(stage: { kind: string }): boolean {
  return stage.kind === 'importing';
}

/**
 * What a restore with Replace would delete here, in words, or nothing when it
 * deletes nothing (journey §20.4.6): the records, kept walk routes included
 * (Plan 6), and the profile and settings, or setup's answers so far. Anything
 * it names is asked twice (H5-25, K5-06). The unit, set before any answer, is
 * not an answer.
 */
export function replaceErases(state: RecordState & { profile?: UserProfile; settings: UserSettings }): string | undefined {
  const counts = recordCounts(state);
  const held = counts.readings + counts.sessions + counts.checkIns + counts.bodyMetrics + counts.personalRecords + (counts.routes ?? 0);
  const setup = setupStateOf(state.settings, state.profile);
  // A number typed and not yet an answer is one too (H5R-17).
  const given = Object.entries(answersOf(setup)).some(([k, v]) => k !== 'metric' && k !== 'skippedPages' && v !== undefined)
    || Object.keys(setup.draft?.raw ?? {}).length > 0;
  const parts = [
    held > 0 ? `the ${countsSentence(counts)}` : undefined,
    state.profile ? 'your profile and settings' : given ? 'your setup answers so far' : undefined,
  ].filter((x): x is string => x !== undefined);
  return parts.length > 0 ? listOf(parts) : undefined;
}
