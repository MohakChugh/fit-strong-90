import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { useStore } from '@/store/useStore';
import type { HabitSettings, Meal } from '@/types/habits';
import type { MedicineAnswer } from '@/types/profile';
import type { StoreResult } from '@/store/db';
import { MEAL_LABEL, MEAL_WALK_EVIDENCE, MEAL_WALK_SOURCE, NOT_ADVICE, SITTING_EVIDENCE, SITTING_SOURCE } from '@/reminders/copy';
import { MEALS, isQuiet, windowTimes } from '@/reminders/schedule';
import { parseClock } from '@/reminders/time';
import { conditionBlock, fluidRestriction } from '@/reminders/water';
import { habitInstead, type MovementHabit } from '@/reminders/advice';
import { exportedStill } from '@/reminders/calendarNotice';
import { dayOf, nowAt } from '@/health/observation';
import { CalendarStill } from './CalendarStill';
import { CheckRows, ChoiceRows, Notice, PlainButton, PrimaryButton, Segmented, TimeField, Toggle } from './controls';
import {
  DEFAULT_FINISH,
  DEFAULT_QUIET,
  DEFAULT_SITTING,
  DEFAULT_WATER,
  GLASS_SIZES,
  SITTING_EVERY,
  WATER_EVERY,
  mealProblem,
  parseGoal,
  windowProblem,
} from './habitOptions';
import { clockFormat, plural } from './summaries';
import { changeHabits, setFluidRestriction } from './write';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOURS: Record<number, string> = { 60: '1 h', 90: '1½ h', 120: '2 h', 180: '3 h' };

/** A sheet's save: closes it when the write lands, says why when it does not. */
function useSave(close: () => void) {
  const [problem, setProblem] = useState<string>();
  const save = async (write: () => Promise<StoreResult>) => {
    const saved = await write();
    if (saved.ok) close();
    else setProblem(`That did not save. ${saved.failure.message}`);
  };
  /** The common case: a change to the habits, worked out from the latest stored ones. */
  const run = (edit: (habits: HabitSettings) => HabitSettings) => save(() => changeHabits(edit));
  return { problem, run, save };
}

function Footnote({ children }: { children: ReactNode }) {
  return <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{children}</p>;
}

/** What a window gives, in the person's own times, quiet hours taken out. */
function windowSummary(from: string, to: string, every: number, quiet: HabitSettings['quietHours']): string {
  const problem = windowProblem(from, to, every);
  if (problem) return problem;
  const all = windowTimes(from, to, every);
  const times = all.filter(minute => !isQuiet(minute, quiet));
  const hushed = all.length - times.length;
  const note = hushed > 0 ? ` Quiet hours leave out ${plural(hushed, 'other')}.` : '';
  if (times.length === 0) return 'Every one of these falls in your quiet hours.';
  if (times.length === 1) return `One reminder a day, at ${clockFormat(times[0])}.${note}`;
  return `${times.length} reminders a day, from ${clockFormat(times[0])} to ${clockFormat(times[times.length - 1])}.${note}`;
}

/**
 * A standing or walking habit the Guide does not offer this person — an open
 * foot wound or active Charcot foot — says why, with what it offers instead,
 * and cannot be turned on here. Its setup is kept for when that changes.
 */
function NotOffered({ habit, instead, close }: { habit: MovementHabit; instead: string; close: () => void }) {
  const { settings } = useStore();
  const [today] = useState(() => dayOf(nowAt()));
  const still = exportedStill(settings.habits, habit, today);
  return (
    <>
      <CalendarStill still={still ? [still] : []} />
      <Group footer="Your care team can say when it is safe again. If your health answers change, this follows them.">
        <Row label={habit === 'sittingBreak' ? 'Sitting-break reminders are off' : 'Walk reminders are off'} detail={instead} />
        <Row as={Link} to="/you/profile" viewTransition onClick={close} label="Profile & health" chevron />
      </Group>
      <Footnote>{NOT_ADVICE}</Footnote>
    </>
  );
}

function Actions({ problem, primary, disabled, onPrimary, onTurnOff }: {
  problem?: string;
  primary: string;
  disabled?: boolean;
  onPrimary: () => void;
  /** Present when the habit is on. */
  onTurnOff?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {problem && <Notice tone="error">{problem}</Notice>}
      <PrimaryButton disabled={disabled} onClick={onPrimary}>{primary}</PrimaryButton>
      {onTurnOff && <PlainButton onClick={onTurnOff}>Turn off</PlainButton>}
    </div>
  );
}

// ============================================================================
// Water
// ============================================================================

export function WaterSheet({ open, onOpenChange }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Water" detent="large">
      {open && <WaterBody close={() => onOpenChange(false)} />}
    </Sheet>
  );
}

const LIMIT_CHOICES: { value: 'no' | 'yes' | 'unsure'; label: string }[] = [
  { value: 'no', label: 'No, there is no limit' },
  { value: 'yes', label: 'Yes, I have a fluid limit' },
  { value: 'unsure', label: 'Not sure' },
];

function WaterBody({ close }: { close: () => void }) {
  const { settings, profile } = useStore();
  const habits = settings.habits;
  const stored = habits?.water;
  const answered = fluidRestriction(profile, habits);
  const [limit, setLimit] = useState<MedicineAnswer | undefined>(answered);
  const [glassMl, setGlass] = useState(stored?.glassMl ?? DEFAULT_WATER.glassMl);
  const [every, setEvery] = useState(stored?.everyMinutes ?? DEFAULT_WATER.everyMinutes);
  const [from, setFrom] = useState(stored?.from ?? DEFAULT_WATER.from);
  const [to, setTo] = useState(stored?.to ?? DEFAULT_WATER.to);
  const [goalText, setGoalText] = useState(stored?.dailyGoalMl ? String(stored.dailyGoalMl) : '');
  const { problem, save } = useSave(close);
  const goalId = useId();
  const [today] = useState(() => dayOf(nowAt()));
  const waterStill = exportedStill(habits, 'water', today);

  // The profile's reasons come first: nothing answered here can lift them.
  const profileReason = conditionBlock(profile);
  if (profileReason) {
    return (
      <>
        <CalendarStill still={waterStill ? [waterStill] : []} />
        <Group footer="Your care team knows what is right for you. If your health answers change, this follows them.">
          <Row label="Water reminders are off" detail={profileReason} />
          <Row as={Link} to="/you/profile" viewTransition onClick={close} label="Profile & health" chevron />
        </Group>
        <Footnote>{NOT_ADVICE}</Footnote>
      </>
    );
  }

  const goal = parseGoal(goalText);
  const on = !!stored?.enabled && answered === false;

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        Has your care team told you to limit how much you drink? Kidney and heart conditions sometimes need that.
      </p>
      <Group>
        <ChoiceRows
          label="Has your care team told you to limit how much you drink?"
          options={LIMIT_CHOICES}
          value={limit === undefined ? undefined : limit === 'unsure' ? 'unsure' : limit ? 'yes' : 'no'}
          onChange={choice => setLimit(choice === 'unsure' ? 'unsure' : choice === 'yes')}
        />
      </Group>

      {limit === true && <Notice>Then the app will not remind you to drink. Follow the plan your care team gave you.</Notice>}
      {limit === 'unsure' && <Notice>Then the app will not remind you to drink until you know. Ask your care team, and change this answer here or in Profile & health.</Notice>}
      {limit !== false && limit !== undefined && <CalendarStill still={waterStill ? [waterStill] : []} />}

      {limit === false && (
        <>
          <Group header="Your glass">
            <div className="p-3">
              <Segmented label="Glass size" options={GLASS_SIZES.map(ml => ({ value: String(ml), label: `${ml} ml` }))} value={String(glassMl)} onChange={v => setGlass(Number(v))} />
            </div>
          </Group>

          <Group header="Remind me every" footer={windowSummary(from, to, every, habits?.quietHours)}>
            <div className="p-3">
              <Segmented label="Remind me every" options={WATER_EVERY.map(m => ({ value: String(m), label: HOURS[m] }))} value={String(every)} onChange={v => setEvery(Number(v))} />
            </div>
            <TimeField id="water-from" label="From" value={from} onChange={setFrom} />
            <TimeField id="water-to" label="Until" value={to} onChange={setTo} />
          </Group>

          <Group
            header="Daily goal, if you want one"
            footer={goal.ok
              ? 'Needs differ with heat, activity and health, so there is no suggested amount. Agree a goal with your care team, or leave it empty. Reminders stop for the day once a goal is met.'
              : goal.message}
          >
            <label htmlFor={goalId} className="flex min-h-[3.25rem] items-center gap-3 px-4 py-1.5">
              <span className="min-w-0 flex-1 text-[length:var(--text-body)]">Goal</span>
              <input
                id={goalId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={goalText}
                placeholder="None"
                aria-invalid={!goal.ok}
                onChange={e => setGoalText(e.target.value)}
                className="numeric min-h-11 w-28 rounded-lg bg-muted/60 px-3 text-right text-[length:var(--text-body)] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-tint/40"
              />
              <span className="text-[length:var(--text-body)] text-muted-foreground">ml</span>
            </label>
          </Group>
        </>
      )}

      <Actions
        problem={problem}
        primary={limit !== false && limit !== undefined ? 'Save' : on ? 'Save' : 'Turn on'}
        disabled={limit === undefined || (limit === false && (!!windowProblem(from, to, every) || !goal.ok))}
        onPrimary={() => {
          if (limit === undefined) return;
          const dailyGoalMl = goal.ok ? goal.value : undefined;
          void save(() => setFluidRestriction(limit, limit === false
            ? { enabled: true, glassMl, everyMinutes: every, from, to, ...(dailyGoalMl ? { dailyGoalMl } : {}) }
            : undefined));
        }}
        {...(on && limit === false ? { onTurnOff: () => void save(() => changeHabits(h => (h.water ? { ...h, water: { ...h.water, enabled: false } } : h))) } : {})}
      />
      <Footnote>{NOT_ADVICE}</Footnote>
    </>
  );
}

// ============================================================================
// Sitting breaks
// ============================================================================

export function SittingSheet({ open, onOpenChange }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sitting breaks" detent="large">
      {open && <SittingBody close={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function SittingBody({ close }: { close: () => void }) {
  const { settings, profile } = useStore();
  const stored = settings.habits?.sittingBreak;
  const [every, setEvery] = useState(stored?.everyMinutes ?? DEFAULT_SITTING.everyMinutes);
  const [from, setFrom] = useState(stored?.from ?? DEFAULT_SITTING.from);
  const [to, setTo] = useState(stored?.to ?? DEFAULT_SITTING.to);
  const { problem, run } = useSave(close);
  const on = !!stored?.enabled;
  const instead = habitInstead('sittingBreak', profile, settings.habits);
  if (instead) return <NotOffered habit="sittingBreak" instead={instead} close={close} />;

  return (
    <>
      <Group header="Remind me every" footer={windowSummary(from, to, every, settings.habits?.quietHours)}>
        <div className="p-3">
          <Segmented label="Remind me every" options={SITTING_EVERY.map(m => ({ value: String(m), label: `${m} min` }))} value={String(every)} onChange={v => setEvery(Number(v))} />
        </div>
        <TimeField id="sitting-from" label="From" value={from} onChange={setFrom} />
        <TimeField id="sitting-to" label="Until" value={to} onChange={setTo} />
      </Group>

      <Footnote>{SITTING_EVIDENCE} A few minutes of easy walking or simple movement is enough. ({SITTING_SOURCE}.)</Footnote>

      <Actions
        problem={problem}
        primary={on ? 'Save' : 'Turn on'}
        disabled={!!windowProblem(from, to, every)}
        onPrimary={() => void run(h => ({ ...h, sittingBreak: { enabled: true, everyMinutes: every, from, to } }))}
        {...(on ? { onTurnOff: () => void run(h => (h.sittingBreak ? { ...h, sittingBreak: { ...h.sittingBreak, enabled: false } } : h)) } : {})}
      />
      <Footnote>{NOT_ADVICE}</Footnote>
    </>
  );
}

// ============================================================================
// Walk after meals
// ============================================================================

export function MealWalkSheet({ open, onOpenChange }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Walk after meals" detent="large">
      {open && <MealWalkBody close={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function MealWalkBody({ close }: { close: () => void }) {
  const { settings, profile } = useStore();
  const stored = settings.habits?.mealWalk;
  const [meals, setMeals] = useState<Meal[]>(() => MEALS.filter(m => stored?.meals?.includes(m)));
  const [finish, setFinish] = useState<Partial<Record<Meal, string>>>(() => ({ ...DEFAULT_FINISH, ...stored?.finish }));
  const { problem, run } = useSave(close);
  const issue = mealProblem(meals, finish);
  const on = !!stored?.enabled;
  const instead = habitInstead('mealWalk', profile, settings.habits);
  if (instead) return <NotOffered habit="mealWalk" instead={instead} close={close} />;

  return (
    <>
      <Group header="After which meals?">
        <CheckRows
          label="After which meals?"
          options={MEALS.map(meal => ({ value: meal, label: MEAL_LABEL[meal] }))}
          value={meals}
          onChange={next => setMeals(MEALS.filter(m => next.includes(m)))}
        />
      </Group>

      {meals.length > 0 && (
        <Group header="When you usually finish" footer="The reminder comes then: in the study, each walk began within five minutes of finishing the meal.">
          {meals.map(meal => (
            <TimeField
              key={meal}
              id={`finish-${meal}`}
              label={MEAL_LABEL[meal]}
              value={finish[meal] ?? ''}
              onChange={value => setFinish(current => ({ ...current, [meal]: value }))}
            />
          ))}
        </Group>
      )}

      <Footnote>{MEAL_WALK_EVIDENCE} ({MEAL_WALK_SOURCE}.)</Footnote>

      <Actions
        problem={problem ?? (meals.length > 0 ? issue : undefined)}
        primary={on ? 'Save' : 'Turn on'}
        disabled={!!issue}
        onPrimary={() => void run(h => ({
          ...h,
          mealWalk: { enabled: true, meals, finish: Object.fromEntries(meals.map(m => [m, finish[m] ?? ''])) },
        }))}
        {...(on ? { onTurnOff: () => void run(h => (h.mealWalk ? { ...h, mealWalk: { ...h.mealWalk, enabled: false } } : h)) } : {})}
      />
      <Footnote>Starting a walk goes through the same check as any movement in Move. {NOT_ADVICE}</Footnote>
    </>
  );
}

// ============================================================================
// Quiet hours
// ============================================================================

export function QuietSheet({ open, onOpenChange }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Quiet hours" detent="large">
      {open && <QuietBody close={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function QuietBody({ close }: { close: () => void }) {
  const { settings } = useStore();
  const stored = settings.habits?.quietHours;
  const [on, setOn] = useState(!!stored);
  const [from, setFrom] = useState(stored?.from ?? DEFAULT_QUIET.from);
  const [to, setTo] = useState(stored?.to ?? DEFAULT_QUIET.to);
  const { problem, run } = useSave(close);
  const issue = !on
    ? undefined
    : parseClock(from) === undefined || parseClock(to) === undefined
      ? 'Choose a start and an end time.'
      : from === to ? 'Choose an end time different from the start.' : undefined;

  return (
    <>
      <Group footer="No reminder shows during these hours, in the app or in a calendar file made here.">
        <Row label="Quiet hours" accessory={<Toggle checked={on} onChange={setOn} label="Quiet hours" />} />
        {on && <TimeField id="quiet-from" label="From" value={from} onChange={setFrom} />}
        {on && <TimeField id="quiet-to" label="Until" value={to} onChange={setTo} />}
      </Group>
      <Actions
        problem={problem ?? issue}
        primary="Save"
        disabled={!!issue}
        onPrimary={() => void run(h => {
          const next = { ...h };
          if (on) next.quietHours = { from, to };
          else delete next.quietHours;
          return next;
        })}
      />
    </>
  );
}
