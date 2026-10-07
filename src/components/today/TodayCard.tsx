import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SessionPlan } from '@/types/plan';
import type { CheckInRecord } from '@/types/checkin';
import type { WorkoutSession } from '@/types';
import { nameOf } from '@/data/catalog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { blockMinutes } from './blocks';
import { PlayIcon, ChevronDownIcon, CheckCircle2Icon, RotateCcwIcon, ClipboardCheckIcon } from 'lucide-react';

interface Props {
  plan: SessionPlan;
  checkIn?: CheckInRecord;
  todaySession?: WorkoutSession;
  /** Set when today's own session is unfinished and can be resumed. */
  resumeMinutesLeft?: number;
  /** Unfinished session from an earlier day, offered under today's Start. */
  earlier?: { date: string; minutesLeft: number };
  onStart: () => void;
  onResume: () => void;
  onDiscardEarlier: () => void;
}

const BLOCKS = [
  { key: 'mobility', label: 'Mobility', color: 'bg-[var(--block-mobility)]' },
  { key: 'strength', label: 'Strength', color: 'bg-[var(--block-strength)]' },
  { key: 'cardio', label: 'Cardio', color: 'bg-[var(--block-cardio)]' },
] as const;

export function TodayCard({ plan, checkIn, todaySession, resumeMinutesLeft, earlier, onStart, onResume, onDiscardEarlier }: Props) {
  const [preview, setPreview] = useState(false);
  const m = blockMinutes(plan);
  const done = todaySession?.guided && todaySession.status === 'completed';
  const none = plan.kind === 'none';

  return (
    <Card className="overflow-hidden border-2 animate-scale-in">
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Today · {none ? 'rest' : `${Math.round(plan.totalSeconds / 60)} min`} · Week {plan.week}
            </p>
            <h2 className="text-2xl font-bold tracking-tight leading-tight mt-1">{plan.label}</h2>
            {plan.kind === 'recovery' && <p className="text-sm text-muted-foreground mt-1">Recovery version today</p>}
          </div>
          {done && <CheckCircle2Icon className="size-7 shrink-0 text-[var(--block-mobility)]" aria-label="Completed" />}
        </div>

        {!none && (
          <div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img"
              aria-label={`${Math.round(m.mobility / 60)} minutes mobility, ${Math.round(m.strength / 60)} strength, ${Math.round(m.cardio / 60)} cardio`}>
              {BLOCKS.map(b => m[b.key] > 0 && (
                <div key={b.key} className={cn('h-full', b.color)} style={{ width: `${(m[b.key] / m.total) * 100}%` }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {BLOCKS.map(b => m[b.key] > 0 && (
                <span key={b.key} className="flex items-center gap-1.5">
                  <span className={cn('size-2.5 rounded-full', b.color)} />
                  {Math.round(m[b.key] / 60)} min {b.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {checkIn && plan.changes.length > 0 && (
          <div className="rounded-xl bg-muted/60 p-3 text-sm">
            <p className="font-semibold mb-1 flex items-center gap-1.5"><ClipboardCheckIcon className="size-4" /> Adjusted for today</p>
            <ul className="list-disc pl-5 flex flex-col gap-0.5 text-muted-foreground">
              {plan.changes.slice(0, 3).map(c => <li key={c}>{c}</li>)}
            </ul>
          </div>
        )}

        {none ? (
          <div className="rounded-xl bg-muted/60 p-4 text-sm flex flex-col gap-1">
            {plan.readiness.outcome === 'urgent' || plan.readiness.outcome === 'red'
              ? plan.readiness.reasons.filter(r => r.outcome !== 'green').map(r => <p key={r.code}>{r.message}</p>)
              : <p>Rest day. A 15 to 20 minute walk after a meal helps your back and your glucose.</p>}
          </div>
        ) : done ? (
          <p className="text-sm text-muted-foreground">
            Session complete{todaySession.durationSeconds ? ` in ${Math.round(todaySession.durationSeconds / 60)} minutes` : ''}. Great work.
          </p>
        ) : resumeMinutesLeft !== undefined ? (
          <Button className="h-14 text-base w-full" onClick={onResume}>
            <RotateCcwIcon /> Resume today’s session · {resumeMinutesLeft} min left
          </Button>
        ) : (
          <Button className="h-14 text-base w-full" onClick={onStart}>
            <PlayIcon /> {checkIn ? 'Start session' : 'Check in & start'}
          </Button>
        )}

        {earlier && (
          <div className="rounded-xl bg-muted/60 p-3 flex flex-col gap-2">
            <p className="text-sm">
              Unfinished session from <span className="font-semibold">{formatDate(earlier.date)}</span> · {earlier.minutesLeft} min left
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={onResume}>
                <RotateCcwIcon /> Finish it
              </Button>
              <Button variant="ghost" className="h-11" onClick={onDiscardEarlier}>Discard</Button>
            </div>
          </div>
        )}

        {!none && (
          <button type="button" className="flex min-h-11 items-center justify-between text-sm font-medium" aria-expanded={preview} onClick={() => setPreview(!preview)}>
            Preview today’s exercises
            <ChevronDownIcon className={cn('size-4 transition-transform', preview && 'rotate-180')} />
          </button>
        )}
        {preview && !none && (
          <div className="flex flex-col gap-3 text-sm animate-fade-in">
            <PreviewGroup color="bg-[var(--block-mobility)]" title="Mobility"
              items={unique(plan.steps.filter(s => s.block === 'mobility' && (s.kind === 'hold' || s.kind === 'drill')).map(s => nameOf((s as { exerciseId: string }).exerciseId)))} />
            {plan.exercises.length > 0 && (
              <PreviewGroup color="bg-[var(--block-strength)]" title="Strength"
                items={plan.exercises.map(e => `${nameOf(e.exerciseId)} · ${e.rx.sets} × ${e.rx.holdSeconds ? `${e.rx.holdSeconds}s` : e.rx.carrySeconds ? `${e.rx.carrySeconds}s walk` : e.rx.targetReps}`)} />
            )}
            {plan.cardio && (
              <PreviewGroup color="bg-[var(--block-cardio)]" title="Cardio"
                items={[`${nameOf(plan.cardio.modality)} · ${plan.cardio.format === 'intervals' ? 'short intervals' : 'steady, conversational pace'}`]} />
            )}
            <Link to="/plan" viewTransition className="text-sm font-medium underline underline-offset-4 min-h-11 flex items-center">See the full week</Link>
          </div>
        )}
      </div>
    </Card>
  );
}

const unique = (xs: string[]) => [...new Set(xs)];

function PreviewGroup({ color, title, items }: { color: string; title: string; items: string[] }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-semibold mb-1"><span className={cn('size-2.5 rounded-full', color)} />{title}</p>
      <ol className="flex flex-col gap-0.5 text-muted-foreground pl-4.5">
        {items.map((it, i) => <li key={`${it}-${i}`}>{it}</li>)}
      </ol>
    </div>
  );
}
