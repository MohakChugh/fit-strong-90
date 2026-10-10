/**
 * The Trends tab (journey §12.1): Your week, with its ring and the last 8
 * weeks; every category with data, in the registry's order, whether or not
 * it's on Home (A-29, K-33); the recent workouts, stretches and walks, a
 * walk with its kept route drawn small (Plan 6); and Today's log. History is
 * drawn at once, never swept in (M21). Trends decides nothing: the safety
 * surface above it is the shell's (B-02).
 */
import { useContext, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRightIcon, PlusIcon, SmileIcon } from 'lucide-react';
import { GROUPS, categoryById, type CategoryId } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { markInPlace, type Origin } from '@/components/hig/navigation';
import { isDay } from '@/health/observation';
import { statusOn } from '@/health/status';
import { TileIcon } from '@/screens/home/Tile';
import { UrgentContext, useHeld } from '@/screens/home/urgent';
import { displayPrefs } from '@/screens/track/logKinds';
import { addDays, mondayOf } from '@/screens/track/periods';
import { recordPath } from '@/screens/track/timeline';
import { useToday } from '@/screens/track/useToday';
import { RouteThumb } from '@/screens/walk/RouteThumb';
import { setContentState, useStore } from '@/store/useStore';
import type { RouteRecord } from '@/walk/routeRecord';
import { TREND_ORDER, TRENDS, hasData } from './metrics';
import { trendContext, trendRow, type TrendRowView } from './model';
import { activities } from './records';
import { Sparkline } from './Sparkline';
import { WeeklyRings } from './WeeklyRings';
import { YourWeekCard } from './YourWeekCard';
import { WEEK_BRIEF_KEY, briefPause, briefSeen, pendingGoalText, weekFacts, weekRings, weekSentences, withSeen } from './yourWeek';

/** A category's row (§12.1): its icon, its title, its figure with the statistic named, and a small chart. */
function TrendLink({ row, origin }: { row: TrendRowView; origin: Origin }) {
  return (
    <Link to={`/trends/${row.id}`} state={origin} viewTransition className="@container press-feedback block transition-colors active:bg-muted/60">
      <span className="flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 @max-[16rem]:flex-wrap @max-[16rem]:px-2">
        {row.id === 'mood'
          ? <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint/10 text-tint"><SmileIcon className="size-6" strokeWidth={2.1} /></span>
          : <TileIcon category={{ id: row.id as CategoryId, colour: row.colour }} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{row.title}</span>
          <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{row.value}</span>
        </span>
        <Sparkline values={row.spark} colour={`var(${row.colour})`} kind={TRENDS[row.id].family === 'readings' ? 'line' : 'bars'} />
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
      </span>
    </Link>
  );
}

export default function TrendsScreen() {
  const state = useStore();
  const today = useToday();
  const urgent = useContext(UrgentContext);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const thisWeek = mondayOf(today);
  const lastWeek = addDays(thisWeek, -7);
  const asked = params.get('week');
  // A week from the rings, or from Home's brief; never one still to come.
  const week = asked !== null && isDay(asked) && mondayOf(asked) <= thisWeek ? mondayOf(asked) : thisWeek;

  const data = useMemo(() => ({ observations: state.observations, sessions: state.sessions, checkIns: state.checkIns }), [state.observations, state.sessions, state.checkIns]);
  const prefs = useMemo(() => displayPrefs(state.settings, state.profile, state.observations), [state.settings, state.profile, state.observations]);
  const ctx = useMemo(() => trendContext({ today, data, settings: state.settings, profile: state.profile }), [today, data, state.settings, state.profile]);
  const facts = useMemo(() => weekFacts({ week, data, prefs, ctx }), [week, data, prefs, ctx]);
  const rings = useMemo(() => weekRings(today, data, state.settings), [today, data, state.settings]);
  const rows = useMemo(() => TREND_ORDER.filter(id => hasData(id, data)).map(id => trendRow(TRENDS[id], data, prefs, ctx)), [data, prefs, ctx]);
  const recent = useMemo(() => activities(data, prefs, today).slice(0, 5), [data, prefs, today]);
  // A walk's kept route, drawn small beside it (journey §9.5, B-23), as Today's log draws it: our own drawing, never a map picture.
  const routeOf = useMemo(() => new Map(state.records.routes.map(r => [r.walkId as string, r as unknown as RouteRecord])), [state.records.routes]);

  const held = useHeld();
  const pause = briefPause({ status: statusOn(state.settings.statusPeriods, today), urgent: urgent !== undefined, held });
  const goal = rings.find(r => r.week === week)?.goal;
  const pending = week === thisWeek ? pendingGoalText(state.settings, today) : undefined;
  const choose = (next: string) => {
    markInPlace();
    // Reading last week here is opening its brief (B-20).
    if (next === lastWeek) void setContentState(WEEK_BRIEF_KEY, withSeen(briefSeen(state.contentState[WEEK_BRIEF_KEY]), next));
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (next === thisWeek) p.delete('week');
      else p.set('week', next);
      return p;
    }, { replace: true });
  };
  const origin: Origin = { path: location.pathname, label: 'Trends', ...(location.search ? { search: location.search } : {}) };
  const sections = [
    ...GROUPS.filter(g => g.id !== 'learn').map(g => ({ title: g.title, rows: rows.filter(r => r.id !== 'mood' && categoryById(r.id as CategoryId).group === g.id) })),
    // Mood isn't a category: it comes only from v4 backups, and is never hidden (D74).
    { title: 'Other records', rows: rows.filter(r => r.id === 'mood') },
  ].filter(s => s.rows.length > 0);

  if (ctx.since === undefined) {
    return (
      <Screen title="Trends">
        <div className="flex flex-col items-start gap-3 rounded-xl bg-grouped-card p-4">
          <h2 className="text-[length:var(--text-title-2)] font-semibold">Nothing recorded yet</h2>
          <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Each reading, walk, stretch and workout you record shows here, week by week.</p>
          <Link to="/day/today?add=" state={origin} className="press-feedback inline-flex min-h-12 items-center gap-2 rounded-full bg-tint px-5 text-[length:var(--text-body)] font-semibold text-on-tint">
            <PlusIcon className="size-5" aria-hidden />
            Add a record
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Trends">
      <YourWeekCard
        title={facts.title}
        name={facts.name}
        minutes={facts.minutes}
        {...(goal !== undefined ? { goal } : {})}
        sentences={pause ? [] : weekSentences(facts, prefs)}
        {...(pause ? { pause } : {})}
        {...(pending ? { pending } : {})}
        {...(week === thisWeek ? { onLastWeek: () => choose(lastWeek) } : { onThisWeek: () => choose(thisWeek) })}
      />
      <WeeklyRings rings={rings} chosen={week} onChoose={choose} />
      {sections.map(s => (
        <Group key={s.title} header={s.title}>
          {s.rows.map(r => <TrendLink key={r.id} row={r} origin={origin} />)}
        </Group>
      ))}
      {recent.length > 0 && (
        <Group header="Recent workouts, stretches and walks">
          {recent.map(r => (
            <Row
              key={r.key} as={Link} to={recordPath(r.ref)} state={origin} label={r.heading} detail={r.detail} chevron
              icon={r.ref.type === 'walk' && routeOf.has(r.ref.id) ? <RouteThumb walkId={r.ref.id} route={routeOf.get(r.ref.id)!} /> : undefined}
            />
          ))}
        </Group>
      )}
      <Group>
        <Row as={Link} to="/day/today" state={origin} label="See today’s log" detail="Every record of today, to correct or delete" chevron />
      </Group>
    </Screen>
  );
}
