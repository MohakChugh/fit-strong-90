import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ChevronDownIcon, CircleCheckIcon, CircleDashedIcon, CircleDotIcon, CircleIcon, CirclePauseIcon, MoonIcon, type LucideIcon,
} from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { ProfileWizard } from '@/components/profile/ProfileWizard';
import { WizardCover } from '@/screens/you/WizardCover';
import { useGuided } from '@/hooks/useGuided';
import { isEnrolled } from '@/health/recommend';
import { setFocusOverride } from '@/store/useStore';
import { focusLabel } from '@/engine/templates';
import { bankProgress } from '@/session/logging';
import { clearProgress, loadProgress } from '@/session/persistence';
import { cn, generateId, parseDateString } from '@/lib/utils';
import { toFailure, type StoreResult } from '@/store/db';
import type { DayFocus } from '@/types/plan';
import { ChoiceRows, PrimaryButton } from './controls';
import {
  canSwapToday, JOIN_CLOSED, joinController, joinFlow, joinSeed, PHASE_INFO, planView, programmeWeek, programmeWeekDates, startDateProblem,
  STATUS_TEXT, swapChoices, swapToday, weekNote, weekView, withLeft, type DayStatus, type WeekDay,
} from './plan';

const WEEKDAY = (day: WeekDay['day']) => day.charAt(0).toUpperCase() + day.slice(1);
const longDate = (date: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(parseDateString(date));
const dayMonth = (date: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(parseDateString(date));
/** "8 to 14 October", or "28 September to 4 October" across a month's end. */
const dates = (from: string, to: string) => (from.slice(0, 7) === to.slice(0, 7)
  ? `${parseDateString(from).getDate()} to ${dayMonth(to)}`
  : `${dayMonth(from)} to ${dayMonth(to)}`);

const STATUS_ICON: Record<DayStatus, { icon: LucideIcon; tint: boolean }> = {
  done: { icon: CircleCheckIcon, tint: true },
  partial: { icon: CircleDashedIcon, tint: true },
  inProgress: { icon: CircleDotIcon, tint: true },
  today: { icon: CircleDotIcon, tint: true },
  recovery: { icon: CircleDashedIcon, tint: false },
  skipped: { icon: CircleIcon, tint: false },
  rest: { icon: MoonIcon, tint: false },
  comingUp: { icon: CircleIcon, tint: false },
  notRecorded: { icon: CircleIcon, tint: false },
  beforeStart: { icon: CircleIcon, tint: false },
  flare: { icon: CirclePauseIcon, tint: false },
  unwell: { icon: CirclePauseIcon, tint: false },
  away: { icon: CirclePauseIcon, tint: false },
};

/** "Upper A · Push & Row, swapped from Lower A · Done". */
function dayDetail(d: WeekDay): string {
  const swap = d.swappedFrom === undefined ? ''
    : d.swappedFrom === 'rest' ? ', on a rest day'
      : `, swapped from ${focusLabel(d.swappedFrom)}`;
  const what = d.focus === 'rest' ? 'Rest day' : `${focusLabel(d.focus)}${swap}`;
  return d.status === 'rest' ? what : `${what} · ${STATUS_TEXT[d.status]}`;
}

/** The three phases, each explained behind its own disclosure. */
function Phases({ current }: { current?: string }) {
  return (
    <Group header="Phases" footer="When every set reaches the top of its range, the next session adds the smallest step.">
      {PHASE_INFO.map(p => (
        <details key={p.phase} className="group">
          <summary className="press-feedback flex min-h-[3.25rem] cursor-pointer list-none items-center gap-3 px-4 py-2.5 active:bg-muted/60 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--text-body)] leading-snug">{p.name}</span>
              <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
                Weeks {p.weeks[0]} to {p.weeks[1]}{p.phase === current ? ' · Now' : ''}
              </span>
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-col gap-2 px-4 pb-4 text-[length:var(--text-subhead)] leading-snug">
            <p>{p.dose}</p>
            {p.phase === 'foundation' && <p className="text-muted-foreground">Week 4 is lighter: half the sets and easier effort.</p>}
            {p.phase === 'hypertrophy' && <p className="text-muted-foreground">Week 8 is lighter: half the sets and easier effort.</p>}
            {p.phase === 'strength' && <p className="text-muted-foreground">Week 12 tapers, with re-tests on spine-friendly lifts only. No one-rep maxes.</p>}
          </div>
        </details>
      ))}
    </Group>
  );
}

/**
 * Your plan (codex-vision §4 and §10; board D8): the 12-week programme for
 * someone in it, and the way in for anyone else. Membership is the app's one
 * rule (`isEnrolled`), never decided here.
 *
 * Joining and leaving are owned here, above the switch between the two views
 * (R02). The store shows a change before storing it, so either one flips
 * membership at once and flips it back if the save is refused; the view a
 * save started from stays until the store answers, so its answers and its
 * error are not thrown away with it.
 */
export function PlanScreen() {
  const { data, update, date } = useGuided();
  const [flow, dispatch] = useReducer(joinFlow, JOIN_CLOSED);
  const submit = useMemo(() => joinController(update, dispatch), [update]);
  const [leaving, setLeaving] = useState(false);
  // A saved join or leave swaps the view from under its dialog, so the button
  // that opened it is gone and focus has nowhere to return: the new view
  // takes it instead.
  const [switched, setSwitched] = useState(false);
  const cancel = () => dispatch({ type: 'cancel' });

  const leave = async (): Promise<StoreResult> => {
    setLeaving(true);
    // The store answers with a result; anything thrown all the same must not leave the sheet stuck saving.
    const result = await update(withLeft).catch((error: unknown) => ({ ok: false as const, failure: toFailure(error) }));
    setLeaving(false);
    if (result.ok) setSwitched(true);
    return result;
  };

  return (
    <Screen title="Your plan" back={{ to: '/move', label: 'Move' }}>
      {planView(isEnrolled(data.settings, data.profile), { joining: flow.open, leaving }) === 'member'
        ? <MemberPlan focusOnArrival={switched} onLeave={leave} />
        : <JoinPlan focusOnArrival={switched} unsaved={!flow.open && flow.draft !== undefined} onJoin={() => dispatch({ type: 'open' })} />}

      <WizardCover open={flow.open} onClose={cancel} label="Join the 12-week programme">
        <ProfileWizard
          mode="edit"
          steps={['about']}
          programme
          askStartDate
          startDateRule={day => startDateProblem(day, date)}
          submitLabel="Join the programme"
          busy={flow.busy}
          error={flow.error}
          initial={joinSeed(flow, data, date)}
          onCancel={cancel}
          onComplete={answers => { void submit(answers).then(result => { if (result?.ok) setSwitched(true); }); }}
        />
      </WizardCover>
    </Screen>
  );
}

/** A ref whose element takes focus when its view appears after a saved join or leave. */
function useArrivalFocus<T extends HTMLElement>(focusOnArrival: boolean) {
  const target = useRef<T>(null);
  useEffect(() => {
    if (focusOnArrival) target.current?.focus({ preventScroll: true });
  }, [focusOnArrival]);
  return target;
}

/** Where the programme stands, this week first. A day reads Done only for its recorded programme workout. */
function MemberPlan({ focusOnArrival, onLeave }: { focusOnArrival: boolean; onLeave: () => Promise<StoreResult> }) {
  const { data, update, profile, plan, date } = useGuided();
  const standing = useArrivalFocus<HTMLParagraphElement>(focusOnArrival);
  const week = programmeWeek(data.settings.startDate, date);
  const weekDates = programmeWeekDates(data.settings.startDate, date);
  const days = weekView(data, profile, date);
  const today = days.find(d => d.isToday);
  const swappable = canSwapToday(plan, today);
  const [swapOpen, setSwapOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const phase = PHASE_INFO.find(p => p.phase === week.phase)!;
  const note = weekNote(week.mode);
  const fromRest = today !== undefined && (today.focus === 'rest' || today.swappedFrom === 'rest');

  const swap = async (focus: DayFocus) => {
    if (!today || focus === today.focus || saving) return;
    setSaving(true);
    setProblem(null);
    const result = await swapToday(today, focus, {
      saved: loadProgress(),
      bank: saved => update(prev => bankProgress(prev, saved, saved.sessionId ?? `guided-${saved.plan.date}-${generateId()}`)),
      clear: clearProgress,
      setOverride: setFocusOverride,
    });
    setSaving(false);
    if (result.ok) setSwapOpen(false);
    else setProblem(result.failure.message);
  };

  const leave = async () => {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const result = await onLeave();
    setSaving(false);
    if (!result.ok) setProblem(result.failure.message);
    // On success the screen becomes the way back in; nothing else to do.
  };

  return (
    <>
      <section aria-label="Where the programme stands" className="flex flex-col gap-1 px-4">
        <p ref={standing} tabIndex={-1} className="numeric text-[length:var(--text-title-2)] font-semibold leading-tight outline-none">
          {week.startsOn ? `Starts ${longDate(week.startsOn)}` : `Week ${week.week} of 12`}
        </p>
        {/* The programme week's own dates: it counts from the start date, not Monday (J2-11). */}
        {!week.startsOn && weekDates && <p className="text-[length:var(--text-subhead)]">{dates(weekDates.from, weekDates.to)}</p>}
        <p className="text-[length:var(--text-subhead)] text-muted-foreground">
          {phase.name} phase · weeks {phase.weeks[0]} to {phase.weeks[1]}
        </p>
        {note && !week.startsOn && <p className="pt-1 text-[length:var(--text-subhead)] leading-snug">{note}</p>}
        {week.finished && (
          <p className="pt-1 text-[length:var(--text-subhead)] leading-snug">The 12 weeks are done. The plan stays on its final week.</p>
        )}
      </section>

      <Group header={`This week, ${dates(days[0].date, days[days.length - 1].date)}`} footer="Heavy squat and hinge days are kept apart, so your back recovers between them.">
        {days.map(d => {
          const { icon: Icon, tint } = STATUS_ICON[d.status];
          // A day in another programme week says which, so "This week" and "Week 3" cannot be confused (J2-11).
          const otherWeek = !week.startsOn && d.week !== undefined && d.week !== week.week ? ` · Week ${d.week}` : '';
          return (
            <Row
              key={d.date}
              aria-current={d.isToday ? 'date' : undefined}
              icon={<Icon className={cn(!tint && 'text-muted-foreground')} strokeWidth={2} />}
              label={<span className={cn('whitespace-normal', d.isToday && 'font-semibold')}>{WEEKDAY(d.day)}</span>}
              detail={`${dayDetail(d)}${otherWeek}`}
            />
          );
        })}
      </Group>

      {swappable && today && (
        <Group>
          <Row onClick={() => { setProblem(null); setSwapOpen(true); }} label={<span className="whitespace-normal text-tint">{fromRest ? 'Train today instead' : 'Swap today’s workout'}</span>} />
        </Group>
      )}

      <Phases current={week.phase} />

      <Group footer="Your sessions and history stay. You can join again any time.">
        <Row onClick={() => { setProblem(null); setLeaveOpen(true); }} label={<span className="whitespace-normal text-stop">Leave the programme</span>} />
      </Group>

      {today && (
        <Sheet open={swapOpen} dismissible={!saving} onOpenChange={open => { if (!saving) setSwapOpen(open); }} title={fromRest ? 'Train today instead' : 'Swap today’s workout'} detent="large">
          <Group footer="Today’s guided session and workout log follow the one you choose. The rest of your week stays as it is.">
            <ChoiceRows<DayFocus>
              label="Workouts"
              options={swapChoices(profile, today).map(c => ({
                value: c.focus,
                label: c.focus === 'rest' ? 'Rest day' : focusLabel(c.focus),
                detail: c.day ? `Usually ${WEEKDAY(c.day)}` : 'As scheduled for today',
              }))}
              value={today.focus}
              onChange={focus => { void swap(focus); }}
            />
          </Group>
          {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">That did not save. {problem}</p>}
        </Sheet>
      )}

      <Sheet open={leaveOpen} dismissible={!saving} onOpenChange={open => { if (!saving) setLeaveOpen(open); }} title="Leave the programme?">
        <p className="px-4 text-[length:var(--text-body)] leading-snug">
          Every session, check-in and answer stays on this device. You can join again any time.
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={() => { void leave(); }}
          className="press-feedback flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-50"
        >
          Leave the programme
        </button>
        {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">That did not save. {problem}</p>}
      </Sheet>
    </>
  );
}

/**
 * The way in (board D8: optional and explicit). The programme's questions,
 * its start date among them, come from the one profile wizard the app shares.
 */
function JoinPlan({ focusOnArrival, unsaved, onJoin }: {
  focusOnArrival: boolean;
  /** Answers were submitted and refused; the wizard has the reason and the answers. */
  unsaved: boolean;
  onJoin: () => void;
}) {
  const heading = useArrivalFocus<HTMLParagraphElement>(focusOnArrival);
  return (
    <>
      <section aria-label="The 12-week programme" className="flex flex-col gap-2 px-4">
        <p ref={heading} tabIndex={-1} className="text-[length:var(--text-title-2)] font-semibold leading-tight outline-none">The 12-week programme</p>
        <p className="text-[length:var(--text-body)] leading-snug">
          A guided hour on the days you choose: mobility, then strength, then an easy finish, fitted around your back and your health. It builds over three phases, with lighter weeks along the way.
        </p>
        <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">Stretch and Walk work without it.</p>
      </section>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onJoin}>Join the 12-week programme</PrimaryButton>
        <p className="px-4 text-center text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
          Next: your training days, session length, where you train and the day you start.
        </p>
        {unsaved && (
          <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">
            That did not save, so you have not joined yet. Your answers are kept for when you try again.
          </p>
        )}
      </div>

      <Phases />
    </>
  );
}
