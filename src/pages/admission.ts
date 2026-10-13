/**
 * Whether a guided session may open (J§17.2 #42, board D116), decided once,
 * when the session page opens (Codex P8-19). A stretch always may. After the
 * twelve weeks, a guided run opens only as progress saved part-way that
 * `loadProgress` still finds resumable, asked for by `?resume=1` or saved
 * today; `?resume=1` alone admits nothing. A run admitted before midnight
 * stays admitted: the question isn't asked again while the page is up.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseStretchSpec } from '@/engine/stretch';
import { useGuided } from '@/hooks/useGuided';
import { programmeDone } from '@/lib/utils';
import { loadProgress, type SavedProgress } from '@/session/persistence';

export interface Admission {
  stretch: boolean;
  /** `?resume=1`. */
  resume: boolean;
  /** Guided progress, as `loadProgress` reads it: real, unfinished and within its window, or nothing. */
  saved: Pick<SavedProgress, 'plan'> | null;
  startDate: string;
  date: string;
}

export function admits(a: Admission): boolean {
  if (a.stretch) return true;
  const resumes = a.saved !== null && (a.resume || a.saved.plan.date === a.date);
  return resumes || !programmeDone(a.startDate, a.date);
}

/** Asked once, when the session page opens. */
export function useAdmission(): boolean {
  const { data, date } = useGuided();
  const [params] = useSearchParams();
  const [admitted] = useState(() => admits({
    stretch: parseStretchSpec(params) !== null,
    resume: params.get('resume') === '1',
    saved: loadProgress(Date.now(), 'guided'),
    startDate: data.settings.startDate,
    date,
  }));
  return admitted;
}
