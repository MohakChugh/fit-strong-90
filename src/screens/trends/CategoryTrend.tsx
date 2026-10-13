/**
 * A category's trend, `/trends/:id` (journey §12.2): the period and its
 * pager, the headline and its change, the chart with its list and summary,
 * the spread and the notes, and for movement the records behind it. Week
 * first unless the address says otherwise (B-10). Labs are their results,
 * dated, with no period (A-45). Food is its estimates, only with them on
 * (D114). It decides nothing and has no Start (J§4.2): the hub, one tap
 * away, has those.
 */
import { useMemo } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { StatGrid } from '@/components/hig/StatGrid';
import { markInPlace, type Origin } from '@/components/hig/navigation';
import { numbersView } from '@/food/level';
import { mealsIn } from '@/food/records';
import { isDay } from '@/health/observation';
import { labFrom } from '@/screens/hub/reading';
import { BackLegChart } from '@/screens/track/BackLegChart';
import { assembleBackLeg } from '@/screens/track/backLegSeries';
import { LAB_OPTIONS, displayPrefs, type LabKind } from '@/screens/track/logKinds';
import { recordPath } from '@/screens/track/timeline';
import { Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { RouteThumb } from '@/screens/walk/RouteThumb';
import { useStore } from '@/store/useStore';
import type { RouteRecord } from '@/walk/routeRecord';
import { FOOD_METRICS, foodView, isFoodMetric, type FoodMetric } from './food';
import { trendDef, type TrendDef, type TrendId } from './metrics';
import { dailyView, labsView, latestLab, readingsView, trendContext } from './model';
import { PeriodControl } from './PeriodControl';
import { anchorOf, isCurrent, isTrendPeriod, nextWindow, pagerLabels, previousWindow, windowOf, type TrendPeriod } from './periods';
import { activities } from './records';
import { TrendChart } from './TrendChart';
import { TrendHeadlines } from './TrendHeadlines';

/** The records listed under a movement trend, for the window shown. */
const RECORDS: Partial<Record<TrendId, string>> = { workout: 'Workouts', stretch: 'Stretches', walk: 'Walks' };

export default function CategoryTrend() {
  const { id } = useParams();
  const def = trendDef(id);
  // An id with no trend is an address that has moved (journey §19.3).
  if (!def) return <Navigate to="/home?moved=1" replace />;
  if (def.family === 'labs') return <LabsTrend def={def} />;
  return def.id === 'food' ? <FoodTrend def={def} /> : <PeriodTrend key={def.id} def={def} />;
}

/** The records, the person's units and the day context, as every trend reads them. */
function useTrendData() {
  const state = useStore();
  const today = useToday();
  const data = useMemo(() => ({ observations: state.observations, sessions: state.sessions, checkIns: state.checkIns }), [state.observations, state.sessions, state.checkIns]);
  const prefs = useMemo(() => displayPrefs(state.settings, state.profile, state.observations), [state.settings, state.profile, state.observations]);
  const ctx = useMemo(
    () => trendContext({ today, data, settings: state.settings, profile: state.profile }),
    [today, data, state.settings, state.profile],
  );
  return { state, today, data, prefs, ctx };
}

/** Where the records are added and corrected: the hub, and for Workout, logging one (B-14). */
function HubLinks({ def, origin, search = '' }: { def: TrendDef; origin: Origin; search?: string }) {
  if (!def.hub) return null;
  return (
    <Group>
      {def.id === 'workout' && <Row as={Link} to="/hub/workout/log" state={origin} label="Log a workout" detail="Sets you did on your own" chevron />}
      <Row as={Link} to={`${def.hub}${search}`} state={origin} label={`Go to ${def.title}`} chevron />
    </Group>
  );
}

function PeriodTrend({ def }: { def: TrendDef }) {
  const { state, today, data, prefs, ctx } = useTrendData();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const asked = params.get('period');
  // Week first, wherever the trend was opened from (B-10).
  const period: TrendPeriod = isTrendPeriod(asked) ? asked : 'week';
  const at = params.get('at');
  const anchor = at !== null && isDay(at) && at <= today ? at : today;
  const w = useMemo(() => windowOf(period, anchor), [period, anchor]);
  const view = useMemo(() => (def.family === 'readings' ? readingsView : dailyView)({ def, window: w, data, prefs, ctx }), [def, w, data, prefs, ctx]);
  // D21's chart, for a month or more: a week is too short to show loading against symptoms.
  const backLeg = useMemo(
    () => (def.id === 'back' && period !== 'week' ? assembleBackLeg(w, state.observations, state.sessions, state.checkIns, state.profile) : undefined),
    [def.id, period, w, state.observations, state.sessions, state.checkIns, state.profile],
  );
  const records = useMemo(
    () => (RECORDS[def.id] ? activities(data, prefs, today).filter(r => r.kind === def.id && r.day >= w.from && r.day <= w.to) : []),
    [def.id, data, prefs, today, w],
  );
  // A walk's kept route, drawn small beside it (journey §9.5, B-23), as Today's log draws it: our own drawing, never a map picture.
  const routeOf = useMemo(() => new Map(state.records.routes.map(r => [r.walkId as string, r as unknown as RouteRecord])), [state.records.routes]);
  // Paging and the period change this screen's address, not the screen: focus stays on the control used.
  const change = (next: { period?: TrendPeriod; at?: string | null }) => {
    markInPlace();
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (next.period) p.set('period', next.period);
      // Today's window keeps no anchor, so it stays today's (H3-10).
      if (next.at === null) p.delete('at');
      else if (next.at) p.set('at', next.at);
      return p;
    }, { replace: true });
  };
  const earlier = previousWindow(w);
  const origin: Origin = { path: location.pathname, label: def.title, ...(location.search ? { search: location.search } : {}) };

  return (
    <Screen title={def.title} back={{ to: '/trends', label: 'Trends' }}>
      <PeriodControl
        period={period}
        onPeriod={p => change({ period: p })}
        title={view.title}
        labels={pagerLabels(period)}
        // Back as far as the window holding the first record; forward as far as today's.
        canPrevious={ctx.since !== undefined && earlier.to >= ctx.since}
        canNext={!isCurrent(w, today)}
        onPrevious={() => change({ at: anchorOf(earlier, today) })}
        onNext={() => change({ at: anchorOf(nextWindow(w), today) })}
      />
      <TrendHeadlines headline={view.headline} change={view.change} {...(view.meter ? { meter: view.meter } : {})} />
      <section aria-label={`${def.title} chart`} className="rounded-xl bg-grouped-card p-4">
        <TrendChart model={view.chart} label={`${def.title}, ${view.title}`} summary={view.summary} table={view.table} view={`${period}:${w.from}`} origin={origin} />
      </section>
      <StatGrid items={view.stats} />
      {view.notes.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          {view.notes.map(note => <p key={note} className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{note}</p>)}
        </div>
      )}
      {backLeg && (
        <Group header="Pain against loading">
          <div className="p-4"><BackLegChart data={backLeg} current={today} /></div>
        </Group>
      )}
      {records.length > 0 && (
        <Group header={RECORDS[def.id]}>
          {records.map(r => (
            <Row
              key={r.key} as={Link} to={recordPath(r.ref)} state={origin} label={r.label} detail={r.detail} chevron
              icon={r.ref.type === 'walk' && routeOf.has(r.ref.id) ? <RouteThumb walkId={r.ref.id} route={routeOf.get(r.ref.id)!} /> : undefined}
            />
          ))}
        </Group>
      )}
      <HubLinks def={def} origin={origin} />
    </Screen>
  );
}

/**
 * Food's trend (D114), only while estimates are on: without them its address
 * opens the Food hub with its query and navigation state (D74), and nothing
 * about meals is worked out.
 */
function FoodTrend({ def }: { def: TrendDef }) {
  const { profile } = useStore();
  const location = useLocation();
  const numbers = numbersView(profile);
  if (!numbers.show) return <Navigate to={{ pathname: '/hub/food', search: location.search }} replace state={location.state} />;
  return <FoodEstimates def={def} ranges={numbers.ranges} />;
}

/** Energy or Carbs, with the period and its pager, and no comparison. */
function FoodEstimates({ def, ranges }: { def: TrendDef; ranges: boolean }) {
  const { state, today, ctx } = useTrendData();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const meals = useMemo(() => mealsIn(state.records), [state.records]);
  const asked = params.get('period');
  const period: TrendPeriod = isTrendPeriod(asked) ? asked : 'week';
  const at = params.get('at');
  const anchor = at !== null && isDay(at) && at <= today ? at : today;
  const chosen = params.get('metric');
  const metric: FoodMetric = isFoodMetric(chosen) ? chosen : 'kcal';
  const w = useMemo(() => windowOf(period, anchor), [period, anchor]);
  const view = useMemo(() => foodView({ metric, window: w, meals, ranges, ctx }), [metric, w, meals, ranges, ctx]);
  // The period, the pager and Energy or Carbs change this screen's address, not the screen, as a trend's own do.
  const change = (next: { period?: TrendPeriod; at?: string | null; metric?: FoodMetric }) => {
    markInPlace();
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (next.period) p.set('period', next.period);
      // Today's window keeps no anchor, so it stays today's (H3-10).
      if (next.at === null) p.delete('at');
      else if (next.at) p.set('at', next.at);
      if (next.metric) p.set('metric', next.metric);
      return p;
    }, { replace: true });
  };
  const earlier = previousWindow(w);
  // Back as far as the first meal or the first record, whichever came first.
  const since = [ctx.since, ...meals.map(m => m.day)].filter((d): d is string => d !== undefined).sort()[0];
  const origin: Origin = { path: location.pathname, label: def.title, ...(location.search ? { search: location.search } : {}) };

  return (
    <Screen title={def.title} back={{ to: '/trends', label: 'Trends' }}>
      <Segmented label="What to show" options={FOOD_METRICS.map(m => ({ id: m.id, label: m.label }))} value={metric} onChange={m => change({ metric: m })} />
      <PeriodControl
        period={period}
        onPeriod={p => change({ period: p })}
        title={view.title}
        labels={pagerLabels(period)}
        canPrevious={since !== undefined && earlier.to >= since}
        canNext={!isCurrent(w, today)}
        onPrevious={() => change({ at: anchorOf(earlier, today) })}
        onNext={() => change({ at: anchorOf(nextWindow(w), today) })}
      />
      <TrendHeadlines headline={view.headline} change={view.change} />
      <section aria-label={`${def.title} chart`} className="rounded-xl bg-grouped-card p-4">
        <TrendChart model={view.chart} label={`${def.title}, ${view.title}`} summary={view.summary} table={view.table} view={`${metric}:${period}:${w.from}`} origin={origin} />
      </section>
      <StatGrid items={view.stats} />
      {view.notes.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          {view.notes.map(note => <p key={note} className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{note}</p>)}
        </div>
      )}
      <HubLinks def={def} origin={origin} />
    </Screen>
  );
}

function LabsTrend({ def }: { def: TrendDef }) {
  const { state, today, data, prefs } = useTrendData();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const asked = params.get('metric');
  // The lab the address names (B-14), or the latest result of any, as the Labs row names it (H3-20); HbA1c when none has any.
  const lab: LabKind = asked !== null ? labFrom(asked) : latestLab(state.observations, prefs)?.lab ?? 'hba1c';
  const view = useMemo(() => labsView(lab, data, prefs, today), [lab, data, prefs, today]);
  const choose = (next: LabKind) => {
    markInPlace();
    setParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('metric', next);
      return p;
    }, { replace: true });
  };
  const origin: Origin = { path: location.pathname, label: def.title, ...(location.search ? { search: location.search } : {}) };

  return (
    <Screen title={def.title} back={{ to: '/trends', label: 'Trends' }}>
      <Segmented label="Which result" options={LAB_OPTIONS.map(o => ({ id: o.kind, label: o.title }))} value={lab} onChange={choose} />
      <TrendHeadlines headline={view.headline} change={view.change} />
      <section aria-label={`${view.title} chart`} className="rounded-xl bg-grouped-card p-4">
        <TrendChart model={view.chart} label={`${view.title} results`} summary={view.summary} table={view.table} view={lab} origin={origin} />
      </section>
      <HubLinks def={def} origin={origin} search={`?metric=${lab}`} />
    </Screen>
  );
}
