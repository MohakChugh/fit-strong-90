import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { planOffer } from '@/health/status';
import { useStore } from '@/store/useStore';
import { GoalSheet, StepsGoalSheet } from '@/screens/track/GoalSheet';
import { today as todayOf } from '@/screens/track/periods';
import { currentStepsGoal } from '@/screens/track/stepsGoal';
import { formatNumber } from '@/screens/track/units';
import { pendingWeeklyGoal, weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { MovePlanBack } from '@/screens/today/StatusSheet';
import { pendingLine, stepsGoalLines, weeklyGoalLines } from './goals';
import { ProgrammeGroup } from './ProgrammeGroup';

/**
 * Goals (journey §16): the weekly movement goal and the daily steps goal,
 * each with its history, then the programme, and the plan shift after a
 * break when one is waiting (D25). A weekly change waits for Monday (B-16);
 * a steps change counts from today. Nothing here is ever raised for the
 * person (D27, D31).
 */
export function GoalsScreen() {
  const { settings } = useStore();
  // Read once per visit, like the rest of Me's view of today.
  const [day] = useState(() => todayOf());
  const [open, setOpen] = useState<'weekly' | 'steps'>();
  const weekly = weeklyGoalOn(settings, day);
  const pending = pendingWeeklyGoal(settings, day);
  const steps = currentStepsGoal(settings);
  const weeklyHistory = weeklyGoalLines(settings);
  const stepsHistory = stepsGoalLines(settings);
  const offer = planOffer(settings.statusPeriods, settings.startDate, day);
  const sheet = (which: 'weekly' | 'steps') => (next: boolean) => setOpen(next ? which : undefined);

  return (
    <Screen title="Goals" back={{ to: '/me', label: 'Me' }}>
      <Group
        header="Movement"
        footer={pending ? pendingLine(pending, weekly) : 'A first goal counts from this week. A change starts on the next Monday, so the week under way keeps its goal.'}
      >
        <Row onClick={() => setOpen('weekly')} label="Weekly movement goal" value={weekly === undefined ? 'No goal' : `${weekly} min a week`} chevron />
      </Group>
      <Group header="Steps" footer="A change counts from today. Earlier days keep the goal they had.">
        <Row onClick={() => setOpen('steps')} label="Daily steps goal" value={steps === undefined ? 'No goal' : `${formatNumber(steps)} steps a day`} chevron />
      </Group>
      {weeklyHistory.length > 0 && (
        <Group header="Weekly goal history">
          {weeklyHistory.map(line => <Row key={line.key} label={line.what} detail={line.when} />)}
        </Group>
      )}
      {stepsHistory.length > 0 && (
        <Group header="Steps goal history">
          {stepsHistory.map(line => <Row key={line.key} label={line.what} detail={line.when} />)}
        </Group>
      )}
      <ProgrammeGroup />
      {offer && <MovePlanBack offer={offer} periods={settings.statusPeriods} startDate={settings.startDate} />}
      <GoalSheet open={open === 'weekly'} onOpenChange={sheet('weekly')} goal={settings.weeklyMovementGoalMinutes} />
      <StepsGoalSheet open={open === 'steps'} onOpenChange={sheet('steps')} goal={steps} />
    </Screen>
  );
}
