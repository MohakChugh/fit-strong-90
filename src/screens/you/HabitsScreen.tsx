import { useState, type ReactNode } from 'react';
import { ArmchairIcon, BellRingIcon, CalendarPlusIcon, FootprintsIcon, GlassWaterIcon, MoonIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { useStore } from '@/store/useStore';
import { STATUS_LABEL, statusOn } from '@/health/status';
import { dayOf, nowAt } from '@/health/observation';
import { HABIT_LABEL, NOT_ADVICE } from '@/reminders/copy';
import type { HabitId } from '@/reminders/schedule';
import { waterBlock } from '@/reminders/water';
import { habitOffered } from '@/reminders/advice';
import { calendarStillReminds } from '@/reminders/calendarNotice';
import { CalendarStill } from './CalendarStill';
import { CalendarSheet } from './CalendarSheet';
import { Notice, Toggle } from './controls';
import { MealWalkSheet, QuietSheet, SittingSheet, WaterSheet } from './HabitSheets';
import { isSetUp, withEnabled } from './habitOptions';
import { clockFormat, habitLine } from './summaries';
import { changeHabits } from './write';

type Open = HabitId | 'quiet' | 'calendar' | undefined;

const ICON: Record<HabitId, ReactNode> = {
  water: <GlassWaterIcon />,
  sittingBreak: <ArmchairIcon />,
  mealWalk: <FootprintsIcon />,
};

/**
 * One row per habit, each off until chosen. The page says plainly which
 * reminders reach the person when, because on iPhone the honest answer is
 * "only while the app is open" unless Calendar takes them over.
 */
export function HabitsScreen() {
  const { settings, profile } = useStore();
  const habits = settings.habits;
  const [open, setOpen] = useState<Open>();
  const [problem, setProblem] = useState<string>();

  const write = async (edit: Parameters<typeof changeHabits>[0]) => {
    const saved = await changeHabits(edit);
    setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`);
  };

  const toggle = (habit: HabitId, on: boolean) => {
    // Turning on for the first time asks the minimum, in the habit's sheet.
    if (on && !isSetUp(habits, habit, profile)) setOpen(habit);
    else void write(h => withEnabled(h, habit, on));
  };

  const sheet = (which: Open) => (next: boolean) => setOpen(next ? which : undefined);
  const quiet = habits?.quietHours;
  // Read once per visit, like the rest of the screen's view of today.
  const [today] = useState(() => dayOf(nowAt()));
  const status = statusOn(settings.statusPeriods, today);

  return (
    <Screen title="Habits & reminders" back={{ to: '/you', label: 'You' }}>
      <CalendarStill still={calendarStillReminds(habits, profile, today)} />
      {status !== 'normal' && (
        <Notice>{`Your status is ${STATUS_LABEL[status]}, so reminders in the app stay quiet until it is Normal again. You can change it on Today.`}</Notice>
      )}
      <Group header="Reminders" footer={`Every reminder starts off. Turn on only what helps. ${NOT_ADVICE}`}>
        {(['water', 'sittingBreak', 'mealWalk'] as const).map(habit => {
          // Water follows the fluid answer; standing and walking follow the Guide (R03).
          const blocked = (habit === 'water' && !!waterBlock(profile, habits)) || !habitOffered(habit, profile, habits);
          const on = !!habits?.[habit]?.enabled && !blocked;
          return (
            <div key={habit} className="flex min-h-[3.25rem] items-center gap-3 pr-4">
              <button
                type="button"
                onClick={() => setOpen(habit)}
                className="press-feedback flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors active:bg-muted/60"
              >
                <span className="flex size-7 shrink-0 items-center justify-center text-tint [&_svg]:size-5" aria-hidden>{ICON[habit]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--text-body)] leading-snug">{HABIT_LABEL[habit]}</span>
                  <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{habitLine(habit, habits, profile, clockFormat)}</span>
                </span>
              </button>
              <Toggle checked={on} disabled={blocked} onChange={next => toggle(habit, next)} label={HABIT_LABEL[habit]} />
            </div>
          );
        })}
      </Group>

      <Group
        header="While the app is open"
        footer="On iPhone, a web app cannot remind you once it is closed: that needs a server to send the reminder, and this app has none. Calendar can do it instead. Using Calendar too? Turn banners off so you are not reminded twice."
      >
        <Row
          icon={<BellRingIcon />}
          label="Banners in the app"
          detail="A short note near the bottom of the screen, for a few seconds. The app's icon counts any you have not answered."
          accessory={<Toggle checked={habits?.inApp !== false} onChange={on => void write(h => ({ ...h, inApp: on }))} label="Banners in the app" />}
        />
        <Row
          onClick={() => setOpen('quiet')}
          icon={<MoonIcon />}
          label="Quiet hours"
          detail={quiet ? `${clockFormat(parseMinutes(quiet.from))} to ${clockFormat(parseMinutes(quiet.to))}` : 'Off'}
          chevron
        />
      </Group>

      <Group header="When the app is closed">
        <Row
          onClick={() => setOpen('calendar')}
          icon={<CalendarPlusIcon />}
          label="Add to Calendar"
          detail="Calendar can remind you even when this app is closed."
          chevron
        />
      </Group>

      {problem && <Notice tone="error">{problem}</Notice>}

      <WaterSheet open={open === 'water'} onOpenChange={sheet('water')} />
      <SittingSheet open={open === 'sittingBreak'} onOpenChange={sheet('sittingBreak')} />
      <MealWalkSheet open={open === 'mealWalk'} onOpenChange={sheet('mealWalk')} />
      <QuietSheet open={open === 'quiet'} onOpenChange={sheet('quiet')} />
      <CalendarSheet open={open === 'calendar'} onOpenChange={sheet('calendar')} />
    </Screen>
  );
}

function parseMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
