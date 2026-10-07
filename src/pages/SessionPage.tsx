/**
 * The guided session (spec §3.3): one continuous, narrated hour.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Segment, SessionPlan, SetStep, Step } from '@/types/plan';
import type { RepSync } from '@/components/motion/MotionView';
import type { RunnerState } from '@/session/runner';
import { useGuided } from '@/hooks/useGuided';
import { useGuidedSession } from '@/hooks/useGuidedSession';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { loadProgress, rehydrate, clearProgress, type SavedProgress } from '@/session/persistence';
import { segmentsWithExtra } from '@/session/runner';
import { toWorkoutSession, withGuidedSession, activeSeconds } from '@/session/logging';
import { getCoaching } from '@/data/coaching';
import { nameOf } from '@/data/catalog';
import { deriveHealth } from '@/engine/health';
import { generateId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { blockMinutes } from '@/components/today/blocks';
import { SessionProgress, TimerRing, BreathPacer } from '@/components/session/parts';
import { BLOCK_INK, BLOCK_LABEL, fmt } from '@/components/session/format';
import { InfoSheet } from '@/components/session/InfoSheet';
import { FigureSlot } from '@/components/session/FigureSlot';
import { cn } from '@/lib/utils';
import {
  PauseIcon, PlayIcon, SkipForwardIcon, SkipBackIcon, InfoIcon, Volume2Icon, VolumeXIcon, XIcon,
  PlusIcon, MinusIcon, CheckIcon, CandyIcon, HeadphonesIcon,
} from 'lucide-react';
import { toast } from 'sonner';

interface Run {
  plan: SessionPlan;
  resumeState?: RunnerState;
  /** Stable across saves, so saving twice updates one session instead of two. */
  sessionId: string;
  /** Progress for another day that this run is about to overwrite. */
  stale?: SavedProgress;
}

export default function SessionPage() {
  const { data, update, profile, plan: todayPlan, checkIn } = useGuided();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Resume saved progress (keeps its original plan and date), else today's plan.
  const [{ plan, resumeState, sessionId, stale }] = useState<Run>(() => {
    const saved = loadProgress();
    const id = (p: SessionPlan) => `guided-${p.date}-${generateId()}`;
    if (saved && (params.get('resume') === '1' || saved.plan.date === todayPlan.date)) {
      return { plan: saved.plan, resumeState: rehydrate(saved.state, saved.clockAt, Date.now()), sessionId: id(saved.plan) };
    }
    // Progress from another day survives here only until the first autosave of
    // this run, so bank its work before it goes (Review Focus #3).
    return { plan: todayPlan, sessionId: id(todayPlan), ...(saved ? { stale: saved } : {}) };
  });

  const saveSession = (state: RunnerState, painAfter?: number) => {
    const session = toWorkoutSession(plan, state, { sessionId, checkIn, painAfter });
    update(prev => withGuidedSession(prev, session));
  };

  useEffect(() => {
    if (!stale) return;
    const rescued = toWorkoutSession(stale.plan, stale.state, { sessionId: `guided-${stale.plan.date}-${generateId()}` });
    // Nothing logged means nothing to lose, and History stays clean.
    if (rescued.status === 'in_progress') return;
    update(prev => (prev.sessions.some(s => s.date === rescued.date && s.guided && s.status === 'completed') ? prev : withGuidedSession(prev, rescued)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  // Saved progress is dropped only once the session is in data.sessions, so a
  // phone lock on the Summary can never cost the user the hour.
  useEffect(() => {
    if (data.sessions.some(s => s.id === sessionId)) clearProgress();
  }, [data.sessions, sessionId]);

  if (plan.kind === 'none') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 pt-safe pb-safe">
        <div className="max-w-sm text-center flex flex-col gap-4">
          <h1 className="text-2xl font-bold">No session today</h1>
          {plan.readiness.reasons.filter(r => r.outcome !== 'green').map(r => <p key={r.code}>{r.message}</p>)}
          <Button className="h-12" onClick={() => navigate('/dashboard')}>Back to Today</Button>
        </div>
      </div>
    );
  }

  return (
    <Player
      plan={plan}
      resumeState={resumeState}
      profile={profile}
      sessions={data.sessions}
      useMetric={data.settings.useMetric}
      onExit={() => navigate('/dashboard', { viewTransition: true })}
      onSave={saveSession}
    />
  );
}

interface PlayerProps {
  plan: SessionPlan;
  resumeState?: RunnerState;
  profile: ReturnType<typeof useGuided>['profile'];
  sessions: ReturnType<typeof useGuided>['data']['sessions'];
  useMetric: boolean;
  onExit: () => void;
  onSave: (state: RunnerState, painAfter?: number) => void;
}

function Player({ plan, resumeState, profile, sessions, useMetric, onExit, onSave }: PlayerProps) {
  const g = useGuidedSession({ plan, profile, sessions, resumeState });
  const reduced = useReducedMotion();
  const [infoOpen, setInfoOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [lowOpen, setLowOpen] = useState(false);
  const { state, position: pos, act } = g;
  const step = pos.step;
  const seg = pos.segment;
  const exerciseId = 'exerciseId' in step ? step.exerciseId : undefined;
  const coaching = exerciseId ? getCoaching(exerciseId) : undefined;
  const segTotal = segmentsWithExtra(step, state)[pos.segmentIndex]?.ms ?? 0;
  const color = BLOCK_INK[step.block];
  const health = deriveHealth(profile.health);

  // Write the session the moment the runner is done, not when the user taps
  // "Save and finish": the runner clears saved progress at `done`, so a phone
  // lock on the Summary would otherwise lose the whole hour (Review Focus #1).
  const autoSaved = useRef(false);
  useEffect(() => {
    if (state.status !== 'done' || autoSaved.current) return;
    autoSaved.current = true;
    onSave(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  if (state.status === 'ready') return <StartScreen plan={plan} voiceName={g.voiceName} muted={g.muted} setMuted={act.setMuted} onStart={act.start} onExit={onExit} />;
  if (state.status === 'done') return <Summary plan={plan} state={state} onSave={onSave} onExit={onExit} />;

  const paused = state.status === 'paused';
  const blockSteps = plan.steps.filter(s => s.block === step.block && s.kind !== 'rest');
  const stepNo = blockSteps.indexOf(step) + 1;

  return (
    <div className="fixed inset-0 flex flex-col bg-background pt-safe pb-safe">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 pt-2">
        <button type="button" aria-label="End session" onClick={() => { act.pause(); setExitOpen(true); }} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
          <XIcon className="size-5" />
        </button>
        <div className="flex-1"><SessionProgress plan={plan} elapsedMs={pos.sessionElapsedMs} /></div>
        <span className="w-14 text-right text-sm font-medium tabular-nums" aria-label="Time left">{fmt(pos.sessionTotalMs - pos.sessionElapsedMs)}</span>
      </div>
      <div className="flex items-center justify-between px-4 pt-1 text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        <span>{BLOCK_LABEL[step.block]}{stepNo > 0 && step.kind !== 'talk' ? ` · ${stepNo} of ${blockSteps.length}` : ''}</span>
        {health.hypoRisk && (
          <button type="button" onClick={() => { act.pause(); setLowOpen(true); }} className="flex min-h-11 items-center gap-1 rounded-full px-3 normal-case tracking-normal text-[var(--safety)] font-semibold">
            <CandyIcon className="size-4" /> I feel low
          </button>
        )}
      </div>
      {/* The phone blocked the coach's voice (an audio permission lapse, or the
          pack arrived after Start): one tap inside a gesture brings it back. */}
      {g.voiceTrouble === 'blocked' && !g.muted && (
        <button type="button" onClick={act.unlockAudio}
          className="mx-4 mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--block-strength-ink)] px-4 text-sm font-semibold text-[var(--on-ink)] press-feedback">
          <Volume2Icon className="size-4" /> Tap to turn the coach’s voice back on
        </button>
      )}
      {g.voiceTrouble === 'failed' && !g.muted && (
        <p role="status" className="mx-4 mt-2 rounded-xl bg-muted px-4 py-2 text-xs text-muted-foreground">
          The recorded voice couldn’t play, so your phone’s own voice is reading the steps.
        </p>
      )}

      {/* Main */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2 landscape:flex-row landscape:gap-4">
        <FigureSlot step={step} segment={seg} coaching={coaching} demoId={demoIdFor(plan, pos.stepIndex)} sync={repSync(step, seg, pos, segTotal)}
          playing={state.status === 'running'} figure={profile.figure}
          className="min-h-0 shrink-0 h-[min(34dvh,280px)] [@media(max-height:640px)_and_(orientation:portrait)]:h-[21dvh] landscape:h-auto landscape:w-1/2 landscape:shrink" />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight">{titleFor(step)}</h1>
              <p className="text-sm text-muted-foreground">{subtitleFor(step, seg.label)}</p>
            </div>
            {seg.side && (
              <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--on-ink)]" style={{ background: color }}>
                {seg.side}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <TimerRing remainingMs={pos.segmentRemainingMs} totalMs={segTotal} color={color} size={104}
              label={step.kind === 'set' && seg.rep ? `Rep ${seg.rep} of ${step.reps}` : seg.kind === 'rest' ? 'Rest' : seg.label} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {(seg.kind === 'hold' || seg.breath) && <BreathPacer segment={seg} segmentElapsedMs={pos.segmentElapsedMs} reduced={reduced} />}
              {step.kind === 'set' && seg.kind === 'rep' && (
                <p className="text-2xl font-bold">{seg.repPhase === 'lift' ? 'Exhale · lift' : seg.repPhase === 'lower' ? 'Inhale · lower' : 'Pause'}</p>
              )}
              {step.kind === 'cardio' && <CardioHint intensity={seg.intensity} />}
              <p className="text-sm text-muted-foreground">Step ends in {fmt(pos.stepRemainingMs)}</p>
            </div>
          </div>

          <p className="min-h-[3rem] rounded-xl bg-muted/60 p-3 text-base leading-snug" aria-live="polite">
            {g.caption || (paused ? 'Paused.' : '…')}
          </p>

          {step.kind === 'set' && <SetPanel step={step} state={state} useMetric={useMetric} onLog={act.log} onDone={() => act.next('doneEarly')} />}
          {step.kind === 'rest' && <RestPanel plan={plan} index={pos.stepIndex} state={state} useMetric={useMetric} onLog={act.log} />}
          {step.kind === 'checkpoint' && (
            <CheckpointPanel step={step} onAnswer={answer => {
              act.log({ stepId: step.id, kind: 'checkpoint', completed: true, answer });
              if (answer === 'worse') toast.warning('Noted. Next time the plan steps this exercise down. If leg symptoms spread, stop and rest.');
              act.next();
            }} />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-around gap-1 border-t px-2 py-2">
        <IconButton label="Previous" onClick={act.previous}><SkipBackIcon /></IconButton>
        <IconButton label="Add 15 seconds" onClick={() => act.addTime(15)}><PlusIcon /><span className="text-xs">15</span></IconButton>
        <button type="button" aria-label={paused ? 'Resume' : 'Pause'} onClick={paused ? act.resume : act.pause}
          className="flex size-16 items-center justify-center rounded-full text-[var(--on-ink)] shadow-lg press-feedback" style={{ background: color }}>
          {paused ? <PlayIcon className="size-7" /> : <PauseIcon className="size-7" />}
        </button>
        <IconButton label="Next" onClick={() => act.next('skip')}><SkipForwardIcon /></IconButton>
        <IconButton label={g.muted ? 'Unmute voice' : 'Mute voice'} onClick={() => act.setMuted(!g.muted)}>{g.muted ? <VolumeXIcon /> : <Volume2Icon />}</IconButton>
        <IconButton label="How to do it" onClick={() => setInfoOpen(true)} disabled={!coaching}><InfoIcon /></IconButton>
      </div>

      <InfoSheet open={infoOpen} onOpenChange={setInfoOpen} coaching={coaching} title={step.title} />

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave the session?</DialogTitle>
            <DialogDescription>Your progress is saved. You can resume from Today.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button className="h-12" onClick={() => { setExitOpen(false); act.resume(); }}>Keep going</Button>
            <Button variant="outline" className="h-12" onClick={() => { g.stopVoice(); onExit(); }}>Save and exit</Button>
            <Button variant="ghost" className="h-12" onClick={() => { g.stopVoice(); act.finish(); setExitOpen(false); }}>Finish now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LowGlucoseDialog open={lowOpen} onOpenChange={setLowOpen}
        onRecovered={() => { setLowOpen(false); skipToCooldown(plan, pos.stepIndex, act); }}
        onEnd={() => { setLowOpen(false); g.stopVoice(); act.finish(); }} />
    </div>
  );
}

function skipToCooldown(plan: SessionPlan, from: number, act: ReturnType<typeof useGuidedSession>['act']) {
  const target = plan.steps.findIndex((s, i) => i > from && (s.block === 'cardio' || s.block === 'wrapUp'));
  const steps = target < 0 ? 0 : target - from;
  for (let i = 0; i < steps; i++) act.next('skip');
  act.resume();
}

/** Exercise the figure demonstrates: the current one, or the next one during rests and talks. */
function demoIdFor(plan: SessionPlan, index: number): string | undefined {
  const own = (s: Step) => (s.kind !== 'checkpoint' && 'exerciseId' in s ? s.exerciseId : undefined);
  const step = plan.steps[index];
  if (own(step)) return own(step);
  if (step.kind !== 'rest' && step.kind !== 'talk') return undefined;
  for (let j = index + 1; j < plan.steps.length; j++) if (own(plan.steps[j])) return own(plan.steps[j]);
  return undefined;
}

/**
 * Which part of the rep the coach is counting, so the demo moves with the voice.
 * A clip always runs easy end → hardest point → back, so each rep phase maps to
 * the same span whichever way round the lift is counted.
 */
const REP_STAGE = { lower: 0, pauseBottom: 1, lift: 2, pauseTop: 3 } as const;

function repSync(step: Step, seg: Segment, pos: { segmentIndex: number; segmentElapsedMs: number }, segMs: number): RepSync | null {
  if (step.kind !== 'set' || seg.kind !== 'rep' || !seg.repPhase) return null;
  return { key: `${step.id}:${pos.segmentIndex}`, stage: REP_STAGE[seg.repPhase], seconds: segMs / 1000, elapsed: pos.segmentElapsedMs / 1000 };
}

function titleFor(step: Step): string {
  if (step.kind === 'rest') return 'Rest';
  if (step.kind === 'setup') return `Next: ${step.title}`;
  if (step.kind === 'checkpoint') return step.title;
  return step.title;
}

function subtitleFor(step: Step, segLabel: string): string {
  switch (step.kind) {
    case 'set': return step.ramp ? `Warm-up set ${step.set} · ${step.reps} easy reps` : `Set ${step.set} of ${step.of} · ${step.holdSeconds ? `${step.holdSeconds} s hold` : step.carrySeconds ? `${step.carrySeconds} s walk` : `${step.reps} reps`}${step.sides ? ' each side' : ''}`;
    case 'hold': return `${step.sets > 1 ? `${step.sets} × ` : ''}${step.holdSeconds} s${step.sides ? ' each side' : ''}`;
    case 'drill': return step.breathing ? `${step.reps} slow breaths` : `${step.reps} reps${step.sides ? ' each side' : ''}`;
    case 'setup': return 'Set up the station while I explain';
    case 'rest': return step.nextStepId ? '' : 'Recover, breathe slowly, sip water';
    case 'cardio': return segLabel;
    default: return segLabel;
  }
}

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
      className="flex size-12 items-center justify-center gap-0.5 rounded-full hover:bg-muted disabled:opacity-40 press-feedback [&_svg]:size-5">
      {children}
    </button>
  );
}

function CardioHint({ intensity }: { intensity?: string }) {
  const text = intensity === 'fast' ? 'Hard: about 7 out of 10' : intensity === 'zone2' ? 'Talk in full sentences: 3 to 4 out of 10' : intensity === 'cooldown' ? 'Slow and easy' : 'Easy pace';
  return <p className="text-base font-semibold">{text}</p>;
}

function Stepper({ label, value, onChange, step, suffix }: { label: string; value: number; onChange: (v: number) => void; step: number; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border px-2 py-1">
      <span className="text-sm text-muted-foreground pl-1">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Less ${label}`} className="flex size-11 items-center justify-center rounded-full hover:bg-muted" onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}><MinusIcon className="size-4" /></button>
        <span className="min-w-14 text-center text-lg font-bold tabular-nums">{value}{suffix}</span>
        <button type="button" aria-label={`More ${label}`} className="flex size-11 items-center justify-center rounded-full hover:bg-muted" onClick={() => onChange(+(value + step).toFixed(2))}><PlusIcon className="size-4" /></button>
      </div>
    </div>
  );
}

const LB = 2.20462;

function SetPanel({ step, state, useMetric, onLog, onDone }: { step: SetStep; state: RunnerState; useMetric: boolean; onLog: ReturnType<typeof useGuidedSession>['act']['log']; onDone: () => void }) {
  const log = state.logs.find(l => l.stepId === step.id);
  const kg = log?.weightKg ?? step.load.kg;
  const showWeight = step.load.note !== 'bodyweight' && !step.ramp;
  return (
    <div className="flex flex-col gap-2">
      {showWeight && (
        <Stepper label={step.load.note === 'firstTime' && kg === null ? 'Weight (find yours)' : 'Weight'}
          value={kg === null ? 0 : Math.round((useMetric ? kg : kg * LB) * 10) / 10} step={useMetric ? 2.5 : 5} suffix={useMetric ? ' kg' : ' lb'}
          onChange={v => onLog({ stepId: step.id, kind: 'set', completed: log?.completed ?? false, reps: log?.reps ?? step.reps, weightKg: useMetric ? v : Math.round((v / LB) * 10) / 10, exerciseId: step.exerciseId })} />
      )}
      <Button variant="outline" className="h-12 text-base" onClick={onDone}><CheckIcon /> Done — next</Button>
    </div>
  );
}

function RestPanel({ plan, index, state, useMetric, onLog }: { plan: SessionPlan; index: number; state: RunnerState; useMetric: boolean; onLog: ReturnType<typeof useGuidedSession>['act']['log'] }) {
  const prev = [...plan.steps.slice(0, index)].reverse().find(s => s.kind === 'set') as SetStep | undefined;
  const next = plan.steps.slice(index + 1).find(s => s.kind === 'set' || s.kind === 'setup' || s.kind === 'cardio');
  if (!prev || prev.ramp) return next ? <p className="text-sm">Next: <span className="font-semibold">{nameOf((next as { exerciseId: string }).exerciseId)}</span></p> : null;
  const log = state.logs.find(l => l.stepId === prev.id);
  const reps = log?.reps ?? prev.reps;
  const kg = log?.weightKg ?? prev.load.kg;
  const base = { stepId: prev.id, kind: 'set' as const, completed: log?.completed ?? true, exerciseId: prev.exerciseId };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Log the set you just did</p>
      {!prev.holdSeconds && !prev.carrySeconds && <Stepper label="Reps" value={reps} step={1} onChange={v => onLog({ ...base, reps: v, weightKg: kg })} />}
      {prev.load.note !== 'bodyweight' && (
        <Stepper label="Weight" value={kg === null ? 0 : Math.round((useMetric ? kg : kg * LB) * 10) / 10} step={useMetric ? 2.5 : 5} suffix={useMetric ? ' kg' : ' lb'}
          onChange={v => onLog({ ...base, reps, weightKg: useMetric ? v : Math.round((v / LB) * 10) / 10 })} />
      )}
      {next && <p className="text-sm">Next: <span className="font-semibold">{next.kind === 'set' && next.exerciseId === prev.exerciseId ? `Set ${next.set} of ${next.of}` : nameOf((next as { exerciseId: string }).exerciseId)}</span></p>}
    </div>
  );
}

function CheckpointPanel({ step, onAnswer }: { step: Extract<Step, { kind: 'checkpoint' }>; onAnswer: (a: string) => void }) {
  if (step.question === 'glucose') {
    return (
      <div className="flex flex-col gap-2">
        <Button className="h-12 text-base" onClick={() => onAnswer('ok')}>Glucose is fine — start cardio</Button>
        <Button variant="outline" className="h-12 text-base" onClick={() => onAnswer('treated')}>I had carbs — continue</Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['better', 'same', 'worse'] as const).map(a => (
        <Button key={a} variant={a === 'worse' ? 'outline' : 'secondary'} className={cn('h-14 text-base capitalize', a === 'worse' && 'border-[var(--safety)] text-[var(--safety)]')} onClick={() => onAnswer(a)}>{a}</Button>
      ))}
    </div>
  );
}

function LowGlucoseDialog({ open, onOpenChange, onRecovered, onEnd }: { open: boolean; onOpenChange: (o: boolean) => void; onRecovered: () => void; onEnd: () => void }) {
  const [left, setLeft] = useState(15 * 60_000);
  useEffect(() => {
    if (!open) return;
    const endsAt = Date.now() + 15 * 60_000;
    const t = setInterval(() => setLeft(Math.max(0, endsAt - Date.now())), 1000);
    return () => { clearInterval(t); setLeft(15 * 60_000); };
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Treat the low first</DialogTitle>
          <DialogDescription>Stop and sit down. Take 15 g of fast-acting carbohydrate: 4 glucose tablets, half a cup of juice or regular soda, or a tablespoon of sugar.</DialogDescription>
        </DialogHeader>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Re-check in</p>
          <p className="text-5xl font-bold tabular-nums">{fmt(left)}</p>
          <p className="mt-2 text-sm">Still under 70, or symptoms continue? Take another 15 g and wait again. Below 54, end the session.</p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button className="h-12" onClick={onRecovered}>I’m 90 or above and feel fine — cool-down only</Button>
          <Button variant="outline" className="h-12" onClick={onEnd}>End session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StartScreen({ plan, voiceName, muted, setMuted, onStart, onExit }: { plan: SessionPlan; voiceName: string | null; muted: boolean; setMuted: (m: boolean) => void; onStart: () => void; onExit: () => void }) {
  const m = blockMinutes(plan);
  const first = useMemo(() => plan.steps.find(s => s.kind === 'hold' || s.kind === 'drill'), [plan]);
  return (
    <div className="min-h-dvh flex flex-col bg-background pt-safe pb-safe">
      <div className="flex items-center justify-between px-3 pt-2">
        <button type="button" aria-label="Back" onClick={onExit} className="flex size-11 items-center justify-center rounded-full hover:bg-muted"><XIcon className="size-5" /></button>
        <span className="text-sm text-muted-foreground">{Math.round(plan.totalSeconds / 60)} minutes</span>
        <span className="size-11" />
      </div>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.kind === 'recovery' ? 'Recovery session' : 'Today'}</p>
          <h1 className="text-3xl font-bold tracking-tight">{plan.label}</h1>
        </div>
        <div className="flex flex-col gap-2">
          {([
            ['Mobility', m.mobility, 'var(--block-mobility)', first ? `Starts with ${nameOf((first as { exerciseId: string }).exerciseId).toLowerCase()}` : ''],
            ['Strength', m.strength, 'var(--block-strength)', plan.exercises.slice(0, 3).map(e => nameOf(e.exerciseId)).join(', ')],
            ['Cardio', m.cardio, 'var(--block-cardio)', plan.cardio ? nameOf(plan.cardio.modality) : ''],
          ] as const).filter(([, s]) => s > 0).map(([label, s, color, detail]) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border p-3">
              <span className="h-10 w-1.5 rounded-full" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{label} · {Math.round(s / 60)} min</p>
                {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm">
          <HeadphonesIcon className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{muted ? 'Captions only' : voiceName ? `Voice: ${voiceName}` : 'Voice: captions until a voice loads'}</p>
            <p className="text-muted-foreground">Put your earphones in and keep the screen on.</p>
          </div>
          <Button variant="outline" className="h-11" onClick={() => setMuted(!muted)}>{muted ? 'Unmute' : 'Mute'}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Stop and get help for chest pain, faintness or severe breathlessness. Stop any exercise that sends pain or tingling down your leg.</p>
        <div className="mt-auto">
          <Button className="h-16 w-full text-lg" onClick={onStart}><PlayIcon className="size-6" /> Start</Button>
        </div>
      </div>
    </div>
  );
}

function Summary({ plan, state, onSave, onExit }: { plan: SessionPlan; state: RunnerState; onSave: (s: RunnerState, painAfter?: number) => void; onExit: () => void }) {
  const [pain, setPain] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const setsDone = state.logs.filter(l => l.kind === 'set' && l.completed).length;
  const mobilityDone = state.logs.filter(l => (l.kind === 'hold' || l.kind === 'drill') && l.completed).length;
  const minutes = Math.round((activeSeconds(plan, state) ?? plan.totalSeconds) / 60);
  const back = plan.steps.some(s => s.kind === 'checkpoint' && s.question === 'backSymptoms');
  return (
    <div className="min-h-dvh flex flex-col bg-background pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-[var(--block-mobility)]/15 animate-pop"><CheckIcon className="size-8 text-[var(--block-mobility)]" /></div>
          <h1 className="text-3xl font-bold">Session complete</h1>
          <p className="text-muted-foreground">{plan.label} · {minutes} minutes</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Stretches', mobilityDone], ['Sets', setsDone], ['Minutes', minutes]].map(([l, v]) => (
            <div key={l} className="rounded-xl border p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
          ))}
        </div>
        {back && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">How does your back feel now? (0 = no pain)</p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 11 }, (_, i) => i).map(i => (
                <button key={i} type="button" onClick={() => setPain(i)} aria-pressed={pain === i}
                  className={cn('h-11 rounded-lg border text-sm font-semibold', pain === i ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>{i}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          <Button className="h-14 text-base" disabled={saved} onClick={() => { onSave(state, pain); setSaved(true); toast.success('Saved to your history'); onExit(); }}>
            <CheckIcon /> Save and finish
          </Button>
        </div>
      </div>
    </div>
  );
}
