import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CalendarDaysIcon, ClipboardListIcon, SearchIcon, TargetIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { defaultStartLabel } from '@/components/checkin/copy';
import { HREF, resumeHref, savedRun } from '@/health/recommend';
import { carriedOn } from '@/session/carryOn';
import { loadProgress, type SavedProgress } from '@/session/persistence';
import { workoutNormal } from '@/screens/home/tileLine';
import { programmeWeek, weekView } from '@/screens/move/plan';
import { weekMovement } from '@/screens/today/model';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { GoalSheet } from '@/screens/track/GoalSheet';
import { displayPrefs } from '@/screens/track/logKinds';
import { pendingWeeklyGoal, weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubGate, useHubOrigin } from './hooks';
import { MovementCard } from './MovementCard';
import { actionTarget, movementCard, restDayOf, resumeAllowed, runAction, sessionParts, type HubActionKind } from './movement';
import { goalLine, modeWeek, movementHistory } from './week';
import { WeekStrip } from './WeekStrip';

const REFUSED = new Set(['held', 'stopped', 'gap']);

/**
 * The Workout hub (journey §8.3).
 * - In the programme: today's session, or the rest day with "Stretch instead".
 * - Outside it: the way in, never a session (D35).
 * - Options: Your plan, Find an exercise, Log a workout and Weekly goal.
 * - Then the programme's week against this week's goal, the last workouts,
 *   and the trend.
 */
export default function WorkoutHub() {
  const category = categoryById('workout');
  const g = useHubGate('guided');
  const { guided, state, now, today, status, enrolled } = g;
  const navigate = useNavigate();
  const origin = useHubOrigin(category.title);
  const [goalOpen, setGoalOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const plan = guided.plan;
  const recovery = plan.kind === 'recovery';
  // Read at the hub's clock, which the shared gate's boundaries keep current (render stays pure).
  const runs = [loadProgress(now.getTime(), 'guided')].filter((p): p is SavedProgress => p !== null);
  const savedToday = savedRun(runs, today, 'today');
  const saved = savedToday && resumeAllowed(status, 'guided') ? savedToday : undefined;
  const rest = enrolled ? restDayOf(plan) : undefined;
  const parts = sessionParts(plan);
  const week = programmeWeek(state.settings.startDate, today);
  const card = movementCard({
    mode: 'guided', permission: g.permission, gate: g.gate, status, line: g.line, enrolled, recovery,
    done: enrolled && week.finished,
    title: workoutNormal({ enrolled: true, label: plan.label, minutes: Math.round(plan.totalSeconds / 60) }),
    ...(parts ? { detail: parts } : {}),
    ...(g.recommendation.action.mode === 'guided' && g.recommendation.reason ? { reason: g.recommendation.reason } : {}),
    gaps: g.gaps, stretchOpen: g.stretchOpen,
    ...(rest ? { rest } : {}),
    // What is left as the player will run it, held to today from where it stopped (codex H2-02).
    ...(saved ? { saved: { minutesLeft: leftOf(saved, guided, now), label: saved.plan.label } } : {}),
  });
  const ctx = { mode: 'guided' as const, href: HREF.guided, startLabel: defaultStartLabel('guided', recovery), recovery, ...(saved ? { resumeHref: resumeHref(saved) } : {}) };
  const act = (kind: HubActionKind) => runAction(actionTarget(kind, ctx), {
    start: g.start,
    go: to => navigate(to, { viewTransition: true, state: origin }),
    status: () => setStatusOpen(true),
    local: () => {},
  });

  const planDetail = !enrolled ? 'Not joined yet' : week.startsOn ? 'Starts soon' : week.finished ? 'The 12 weeks are done' : `Week ${week.week} of 12`;
  const goal = weeklyGoalOn(state.settings, today);
  const pending = pendingWeeklyGoal(state.settings, today);
  const goalDetail = pending
    ? `${pending.goal !== undefined ? `${pending.goal} min` : 'No goal'} from ${format(parseISO(pending.from), 'EEEE d MMMM')}`
    : 'Minutes of recorded movement a week, yours to choose';
  const minutes = weekMovement(today, state.observations, state.sessions).minutes;
  const prefs = displayPrefs(state.settings, state.profile, state.observations);
  const programme = enrolled ? weekView(guided.data, guided.profile, today) : undefined;

  return (
    <HubFrame category={category} held={REFUSED.has(card.state)}>
      <MovementCard card={card} onAction={act} />

      <HubSection title="Options">
        <Group>
          <Row as={Link} to="/hub/workout/plan" state={origin} viewTransition icon={<CalendarDaysIcon />} label="Your plan" detail={planDetail} chevron />
          <Row as={Link} to="/hub/workout/exercises" state={origin} viewTransition icon={<SearchIcon />} label="Find an exercise" detail="Every stretch and exercise, with its demo" chevron />
          <Row as={Link} to="/hub/workout/log" state={origin} viewTransition icon={<ClipboardListIcon />} label="Log a workout" detail="Sets you did on your own, marked as logged by you" chevron />
          <Row as="button" type="button" onClick={() => setGoalOpen(true)} icon={<TargetIcon />} label="Weekly goal" value={goal !== undefined ? `${goal} min` : 'Not set'} detail={goalDetail} chevron />
        </Group>
      </HubSection>

      <WeekStrip
        days={modeWeek({
          mode: 'guided', today, sessions: state.sessions, observations: state.observations,
          ...(state.settings.statusPeriods ? { statusPeriods: state.settings.statusPeriods } : {}),
          ...(programme ? { programme } : {}),
        })}
        goal={goalLine(minutes, goal)}
      />
      <HistoryList rows={movementHistory('guided', state.sessions, state.observations, prefs, today)} origin={origin} empty="No workouts yet. Each one shows here, with its sets." />
      <SeeTrends category={category} origin={origin} />

      {g.sheet}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} today={today} periods={state.settings.statusPeriods} startDate={state.settings.startDate} />
      <GoalSheet open={goalOpen} onOpenChange={setGoalOpen} goal={state.settings.weeklyMovementGoalMinutes} />
    </HubFrame>
  );
}

/** Minutes left of a saved session as carrying it on would run it now (`carriedOn`). */
function leftOf(saved: SavedProgress, guided: ReturnType<typeof useHubGate>['guided'], now: Date): number {
  const { data, checkIns, checkIn, profile, date, plan: todayPlan } = guided;
  return carriedOn(saved, { data, checkIns, checkIn, profile, date, todayPlan }, { profile, ...(checkIn ? { checkIn } : {}), now, recent: checkIns }).minutesLeft;
}
