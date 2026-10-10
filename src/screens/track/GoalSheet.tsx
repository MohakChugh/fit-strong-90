/**
 * The weekly movement goal (board D31): the person's own number. WHO's 150
 * minutes is offered as a suggestion they can take with one tap, never filled
 * in for them, and the app never raises it.
 */

import { useId, useState } from 'react';
import { Sheet } from '@/components/hig/Sheet';
import { setSettings, update } from '@/store/useStore';
import { WHO_WEEKLY_MINUTES, checkWeeklyGoal } from './movement';
import { today } from './periods';
import { checkValue } from './plausible';
import { withStepsGoal } from './stepsGoal';
import { NOT_ADVICE } from './targets';
import { ErrorText, Hint, NumberField, PrimaryButton, SecondaryButton } from './ui';

export function GoalSheet({ open, onOpenChange, goal }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: number | undefined;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Weekly movement goal" detent="large">
      {/* Remounts with each opening, so the field starts from the saved goal. */}
      {open && <GoalForm goal={goal} onDone={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function GoalForm({ goal, onDone }: { goal: number | undefined; onDone: () => void }) {
  const errorId = useId();
  const [raw, setRaw] = useState(goal !== undefined ? String(goal) : '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const write = async (minutes: number | undefined) => {
    setBusy(true);
    const result = await setSettings({ weeklyMovementGoalMinutes: minutes });
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    onDone();
  };

  const save = () => {
    const checked = checkWeeklyGoal(raw);
    if (!checked.ok) return setError(checked.message);
    setError(undefined);
    void write(checked.minutes);
  };

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        Choose how many minutes of recorded movement you would like each week. Walks, sessions and workouts you record count towards it, and a rest day is part of the plan.
      </p>
      <NumberField
        label="Minutes each week"
        mode="numeric"
        value={raw}
        onChange={v => { setRaw(v); setError(undefined); }}
        placeholder="Your choice"
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit="min"
      />
      <div className="flex flex-col gap-2">
        <SecondaryButton onClick={() => { setRaw(String(WHO_WEEKLY_MINUTES)); setError(undefined); }}>
          Use WHO’s suggestion: {WHO_WEEKLY_MINUTES} minutes
        </SecondaryButton>
        <Hint>
          WHO suggests adults build up to 150 to 300 minutes of moderate activity a week, starting with less if needed (WHO 2020). {NOT_ADVICE}
        </Hint>
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save goal'}</PrimaryButton>
      {goal !== undefined && (
        <SecondaryButton tone="stop" onClick={() => void write(undefined)}>Remove the goal</SecondaryButton>
      )}
    </>
  );
}

/**
 * A daily steps goal (acceptance J07; board D27, as revised): the person's
 * own, with nothing filled in, no suggestion and no floor. It applies from
 * today: earlier days keep the goal they had, so a change never re-scores them.
 */
export function StepsGoalSheet({ open, onOpenChange, goal }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: number | undefined;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Daily steps goal" detent="large">
      {open && <StepsGoalForm goal={goal} onDone={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function StepsGoalForm({ goal, onDone }: { goal: number | undefined; onDone: () => void }) {
  const errorId = useId();
  const [raw, setRaw] = useState(goal !== undefined ? String(goal) : '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Built inside the store's queue from the latest settings, so a change made
  // elsewhere in the meantime is not lost.
  const write = async (steps: number | undefined) => {
    setBusy(true);
    const day = today();
    const result = await update(prev => ({ ...prev, settings: { ...prev.settings, ...withStepsGoal(prev.settings, steps, day) } }));
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    onDone();
  };

  const save = () => {
    const checked = checkValue('steps', raw, 'steps');
    if (!checked.ok) return setError(checked.message);
    if (!(checked.value > 0)) return setError('Enter a goal above zero.');
    setError(undefined);
    void write(checked.value);
  };

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        Choose a number of steps a day, if a goal helps you. It counts from today: earlier days stay as they were.
      </p>
      <NumberField
        label="Steps a day"
        mode="numeric"
        value={raw}
        onChange={v => { setRaw(v); setError(undefined); }}
        placeholder="Your choice"
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit="steps"
      />
      <Hint>Yours to choose and to change. The app never raises it, and no number here is a requirement. {NOT_ADVICE}</Hint>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save goal'}</PrimaryButton>
      {goal !== undefined && (
        <SecondaryButton tone="stop" onClick={() => void write(undefined)}>Remove the goal</SecondaryButton>
      )}
    </>
  );
}
