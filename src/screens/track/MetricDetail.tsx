/**
 * Metric Detail: one measure over time. One chart with its target band and
 * the framework that band comes from, a period control, and every reading
 * underneath, each a tap from correcting or deleting it. Days with nothing
 * are gaps, never zeroes; interpretation always carries its source and the
 * not-advice line.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { BarChart, LineChart } from '@/components/hig/Chart';
import { useStore } from '@/store/useStore';
import type { Observation } from '@/health/observation';
import { formatDayShort, unitLabel, type DisplayPrefs } from './format';
import { StepsGoalSheet } from './GoalSheet';
import { displayPrefs, type AddRequest } from './logKinds';
import {
  LIST_PREVIEW, METRICS, dayTotalSlots, metricFromParam, metricNotes, metricRows, observedSlots, pressureSlots, readingSlots,
  readingsOf, type MetricId,
} from './metrics';
import type { Origin } from './MyDay';
import { PairChart } from './PairChart';
import { PERIODS, isPeriod, periodRange, type Period } from './periods';
import { QuickLog, type SavedResult } from './QuickLog';
import {
  NOT_ADVICE, ageForTargets, b12Reference, clinicianOverrides, glucoseGroup, glucoseReference, hba1cReference, healthyWeightBand,
  pressureReference, vitaminDReference, waterAdviceBlocked, type GlucoseGroup, type Reference,
} from './targets';
import { currentStepsGoal, stepsGoalThroughout } from './stepsGoal';
import { recordPath } from './timeline';
import { Hint, Interpretation, PrimaryButton, Segmented } from './ui';
import { formatNumber } from './units';
import { useOrigin } from './useOrigin';
import { useToday } from './useToday';

/** What "Add" opens for each metric. Walking is recorded by a walk, not typed. */
const ADD: Partial<Record<MetricId, AddRequest>> = {
  glucose: { kind: 'glucose' },
  bloodPressure: { kind: 'bloodPressure' },
  weight: { kind: 'weight' },
  waist: { kind: 'waist' },
  water: { kind: 'water' },
  steps: { kind: 'steps' },
  sleep: { kind: 'sleep' },
  hba1c: { kind: 'lab', lab: 'hba1c' },
  b12: { kind: 'lab', lab: 'b12' },
  vitaminD: { kind: 'lab', lab: 'vitaminD' },
};

/** What the empty state's button says, in the metric's own words. */
const ADD_LABEL: Partial<Record<MetricId, string>> = {
  water: 'Add water',
  steps: 'Add steps',
  sleep: 'Add sleep',
  hba1c: 'Add a result',
  b12: 'Add a result',
  vitaminD: 'Add a result',
};

type GlucoseView = GlucoseGroup | 'all';

const GLUCOSE_VIEWS: readonly { id: GlucoseView; label: string }[] = [
  { id: 'beforeMeal', label: 'Before' },
  { id: 'afterMeal', label: 'After' },
  { id: 'other', label: 'Other' },
  { id: 'all', label: 'All' },
];

const GLUCOSE_VIEW_NAMES: Record<GlucoseView, string> = {
  beforeMeal: 'before meals and fasting',
  afterMeal: 'after meals',
  other: 'at other times',
  all: 'at any time',
};

const PERIOD_NAMES: Record<Period, string> = { week: 'last 7 days', month: 'last month', quarter: 'last 3 months', year: 'last year' };

export function MetricDetail() {
  const { kind } = useParams();
  const location = useLocation();
  const metric = metricFromParam(kind);
  if (metric === 'backLeg') return <Navigate to="/track/back" replace state={location.state} />;
  // `movementMinutes` is counted by the week on My Day (D31), so it has no chart of its own.
  if (!metric) return <Navigate to="/track" replace />;
  return <MetricScreen key={metric} metric={metric} />;
}

function MetricScreen({ metric }: { metric: MetricId }) {
  const state = useStore();
  const current = useToday();
  const location = useLocation();
  const { back } = useOrigin();
  const [params, setParams] = useSearchParams();
  const spec = METRICS[metric];
  const isLab = metric === 'hba1c' || metric === 'b12' || metric === 'vitaminD';
  const period: Period = isPeriod(params.get('period')) ? params.get('period') as Period : isLab ? 'year' : 'month';
  const range = periodRange(period, current);
  const prefs = useMemo(() => displayPrefs(state.settings, state.profile, state.observations), [state.settings, state.profile, state.observations]);
  const [logOpen, setLogOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [fresh, setFresh] = useState<readonly string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string>();
  const list = useRef<HTMLDivElement>(null);

  // A brief confirmation, as on My Day. The reading itself stays in the list.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const own = useMemo(() => state.observations.filter(o => spec.kinds.includes(o.kind)), [state.observations, spec.kinds]);
  const glucoseView: GlucoseView = metric === 'glucose'
    ? (GLUCOSE_VIEWS.some(v => v.id === params.get('group')) ? params.get('group') as GlucoseView : own.some(o => glucoseGroup(o.tag) === 'beforeMeal') ? 'beforeMeal' : 'all')
    : 'all';
  const filter = useMemo(
    () => (metric === 'glucose' && glucoseView !== 'all' ? (o: Observation) => glucoseGroup(o.tag) === glucoseView : undefined),
    [metric, glucoseView],
  );

  // One update for several keys: two in one tick would each start from the same old address.
  const set = (changes: Record<string, string>) => setParams(prev => {
    const p = new URLSearchParams(prev);
    for (const [key, value] of Object.entries(changes)) p.set(key, value);
    return p;
  }, { replace: true });

  const rows = useMemo(
    () => metricRows(metric, state.observations, periodRange(period, current), prefs, current, filter),
    [metric, state.observations, period, prefs, current, filter],
  );
  const request = ADD[metric];
  const stepsGoal = currentStepsGoal(state.settings);
  const here: Origin = { path: location.pathname, label: spec.title, ...(location.search ? { search: location.search } : {}) };

  const onSaved = (result: SavedResult) => {
    setFresh(result.ids);
    setNotice(`Saved on this device: ${result.summary}.`);
  };
  // A reading saved outside what is shown — an after-meal glucose under
  // "Before", or a time before the period — is said, with a way to see it.
  const hidden = fresh.length > 0 && !rows.some(r => r.ids.some(id => fresh.includes(id)));

  // The first newly shown row takes the focus, so the button's disappearing does not drop it.
  const expand = () => {
    flushSync(() => setShowAll(true));
    list.current?.querySelectorAll<HTMLElement>('a[href]')[LIST_PREVIEW]?.focus();
  };

  return (
    <Screen
      title={spec.title}
      back={back}
      trailing={request && (
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          aria-label={`Add ${spec.title.toLowerCase()}`}
          className="press-feedback flex size-[44px] items-center justify-center rounded-full text-tint"
        >
          <PlusIcon className="size-[28px]" strokeWidth={2} aria-hidden />
        </button>
      )}
    >
      <div className="flex flex-col gap-3">
        {metric === 'glucose' && (
          <Segmented
            label="Which readings"
            options={GLUCOSE_VIEWS.map(v => ({ id: v.id, label: v.label }))}
            value={glucoseView}
            onChange={v => set({ group: v })}
          />
        )}
        <Segmented label="Period" options={PERIODS} value={period} onChange={p => set({ period: p })} />
        {metric === 'glucose' && <Hint>Showing readings {GLUCOSE_VIEW_NAMES[glucoseView]}, {PERIOD_NAMES[period]}.</Hint>}
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] animate-in fade-in slide-in-from-top-1 duration-300">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
        {hidden && (
          <div className="flex flex-col items-start gap-2 rounded-xl bg-grouped-card px-4 py-3">
            <p className="text-[length:var(--text-subhead)] leading-snug">The reading you just saved is not in this view.</p>
            <button
              type="button"
              onClick={() => set(metric === 'glucose' ? { group: 'all', period: 'year' } : { period: 'year' })}
              className="press-feedback min-h-11 text-[length:var(--text-body)] font-medium text-tint"
            >
              {metric === 'glucose' ? 'Show all readings for the year' : 'Show the last year'}
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-5 px-2 pt-4 text-center">
          <p className="text-[length:var(--text-body)] text-muted-foreground">Not entered in the {PERIOD_NAMES[period]}.</p>
          {request && (
            <PrimaryButton onClick={() => setLogOpen(true)} className="max-w-xs">
              <PlusIcon className="size-5" aria-hidden />
              {ADD_LABEL[metric] ?? 'Add a reading'}
            </PrimaryButton>
          )}
        </div>
      ) : (
        <>
          <MetricChart metric={metric} own={own} range={range} prefs={prefs} current={current} glucoseView={glucoseView} filter={filter} period={period} />
          <Notes metric={metric} own={own} prefs={prefs} glucoseView={glucoseView} current={current} />
          <div ref={list}>
          <Group header={spec.chart === 'bar' && metric !== 'walking' ? 'Days' : 'Readings'}>
            {(showAll ? rows : rows.slice(0, LIST_PREVIEW)).map(r => (
              <Row
                key={r.key}
                as={Link}
                to={recordPath(r.ref)}
                state={here}
                viewTransition
                label={<span className={r.ids.some(id => fresh.includes(id)) ? 'inline-block animate-in fade-in zoom-in-110 duration-500' : undefined}>{r.label}</span>}
                detail={r.detail}
                chevron
              />
            ))}
            {!showAll && rows.length > LIST_PREVIEW && (
              <Row label={<span className="text-tint">Show all {rows.length}</span>} onClick={expand} />
            )}
          </Group>
          </div>
        </>
      )}

      {metric === 'steps' && (
        <>
          {/* The person's own goal: none until they choose one (J07; D27 as revised). */}
          <Group footer="Optional, and yours to change. Each day keeps the goal it had.">
            <Row
              as="button"
              type="button"
              label="Daily steps goal"
              value={stepsGoal !== undefined ? `${formatNumber(stepsGoal)} steps` : 'Not set'}
              chevron
              onClick={() => setGoalOpen(true)}
            />
          </Group>
          <StepsGoalSheet open={goalOpen} onOpenChange={setGoalOpen} goal={stepsGoal} />
        </>
      )}

      {request && (
        <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={request} onSaved={onSaved} prefs={prefs} />
      )}
    </Screen>
  );
}

function unitOf(metric: MetricId, prefs: DisplayPrefs): string {
  switch (metric) {
    case 'glucose': return prefs.glucose;
    case 'weight': return prefs.mass;
    case 'waist': return prefs.length;
    case 'hba1c': return prefs.hba1c;
    case 'b12': return prefs.b12;
    case 'vitaminD': return prefs.vitaminD;
    case 'bloodPressure': return 'mmHg';
    case 'water': return 'ml';
    case 'steps': return 'steps';
    case 'sleep': return 'h';
    case 'walking': return 'min';
    case 'mood': return '1-5';
    case 'backLeg': return '0-10';
  }
}

function MetricChart({ metric, own, range, prefs, current, glucoseView, filter, period }: {
  metric: MetricId;
  own: Observation[];
  range: { from: string; to: string };
  prefs: DisplayPrefs;
  current: string;
  glucoseView: GlucoseView;
  filter?: (o: Observation) => boolean;
  period: Period;
}) {
  const { profile, settings } = useStore();
  const spec = METRICS[metric];
  const unit = unitOf(metric, prefs);
  const caption = `${spec.title}, ${PERIOD_NAMES[period]}, from ${formatDayShort(range.from, current)} to ${formatDayShort(range.to, current)}`;

  if (spec.chart === 'pressure') {
    const age = ageForTargets(profile?.birthYear, current);
    const ref = pressureReference(age, profile?.health.hypertension);
    const slots = pressureSlots(own, range, current).map(s => ({ label: s.label, first: s.systolic, second: s.diastolic }));
    return (
      <div className="flex flex-col gap-2">
        <PairChart
          slots={slots}
          names={['Top number (systolic)', 'Bottom number (diastolic)']}
          unit="mmHg"
          label={caption}
          targets={[
            { value: ref.systolic, label: `${ref.label}: top number ${ref.systolic}` },
            { value: ref.diastolic, label: `${ref.label}: bottom number ${ref.diastolic}` },
          ]}
        />
        <Hint>Dashed lines: {ref.label}.</Hint>
      </div>
    );
  }

  if (spec.chart === 'bar') {
    const kind = spec.kinds[0];
    const points = metric === 'walking' ? observedSlots(kind, own, range, current) : dayTotalSlots(kind, own, range, current);
    // No goal line to drink towards when fluids are, or may need to be, limited (F05).
    // A steps goal is drawn only if it held on every day shown: one line would
    // measure some days against a goal they never had (J07).
    const steps = metric === 'steps' ? stepsGoalThroughout(settings, range.from, range.to) : undefined;
    const goal = metric === 'water' && !waterAdviceBlocked(profile, settings.habits) ? settings.habits?.water?.dailyGoalMl
      : typeof steps === 'number' ? steps : undefined;
    return (
      <div className="flex flex-col gap-2">
        <BarChart
          points={points}
          unit={unitLabel(unit)}
          label={caption}
          {...(goal ? { target: { value: goal, label: 'Your daily goal' } } : {})}
        />
        {goal && <Hint>Dashed line: your daily goal, {formatNumber(goal)} {unit}.</Hint>}
        {steps === 'changed' && <Hint>No goal line: some days in this period had a different goal, or none. My Day shows each day against its own goal.</Hint>}
        {metric === 'walking' && own.some(o => o.source === 'manual' && o.scope === 'sessionObserved' && o.day >= range.from && o.day <= range.to) && (
          <Hint>Includes time you added to a walk for a gap the app could not record. Each walk below says how much.</Hint>
        )}
      </div>
    );
  }

  const kind = spec.kinds[0];
  let reference: Reference | undefined;
  if (metric === 'glucose' && glucoseView !== 'all') reference = glucoseReference(glucoseView, prefs.glucose);
  if (metric === 'weight' && profile?.heightCm) reference = healthyWeightBand(profile.heightCm, prefs.mass);
  if (metric === 'hba1c') reference = hba1cReference(prefs.hba1c, clinicianOverrides(profile));
  if (metric === 'b12') reference = b12Reference(prefs.b12);
  if (metric === 'vitaminD') reference = vitaminDReference(prefs.vitaminD);

  const points = readingSlots(readingsOf(kind, own, prefs, filter), range, current);
  return (
    <div className="flex flex-col gap-2">
      <LineChart
        points={points}
        unit={unitLabel(unit)}
        label={caption}
        missingLabel="Not entered"
        {...(reference?.band ? { band: reference.band } : {})}
        {...(reference?.target ? { target: reference.target } : {})}
      />
      {reference && (
        <Hint>
          {reference.band ? 'Shaded' : 'Dashed line'}: {(reference.band ?? reference.target)!.label}
          {reference.band ? `, ${fmt(reference.band.from)} to ${fmt(reference.band.to)} ${unit}` : ''}. {reference.framework}. {NOT_ADVICE}
        </Hint>
      )}
      {metric === 'glucose' && glucoseView === 'all' && (
        <Hint>Targets differ before and after meals, so “All” has no band. Choose Before or After to see one.</Hint>
      )}
    </div>
  );
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The interpretive lines for a metric, each with its framework and the not-advice line. */
function Notes({ metric, own, prefs, glucoseView, current }: {
  metric: MetricId;
  own: Observation[];
  prefs: DisplayPrefs;
  glucoseView: GlucoseView;
  current: string;
}) {
  const { profile, settings } = useStore();
  const notes = metricNotes(metric, own, { prefs, profile, habits: settings.habits, glucoseView, current });

  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {notes.map(n => (
        <Interpretation
          key={n.key}
          text={n.reading.text}
          tone={n.reading.tone}
          framework={n.reading.framework}
          extra={n.extra ? <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{n.extra}</p> : undefined}
        />
      ))}
    </div>
  );
}
