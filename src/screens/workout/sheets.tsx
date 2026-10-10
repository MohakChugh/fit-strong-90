import { useState, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import type { DayOfWeek, WorkoutSet, WorkoutStatus } from '@/types';
import type { DayFocus } from '@/types/plan';
import { nameOf } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { focusLabel } from '@/engine/templates';
import { loadAdvice } from '@/session/manual';
import { ExerciseFigure } from '@/components/exercise/ExerciseFigure';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { STATUS_LABEL, timeText } from './summary';
import { readMinutes, stepMinutes } from './entry';
import { targetText } from './words';
import type { Planned } from './model';
import { NumberStepper, SetFields, primary, secondary, type SetValues } from './parts';

/** A save that did not happen, said where it was asked for. */
function Failed({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-[length:var(--text-subhead)] text-stop">That did not save. {message}</p> : null;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Swap one exercise for what the planner would put in its slot instead. The
 * list is the planner's, so everything on it already suits the equipment, the
 * back and today's check-in.
 */
export function SwapSheet({ open, onOpenChange, name, planned, alternatives, useMetric, onChoose }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** The plan's own exercise, when the one there now is the user's swap. */
  planned?: Planned;
  alternatives: Planned[];
  useMetric: boolean;
  onChoose: (to: Planned) => void;
}) {
  const option = (p: Planned, label: ReactNode) => (
    <Row key={p.exerciseId} onClick={() => onChoose(p)} label={label}
      detail={[targetText(p.target), p.target.load ? loadAdvice(p.target.load, useMetric) : ''].filter(Boolean).join(' · ')} />
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Instead of ${name}`}>
      {planned && <Group header="Planned">{option(planned, `Back to ${nameOf(planned.exerciseId)}`)}</Group>}
      {alternatives.length > 0 ? (
        <Group header="From your plan" footer="Each of these suits your equipment, your back and today’s check-in, as the planner chose them.">
          {alternatives.map(p => option(p, nameOf(p.exerciseId)))}
        </Group>
      ) : (
        <p className="px-4 text-[length:var(--text-body)] text-muted-foreground">
          Nothing else fits this part of today’s plan. You can skip this exercise instead.
        </p>
      )}
    </Sheet>
  );
}

/** Correct one set: its reps and weight, or that it was not done after all. */
export function EditSetSheet({ open, onOpenChange, title, set, timed, guided, perSide, showWeight, useMetric, onSave, onNotDone, failure }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  set: WorkoutSet | undefined;
  timed: boolean;
  guided: boolean;
  perSide: boolean;
  showWeight: boolean;
  useMetric: boolean;
  onSave: (values: SetValues) => void;
  onNotDone?: () => void;
  failure?: string | null;
}) {
  // A guided hold records no count of its own, so there is none to correct.
  const countless = timed && guided;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {set && (
        // On a card, as in the workout, so the fields stand out from the sheet behind them.
        <div className="rounded-xl bg-grouped-card p-4">
          <SetFields key={`${set.id}:${set.status}`} idPrefix={`edit-${set.id}`} timed={timed} perSide={perSide} showWeight={showWeight}
            useMetric={useMetric} initial={{ reps: set.actualReps ?? set.plannedReps, weightKg: set.weight }}
            action={set.status === 'completed' ? 'Save' : 'Mark as done'} onSubmit={onSave} hideCount={countless}>
            <Failed message={failure ?? null} />
          </SetFields>
        </div>
      )}
      {set?.status === 'completed' && onNotDone && (
        <button type="button" className={secondary} onClick={onNotDone}>Mark as not done</button>
      )}
    </Sheet>
  );
}

/**
 * The minutes the person was active, which is all a workout logged by hand
 * can count as movement: the app saw sets being logged, not exercise (F20).
 * Never filled in for them — not from the clock, not from a guess.
 */
function ActiveMinutes({ value, onChange, error, disabled, hint }: {
  value: string;
  onChange: (text: string) => void;
  error: string | null;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    // `min-w-0`: a fieldset otherwise refuses to shrink below its content, and overflows a 320 px screen.
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2 rounded-xl bg-grouped-card p-4">
      <NumberStepper id="active-minutes" label="Minutes you were active (optional)" noun="minutes" value={value}
        inputMode="numeric" onChange={onChange} onStep={d => onChange(stepMinutes(value, d))} />
      {error && <p role="alert" className="text-[length:var(--text-subhead)] text-stop">{error}</p>}
      <p className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        {hint ? `${hint} ` : ''}These count towards your weekly movement. If you are not sure, leave it blank and none are counted.
      </p>
    </fieldset>
  );
}

/**
 * Finishing asks once: how the workout will be recorded, by the same rule as
 * ever (at least half its sets done is completed), how long the person was
 * active, and an optional note. While it saves, nothing else can be done —
 * no closing, no keeping going — so the finish is the last word (F06).
 */
export function FinishSheet({ open, onOpenChange, done, total, status, startedAt, onSave, failure, saving }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  done: number;
  total: number;
  status: WorkoutStatus;
  /** When the first set was logged, as context for the minutes. Never their value. */
  startedAt: string | null;
  onSave: (notes: string, activeMinutes: number | null) => void;
  failure: string | null;
  saving: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('');
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const left = total - done;
  const save = () => {
    const read = readMinutes(minutes);
    if (!read.ok) return setMinutesError(read.message);
    setMinutesError(null);
    onSave(notes.trim(), read.value);
  };
  return (
    <Sheet open={open} dismissible={!saving} onOpenChange={o => { if (!saving) onOpenChange(o); }} title="Finish workout" detent="large">
      <div className="flex flex-col gap-2 px-1 text-[length:var(--text-body)]">
        <p><span className="numeric font-semibold">{done} of {total}</span> sets done. It will be saved as <strong>{STATUS_LABEL[status].toLowerCase()}</strong>.</p>
        {left > 0 && <p className="text-muted-foreground">The {left === 1 ? 'set' : `${left} sets`} not done {left === 1 ? 'is' : 'are'} recorded as not done.</p>}
      </div>
      <ActiveMinutes value={minutes} onChange={t => { setMinutes(t); setMinutesError(null); }} error={minutesError} disabled={saving}
        {...(startedAt ? { hint: `Your first set was logged at ${timeText(startedAt)}.` } : {})} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="finish-notes" className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">Notes (optional)</label>
        <textarea id="finish-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel?" disabled={saving}
          className="w-full resize-none rounded-xl bg-grouped-card p-3 text-[length:var(--text-body)] outline-none focus-visible:ring-2 focus-visible:ring-tint" />
      </div>
      <Failed message={failure} />
      <div className="flex flex-col gap-2">
        <button type="button" className={primary} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save workout'}
        </button>
        <button type="button" className={`${secondary} disabled:opacity-50`} disabled={saving} onClick={() => onOpenChange(false)}>Keep going</button>
      </div>
    </Sheet>
  );
}

/** Add, change or remove the active minutes of a workout logged by hand, after it was saved. */
export function ActiveTimeSheet({ open, onOpenChange, minutes, onSave, failure }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minutes: number | null;
  onSave: (minutes: number | null) => void;
  failure: string | null;
}) {
  const [text, setText] = useState(minutes === null ? '' : String(minutes));
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const read = readMinutes(text);
    if (!read.ok) return setError(read.message);
    setError(null);
    onSave(read.value);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Active time">
      <ActiveMinutes value={text} onChange={t => { setText(t); setError(null); }} error={error} />
      <Failed message={failure} />
      <button type="button" className={primary} onClick={save}>Save</button>
    </Sheet>
  );
}

/** Do another of the week's workouts today. Kept per date, so Today and the guided session follow it. */
export function ChangeWorkoutSheet({ open, onOpenChange, options, current, onChoose, failure }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: { focus: DayFocus; day?: DayOfWeek }[];
  current: DayFocus;
  onChoose: (focus: DayFocus) => void;
  failure: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Change today’s workout">
      <Group footer="Today and the guided session will run the one you choose. Choosing the usual one again puts the day back.">
        {options.map(({ focus, day }) => (
          <Row key={focus} onClick={() => onChoose(focus)}
            aria-current={focus === current ? 'true' : undefined}
            label={focusLabel(focus)} detail={day ? `Usually ${capitalise(day)}` : undefined}
            accessory={focus === current ? <CheckIcon className="size-5 shrink-0 text-tint" aria-label="Today’s workout" /> : undefined} />
        ))}
      </Group>
      <Failed message={failure} />
    </Sheet>
  );
}

/** The form demo and the coach's steps, one tap away rather than on the logging screen. */
export function HowToSheet({ open, onOpenChange, exerciseId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string;
}) {
  const c = getCoaching(exerciseId);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={nameOf(exerciseId)} detent="large">
      {open && <ExerciseFigure exerciseId={exerciseId} playing className="h-56 overflow-hidden rounded-xl bg-grouped-card" />}
      {c ? (
        <>
          <p className="px-1 text-[length:var(--text-body)]">{c.summary}</p>
          <Group header="How to do it">
            {c.steps.map((s, i) => <Row key={s} label={<span className="whitespace-normal">{s}</span>} icon={<span className="numeric text-[length:var(--text-subhead)]">{i + 1}</span>} />)}
          </Group>
          <Group header="As you do it" footer="General information, not medical advice.">
            <Row label="Breathing" detail={c.breathing} />
            <Row label="Where you feel it" detail={c.feel} />
            <Row label="Ease off or stop if" detail={c.shouldNotFeel} />
            {c.backSafety.status !== 'ok' && <Row label="For your back" detail={c.backSafety.note} />}
          </Group>
        </>
      ) : (
        <p className="px-1 text-[length:var(--text-body)] text-muted-foreground">There are no coaching notes for this exercise yet.</p>
      )}
    </Sheet>
  );
}

/** Deleting asks once, and says what goes with it. */
export function DeleteSheet({ open, onOpenChange, onDelete, failure }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  failure: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Delete workout">
      <p className="px-1 text-[length:var(--text-body)]">
        This removes the workout and its sets from this device, along with any personal record they set. It cannot be undone.
      </p>
      <Failed message={failure} />
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onDelete}
          className="press-feedback flex min-h-14 w-full items-center justify-center rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-semibold text-stop">
          Delete workout
        </button>
        <button type="button" className={secondary} onClick={() => onOpenChange(false)}>Keep it</button>
      </div>
    </Sheet>
  );
}
