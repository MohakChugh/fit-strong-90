import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { CalendarDaysIcon, DumbbellIcon, FootprintsIcon, PersonStandingIcon, SearchIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { YouButton } from '@/components/hig/AppShell';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { useGuided } from '@/hooks/useGuided';
import { isEnrolled } from '@/health/recommend';
import { lastStretch, stretchSummary } from '@/engine/stretch';
import { Wrap } from './controls';
import { guidedRow, programmeWeek, weekView } from './plan';
import { StretchScreen } from './StretchScreen';
import { PlanScreen } from './PlanScreen';
import { ExercisesScreen } from './ExercisesScreen';
import { ExerciseScreen } from './ExerciseScreen';

/**
 * Move: what movement can I do? Three ways to move, then the programme and the
 * exercise library (codex-vision §3). No measurements and no advice feed;
 * those are Track's and Guide's.
 */
function MoveHome() {
  const { data, profile, plan, date } = useGuided();
  const { start, sheet } = useStartMovement();
  const enrolled = isEnrolled(data.settings, data.profile);
  const today = weekView(data, profile, date).find(d => d.isToday);
  const week = programmeWeek(data.settings.startDate, date);
  // Someone outside the programme is shown the way in, never a session to start (D8).
  const guided = guidedRow(enrolled, plan, today);
  const planDetail = !enrolled ? 'Not joined yet' : week.startsOn ? 'Starts soon' : `Week ${week.week} of 12`;

  return (
    <Screen title="Move" trailing={<YouButton />}>
      <Group>
        <Row as={Link} to="/move/stretch" viewTransition icon={<PersonStandingIcon />} label={<Wrap>Stretch</Wrap>}
          detail={stretchSummary(lastStretch(data.sessions))} chevron />
        <Row as={Link} to="/walk" viewTransition icon={<FootprintsIcon />} label={<Wrap>Walk</Wrap>}
          detail="Time, and pace if you allow location" chevron />
        {guided.join ? (
          <Row as={Link} to="/move/plan" viewTransition icon={<DumbbellIcon />} label={<Wrap>Guided session</Wrap>} detail={guided.detail} chevron />
        ) : (
          <Row onClick={() => start('guided', '/session', 'Start session')} icon={<DumbbellIcon />} label={<Wrap>Guided session</Wrap>} detail={guided.detail} chevron />
        )}
      </Group>
      <Group>
        <Row as={Link} to="/move/plan" viewTransition icon={<CalendarDaysIcon />} label={<Wrap>Your plan</Wrap>}
          detail={planDetail} chevron />
        <Row as={Link} to="/move/exercises" viewTransition icon={<SearchIcon />} label={<Wrap>Find an exercise</Wrap>}
          detail="Every stretch and exercise, with its demo" chevron />
      </Group>
      {sheet}
    </Screen>
  );
}

export default function MoveRoutes() {
  return (
    <Routes>
      <Route index element={<MoveHome />} />
      <Route path="stretch" element={<StretchScreen />} />
      <Route path="plan" element={<PlanScreen />} />
      <Route path="exercises" element={<ExercisesScreen />} />
      <Route path="exercises/:id" element={<ExerciseScreen />} />
      {/* A mistyped or retired address lands on Move rather than an empty shell. */}
      <Route path="*" element={<Navigate to="/move" replace />} />
    </Routes>
  );
}
