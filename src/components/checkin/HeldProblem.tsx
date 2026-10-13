/**
 * A change refused because the reading still holds movement (board D119):
 * the refusal next to what was tapped (J§20.4 rule 9), and v1's way out for a
 * reading typed wrongly: "It was a mistake" answers exactly the measurements
 * the refusal named, in today's check-in, then the change is tried again. A
 * refusal with no measurement to answer, a hold of its own or the phone's
 * clock change, says its own words instead.
 */
import { useState } from 'react';
import type { HoldFailure } from '@/store/db';
import { update } from '@/store/useStore';
import type { UserProfile } from '@/types/profile';
import { answerMistakes } from './pending';

export const MISTAKE_LABEL = 'It was a mistake';

export function HeldProblem({ failure, profile, onAnswered }: { failure: HoldFailure; profile: UserProfile | undefined; onAnswered: () => void }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const answer = async () => {
    if (!profile || busy) return;
    setBusy(true);
    setProblem(undefined);
    const saved = await answerMistakes(failure.held, { profile, update });
    setBusy(false);
    if (!saved.stored) return setProblem('Your answer didn’t save, so nothing was changed. Try again.');
    onAnswered();
  };
  return (
    <div role="alert" className="flex flex-col gap-2 px-4">
      <p className="text-[length:var(--text-body)]">{failure.message}</p>
      {failure.held.length > 0 && profile && (
        <button type="button" onClick={() => void answer()}
          className="press-feedback min-h-12 self-start rounded-xl px-4 text-[length:var(--text-body)] font-semibold text-tint">
          {MISTAKE_LABEL}
        </button>
      )}
      {problem && <p className="text-[length:var(--text-subhead)] text-stop">{problem}</p>}
    </div>
  );
}
