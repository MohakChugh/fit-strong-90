import type { Readiness } from '@/types/checkin';
import { cn } from '@/lib/utils';
import { CheckCircle2Icon, AlertTriangleIcon, HeartPulseIcon, MoonIcon, SirenIcon } from 'lucide-react';

const STYLE: Record<Readiness['outcome'], { title: string; tone: string; icon: typeof CheckCircle2Icon }> = {
  green: { title: 'Good to go', tone: 'border-[var(--block-mobility)]/40 bg-[var(--block-mobility)]/10', icon: CheckCircle2Icon },
  amber: { title: 'Modified session today', tone: 'border-[var(--block-strength)]/50 bg-[var(--block-strength)]/15', icon: AlertTriangleIcon },
  recovery: { title: 'Recovery session today', tone: 'border-[var(--block-mobility)]/40 bg-[var(--block-mobility)]/10', icon: HeartPulseIcon },
  red: { title: 'Rest today', tone: 'border-[var(--safety)]/40 bg-[var(--safety)]/10', icon: MoonIcon },
  urgent: { title: 'Get help now', tone: 'border-[var(--safety)] bg-[var(--safety)]/15', icon: SirenIcon },
};

const MODIFIER_TEXT: Record<string, string> = {
  INT: 'Moderate effort only; no intervals.',
  LOAD: 'Lighter loads with more reps.',
  HEAD: 'No head-down positions.',
  IMPACT: 'No jumping or jarring.',
  FOOT: 'Seated and floor work only.',
  COOL: 'Longer cool-down; rise slowly.',
  HYPO: 'Fast carbs within reach; glucose check before cardio.',
  HEAT: 'Shorter, easier cardio and extra fluids.',
  MINUS_SET: 'One set fewer per exercise.',
};

export function OutcomeBanner({ readiness }: { readiness: Readiness }) {
  const s = STYLE[readiness.outcome];
  const Icon = s.icon;
  // Standing restrictions (an open foot wound, severe eye disease) are green —
  // the session can go ahead — but "Good to go" alone would hide them.
  const title = readiness.outcome === 'green' && readiness.modifiers.length > 0 ? 'Good to go, with changes' : s.title;
  return (
    <div role={readiness.outcome === 'urgent' ? 'alert' : 'status'} className={cn('rounded-2xl border-2 p-4 flex flex-col gap-3', s.tone)}>
      <div className="flex items-center gap-2">
        <Icon className="size-6 shrink-0" />
        <p className="text-lg font-bold">{title}</p>
      </div>
      {readiness.outcome === 'urgent' && (
        <p className="text-base font-semibold">Call your local emergency number now (for example 112, 911 or 999). Do not drive yourself.</p>
      )}
      {readiness.reasons.filter(r => r.outcome !== 'green').map(r => <p key={r.code} className="text-sm">{r.message}</p>)}
      {readiness.modifiers.length > 0 && readiness.outcome !== 'red' && readiness.outcome !== 'urgent' && (
        <ul className="text-sm list-disc pl-5">
          {readiness.modifiers.map(m => <li key={m}>{MODIFIER_TEXT[m] ?? m}</li>)}
        </ul>
      )}
      {readiness.actions.length > 0 && (
        <div className="rounded-xl bg-background/70 p-3 text-sm">
          <p className="font-semibold mb-1">Before you start</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">{readiness.actions.map(a => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      {readiness.notices.map(n => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
    </div>
  );
}
