import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TARGET } from '@/components/hig/targets';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { ProfileWizard, type WizardResult } from '@/components/profile/ProfileWizard';
import { createDefaultProfile } from '@/profile/defaults';
import { useStore } from '@/store/useStore';
import { isEnrolled } from '@/health/recommend';
import { todayString } from '@/lib/utils';
import { withFluidAnswer } from '@/reminders/water';
import { startDateProblem } from '@/screens/move/plan';
import { Notice, PlainButton } from './controls';
import { shortDay } from './dates';
import { WizardCover } from './WizardCover';
import { joinProgramme, leaveProgramme } from './write';

/**
 * The 12-week programme: join it, or leave it with a confirmation (journey
 * §16 Goals; board D8, D35). Joining and leaving are their own explicit
 * actions, here and in Move under Your plan, and membership is decided in
 * one place for the whole app (`isEnrolled`). Shown in Goals and in "What
 * you’d like more of".
 */
export function ProgrammeGroup() {
  const { settings, profile } = useStore();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinProblem, setJoinProblem] = useState<string>();
  const [leaveProblem, setLeaveProblem] = useState<string>();
  // Read once per visit: joining can start today or any later day.
  const [today] = useState(todayString);
  const enrolled = isEnrolled(settings, profile);

  const join = async (result: WizardResult) => {
    if (busy) return;
    setBusy(true);
    setJoinProblem(undefined);
    const saved = await joinProgramme(result, result.startDate);
    setBusy(false);
    // A failed save keeps the answers on screen to try again.
    if (!saved.ok) setJoinProblem(`That did not save. ${saved.failure.message}`);
    else setJoining(false);
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setLeaveProblem(undefined);
    const saved = await leaveProgramme();
    setBusy(false);
    if (!saved.ok) setLeaveProblem(`That did not save. ${saved.failure.message}`);
    else setLeaving(false);
  };

  return (
    <>
      <Group
        header="The 12-week programme"
        footer={enrolled
          ? 'Leaving keeps every session, record and answer. You can join again at any time.'
          : 'A guided hour on the days you choose: mobility, then strength, then an easy finish, fitted around your back and your health. Stretch and Walk work without it.'}
      >
        {enrolled ? (
          <>
            <Row label="You are in the programme" detail={`Week 1 began on ${shortDay(settings.startDate)}.`} />
            <Row
              onClick={() => { setLeaveProblem(undefined); setLeaving(true); }}
              label={<span className="text-stop">Leave the programme</span>}
            />
          </>
        ) : (
          <Row
            onClick={() => { setJoinProblem(undefined); setJoining(true); }}
            label={<span className="text-tint">Join the 12-week programme</span>}
            detail="Your training days, session length, where you train, and a start date."
            chevron
          />
        )}
      </Group>

      <WizardCover open={joining} onClose={() => { if (!busy) setJoining(false); }} label="Join the 12-week programme">
        <ProfileWizard
          // Someone with no answers yet is asked everything the programme
          // needs, health first among it; anyone else only its own questions.
          mode={profile ? 'edit' : 'onboarding'}
          steps={profile ? ['about'] : ['about', 'body', 'health', 'summary']}
          programme
          askStartDate
          startDateRule={date => startDateProblem(date, today)}
          submitLabel="Join the programme"
          busy={busy}
          {...(joinProblem ? { error: joinProblem } : {})}
          initial={{
            profile: withFluidAnswer(profile ?? createDefaultProfile({ weightKg: settings.currentWeight || 0, needsHealthReview: true }), settings.habits),
            useMetric: settings.useMetric,
          }}
          onCancel={() => { if (!busy) setJoining(false); }}
          onComplete={result => void join(result)}
        />
      </WizardCover>

      <Sheet open={leaving} dismissible={!busy} onOpenChange={next => { if (!next && !busy) setLeaving(false); }} title="Leave the programme" detent="large">
        <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Leave the 12-week programme?</p>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          Every session, record and answer stays. Home stops leading with the programme’s workouts, and stretching and walking carry on as before.
        </p>
        <div className="flex flex-col gap-2">
          {leaveProblem && <Notice tone="error">{leaveProblem}</Notice>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void leave()}
            className={cn('press-feedback w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-60', TARGET.primary)}
          >
            {busy ? 'Leaving…' : 'Leave the programme'}
          </button>
          <PlainButton disabled={busy} onClick={() => setLeaving(false)}>Stay in it</PlainButton>
        </div>
      </Sheet>
    </>
  );
}
