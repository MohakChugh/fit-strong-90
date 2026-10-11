import { useId, useState } from 'react';
import { Group } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { dayOf, nowAt } from '@/health/observation';
import { CheckRows, ChoiceRows, Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import type { DayOfWeek } from '@/types';
import type { SessionMinutes } from '@/types/profile';
import type { JoinAnswers } from '@/types/setup';
import { JOIN_STEPS, joinProblem } from './join';

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' }, { value: 'tuesday', label: 'Tuesday' }, { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' }, { value: 'friday', label: 'Friday' }, { value: 'saturday', label: 'Saturday' }, { value: 'sunday', label: 'Sunday' },
];

/**
 * The 12-week programme's own Join flow (journey §6.2 ch. 6; D35; board D81):
 * experience, where you'll train, your days, and session length with a start
 * date, a step at a time. The same wherever it's opened. While a save is
 * under way nothing closes; a refusal keeps every answer to try again (R02).
 */
export function JoinFlow({ open, onOpenChange, initial, busy = false, error, onJoin }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: JoinAnswers;
  busy?: boolean;
  error?: string;
  onJoin: (j: JoinAnswers) => void;
}) {
  return (
    <Sheet open={open} dismissible={!busy} onOpenChange={next => { if (!busy) onOpenChange(next); }} title="Join the 12-week programme" detent="large">
      {open && <JoinSteps initial={initial} busy={busy} error={error} onJoin={onJoin} onCancel={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function JoinSteps({ initial, busy, error, onJoin, onCancel }: {
  initial: JoinAnswers; busy: boolean; error?: string; onJoin: (j: JoinAnswers) => void; onCancel: () => void;
}) {
  const [j, setJ] = useState(initial);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [today] = useState(() => dayOf(nowAt()));
  const dateId = useId();
  const s = JOIN_STEPS[step];
  const problem = joinProblem(s, j, today);
  const last = step === JOIN_STEPS.length - 1;

  const next = () => {
    if (problem) {
      setTried(true);
      return;
    }
    setTried(false);
    if (last) onJoin(j);
    else setStep(step + 1);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">Step {step + 1} of {JOIN_STEPS.length}</p>
      {s === 'experience' && (
        <Group header="Your experience">
          <ChoiceRows label="How much strength training have you done?" value={j.experience} onChange={experience => setJ({ ...j, experience })}
            options={[
              { value: 'beginner', label: 'New to it', detail: 'Or not for a long while' },
              { value: 'intermediate', label: 'Some', detail: 'A few months, on and off' },
              { value: 'advanced', label: 'A lot', detail: 'Regular training for a year or more' },
            ]} />
        </Group>
      )}
      {s === 'place' && (
        <Group header="Where you’ll train">
          <ChoiceRows label="Where will you train?" value={j.equipment} onChange={equipment => setJ({ ...j, equipment })}
            options={[
              { value: 'fullGym', label: 'A gym' }, { value: 'homeDumbbells', label: 'At home, with dumbbells' },
              { value: 'homeNone', label: 'At home, with no equipment' },
            ]} />
        </Group>
      )}
      {s === 'days' && (
        <Group header="Your days" footer="Three days a week suits most people.">
          <CheckRows label="Which days?" options={DAYS} value={j.days} onChange={days => setJ({ ...j, days })} />
        </Group>
      )}
      {s === 'length' && (
        <>
          <Group header="Session length">
            <ChoiceRows label="How long is each session?" value={String(j.minutes) as `${SessionMinutes}`}
              onChange={m => setJ({ ...j, minutes: Number(m) as SessionMinutes })}
              options={[{ value: '45', label: '45 minutes' }, { value: '60', label: '60 minutes' }, { value: '75', label: '75 minutes' }]} />
          </Group>
          <Group header="Start date">
            <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
              <label htmlFor={dateId} className="min-w-0 flex-1 basis-24 text-[length:var(--text-body)]">Start on</label>
              <input id={dateId} type="date" min={today} value={j.startDate} onChange={e => setJ({ ...j, startDate: e.target.value })}
                className="numeric min-h-11 rounded-lg bg-muted/60 px-3 text-[length:var(--text-body)] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-tint/40" />
            </div>
          </Group>
        </>
      )}
      {tried && problem && <Notice tone="error">{problem}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col gap-2">
        <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={next}>
          {!last ? 'Next' : busy ? 'Joining…' : 'Join the programme'}
        </PrimaryButton>
        <PlainButton className="min-h-12" disabled={busy} onClick={step > 0 ? () => setStep(step - 1) : onCancel}>{step > 0 ? 'Back' : 'Cancel'}</PlainButton>
      </div>
    </div>
  );
}
