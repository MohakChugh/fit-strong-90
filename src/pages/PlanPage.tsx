import { Link } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import { TOTAL_WEEKS, getDayOfWeekFromDate, getPhaseForWeek } from '@/lib/utils';
import { PHASES } from '@/data/program';
import { focusLabel, isHeavyFocus, weekFocus, WEEK } from '@/engine/templates';
import { modeFor } from '@/engine/dosage';
import { blockMinutes } from '@/components/today/blocks';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronRight, Layers } from 'lucide-react';

/** Main-lift dosing per phase (spec §4.3). */
const PHASE_DOSE: Record<string, string> = {
  foundation: 'Main lifts 3 × 8–10 at an easy-to-moderate effort, 3 s down. Learn the patterns.',
  hypertrophy: 'Main lifts 3–4 × 6–10, a little harder, 2 s down. Build muscle.',
  strength: 'Main lifts 3–5 × 4–6 (5–8 for spinal lifts until cleared). Build strength.',
};

const BLOCKS = [
  { key: 'mobility', label: 'Stretch & mobility', color: 'var(--block-mobility)' },
  { key: 'strength', label: 'Strength', color: 'var(--block-strength)' },
  { key: 'cardio', label: 'Cardio', color: 'var(--block-cardio)' },
] as const;

export default function PlanPage() {
  const { data, profile, plan, date } = useGuided();
  const week = weekFocus(profile);
  const today = getDayOfWeekFromDate(date);
  const minutes = blockMinutes(plan);
  const currentPhase = getPhaseForWeek(plan.week);
  const doneInWeek = (w: number) => data.sessions.filter(s => s.week === w && s.status === 'completed').length;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Your plan</h1>
        <p className="mt-1 text-muted-foreground">
          12 weeks, rebuilt every day from your profile, check-in and progress.
        </p>
      </div>

      {/* Today */}
      <Link to="/dashboard" viewTransition className="press-feedback">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
              <p className="font-semibold">{plan.label}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </div>
          {minutes.total > 0 ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                {BLOCKS.map(b => minutes[b.key] > 0 && (
                  <div key={b.key} style={{ flexGrow: minutes[b.key], background: b.color }} />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {BLOCKS.map(b => minutes[b.key] > 0 && (
                  <li key={b.key} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: b.color }} aria-hidden />
                    {b.label} {Math.round(minutes[b.key] / 60)} min
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Rest today. A gentle walk after meals still helps.</p>
          )}
        </Card>
      </Link>

      {/* This week */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="size-5" /> This week</h2>
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {WEEK.map(day => {
            const focus = week[day];
            const rest = focus === 'rest';
            return (
              <li key={day} className={cn('flex min-h-14 items-center gap-3 px-4 py-2', day === today && 'bg-primary/5')}>
                <span className={cn('w-10 shrink-0 text-sm font-semibold capitalize', day === today && 'text-primary')}>{day.slice(0, 3)}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', rest && 'text-muted-foreground')}>{focusLabel(focus)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {rest ? (profile.restDayMobility ? 'Optional 15-min mobility' : 'Walk after meals') : 'Stretch · strength · cardio'}
                  </span>
                </span>
                {day === today && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Today</span>}
                {day !== today && isHeavyFocus(focus) && (
                  <span className="shrink-0 rounded-full border border-[var(--block-strength)]/50 px-2 py-0.5 text-xs font-medium">Heavy</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Heavy squat and hinge days are kept apart so your back recovers between them.
        </p>
      </section>

      {/* 12 weeks */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Layers className="size-5" /> 12 weeks</h2>
        {PHASES.map(p => {
          const [from, to] = p.weeks;
          const isCurrent = p.phase === currentPhase;
          return (
            <Card key={p.phase} className={cn('flex flex-col gap-3 p-4', isCurrent && 'border-primary')}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{p.name}</h3>
                <span className="text-xs text-muted-foreground">Weeks {from}–{to}</span>
              </div>
              <p className="text-sm text-muted-foreground">{PHASE_DOSE[p.phase]}</p>
              <ol className="grid grid-cols-4 gap-2">
                {Array.from({ length: to - from + 1 }, (_, i) => from + i).filter(w => w <= TOTAL_WEEKS).map(w => {
                  const mode = modeFor(w);
                  const done = doneInWeek(w);
                  return (
                    <li key={w} aria-current={w === plan.week ? 'step' : undefined}
                      className={cn('flex min-h-14 flex-col items-center justify-center rounded-lg border px-1 text-center',
                        w === plan.week ? 'border-primary bg-primary/10' : w < plan.week ? 'bg-muted/50' : '')}>
                      <span className="text-sm font-semibold">Wk {w}</span>
                      <span className="text-xs text-muted-foreground">
                        {mode === 'deload' ? 'Deload' : mode === 'taper' ? 'Taper' : done > 0 ? `${done} done` : ' '}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">Deload weeks 4 and 8:</span> half the sets, easier effort and easy cardio, so you come back stronger.</li>
          <li><span className="font-medium text-foreground">Week 12:</span> a lighter taper and re-tests on spine-friendly lifts only. No one-rep maxes.</li>
          <li><span className="font-medium text-foreground">Progress:</span> when every set reaches the top of the rep range, the next session adds the smallest step.</li>
        </ul>
      </section>
    </div>
  );
}
