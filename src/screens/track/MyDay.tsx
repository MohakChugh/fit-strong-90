/**
 * My Day, Track's root: "What did I do or record?"
 *
 * One day at a time, every record in the order it happened with where it
 * came from; or, on the other segment, the measures this person keeps. The
 * day, the view and an open Quick Log all live in the URL, so a reload — or
 * Today's `/track?add=glucose` — lands in the same place.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Screen } from '@/components/hig/Screen';
import { YouButton } from '@/components/hig/AppShell';
import { Group, Row } from '@/components/hig/List';
import { Ring } from '@/components/hig/Ring';
import { useStore } from '@/store/useStore';
import { formatDayLong, formatDayRelative, formatDayShort } from './format';
import { draftSaved, draftStorage, loadQuickLogDraft } from './draft';
import { GoalSheet } from './GoalSheet';
import { WHO_WEEKLY_MINUTES, recordedMovement, wholeMinutes } from './movement';
import { addDays, clampDay, weekOf } from './periods';
import { QuickLog, type SavedResult } from './QuickLog';
import { displayPrefs, parseAddParam } from './logKinds';
import { applyChange, mergeChanges, type ParamChange, type View } from './params';
import { assembleDay, recordPath, type DayView } from './timeline';
import { trendRows } from './trends';
import { DateStepper, PrimaryButton, Segmented } from './ui';
import { useToday } from './useToday';

const VIEWS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'trends', label: 'Trends' },
] as const;

/**
 * Where a pushed screen's Back returns to, and what it is called. The shell's
 * Back pops the stack when the person came from `path`, which restores the
 * exact day, view and scroll they left; `search` is for when it cannot (a
 * reload), so the day and view still come back (see useOrigin).
 */
export interface Origin {
  path: string;
  label: string;
  /** "?day=2026-10-01", or absent for none. */
  search?: string;
}

export function MyDay() {
  const state = useStore();
  const current = useToday();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const day = clampDay(params.get('day'), current);
  const view: View = params.get('view') === 'trends' ? 'trends' : 'timeline';
  // `?add=` with no kind opens the list; with a kind, that kind's form.
  const asking = params.has('add');
  const request = parseAddParam(params.get('add'));
  const [chooserOpen, setChooserOpen] = useState(false);
  // A reading whose save the device refused opens again on its form after a
  // reload, as it was left (J17). One only typed waits in its form instead,
  // for when that form is next opened.
  const [unsaved, setUnsaved] = useState(() => {
    const draft = loadQuickLogDraft(draftStorage());
    return draft?.refused && !draftSaved(draft, state.observations) ? draft.kind : undefined;
  });
  const [goalOpen, setGoalOpen] = useState(false);
  const [fresh, setFresh] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState<string>();

  const prefs = useMemo(
    () => displayPrefs(state.settings, state.profile, state.observations),
    [state.settings, state.profile, state.observations],
  );

  // A brief confirmation, then gone. The record itself stays in the list.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // React Router builds each search-param update from the address of the
  // last render, so two updates in one tick — a save moving to its day, then
  // the sheet closing — would overwrite each other. Merge them into one.
  const queued = useRef<ParamChange | undefined>(undefined);
  const change = (next: ParamChange) => {
    const first = queued.current === undefined;
    queued.current = mergeChanges(queued.current, next);
    if (!first) return;
    queueMicrotask(() => {
      const all = queued.current ?? {};
      queued.current = undefined;
      setParams(prev => applyChange(prev, all, current), { replace: true });
    });
  };

  const goToDay = (next: string) => {
    setFresh([]);
    change({ day: next });
  };

  const onSaved = (result: SavedResult) => {
    setFresh(result.ids);
    setNotice(`Saved on this device: ${result.summary}.`);
    // Show the record arriving: on its own day, in the timeline.
    change({ day: result.day, view: 'timeline' });
  };

  const closeLog = (open: boolean) => {
    if (open) return;
    setChooserOpen(false);
    setUnsaved(undefined);
    if (asking) change({ add: null });
  };

  // Links out carry where they came from, so a detail screen's Back says
  // "My Day" and returns here — to this day and view, never to an open sheet.
  const kept = new URLSearchParams(location.search);
  kept.delete('add');
  const search = kept.toString();
  const origin: Origin = { path: location.pathname, label: 'My Day', ...(search ? { search: `?${search}` } : {}) };

  return (
    <Screen
      title="My Day"
      trailing={(
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setChooserOpen(true)}
            aria-label="Add a record"
            className="press-feedback flex size-[44px] items-center justify-center rounded-full text-tint"
          >
            <PlusIcon className="size-[28px]" strokeWidth={2} aria-hidden />
          </button>
          <YouButton />
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <DateStepper
          label={formatDayRelative(day, current)}
          sublabel={day === current || day === addDays(current, -1) ? formatDayLong(day, current) : undefined}
          previousLabel={`Previous day, ${formatDayLong(addDays(day, -1), current)}`}
          nextLabel={day >= current ? 'Next day' : `Next day, ${formatDayLong(addDays(day, 1), current)}`}
          onPrevious={() => goToDay(addDays(day, -1))}
          onNext={() => goToDay(addDays(day, 1))}
          nextDisabled={day >= current}
        />
        <Segmented label="Show" options={VIEWS} value={view} onChange={v => change({ view: v })} />
      </div>

      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] animate-in fade-in slide-in-from-top-1 duration-300">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      {view === 'timeline'
        ? <TimelineView day={day} current={current} fresh={fresh} origin={origin} prefs={prefs} onAdd={() => setChooserOpen(true)} onGoal={() => setGoalOpen(true)} />
        : <TrendsView day={day} current={current} origin={origin} prefs={prefs} onAdd={() => setChooserOpen(true)} onGoal={() => setGoalOpen(true)} />}

      <QuickLog
        open={chooserOpen || asking || unsaved !== undefined}
        onOpenChange={closeLog}
        initial={request ?? (unsaved ? { kind: unsaved } : undefined)}
        onSaved={onSaved}
        prefs={prefs}
        day={day}
      />
      <GoalSheet open={goalOpen} onOpenChange={setGoalOpen} goal={state.settings.weeklyMovementGoalMinutes} />
    </Screen>
  );
}

const SETTLE = 'animate-in fade-in zoom-in-110 duration-500';

function TimelineView({ day, current, fresh, origin, prefs, onAdd, onGoal }: {
  day: string;
  current: string;
  fresh: readonly string[];
  origin: Origin;
  prefs: ReturnType<typeof displayPrefs>;
  onAdd: () => void;
  onGoal: () => void;
}) {
  const { observations, sessions, checkIns, settings } = useStore();
  const view: DayView = useMemo(
    () => assembleDay(day, { observations, sessions, checkIns, settings }, prefs),
    [day, observations, sessions, checkIns, settings, prefs],
  );
  // Keyed on the week's first day, a string, so the sum is not redone on
  // every render for a range object that is new each time.
  const weekFrom = weekOf(day).from;
  const weekly = useMemo(() => recordedMovement(weekOf(weekFrom), observations, sessions), [weekFrom, observations, sessions]);
  const daily = useMemo(() => recordedMovement({ from: day, to: day }, observations, sessions), [day, observations, sessions]);
  const goal = settings.weeklyMovementGoalMinutes;
  const isFresh = (ids: readonly string[]) => ids.some(id => fresh.includes(id));

  const movement = goal !== undefined
    ? (view.empty && weekly.minutes === 0 ? null : (
      <MovementRing
        week={weekFrom}
        current={current}
        day={day}
        minutes={wholeMinutes(weekly.minutes)}
        dayMinutes={wholeMinutes(daily.minutes)}
        enteredMinutes={wholeMinutes(weekly.enteredMinutes)}
        mayRepeat={weekly.mayRepeat}
        goal={goal}
        overlapped={weekly.flags.some(f => f.fault === 'overlap')}
        onPress={onGoal}
      />
    ))
    // Offered on an empty day too: Track is a place to choose it, not only Today (J07).
    : <SetGoalRow onGoal={onGoal} />;

  if (view.empty) {
    return (
      <>
        {movement}
        <div className="flex flex-col items-center gap-5 px-2 pt-6 text-center">
          <p className="text-[length:var(--text-body)] text-muted-foreground">
            {day === current ? 'Nothing recorded yet today.' : `Nothing was recorded on ${formatDayLong(day, current)}.`}
          </p>
          <PrimaryButton onClick={onAdd} className="max-w-xs">
            <PlusIcon className="size-5" aria-hidden />
            Add a record
          </PrimaryButton>
        </div>
      </>
    );
  }

  return (
    <>
      {movement}
      {view.totals.length > 0 && (
        <Group header="Day totals">
          {view.totals.map(t => (
            <Row
              key={t.key}
              as={Link}
              to={recordPath(t.ref)}
              state={origin}
              viewTransition
              label={t.title}
              detail={t.detail}
              value={<span className={isFresh(t.ids) ? `inline-block ${SETTLE}` : undefined}>{t.value}</span>}
              numeric
              chevron
            />
          ))}
        </Group>
      )}
      {view.rows.length > 0 && (
        <Group header="Records">
          {view.rows.map(r => (
            <Row
              key={r.key}
              as={Link}
              to={recordPath(r.ref)}
              state={origin}
              viewTransition
              label={r.title}
              detail={r.detail}
              value={r.value !== undefined ? <span className={isFresh(r.ids) ? `inline-block ${SETTLE}` : undefined}>{r.value}</span> : undefined}
              numeric
              chevron
            />
          ))}
        </Group>
      )}
    </>
  );
}

function MovementRing({ week, current, day, minutes, dayMinutes, enteredMinutes, mayRepeat, goal, overlapped, onPress }: {
  week: string;
  current: string;
  day: string;
  minutes: number;
  dayMinutes: number;
  /** Of `minutes`, those the person entered rather than the app measured. */
  enteredMinutes: number;
  /** Entered workout minutes whose span took in measured activity, which they may already include. */
  mayRepeat: boolean;
  goal: number;
  overlapped: boolean;
  onPress: () => void;
}) {
  const thisWeek = weekOf(current).from === week;
  const unit = thisWeek ? 'minutes this week' : `minutes, week of ${formatDayShort(week, current)}`;
  const dayName = day === current ? 'Today' : format(new Date(`${day}T12:00:00`), 'EEEE');
  const dayText = dayMinutes > 0 ? `${dayName}: ${dayMinutes} min` : `${dayName}: none recorded`;
  const footer = [
    enteredMinutes > 0 && `${enteredMinutes} of these minutes ${enteredMinutes === 1 ? 'was' : 'were'} entered by you rather than measured.`,
    overlapped && 'Two records overlapped in time, so those minutes are counted once.',
    mayRepeat && 'A workout you entered spans the time of a recorded walk or session; if its minutes include that, they are counted twice.',
  ].filter(Boolean).join(' ');
  return (
    <Group footer={footer || undefined}>
      <button
        type="button"
        onClick={onPress}
        aria-label={`Recorded movement: ${minutes} of ${goal} ${unit}. ${dayText}. Change the weekly goal.`}
        className="press-feedback flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-left"
      >
        <Ring value={minutes} goal={goal} label="Recorded movement" unit={unit} size={72} />
        <span aria-hidden className="text-[length:var(--text-subhead)] text-muted-foreground">{dayText}</span>
      </button>
    </Group>
  );
}

function SetGoalRow({ onGoal }: { onGoal: () => void }) {
  return (
    <Group>
      <Row as="button" type="button" label="Set a weekly movement goal" detail={`WHO suggests ${WHO_WEEKLY_MINUTES} minutes a week`} chevron onClick={onGoal} />
    </Group>
  );
}

function TrendsView({ day, current, origin, prefs, onAdd, onGoal }: {
  day: string;
  current: string;
  origin: Origin;
  prefs: ReturnType<typeof displayPrefs>;
  onAdd: () => void;
  onGoal: () => void;
}) {
  const { observations, profile, settings } = useStore();
  const rows = useMemo(() => trendRows(day, { observations, ...(profile ? { profile } : {}) }, prefs, current), [day, observations, profile, prefs, current]);
  const goal = settings.weeklyMovementGoalMinutes;
  // The weekly goal is the person's to see and change from here as well.
  const goalRow = goal === undefined ? <SetGoalRow onGoal={onGoal} /> : (
    <Group>
      <Row as="button" type="button" label="Weekly movement goal" value={`${goal} min`} numeric chevron onClick={onGoal} />
    </Group>
  );

  if (rows.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center gap-5 px-2 pt-6 text-center">
          <p className="text-[length:var(--text-body)] text-muted-foreground">The measures you record will appear here.</p>
          <PrimaryButton onClick={onAdd} className="max-w-xs">
            <PlusIcon className="size-5" aria-hidden />
            Add a record
          </PrimaryButton>
        </div>
        {goalRow}
      </>
    );
  }

  return (
    <>
      <Group footer={day === current ? undefined : `As of ${formatDayLong(day, current)}.`}>
        {rows.map(r => (
          <Row
            key={r.metric}
            as={Link}
            to={r.to}
            state={origin}
            viewTransition
            label={r.title}
            detail={r.detail}
            value={r.value}
            numeric
            chevron
          />
        ))}
      </Group>
      {goalRow}
    </>
  );
}
