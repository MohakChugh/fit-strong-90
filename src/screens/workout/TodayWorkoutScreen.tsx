import { useCallback, useMemo, useRef, useState, type Ref } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import type { AppData, WorkoutSession } from '@/types';
import type { DayFocus, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { finishedStatus, generateId, getDayOfWeekFromDate, TOTAL_WEEKS, toDateString } from '@/lib/utils';
import { nameOf } from '@/data/catalog';
import { focusLabel, weekFocus } from '@/engine/templates';
import { PERMISSION_TEXT } from '@/engine/permission';
import { loadAdvice, swapOptions } from '@/session/manual';
import { clearProgress, loadProgress } from '@/session/persistence';
import { planFor, useGuided } from '@/hooks/useGuided';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { update, useStore } from '@/store/useStore';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { plannerAlternatives } from './alternatives';
import { gateInputFor, LOG_MODE, logGate, offersOtherWorkout, setGate, type Clinical, type LogGate } from './gate';
import {
  currentItem, groupFor, nextSetIndex, pendingCheck, planKey, prefill, progress,
  type Answer, type Item, type WorkoutState,
} from './model';
import { withWorkoutChanged } from './records';
import { abandoned, pastDate, resumable, unfinishedOn } from './resume';
import { bodyweightExercise, dayText, sessionTitle, setLine, STATUS_LABEL, timeText, totals } from './summary';
import { amountText, groupText, plannerSwapText, progressText, rampText } from './words';
import { Notice, RestPanel, SetFields, primary, quiet, secondary } from './parts';
import { ChangeWorkoutSheet, EditSetSheet, FinishSheet, HowToSheet, SwapSheet } from './sheets';
import { useNow } from './useNow';
import { useWorkout } from './useWorkout';

/**
 * The day's workout, from the same plan the guided session runs, logged at the
 * user's own pace. With `?date=` a past day's workout is written down after
 * the fact, as the old Workout page allowed from History.
 */
export default function TodayWorkoutScreen() {
  const { sessions } = useStore();
  const [params] = useSearchParams();
  const [openedAt] = useState(() => Date.now());
  const now = useNow(true, 30_000);
  const today = toDateString(new Date(now));
  const past = pastDate(params.get('date'), today);
  const active = past ? unfinishedOn(sessions, past) : resumable(sessions, today, openedAt);
  const date = past ?? active?.date ?? today;
  const guided = useGuided(date);
  const { data, profile, plan, saveCheckIn, checkIns } = guided;
  // Every day's effective record, so an answer the device has not stored still counts (re-audit B04).
  const gateInput = gateInputFor(guided, new Date(now));
  const todayCheckIn = gateInput.checkIn;
  const [checkingIn, setCheckingIn] = useState(false);
  const [changing, setChanging] = useState(false);

  // Alternatives are built as the day's plan is: from the effective check-ins.
  const build = useCallback(
    (avoid: string[]) => planFor({ ...data, checkIns }, { ...profile, dislikes: [...profile.dislikes, ...avoid] }, date),
    [data, checkIns, profile, date],
  );
  const lifting = plan.exercises.length > 0 || active !== undefined;

  return (
    <Screen title="Workout" back={{ to: '/track', label: 'Track' }} inline>
      {lifting ? (
        <Workout key={planKey(plan)} plan={plan} active={active} data={data} profile={profile} build={build}
          clinical={{ profile, checkIns }} now={now} checkedIn={todayCheckIn !== undefined} today={today} afterTheFact={past !== undefined}
          onCheckIn={() => setCheckingIn(true)} onChange={() => setChanging(true)} />
      ) : (
        <NoLifting plan={plan} gate={logGate(gateInput, past !== undefined ? 'record' : 'start')} today={today} date={date}
          afterTheFact={past !== undefined} onCheckIn={() => setCheckingIn(true)} onChange={() => setChanging(true)} />
      )}
      <Others sessions={sessions} date={date} today={today} openedAt={openedAt} {...(active ? { continuing: active.id } : {})} />

      {/* Mounted only while asked for: the logging screen re-renders on every
          set, and a closed form has nothing to show. */}
      {checkingIn && (
        <CheckInSheet open onOpenChange={setCheckingIn} profile={profile} date={today} initial={todayCheckIn}
          recent={checkIns} onSave={saveCheckIn} mode={LOG_MODE} startLabel="Start logging"
          onStart={() => setCheckingIn(false)} />
      )}
      <ChangeWorkout open={changing} onOpenChange={setChanging} profile={profile} plan={plan} date={date} />
    </Screen>
  );
}

function DayLine({ label, date, today, week, afterTheFact = false }: {
  label: string;
  date: string;
  today: string;
  week: number;
  afterTheFact?: boolean;
}) {
  const when = date === today ? '' : afterTheFact ? 'Logging ' : 'Started ';
  return (
    <div className="flex flex-col gap-0.5 px-1">
      <p className="text-[length:var(--text-title-2)] font-semibold leading-tight">{label}</p>
      <p className="text-[length:var(--text-subhead)] text-muted-foreground">
        {when}{dayText(date, today)} · Week {week} of {TOTAL_WEEKS}
      </p>
      {afterTheFact && (
        <p className="text-[length:var(--text-subhead)] text-muted-foreground">
          A past workout, written down now: no rest timer, and no start or finish time is recorded.
        </p>
      )}
    </div>
  );
}

/** Why logging is stopped, in the readiness engine's own words, with the way forward. */
function StopNotice({ gate, onCheckIn }: { gate: LogGate; onCheckIn: () => void }) {
  if (gate.kind !== 'stop') return null;
  const p = gate.permission;
  const profileHold = p.reasons.includes(PERMISSION_TEXT.healthUnreviewed) || p.reasons.includes(PERMISSION_TEXT.medicinesUnknown);
  return (
    <Notice tone="stop" role="alert" title={p.disposition === 'emergency' ? 'Get help now' : 'No lifting for now'}>
      {p.reasons.map(r => <p key={r}>{r}</p>)}
      {p.release && <p className="text-muted-foreground">{p.release}</p>}
      {profileHold
        ? <Link to="/you" viewTransition className={`${quiet} self-start`}>Open your profile</Link>
        : p.disposition !== 'emergency' && <button type="button" className={`${quiet} self-start`} onClick={onCheckIn}>Review today’s check-in</button>}
    </Notice>
  );
}

/** Notes on today's plan: the limits that apply and why the plan differs from usual. */
function TodayNotes({ restrictions, changes, hide }: { restrictions: string[]; changes: string[]; hide: string[] }) {
  const notes = [...new Set([...restrictions, ...changes])].filter(n => !hide.includes(n));
  if (notes.length === 0) return null;
  return (
    <Group header="Today" footer="General information, not medical advice.">
      {notes.map(n => <p key={n} className="px-4 py-3 text-[length:var(--text-subhead)] leading-snug">{n}</p>)}
    </Group>
  );
}

function NoLifting({ plan, gate, today, date, afterTheFact, onCheckIn, onChange }: {
  plan: SessionPlan;
  gate: LogGate;
  today: string;
  date: string;
  afterTheFact: boolean;
  onCheckIn: () => void;
  onChange: () => void;
}) {
  const rest = plan.focus === 'rest' || plan.focus === 'activeRecovery';
  const lead = gate.kind === 'stop' ? undefined
    : afterTheFact ? (rest ? 'That day was a rest day in your plan.' : 'There was no lifting in that day’s plan.')
      : rest ? 'No strength workout is planned today. Your body rebuilds on rest days, so a rest day is part of the plan.'
        : plan.kind === 'recovery' ? 'Today’s check-in asks for recovery: gentle mobility, nerve glides and an easy walk, with no lifting.'
          : 'There is no lifting in today’s plan.';
  return (
    <>
      <DayLine label={rest ? 'Rest day' : plan.kind === 'recovery' ? 'Recovery day' : plan.label} date={date} today={today}
        week={plan.week} afterTheFact={afterTheFact} />
      <StopNotice gate={gate} onCheckIn={onCheckIn} />
      {lead && <p className="px-1 text-[length:var(--text-body)]">{lead}</p>}
      {plan.kind === 'recovery' && !afterTheFact && <Link to="/move" viewTransition className={secondary}>Find something gentle in Move</Link>}
      {offersOtherWorkout(plan, gate.permission) && <button type="button" className={secondary} onClick={onChange}>Do a workout anyway</button>}
      <TodayNotes restrictions={[]} changes={plan.changes} hide={gate.permission.reasons} />
    </>
  );
}

function Workout({ plan, active, data, profile, build, clinical, now, checkedIn, today, afterTheFact, onCheckIn, onChange }: {
  plan: SessionPlan;
  active?: WorkoutSession;
  data: AppData;
  profile: UserProfile;
  build: (avoid: string[]) => SessionPlan;
  /** Every day's effective check-in and the profile: what the gate reads. */
  clinical: Clinical;
  /** The screen's clock. */
  now: number;
  /** Today already has a check-in, so it is updated rather than begun. */
  checkedIn: boolean;
  today: string;
  afterTheFact: boolean;
  onCheckIn: () => void;
  onChange: () => void;
}) {
  const useMetric = data.settings.useMetric;
  const { state, dispatch, failure, finish } = useWorkout({
    plan, ...(active ? { active } : {}), defaultRest: data.settings.defaultRestSeconds || 90, build, afterTheFact,
  });
  // Asked again at the tap, not only when the screen last drew: a reading can
  // turn 30 minutes old in between.
  const [askedAt, setAskedAt] = useState(0);
  const gateAt = (t: number) => setGate(state, clinical, new Date(Math.max(now, t)));
  const gate = gateAt(askedAt);
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const focusCard = useRef<HTMLElement>(null);
  const [sheet, setSheet] = useState<'swap' | 'how' | 'finish' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ busy: boolean; failure: string | null }>({ busy: false, failure: null });

  const item = currentItem(state);
  const counts = progress(state);
  const check = pendingCheck(state);
  const worse = Object.entries(state.symptomChecks).filter(([, a]) => a === 'worse').map(([id]) => id);
  const scheduled = weekFocus(profile)[getDayOfWeekFromDate(state.date)];

  const focus = (key: string) => {
    dispatch({ type: 'focus', key });
    focusCard.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  };

  const save = async (notes: string, activeMinutes: number | null) => {
    setSaving({ busy: true, failure: null });
    const result = await finish(notes, activeMinutes);
    if (!result.ok) return setSaving({ busy: false, failure: result.failure.message });
    navigate(`/track/workout/${encodeURIComponent(result.value.id)}`, { replace: true, state: { saved: true }, viewTransition: true });
  };

  const editingSet = editing ? state.items.flatMap(i => i.sets).find(s => s.id === editing) : undefined;
  const editingItem = editing ? state.items.find(i => i.sets.some(s => s.id === editing)) : undefined;

  return (
    <>
      {/* What matters now, kept close together so the Done button stays in
          reach on a small phone: the rest, any question due, the set. */}
      <div className="flex flex-col gap-3">
      <DayLine label={state.label} date={state.date} today={today} week={state.week} afterTheFact={state.afterTheFact} />
      <StopNotice gate={gate} onCheckIn={onCheckIn} />
      {failure && (
        <Notice tone="stop" role="alert" title="That did not save">
          <p>{failure.message}</p>
          <p className="text-muted-foreground">Keep going: the next set you log saves everything again.</p>
        </Notice>
      )}
      {state.rest && <RestPanel rest={state.rest} onSkip={() => dispatch({ type: 'endRest' })} />}
      {check && <Checkpoint item={check} onAnswer={answer => dispatch({ type: 'answer', exerciseId: check.exerciseId, answer })} />}
      {worse.length > 0 && (
        <Notice tone="caution" title={`Your back or leg felt worse after ${worse.map(nameOf).join(' and ')}`}>
          <p>The plan steps this movement down next time. If symptoms spread down your leg, or you notice new numbness or weakness, stop and rest.</p>
          <p className="text-muted-foreground">General information, not medical advice.</p>
        </Notice>
      )}

      {item ? (
        <FocusCard ref={focusCard} state={state} item={item} gate={gate} useMetric={useMetric} checkedIn={checkedIn}
          onLog={values => {
            const t = Date.now();
            if (gateAt(t).kind !== 'log') return setAskedAt(t);
            dispatch({ type: 'log', key: item.key, reps: values.reps, weightKg: values.weightKg, now: t });
          }}
          onUndo={() => dispatch({ type: 'undo' })} onCheckIn={onCheckIn} />
      ) : (
        <section ref={focusCard} className="flex scroll-mt-16 flex-col gap-3 rounded-xl bg-grouped-card p-4">
          <p className="text-[length:var(--text-title-2)] font-semibold">
            {counts.done > 0 ? 'Every set is logged' : 'Nothing left to log'}
          </p>
          <p className="text-[length:var(--text-body)] text-muted-foreground">
            {counts.done} of {counts.total} sets done. Finish to save the workout.
          </p>
          <button type="button" className={primary} onClick={() => setSheet('finish')}>Finish workout</button>
          {state.logged.length > 0 && <button type="button" className={quiet} onClick={() => dispatch({ type: 'undo' })}>Undo last set</button>}
        </section>
      )}
      </div>

      {item && (
        <>
          <Group header="Sets">
            {item.sets.map((s, i) => (s.status === 'completed' ? (
              <Row key={s.id} onClick={() => setEditing(s.id)} label={`Set ${i + 1}`}
                detail={<span className="numeric">{setLine(s, { timed: item.target.timed, guided: false, useMetric })}</span>}
                accessory={<CheckIcon className="size-5 shrink-0 text-tint" aria-label="Done" />} />
            ) : (
              <Row key={s.id} label={`Set ${i + 1}`}
                value={s.status === 'skipped' ? 'Skipped' : i === nextSetIndex(item) ? 'Next' : 'To do'} />
            )))}
          </Group>
          <Group>
            <Row onClick={() => setSheet('how')} label="How to do it" chevron />
            {!item.sets.some(s => s.status === 'completed') && item.slotId && (
              <Row onClick={() => setSheet('swap')} label="Swap exercise" chevron />
            )}
            {nextSetIndex(item) >= 0 ? (
              <Row onClick={() => dispatch({ type: 'skip', key: item.key })}
                label={<span className="text-tint">Skip this exercise</span>} />
            ) : item.sets.some(s => s.status === 'skipped') && (
              <Row onClick={() => dispatch({ type: 'unskip', key: item.key })}
                label={<span className="text-tint">Do this exercise after all</span>} />
            )}
          </Group>
        </>
      )}

      <WorkoutList state={state} current={item?.key} onFocus={focus} />

      <TodayNotes restrictions={gate.permission.restrictions} changes={plan.changes}
        hide={[...gate.permission.reasons, ...state.items.flatMap(i => plannerSwapText(i) ?? [])]} />

      {!state.begun && plan.exercises.length > 0 && (
        <Group>
          <Row onClick={onChange} label="Change today’s workout" chevron
            detail={plan.focus !== scheduled ? `In place of ${focusLabel(scheduled)}` : undefined} />
        </Group>
      )}

      {state.begun && item && (
        <button type="button" className={secondary} onClick={() => setSheet('finish')}>Finish workout</button>
      )}

      {item && (
        <>
          <HowToSheet open={sheet === 'how'} onOpenChange={o => setSheet(o ? 'how' : null)} exerciseId={item.exerciseId} />
          <Swap open={sheet === 'swap'} onClose={() => setSheet(null)} state={state} item={item} build={build} useMetric={useMetric}
            onChoose={to => { dispatch({ type: 'swap', key: item.key, to }); setSheet(null); }} />
        </>
      )}
      <FinishSheet open={sheet === 'finish'} startedAt={state.startedAt}
        onOpenChange={o => { if (saving.busy) return; setSheet(o ? 'finish' : null); if (!o) setSaving({ busy: false, failure: null }); }}
        done={counts.done} total={counts.total}
        status={finishedStatus(state.items.flatMap(i => i.sets))}
        onSave={save} failure={saving.failure} saving={saving.busy} />
      <EditSetSheet open={editingSet !== undefined} onOpenChange={o => { if (!o) setEditing(null); }}
        title={editingSet && editingItem ? `Set ${editingItem.sets.indexOf(editingSet) + 1} · ${nameOf(editingItem.exerciseId)}` : 'Set'}
        set={editingSet} timed={editingItem?.target.timed ?? false} guided={false} perSide={editingItem?.target.perSide ?? false}
        showWeight={editingItem ? showsWeight(editingItem) : true} useMetric={useMetric}
        onSave={values => { if (editing) dispatch({ type: 'edit', setId: editing, reps: values.reps, weightKg: values.weightKg }); setEditing(null); }}
        onNotDone={() => { if (editing) dispatch({ type: 'unlog', setId: editing }); setEditing(null); }} />
    </>
  );
}

/** Bodyweight exercises ask for no weight, as in the guided session. */
const showsWeight = (item: Item) => (item.target.load ? item.target.load.note !== 'bodyweight' : !bodyweightExercise(item.exerciseId));

function FocusCard({ ref, state, item, gate, useMetric, checkedIn, onLog, onUndo, onCheckIn }: {
  ref: Ref<HTMLElement>;
  state: WorkoutState;
  item: Item;
  gate: LogGate;
  useMetric: boolean;
  /** Today already has a check-in, so it is updated rather than begun. */
  checkedIn: boolean;
  onLog: (values: { reps: number; weightKg: number | null }) => void;
  onUndo: () => void;
  onCheckIn: () => void;
}) {
  const group = groupFor(state, item.key);
  const next = nextSetIndex(item);
  const offered = prefill(state, item);
  const notes = [
    item.target.load ? loadAdvice(item.target.load, useMetric) : undefined,
    rampText(item.target),
    group ? groupText(group, state.items, item.key) : undefined,
    plannerSwapText(item),
    item.swappedFrom ? `Your swap, in place of ${nameOf(item.swappedFrom.exerciseId)}.` : undefined,
    ...item.target.caps,
  ].filter((n): n is string => !!n);

  return (
    <section ref={ref} aria-labelledby="now-name" className="flex scroll-mt-16 flex-col gap-3 rounded-xl bg-grouped-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="now-name" className="text-[length:var(--text-title-2)] font-semibold leading-tight">{nameOf(item.exerciseId)}</h2>
        <p className="numeric text-[length:var(--text-body)] text-muted-foreground">
          {next < 0 ? progressText(item) : `${progressText(item)} · ${amountText(item.target)}`}
        </p>
      </div>

      {next < 0 ? (
        <p className="text-[length:var(--text-body)]">
          {item.sets.some(s => s.status === 'completed') ? 'This exercise is done.' : 'You skipped this exercise.'}
        </p>
      ) : gate.kind === 'log' ? (
        <SetFields key={`${item.key}:${next}:${state.undone?.setId ?? ''}`} idPrefix={`set-${item.key}`}
          timed={item.target.timed} perSide={item.target.perSide} showWeight={showsWeight(item)} useMetric={useMetric}
          initial={offered} action="Done set" onSubmit={onLog} />
      ) : gate.kind === 'checkIn' ? (
        <div className="flex flex-col gap-3">
          {gate.permission.reasons.map(r => <p key={r} className="text-[length:var(--text-body)]">{r}</p>)}
          {/* "Answer today's check-in" only repeats "Check in first"; any other release says what to do. */}
          {gate.permission.release && !gate.permission.reasons.includes(PERMISSION_TEXT.noCheckIn) && (
            <p className="text-[length:var(--text-subhead)] text-muted-foreground">{gate.permission.release}</p>
          )}
          <button type="button" className={primary} onClick={onCheckIn}>{checkedIn ? 'Update today’s check-in' : 'Check in'}</button>
        </div>
      ) : null}

      {state.logged.length > 0 && gate.kind !== 'stop' && (
        <button type="button" className={`${quiet} -my-2 self-start`} onClick={onUndo}>Undo last set</button>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-separator pt-3 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          {notes.map(n => <li key={n}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}

const ANSWERS: { answer: Answer; label: string }[] = [
  { answer: 'better', label: 'Better' },
  { answer: 'same', label: 'Same' },
  { answer: 'worse', label: 'Worse' },
];

/** The planner's back-symptom checkpoint, asked as the guided session asks it. */
function Checkpoint({ item, onAnswer }: { item: Item; onAnswer: (a: Answer) => void }) {
  return (
    <section aria-labelledby="check-q" className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
      <div className="flex flex-col gap-1">
        <p id="check-q" className="text-[length:var(--text-body)] font-semibold">Quick check after {nameOf(item.exerciseId)}</p>
        <p className="text-[length:var(--text-subhead)] text-muted-foreground">
          Compared with before it, does your back or leg feel better, the same, or worse?
        </p>
      </div>
      {/* Wraps rather than squeezing the words at large text. */}
      <div className="flex flex-wrap gap-2">
        {ANSWERS.map(({ answer, label }) => (
          <button key={answer} type="button" onClick={() => onAnswer(answer)}
            className="press-feedback flex min-h-12 flex-1 items-center justify-center whitespace-nowrap rounded-xl bg-grouped-bg px-3 text-[length:var(--text-body)] font-medium text-tint">
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** The whole workout, compact: supersets and circuits kept together, as the plan groups them. */
function WorkoutList({ state, current, onFocus }: { state: WorkoutState; current?: string; onFocus: (key: string) => void }) {
  const blocks: { header?: string; items: Item[] }[] = [];
  for (const item of state.items) {
    const group = groupFor(state, item.key);
    const last = blocks[blocks.length - 1];
    if (group) {
      if (group.keys[0] === item.key || !last || !last.items.some(i => group.keys.includes(i.key))) {
        blocks.push({ header: group.kind === 'superset' ? 'Superset' : 'Circuit', items: [item] });
      } else {
        last.items.push(item);
      }
    } else if (last && !last.header) {
      last.items.push(item);
    } else {
      blocks.push({ items: [item] });
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-4 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">This workout</h2>
      {blocks.map(block => (
        <Group key={block.items[0].key} header={block.header}>
          {block.items.map(item => {
            const done = item.sets.every(s => s.status !== 'pending') && item.sets.some(s => s.status === 'completed');
            return (
              <Row key={item.key} onClick={() => onFocus(item.key)}
                aria-current={item.key === current ? 'step' : undefined}
                label={nameOf(item.exerciseId)}
                detail={item.key === current ? `Now · ${progressText(item)}` : progressText(item)}
                accessory={done ? <CheckIcon className="size-5 shrink-0 text-tint" aria-label="Done" /> : undefined} />
            );
          })}
        </Group>
      ))}
    </div>
  );
}

/** The planner's alternatives, asked only while the sheet is open. */
function Swap({ open, onClose, state, item, build, useMetric, onChoose }: {
  open: boolean;
  onClose: () => void;
  state: WorkoutState;
  item: Item;
  build: (avoid: string[]) => SessionPlan;
  useMetric: boolean;
  onChoose: Parameters<typeof SwapSheet>[0]['onChoose'];
}) {
  const planned = item.swappedFrom?.exerciseId ?? item.exerciseId;
  const alternatives = useMemo(() => {
    if (!open || !item.slotId) return [];
    const inWorkout = state.items.filter(i => i.key !== item.key).map(i => i.exerciseId);
    return plannerAlternatives(build, { slotId: item.slotId, planned, avoid: [item.exerciseId, planned], inWorkout });
  }, [open, build, state.items, item.key, item.slotId, item.exerciseId, planned]);
  return (
    <SwapSheet open={open} onOpenChange={o => { if (!o) onClose(); }} name={nameOf(item.exerciseId)}
      {...(item.swappedFrom ? { planned: item.swappedFrom } : {})} alternatives={alternatives} useMetric={useMetric} onChoose={onChoose} />
  );
}

/** Earlier records today, and unfinished ones from before, one tap from their detail. */
function Others({ sessions, date, today, openedAt, continuing }: {
  sessions: WorkoutSession[];
  date: string;
  today: string;
  openedAt: number;
  /** The unfinished record being carried on with here, which is not "left". */
  continuing?: string;
}) {
  const earlier = sessions.filter(s => s.date === date && s.status !== 'in_progress' && s.status !== 'not_started');
  const left = abandoned(sessions, today, openedAt).filter(s => s.id !== continuing);
  return (
    <>
      {earlier.length > 0 && (
        <Group header={date === today ? 'Earlier today' : 'Earlier that day'}>
          {earlier.map(s => {
            const t = totals(s);
            return (
              <Row key={s.id} as={Link} to={`/track/workout/${encodeURIComponent(s.id)}`} viewTransition chevron
                label={sessionTitle(s)}
                detail={[STATUS_LABEL[s.status], `${t.done} of ${t.total} sets`, s.completedAt ? timeText(s.completedAt) : undefined].filter(Boolean).join(' · ')} />
            );
          })}
        </Group>
      )}
      {left.length > 0 && (
        <Group header="Not finished" footer="Open one to save it as it stands, or delete it.">
          {left.map(s => {
            const t = totals(s);
            return (
              <Row key={s.id} as={Link} to={`/track/workout/${encodeURIComponent(s.id)}`} viewTransition chevron
                label={sessionTitle(s)} detail={`${dayText(s.date, today)} · ${t.done} of ${t.total} sets`} />
            );
          })}
        </Group>
      )}
    </>
  );
}

/** Another of the week's workouts today, with the old one's guided progress banked first. */
function ChangeWorkout({ open, onOpenChange, profile, plan, date }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  plan: SessionPlan;
  date: string;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const choose = async (focus: DayFocus) => {
    if (focus === plan.focus) return onOpenChange(false);
    const saved = loadProgress();
    const scheduled = weekFocus(profile)[getDayOfWeekFromDate(date)];
    const result = await update(prev => withWorkoutChanged(prev, { date, focus, scheduled }, saved, `guided-${date}-${generateId()}`));
    if (!result.ok) return setFailure(result.failure.message);
    // Banked, so the guided session's saved progress for that day can go.
    if (saved?.plan.date === date) clearProgress();
    setFailure(null);
    onOpenChange(false);
  };
  return (
    <ChangeWorkoutSheet open={open} onOpenChange={onOpenChange} options={swapOptions(profile)} current={plan.focus}
      onChoose={f => void choose(f)} failure={failure} />
  );
}
