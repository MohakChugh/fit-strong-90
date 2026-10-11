import { useCallback, useState, type ReactNode } from 'react';
import type { SymptomReport } from '@/components/checkin/pending';
import { SayWhatHappenedContext } from '@/components/checkin/sayWhatHappened';
import { deriveHealth } from '@/engine/health';
import { useGuided } from '@/hooks/useGuided';
import { StopSheet } from '@/screens/walk/StopSheet';

/**
 * "Say what happened" off the walk (journey §4.4, K6R-03, board D173): an
 * unanswered "I need to stop" holds every movement until its own questions
 * answer it, so the shared safety surface, every movement hub and the
 * check-in open those questions, the walk's own, here. Each answer goes into
 * today's check-in through the shared path and answers the stop.
 */
export function SayWhatHappenedProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Mounted from its first opening, so a closed dialog is not kept above every screen before then.
  const [asked, setAsked] = useState(false);
  const { profile, checkIn, reportSymptoms } = useGuided();
  const show = useCallback(() => {
    setAsked(true);
    setOpen(true);
  }, []);
  const report = useCallback(async (r: SymptomReport) => (await reportSymptoms(r, new Date())).stored, [reportSymptoms]);
  return (
    <SayWhatHappenedContext value={show}>
      {children}
      {asked && (
        <StopSheet
          open={open}
          onClose={() => setOpen(false)}
          hypoRisk={deriveHealth(profile.health).hypoRisk}
          before={checkIn?.back?.reach}
          onReport={report}
          onLow={() => report({ news: ['lowSymptoms'] })}
        />
      )}
    </SayWhatHappenedContext>
  );
}
