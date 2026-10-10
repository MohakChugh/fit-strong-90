import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2Icon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { gateFor } from '@/components/checkin/start';
import { useGuided } from '@/hooks/useGuided';
import { useStore } from '@/store/useStore';
import { StepsGoalSheet } from '@/screens/track/GoalSheet';
import { displayPrefs, parseAddParam } from '@/screens/track/logKinds';
import { metricRows } from '@/screens/track/metrics';
import { addDays, weekOf } from '@/screens/track/periods';
import { QuickLog } from '@/screens/track/QuickLog';
import { stepsDayFigure } from '@/screens/track/stepsDay';
import { currentStepsGoal, stepsGoalOn, stepsProgress } from '@/screens/track/stepsGoal';
import { STEPS_NOTE } from '@/screens/track/targets';
import { Interpretation } from '@/screens/track/ui';
import { formatNumber } from '@/screens/track/units';
import { useClock } from '@/screens/today/clock';
import { useToday } from '@/screens/track/useToday';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useAddLink, useHubOrigin } from './hooks';
import { feetHold } from './movement';
import { historyRange } from './reading';

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The Steps hub (journey §8.2, §9.6).
 * - Today's figure, with where it came from.
 * - "Add today’s steps", the form with a big number field and Paste.
 * - Options: "Daily step goal", which changes by the day (B-16), and "How
 *   steps are counted".
 * - Then the week, every record, and the trend.
 * While walking is held for the feet it says so in the gate's words, with
 * no walking advice and no step goal; a total still saves (kiro KH-02).
 * Steps can't be read from Apple Health by a web app. The Shortcut help
 * waits for a device check (D54).
 */
export default function StepsHub() {
  const category = categoryById('steps');
  const { observations, settings, profile } = useStore();
  const current = useToday();
  const origin = useHubOrigin(category.title);
  const prefs = useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);
  // A link's `?add=steps` opens the form, on arrival or while the hub is open (D55, codex H2-06).
  const [logOpen, setLogOpen] = useAddLink(add => parseAddParam(add)?.kind === 'steps');
  const [goalOpen, setGoalOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [fresh, setFresh] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Walking held for the feet, by the profile or by today's walk gate, asked at the shared clock (L-09, K-12; kiro KH-02).
  const guided = useGuided();
  const { now } = useClock();
  const held = feetHold(guided.profile, gateFor(guided, 'walk', now));
  const today = stepsDayFigure(current, observations, prefs.hour12);
  const goal = currentStepsGoal(settings);
  // No goal while walking is held: a target to walk towards is advice to walk.
  const progressOn = (steps: number | undefined, day: string) => (held || steps === undefined ? undefined : stepsProgress(steps, stepsGoalOn(settings, day)));
  const progress = progressOn(today.steps, current);
  const { from } = weekOf(current);
  const week = NAMES.map((name, i) => ({ name, day: addDays(from, i) })).filter(d => d.day <= current).map(d => {
    const f = stepsDayFigure(d.day, observations, prefs.hour12);
    const p = progressOn(f.steps, d.day);
    return { ...d, text: f.value ? [`${f.value} steps`, d.day === current ? f.source : undefined, p].filter(Boolean).join(' · ') : 'Not entered' };
  });
  const rows = useMemo(() => metricRows('steps', observations, historyRange({ metric: 'steps' }, observations, current), prefs, current), [observations, prefs, current]);

  return (
    <HubFrame category={category}>
      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      <HubSection title="Today">
        <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
          <p className="numeric text-[length:var(--text-title-2)] font-bold leading-tight">{today.value ? `${today.value} steps` : 'Not entered'}</p>
          {today.kind !== 'none' && <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{today.source}</p>}
          {progress && <p className="text-[length:var(--text-subhead)] leading-snug">{progress}</p>}
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
          >
            <PlusIcon className="size-5" aria-hidden />
            Add today’s steps
          </button>
        </div>
      </HubSection>
      {held ? (
        <section role="status" className="flex flex-col gap-2 rounded-2xl bg-grouped-card p-4 text-[length:var(--text-body)] leading-snug">
          <p className="flex items-start gap-2 font-semibold text-caution">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>Walking is on hold for your feet</span>
          </p>
          <p>{held.reason}</p>
          {held.release && <p className="text-muted-foreground">{held.release}</p>}
          <p className="text-muted-foreground">A total you enter still saves.</p>
        </section>
      ) : (
        <Interpretation text={STEPS_NOTE.text} tone={STEPS_NOTE.tone} framework={STEPS_NOTE.framework} />
      )}

      <HubSection title="Options">
        <Group {...(held ? {} : { footer: 'Optional, and yours to change. Each day keeps the goal it had.' })}>
          {!held && <Row as="button" type="button" label="Daily step goal" value={goal !== undefined ? `${formatNumber(goal)} steps` : 'Not set'} chevron onClick={() => setGoalOpen(true)} />}
          <Row as="button" type="button" label="How steps are counted" chevron onClick={() => setHowOpen(true)} />
        </Group>
      </HubSection>

      <HubSection title="This week">
        <Group>{week.map(d => <Row key={d.day} label={d.name} detail={d.text} />)}</Group>
      </HubSection>

      <HistoryList rows={rows.map(r => ({ key: r.key, label: r.label, detail: r.detail, ref: r.ref, ids: r.ids }))} origin={origin} empty="Nothing here yet. Each day’s total and each walk’s steps show here." fresh={fresh} />
      <SeeTrends category={category} origin={origin} />

      <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={{ kind: 'steps' }} onSaved={r => { setFresh(r.ids); setNotice(`Saved on this device: ${r.summary}.`); }} prefs={prefs} />
      <StepsGoalSheet open={goalOpen} onOpenChange={setGoalOpen} goal={goal} />
      <Sheet open={howOpen} onOpenChange={setHowOpen} title="How steps are counted" detent="large">
        <div className="flex flex-col gap-3 px-1 text-[length:var(--text-body)] leading-snug">
          <p>FitStrong counts steps only while it’s open on the screen.</p>
          <p>A total you enter from your phone’s Health app is the whole day’s so far. A new total for the day replaces the one before; it is never added to it.</p>
          <p>Walks you record here count their own steps, shown as “in FitStrong walks”.</p>
          <p>If you walk with FitStrong after entering a total, the day reads “at least” the two together, until you enter a new total.</p>
          <p>Distance and energy count only recorded walks.</p>
        </div>
      </Sheet>
    </HubFrame>
  );
}
