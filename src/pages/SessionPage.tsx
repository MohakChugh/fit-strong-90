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
import { loadProgress, loadExpiredProgress, rehydrate, clearProgress, setAside, slotOf, type ProgressSlot, type SavedProgress } from '@/session/persistence';
import { segmentsWithExtra } from '@/session/runner';
import { buildSessionPlan } from '@/engine/session';
import { getState, isSessionSaved, useStore } from '@/store/useStore';
import { toWorkoutSession, withGuidedSession, activeSeconds, bankProgress, progressSettled } from '@/session/logging';
import { getCoaching } from '@/data/coaching';
import { nameOf } from '@/data/catalog';
import { deriveHealth } from '@/engine/health';
import { CANNOT_SWALLOW, fluidLimit, glucoseSanity, TREAT } from '@/engine/readiness';
import { HOT_COOL_DOWN } from '@/engine/cardio';
import { PERMISSION_TEXT, type Mode, type Permission, type PermissionInput } from '@/engine/permission';
import { arrivalGate, liveGate, reconcilePlan, restartCapture, startGate } from '@/session/gate';
import type { CheckInRecord, DailyCheckIn, GlucoseEntry, Readiness, SymptomReach } from '@/types/checkin';
import type { SymptomReport } from '@/hooks/useGuided';
import { recheckCountdown } from '@/components/checkin/copy';
import { CheckInBody } from '@/components/checkin/CheckInSheet';
import type { SaveOutcome } from '@/components/checkin/sheetState';
import {
  LEG_QUESTIONS, NO_LEG, REACH, REACH_LABEL, SPREAD_QUESTION, STOP_CHOICES, legReport, onChoice, type LegAnswers, type StopChoice,
} from '@/components/checkin/stop';
import { Segmented } from '@/components/checkin/parts';
import type { UserProfile } from '@/types/profile';
import { parseStretchSpec, specFromPlanId, stretchPlanFor } from '@/engine/stretch';
import type { StretchSpec } from '@/types/plan';
import { cameFrom } from '@/components/hig/navigation';
import { SessionGate } from '@/components/checkin/SessionGate';
import { displayToKg, generateId, kgToDisplay, toDateString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { blockMinutes } from '@/components/today/blocks';
import { SessionProgress, TimerRing, BreathPacer } from '@/components/session/parts';
import { BLOCK_INK, BLOCK_LABEL, fmt } from '@/components/session/format';
import { InfoSheet } from '@/components/session/InfoSheet';
import { FigureSlot } from '@/components/session/FigureSlot';
import { cn } from '@/lib/utils';
import { timeOf } from '@/lib/time';
import {
  PauseIcon, PlayIcon, SkipForwardIcon, SkipBackIcon, InfoIcon, Volume2Icon, VolumeXIcon, XIcon,
  PlusIcon, MinusIcon, CheckIcon, CandyIcon, HeadphonesIcon, OctagonAlertIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/** Two stretch routines are the same when their area and length match. */
function sameSpec(a: StretchSpec | null, b: StretchSpec): boolean {
  return !!a && a.focus === b.focus && a.minutes === b.minutes;
}

interface Run {
  plan: SessionPlan;
  resumeState?: RunnerState;
  /** Stable across saves, so saving twice updates one session instead of two. */
  sessionId: string;
  /** Progress for another day that this run is about to overwrite. */
  stale?: SavedProgress;
}

export default function SessionPage() {
  const { data, update, profile, date, plan: todayPlan, checkIn, checkIns, reportSymptoms, saveCheckIn } = useGuided();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // A stretch asked for by its URL (Move → Start stretch), else the guided session.
  const [spec] = useState(() => parseStretchSpec(params));
  const mode: Mode = spec ? 'stretch' : 'guided';
  const slot: ProgressSlot = spec ? 'stretch' : 'guided';

  // Resume saved progress of the same kind (it keeps its original plan and
  // date), else today's plan. A stretch resumes only the same stretch today; a
  // stretch never resumes in place of a paused guided hour, nor the reverse.
  const [{ plan, resumeState, sessionId, stale }] = useState<Run>(() => {
    const fresh = spec ? stretchPlanFor({ ...data, checkIns }, profile, date, spec) : todayPlan;
    const saved = loadProgress(Date.now(), slot);
    const id = (p: SessionPlan) => `${p.kind === 'stretch' ? 'stretch' : 'guided'}-${p.date}-${generateId()}`;
    const sameRoutine = (p: SessionPlan) => !spec || sameSpec(specFromPlanId(p.id), spec);
    if (saved && (params.get('resume') === '1' || (saved.plan.date === fresh.date && sameRoutine(saved.plan)))) {
      return { plan: saved.plan, resumeState: rehydrate(saved.state, saved.clockAt, Date.now(), saved.plan), sessionId: saved.sessionId ?? id(saved.plan) };
    }
    // Progress from another day or another routine, or too old to resume,
    // survives here only until the first autosave of this run, so bank its
    // work before it goes (Review Focus #3).
    const old = saved ?? loadExpiredProgress(Date.now(), slot);
    return { plan: fresh, sessionId: id(fresh), ...(old ? { stale: old } : {}) };
  });

  // Saved progress is released only once the session record is durably
  // stored, so a phone lock on the summary, or a failed write, can never cost
  // the person the session (Codex data review F09).
  //
  // "Stored" is asked of the device, not taken from the write's reply: a
  // second save can reply "done" because the session already shows on screen
  // while the first write of it is still failing (acceptance J17 step 5).
  //
  // What is recorded is the plan the player ran: a saved plan re-dosed to
  // today's limits (round 3 B05) is the one done, so History holds its reps,
  // holds and cardio, never the saved plan's (scan C2-03).
  const ran = useRef<SessionPlan>(plan);
  const saveSession = async (state: RunnerState, painAfter?: number): Promise<boolean> => {
    const done = ran.current;
    const session = toWorkoutSession(done, state, { sessionId, checkIn, painAfter });
    const result = await update(prev => withGuidedSession(prev, session));
    const durable = result.ok && isSessionSaved(sessionId);
    if (durable && state.status === 'done') clearProgress(slotOf(done));
    return durable;
  };

  // The earlier run is banked before this one's first save can overwrite its
  // slot. If the device will not store it, it is kept aside under its own key
  // for Today to bank later, and the start screen says so (scan M-08).
  const [staleBank, setStaleBank] = useState<'kept' | 'lost' | undefined>();
  useEffect(() => {
    if (!stale) return;
    const id = stale.sessionId ?? `${stale.plan.kind === 'stretch' ? 'stretch' : 'guided'}-${stale.plan.date}-${stale.savedAt}`;
    // Nothing logged means nothing to lose, and History stays clean.
    void update(prev => bankProgress(prev, stale, id)).then(result => {
      if (result.ok && progressSettled(stale, id, getState().sessions, isSessionSaved)) return;
      setStaleBank(setAside(stale) ? 'kept' : 'lost');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  // Back where the person started (Move, Today), or Today after a fresh launch.
  const exit = () => (cameFrom() ? navigate(-1) : navigate('/today', { replace: true }));

  const input = useMemo(
    () => ({ profile, ...(checkIn ? { checkIn } : {}), now: new Date(), recent: checkIns }),
    [profile, checkIn, checkIns],
  );

  // What the app's own builders would prescribe now, for the same day and
  // focus, from today's answers: a saved plan's remaining work is held to it
  // (round 3 B05). For today's own plan it is that plan, so nothing changes.
  const fresh = useMemo(() => {
    if (plan.kind === 'stretch') {
      const s = specFromPlanId(plan.id) ?? spec;
      const built = s ? stretchPlanFor({ ...data, checkIns }, profile, date, s) : plan;
      // A stretch that sent symptoms further down rules out a new stretch
      // today, not the routine on screen (J2-04; acceptance J16 step 6). The
      // builder has no routine to offer then, so the one under way is held to
      // its own steps, less whatever today leaves out. Anything that stops the
      // routine itself is the live gate's.
      return built.kind === 'none' ? plan : built;
    }
    if (plan.date === date && plan.focus === todayPlan.focus) return todayPlan;
    return buildSessionPlan({
      profile, date: plan.date, startDate: data.settings.startDate,
      sessions: data.sessions.filter(x => x.date < plan.date),
      recentCheckIns: checkIns.filter(c => c.date < date),
      ...(checkIn ? { checkIn } : {}),
      focusOverride: plan.focus,
    });
  }, [plan, spec, data, checkIns, profile, date, todayPlan, checkIn]);
  const raw = useMemo(() => reconcilePlan(plan, resumeState?.index ?? 0, fresh, input), [plan, resumeState, fresh, input]);
  // Same content, same object: the player's runner and autosave key on it.
  const rawKey = `${JSON.stringify(raw.plan.steps)}|${[...raw.refused].sort().join(',')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reconciled = useMemo(() => raw, [rawKey]);
  // A back check asks about the exercise just done: once that exercise is left
  // out today there is nothing to ask, so its check goes with it (scan J2-02).
  const refused = useMemo(() => withBackChecks(reconciled.plan, reconciled.refused), [reconciled]);
  ran.current = reconciled.plan;
  // Opening this screen is starting, or starting again, so the full question
  // is asked — today's check-in, a recent enough reading (D29(6)), every
  // clinical condition and every profile rule. Saved progress is restored for
  // inspection either way; it is never permission to move (re-audit F02).
  const [arrival] = useState(() => ({ now: input.now, permission: arrivalGate(input, mode, !!resumeState) }));
  if (!arrival.permission.allowed || arrival.permission.needsCheckIn) {
    return <SessionGate permission={arrival.permission} readiness={checkIn?.readiness} now={arrival.now} onBack={exit} />;
  }
  // Afterwards the question is only whether exercise may carry on: a newly
  // reported emergency, stop or low halts it at once; an ageing reading does
  // not interrupt someone mid-movement (F03). Starting again after a pause is
  // a restart, asked in the player (round 3 B03).
  const halt = liveGate(input, mode);

  if (plan.kind === 'none') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-grouped-bg p-6 pt-safe pb-safe">
        <div className="flex max-w-sm flex-col gap-4 text-center">
          <h1 className="text-[length:var(--text-title-2)] font-bold">{spec ? 'No stretch today' : 'No session today'}</h1>
          {plan.readiness.reasons.filter(r => r.outcome !== 'green').map(r => <p key={r.code} className="text-[length:var(--text-body)]">{r.message}</p>)}
          <Button className="h-12" onClick={exit}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <Player
      plan={reconciled.plan}
      refused={refused}
      resumeState={resumeState}
      sessionId={sessionId}
      profile={profile}
      sessions={data.sessions}
      useMetric={data.settings.useMetric}
      mode={mode}
      halt={halt}
      input={input}
      checkIn={checkIn}
      checkIns={checkIns}
      onReport={reportSymptoms}
      onSaveCheckIn={saveCheckIn}
      onExit={exit}
      onSave={saveSession}
      {...(stale && staleBank ? { startNote: staleNote(stale, staleBank) } : {})}
    />
  );
}

/** The refused steps, with the back check of every exercise that is left out altogether (scan J2-02). */
function withBackChecks(plan: SessionPlan, refused: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set(refused);
  for (const s of plan.steps) {
    if (s.kind !== 'checkpoint' || s.question !== 'backSymptoms' || !s.exerciseId) continue;
    const work = plan.steps.filter(x => x.kind !== 'checkpoint' && 'exerciseId' in x && x.exerciseId === s.exerciseId);
    if (work.length > 0 && work.every(x => refused.has(x.id))) out.add(s.id);
  }
  return out.size === refused.size ? refused : out;
}

/** What the start screen says about an earlier run the device would not bank (scan M-08). */
function staleNote(stale: SavedProgress, how: 'kept' | 'lost'): string {
  const day = new Date(`${stale.plan.date}T12:00:00`).toLocaleDateString([], { weekday: 'long' });
  return how === 'kept'
    ? `Your unfinished session from ${day} could not be added to your history: this device is not saving right now. It is kept here, and Today will add it once saving works again.`
    : `Your unfinished session from ${day} could not be saved: this device has no room for it. Starting now replaces it.`;
}

interface PlayerProps {
  plan: SessionPlan;
  /** Steps today's restrictions refuse: the runner never enters them. */
  refused: ReadonlySet<string>;
  resumeState?: RunnerState;
  sessionId: string;
  profile: ReturnType<typeof useGuided>['profile'];
  sessions: ReturnType<typeof useGuided>['data']['sessions'];
  useMetric: boolean;
  mode: Mode;
  /** Today's answers no longer allow this mode: stop. */
  halt?: Permission;
  input: PermissionInput;
  checkIn?: CheckInRecord;
  /** Every day's effective check-in (`useGuided().checkIns`), for a check-in asked here. */
  checkIns: CheckInRecord[];
  /** Symptoms and readings said during the session, added to today's check-in (`useGuided().reportSymptoms`). */
  onReport: (r: SymptomReport, at?: Date) => Promise<{ record: CheckInRecord; stored: boolean }>;
  /** A check-in asked here, saved as Today saves one (`useGuided().saveCheckIn`). */
  onSaveCheckIn: (c: DailyCheckIn) => Promise<SaveOutcome>;
  onExit: () => void;
  onSave: (state: RunnerState, painAfter?: number) => Promise<boolean>;
  /** Said on the start screen, before anything can overwrite what it is about. */
  startNote?: string;
}

/**
 * A safety question the session is waiting on. While one is open nothing
 * moves, and there is no way to close it into a resume: it is answered, or
 * the session ends (re-audit round 3 B06, B09).
 */
type Flow =
  | { kind: 'low'; since: number }
  | { kind: 'checkpoint'; stepId: string; since: number }
  | { kind: 'symptoms'; exerciseId?: string };

/** The glucose readings in a record measured at or after `since`. */
function readingsSince(c: DailyCheckIn | undefined, since: number): GlucoseEntry[] {
  if (!c) return [];
  const entries = [...(c.glucoseEarlier ?? []), ...[c.glucose, c.glucoseDisplay].filter((x): x is NonNullable<typeof x> => !!x)];
  return entries.filter(e => {
    const t = e.measuredAt ? Date.parse(e.measuredAt) : Number.NaN;
    return !Number.isNaN(t) && t >= since;
  });
}

/** A low (under 70, or a meter showing LO) measured at or after `since`. */
function lowSince(c: DailyCheckIn | undefined, since: number): boolean {
  return readingsSince(c, since).some(e => {
    if ('display' in e) return e.display === 'LO';
    const mg = e.unit === 'mmol/L' ? e.value * 18 : e.value;
    return glucoseSanity(e.value, e.unit, e.unitConfirmed === true) !== 'implausible' && mg < 70;
  });
}

/** Holds that leave no exercise today: still under 70 at the re-check (D29(3)), or two lows in a day (scan J2-01). */
const LOWS_END_TODAY = new Set(['lowRepeat', 'recentLows']);

/**
 * What was just recorded during the run leaves no exercise today: an
 * emergency, a stop for today (a level 2 low, a meter showing LO, a low
 * someone had to help with, new weakness), or a low that ends the day. The
 * run is then over, and is filed into History at once.
 */
function endsToday(stop: Permission, readiness: Readiness): boolean {
  return stop.disposition === 'emergency' || stop.disposition === 'today' || readiness.reasons.some(r => LOWS_END_TODAY.has(r.code));
}

/** The movement under way at `index`, or the last one before it: what a stop for leg symptoms leaves out. */
function movementAt(plan: SessionPlan, index: number): string | undefined {
  for (let j = index; j >= 0; j--) {
    const s = plan.steps[j];
    if ((s.kind === 'set' || s.kind === 'hold' || s.kind === 'drill' || s.kind === 'cardio') && s.exerciseId) return s.exerciseId;
  }
  return undefined;
}

/**
 * What leg symptoms said at the stop control are put down to: the movement
 * under way or just finished. In a stretch the session itself is the
 * stretching, so before any stretch it is the one about to start: a spread
 * said during the welcome still ends new stretching for the day (J2-04).
 */
function provokingAt(plan: SessionPlan, index: number, mode: Mode, refused: ReadonlySet<string>): string | undefined {
  const done = movementAt(plan, index);
  if (done || mode !== 'stretch') return done;
  const ahead = plan.steps.slice(index + 1).find(s => (s.kind === 'hold' || s.kind === 'drill') && !refused.has(s.id));
  return ahead && 'exerciseId' in ahead ? ahead.exerciseId : undefined;
}

/** Focus for a screen that replaces the player, so it is announced and the keyboard starts there (scan M-11). */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}

function Player({ plan, refused, resumeState, sessionId, profile, sessions, useMetric, mode, halt, input, checkIns, onReport, onSaveCheckIn, onExit, onSave, startNote }: PlayerProps) {
  // The latest answers, for the questions asked inside event handlers.
  const inputRef = useRef(input);
  inputRef.current = input;
  /** A start or a restart this person may not make yet, and why. */
  const [refusal, setRefusal] = useState<Permission | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  /** "Stop: something's wrong" is open, on its first question or its dizziness follow-up. */
  const [stopping, setStopping] = useState<'choose' | 'dizzy' | null>(null);
  /**
   * When this run began, on the wall clock: a low measured since then is the
   * session's low, wherever it was entered — the restart check included —
   * and allows only the cool-down (scan M-02; spec §4.6).
   */
  const runStart = useRef(resumeState?.startedAt !== undefined ? Math.min(Date.now(), resumeState.startedAt) : Date.now());
  /**
   * Starting again after a pause is a restart (round 3 B03): today's
   * check-in, a fresh enough reading and every hold, asked at the moment of
   * the tap — on screen, from earphones or the lock screen. Exercise that never
   * stopped is not asked again just because its reading has aged.
   */
  const mayResume = () => {
    const p = startGate({ ...inputRef.current, now: new Date() }, mode);
    if (p.allowed && !p.needsCheckIn) {
      setRefusal(null);
      return true;
    }
    setRefusal(p);
    return false;
  };
  /** Every day's record, the freshest copy of today's first: a run can cross midnight (scan X2-08). */
  const records = () => [inputRef.current.checkIn, ...(inputRef.current.recent ?? [])].filter((c): c is CheckInRecord => !!c);
  /**
   * A low measured since this run began, on any day's record — wherever it
   * was entered, this screen or Today, and across midnight. From then on the
   * run allows only its cool-down (scan M-02; spec §4.6).
   */
  const lowInRun = () => records().some(c => lowSince(c, runStart.current));
  /** The newest record holding a reading taken since `since`: a low's own record, even once the date has changed. */
  const recordSince = (since: number) => records().reduce<CheckInRecord | undefined>(
    (best, c) => (readingsSince(c, since).length > 0 && (!best || c.date > best.date) ? c : best), undefined);
  // A safety question is on screen whenever one of these is: the stop control's
  // questions, a low, check or symptoms flow, a stop, or a restart waiting on
  // a reading or a check-in. Earphones and the lock screen cannot answer it (scan X2-04).
  const held = stopping !== null || flow !== null || !!halt || !!refusal;
  const g = useGuidedSession({ plan, profile, sessions, resumeState, sessionId, refused, mayResume, coolDownOnly: lowInRun, held });
  const reduced = useReducedMotion();
  const [infoOpen, setInfoOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const { state, position: pos, act } = g;
  // Reopened after a low that was settled elsewhere — on Today, or after
  // midnight: the run is moved to its cool-down, still paused, before
  // anything else can be shown or stepped back to (spec §4.6).
  useEffect(() => {
    if (resumeState && lowInRun()) act.toCoolDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const step = pos.step;
  const seg = pos.segment;
  const exerciseId = 'exerciseId' in step ? step.exerciseId : undefined;
  const coaching = exerciseId ? getCoaching(exerciseId) : undefined;
  const segTotal = segmentsWithExtra(step, state)[pos.segmentIndex]?.ms ?? 0;
  const color = BLOCK_INK[step.block];
  const health = deriveHealth(profile.health);
  const fluids = fluidLimit(profile.health);
  const segLabel = step.kind === 'cardio' ? cardioLabel(seg.label, fluids) : seg.label;

  /** The movements passed over, from the runner's own log rather than a second tally: a back check is not one. */
  const leftOut = useMemo(() => {
    const titles = state.logs.filter(l => l.skipped && refused.has(l.stepId)).map(l => plan.steps.find(x => x.id === l.stepId && x.kind !== 'checkpoint')?.title);
    return [...new Set(titles.filter((t): t is string => !!t))];
  }, [state.logs, refused, plan.steps]);

  // A stop stops the movement, not the record: the runner stays mounted so its
  // progress is saved, and the voice goes quiet.
  useEffect(() => {
    if (!halt) return;
    g.stopVoice();
    act.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halt]);

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

  /** A report through the shared check-in path, the same as Walk's; the engine decides what may carry on. */
  const report = async (r: SymptomReport, at?: Date): Promise<CheckInRecord> => {
    const { record } = await onReport(r, at);
    inputRef.current = { ...inputRef.current, checkIn: record };
    return record;
  };

  /** "I feel low": a stop from the moment it is said, until a reading taken after it settles it. */
  const reportLow = () => {
    act.pause();
    g.stopVoice();
    setStopping(null);
    const since = Date.now();
    setFlow({ kind: 'low', since });
    void report({ news: ['lowSymptoms'] }, new Date(since));
  };

  /** A reading saved from the low, checkpoint or restart screen, then what it allows. */
  const saveReading = async (reading: GlucoseEntry, extra: { neededHelp: boolean; recovered: boolean }) => {
    const record = await report({
      // A meter's HI or LO is recorded as the check-in records it (`glucoseDisplay`).
      ...('display' in reading ? { glucoseDisplay: reading } : { glucose: reading }),
      ...(extra.neededHelp ? { news: ['lowSevere' as const] } : {}),
      ...(extra.recovered ? { newsGone: ['lowSymptoms' as const], lowRecovered: true } : {}),
    });
    // Not allowed yet: the stop on screen says what is needed, and the flow stays open.
    const live = liveGate({ ...inputRef.current, checkIn: record, now: new Date() }, mode);
    if (live) {
      // A low found at the routine check or the restart check is looked after
      // as "I feel low" is: the 15 g treatment, the timed re-check, whether
      // symptoms have gone or someone had to help, then the cool-down only
      // (scan X2-05). Nothing on screen goes on promising cardio.
      const at = reading.measuredAt ? Date.parse(reading.measuredAt) : Date.now();
      if (flow?.kind !== 'low' && lowSince(record, at)) setFlow({ kind: 'low', since: at });
      // No exercise left today — a level 2 low, one someone had to help with,
      // still low at the re-check, an emergency: the run ends here and goes
      // into History now. The low's guidance stays on screen.
      if (endsToday(live, record.readiness)) { g.stopVoice(); act.finish(); }
      return;
    }
    const checkpoint = flow?.kind === 'checkpoint' ? flow.stepId : null;
    setFlow(null);
    if (checkpoint && !lowInRun()) {
      // A normal routine check: on to the cardio it was checking for (P27).
      act.log({ stepId: checkpoint, kind: 'checkpoint', completed: true, answer: 'measured' });
      act.next();
    }
    // After a low in this run, carrying on is the cool-down only (spec §4.6).
    act.resume();
  };

  /** Worse back or leg symptoms: that exercise stops now, for the day, before anything is asked (B09). */
  const reportWorse = (provoking: string | undefined) => {
    act.log({ stepId: step.id, kind: 'checkpoint', completed: true, answer: 'worse' });
    act.pause();
    g.stopVoice();
    setFlow({ kind: 'symptoms', ...(provoking ? { exerciseId: provoking } : {}) });
    if (provoking) void report({ provoked: [provoking] });
  };

  /** The answers after "Worse", the same builder as the stop control's and the walk's. */
  const saveSymptoms = async (a: LegAnswers) => {
    const record = await report({
      ...legReport(a, inputRef.current.checkIn?.back?.reach),
      ...(flow?.kind === 'symptoms' && flow.exerciseId ? { provoked: [flow.exerciseId] } : {}),
    });
    setFlow(null);
    if (liveGate({ ...inputRef.current, checkIn: record, now: new Date() }, mode)) return;
    act.next();
    act.resume();
  };

  /** "Stop: something's wrong": still, and quiet, before anything is asked. */
  const openStop = () => {
    act.pause();
    g.stopVoice();
    setExitOpen(false);
    setStopping('choose');
  };
  /** An emergency ends the session; the stop screen shows what to do. */
  const endIfEmergency = (record: CheckInRecord) => {
    if (record.readiness.disposition !== 'emergency') return;
    g.stopVoice();
    act.finish();
  };
  const stopChoice = async (choice: 'chest' | 'stroke' | 'breathless' | 'dizzy' | 'rest') => {
    const { report: said, next } = onChoice(choice, health.hypoRisk);
    setStopping(next === 'dizzy' ? 'dizzy' : null);
    if (said) endIfEmergency(await report(said));
  };
  /** Leg symptoms: reported, and the movement that brought them on is left out for the day. */
  const stopForLeg = async (a: LegAnswers) => {
    const provoking = provokingAt(plan, pos.stepIndex, mode, refused);
    // Leg symptoms that movement brought on are that movement made worse, as a
    // back check's "Worse" is: the session records it, the loading ladder
    // steps down and the Back & leg chart shows it (contract A-BACK, scan J2-02).
    if (provoking) act.log({ stepId: `stop-${provoking}`, kind: 'checkpoint', exerciseId: provoking, completed: true, answer: 'worse' });
    setStopping(null);
    const record = await report({ ...legReport(a, inputRef.current.checkIn?.back?.reach), ...(provoking ? { provoked: [provoking] } : {}) });
    // Leg symptoms that stop this mode stop it for the day: an emergency, new
    // weakness, a stretch that sent them further down. The run ends there, so
    // what was done and the worsening are in History now, not only when the
    // run is next banked; the stop on screen says what to do.
    const live = liveGate({ ...inputRef.current, checkIn: record, now: new Date() }, mode);
    if (live && endsToday(live, record.readiness)) { g.stopVoice(); act.finish(); }
  };

  const end = () => { setFlow(null); setStopping(null); g.stopVoice(); act.finish(); };

  /** The way on from a check-in asked here: Start on the ready screen, otherwise the restart question again. */
  const carryOn = () => {
    if (state.status !== 'ready') { act.resume(); return; }
    const p = startGate({ ...inputRef.current, now: new Date() }, mode);
    if (p.allowed && !p.needsCheckIn) { setRefusal(null); act.start(); } else setRefusal(p);
  };

  // What the screen shows, strictest first: a stop; then, once the session
  // is over, its summary — there is nothing left to carry on (scan M-09);
  // then the stop control's questions, a reading the session is waiting for,
  // a refused restart and an open question.
  const reading = flow?.kind === 'low' || flow?.kind === 'checkpoint';
  const stop = halt && !halt.needsCheckIn ? halt : refusal && !refusal.needsCheckIn ? refusal : null;
  const waiting = halt?.needsCheckIn ? halt : refusal?.needsCheckIn ? refusal : undefined;
  const firm = stop && (stop.disposition === 'emergency' || stop.disposition === 'today');
  if (stopping === 'dizzy' && !firm) return <DizzyScreen onLow={reportLow} onBack={() => setStopping(null)} />;
  // A low that ended the run (only that leaves the run done with the low
  // still open) keeps its own guidance on screen — the 15 g treatment, help
  // for someone who cannot swallow safely, the timed re-check and a place for
  // that reading — rather than a bare summary. An emergency shows the emergency.
  // A low's readings, and the record that times its re-check, even across midnight (scan X2-08).
  const lowRecord = flow?.kind === 'low' ? recordSince(flow.since) : undefined;
  const endedBy = state.status === 'done' && flow?.kind === 'low' ? halt ?? refusal : null;
  if (endedBy && endedBy.disposition !== 'emergency') {
    return (
      <ReadingScreen key="low-ended" kind="low" ended permission={endedBy} record={lowRecord ?? inputRef.current.checkIn} measured profile={profile}
        onSave={saveReading} onEnd={end} onLeave={onExit} />
    );
  }
  if (stop) return <SessionGate permission={stop} readiness={inputRef.current.checkIn?.readiness} now={new Date()} onBack={onExit} />;
  if (state.status === 'done') return <Summary plan={plan} state={state} onSave={onSave} onExit={onExit} {...(waiting ? { guidance: waiting } : {})} />;
  if (stopping === 'choose') {
    return <StopScreen reach={inputRef.current.checkIn?.back?.reach} onChoice={c => void stopChoice(c)} onLeg={a => stopForLeg(a)} />;
  }
  if (reading || waiting) {
    const now = new Date();
    if (!reading && waiting && restartCapture({ ...inputRef.current, now }) === 'checkIn') {
      const day = toDateString(now);
      return (
        <CheckInScreen key={day} permission={waiting} profile={profile} date={day} record={checkIns.find(c => c.date === day)} recent={checkIns}
          mode={mode} starting={state.status === 'ready'} onSave={onSaveCheckIn} onCarryOn={carryOn} onEnd={end} onLeave={onExit} />
      );
    }
    const kind = flow?.kind === 'low' ? 'low' : flow?.kind === 'checkpoint' ? 'checkpoint' : 'restart';
    return (
      // A new kind is a new screen: its heading takes the focus, so it is announced.
      <ReadingScreen
        key={kind}
        kind={kind}
        permission={waiting}
        record={lowRecord ?? inputRef.current.checkIn}
        measured={!!lowRecord}
        profile={profile}
        onSave={saveReading}
        onEnd={end}
        onLeave={onExit}
      />
    );
  }
  if (flow?.kind === 'symptoms') return <SymptomsScreen profile={profile} reach={inputRef.current.checkIn?.back?.reach} onSave={saveSymptoms} onEnd={end} />;
  if (state.status === 'ready') {
    // The ready screen can sit open while a reading goes stale, so the tap is
    // its own question (F03).
    const start = () => {
      const p = startGate({ ...inputRef.current, now: new Date() }, mode);
      if (p.allowed && !p.needsCheckIn) act.start(); else setRefusal(p);
    };
    return <StartScreen plan={plan} voiceName={g.voiceName} muted={g.muted} setMuted={act.setMuted} mix={mixesWithMusic(profile)} note={startNote} onStart={start} onExit={onExit} />;
  }

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
          <button type="button" onClick={reportLow} className="flex min-h-11 items-center gap-1 rounded-full px-3 normal-case tracking-normal text-[var(--safety)] font-semibold">
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
      {g.voiceTrouble === 'silent' && !g.muted && (
        <p role="status" className="mx-4 mt-2 rounded-xl bg-muted px-4 py-2 text-xs text-muted-foreground">
          The coach’s voice isn’t playing on this phone right now. Follow the captions below.
        </p>
      )}
      {paused && mixesWithMusic(profile) && (
        <p className="mx-4 mt-2 rounded-xl bg-muted px-4 py-2 text-xs text-muted-foreground">{SILENT_SWITCH_NOTE}</p>
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
              <p className="text-sm text-muted-foreground">{subtitleFor(step, segLabel, fluids)}</p>
            </div>
            {seg.side && (
              <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--on-ink)]" style={{ background: color }}>
                {seg.side}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <TimerRing remainingMs={pos.segmentRemainingMs} totalMs={segTotal} color={color} size={104}
              label={step.kind === 'set' && seg.rep ? `Rep ${seg.rep} of ${step.reps}` : seg.kind === 'rest' ? 'Rest' : segLabel} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {(seg.kind === 'hold' || seg.breath) && <BreathPacer segment={seg} segmentElapsedMs={pos.segmentElapsedMs} reduced={reduced} />}
              {step.kind === 'set' && seg.kind === 'rep' && (
                <p className="text-2xl font-bold">{seg.repPhase === 'lift' ? 'Exhale · lift' : seg.repPhase === 'lower' ? 'Inhale · lower' : 'Pause'}</p>
              )}
              {step.kind === 'cardio' && <CardioHint intensity={seg.intensity} />}
              <p className="text-sm text-muted-foreground">
                {step.kind === 'checkpoint' && step.question === 'glucose' && pos.stepRemainingMs === 0 ? 'Answer to carry on' : `Step ends in ${fmt(pos.stepRemainingMs)}`}
              </p>
            </div>
          </div>

          <p className="min-h-[3rem] rounded-xl bg-muted/60 p-3 text-base leading-snug" aria-live="polite">
            {g.caption || (paused ? 'Paused.' : '…')}
          </p>

          {step.kind === 'set' && <SetPanel step={step} state={state} useMetric={useMetric} onLog={act.log} onDone={() => act.next('doneEarly')} />}
          {step.kind === 'rest' && <RestPanel plan={plan} index={pos.stepIndex} state={state} useMetric={useMetric} onLog={act.log} />}
          {step.kind === 'checkpoint' && (
            <CheckpointPanel step={step} onAnswer={answer => {
              // The glucose check is answered by a reading, never by a tap: it is
              // logged only once the reading is in and allows carrying on (B06).
              if (step.question === 'glucose') { act.pause(); setFlow({ kind: 'checkpoint', stepId: step.id, since: Date.now() }); return; }
              if (answer === 'worse') { reportWorse(lastExerciseId(plan, pos.stepIndex)); return; }
              act.log({ stepId: step.id, kind: 'checkpoint', completed: true, answer });
              act.next();
            }} />
          )}
          {leftOut.length > 0 && (
            <p role="status" className="rounded-xl bg-muted/60 p-3 text-[length:var(--text-subhead)]">
              Left out today, because of your check-in: {leftOut.join(', ')}.
            </p>
          )}
        </div>
      </div>

      {/* Always there while moving or paused: pauses at once, then asks what is wrong (J02, J08, J16). */}
      <div className="px-4 pb-2 pt-1">
        <button type="button" onClick={openStop}
          className="press-feedback flex min-h-12 w-full flex-col items-center justify-center rounded-xl bg-[var(--safety)]/10 px-4 py-1.5 text-[var(--safety)]">
          <span className="flex items-center gap-1.5 text-[length:var(--text-body)] font-semibold"><OctagonAlertIcon className="size-4" aria-hidden /> Stop: something’s wrong</span>
          <span className="text-[length:var(--text-footnote)]">Pain, symptoms or feeling unwell</span>
        </button>
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

    </div>
  );
}

/**
 * "Play over my music" uses the iPhone's mixing audio category, which the
 * silent switch and screen lock both mute (WebKit maps it to Ambient).
 */
const mixesWithMusic = (profile: { voice: { mode: string } }) => profile.voice.mode === 'overMusic' && typeof navigator !== 'undefined' && 'audioSession' in navigator;
const SILENT_SWITCH_NOTE = 'Playing over your music: switch silent mode off, or the coach can’t be heard.';

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

/**
 * A rest's own line, with only the drinking advice this profile may be given
 * (contract H-DIZZY; Codex re-audit F13): never "sip water" with a fluid limit,
 * and only conditionally when the question has not been answered.
 */
const REST_LINE: Record<ReturnType<typeof fluidLimit>, string> = {
  limited: 'Recover, breathe slowly, keep to your fluid plan',
  free: 'Recover, breathe slowly, sip water',
  unknown: 'Recover, breathe slowly, sip water unless you have a fluid limit',
};

/**
 * A cardio part's own label. A hot day's spare cool-down is said for the
 * profile as it is now, as the rest line is, whichever profile a saved plan
 * was built for.
 */
const cardioLabel = (label: string, fluids: ReturnType<typeof fluidLimit>) => (Object.values(HOT_COOL_DOWN).includes(label) ? HOT_COOL_DOWN[fluids] : label);

function subtitleFor(step: Step, segLabel: string, fluids: ReturnType<typeof fluidLimit>): string {
  switch (step.kind) {
    case 'set': return step.ramp ? `Warm-up set ${step.set} · ${step.reps} easy reps` : `Set ${step.set} of ${step.of} · ${step.holdSeconds ? `${step.holdSeconds} s hold` : step.carrySeconds ? `${step.carrySeconds} s walk` : `${step.reps} reps`}${step.sides ? ' each side' : ''}`;
    case 'hold': return `${step.sets > 1 ? `${step.sets} × ` : ''}${step.holdSeconds} s${step.sides ? ' each side' : ''}`;
    case 'drill': return step.breathing ? `${step.reps} slow breaths` : `${step.reps} reps${step.sides ? ' each side' : ''}`;
    case 'setup': return 'Set up the station while I explain';
    case 'rest': return step.nextStepId ? '' : REST_LINE[fluids];
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

function SetPanel({ step, state, useMetric, onLog, onDone }: { step: SetStep; state: RunnerState; useMetric: boolean; onLog: ReturnType<typeof useGuidedSession>['act']['log']; onDone: () => void }) {
  const log = state.logs.find(l => l.stepId === step.id);
  const kg = log?.weightKg ?? step.load.kg;
  const showWeight = step.load.note !== 'bodyweight' && !step.ramp;
  return (
    <div className="flex flex-col gap-2">
      {showWeight && (
        <Stepper label={step.load.note === 'firstTime' && kg === null ? 'Weight (find yours)' : 'Weight'}
          value={kg === null ? 0 : kgToDisplay(kg, useMetric)} step={useMetric ? 2.5 : 5} suffix={useMetric ? ' kg' : ' lb'}
          onChange={v => onLog({ stepId: step.id, kind: 'set', completed: log?.completed ?? false, reps: log?.reps ?? step.reps, weightKg: displayToKg(v, useMetric), exerciseId: step.exerciseId })} />
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
        <Stepper label="Weight" value={kg === null ? 0 : kgToDisplay(kg, useMetric)} step={useMetric ? 2.5 : 5} suffix={useMetric ? ' kg' : ' lb'}
          onChange={v => onLog({ ...base, reps, weightKg: displayToKg(v, useMetric) })} />
      )}
      {next && <p className="text-sm">Next: <span className="font-semibold">{next.kind === 'set' && next.exerciseId === prev.exerciseId ? `Set ${next.set} of ${next.of}` : nameOf((next as { exerciseId: string }).exerciseId)}</span></p>}
    </div>
  );
}

function CheckpointPanel({ step, onAnswer }: { step: Extract<Step, { kind: 'checkpoint' }>; onAnswer: (a: string) => void }) {
  if (step.question === 'glucose') {
    // The number decides, so there is nothing else to tap (F08).
    return <Button className="h-12 text-base" onClick={() => onAnswer('measured')}>Enter my glucose</Button>;
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['better', 'same', 'worse'] as const).map(a => (
        <Button key={a} variant={a === 'worse' ? 'outline' : 'secondary'} className={cn('h-14 text-base capitalize', a === 'worse' && 'border-[var(--safety)] text-[var(--safety)]')} onClick={() => onAnswer(a)}>{a}</Button>
      ))}
    </div>
  );
}

/** The exercise a checkpoint is asking about: the last one before it. */
function lastExerciseId(plan: SessionPlan, index: number): string | undefined {
  for (let j = index; j >= 0; j--) {
    const s = plan.steps[j];
    if (s.kind !== 'checkpoint' && 'exerciseId' in s && s.exerciseId) return s.exerciseId;
  }
  return undefined;
}

/** A row on a full-screen question: a whole-width tap target, never under 44 points. */
const ROW = 'flex min-h-12 w-full items-start gap-3 rounded-xl bg-grouped-card px-4 py-3 text-left text-[length:var(--text-subhead)]';

/**
 * A glucose reading the session is waiting for (contract H-HYPO, D29(3),
 * D29(6); re-audit round 3 B03, B06). Full screen, with no close button: it
 * is answered, or the session ends or is left with its progress saved.
 *
 * - `low` — "I feel low", or a low found at the routine check or the restart
 *   check (scan X2-05): the reading now, before treating if possible, then
 *   the re-check, with the 15 g treatment and help for someone who cannot
 *   swallow safely. Whether someone had to help is asked too (level 3).
 * - `checkpoint` — the routine check before cardio; cardio starts only once
 *   the reading is in and allows it.
 * - `restart` — resuming after a pause needs a fresh enough reading. Asked
 *   only when a reading is all the restart waits on, of someone whose
 *   check-in asks for one; anything else is the check-in's (scan M-01).
 *
 * The number is judged as the check-in judges it (`glucoseSanity`): one that
 * does not fit the unit shown is asked about before it is saved, so a slip of
 * the unit never becomes advice (scan X2-18). The reading then goes through
 * the check-in path, so the engine decides.
 */
function ReadingScreen({ kind, permission, record, measured = false, ended = false, profile, onSave, onEnd, onLeave }: {
  kind: 'low' | 'checkpoint' | 'restart';
  permission?: Permission;
  record?: CheckInRecord;
  /** A reading is already in for this low: the next one is the re-check. */
  measured?: boolean;
  /** The low left no exercise today and ended the run: what stays is the low's own care. */
  ended?: boolean;
  profile: UserProfile;
  onSave: (reading: GlucoseEntry, extra: { neededHelp: boolean; recovered: boolean }) => Promise<void>;
  onEnd: () => void;
  onLeave: () => void;
}) {
  const [value, setValue] = useState('');
  // A meter showing HI or LO has no number to type: asked as Quick Log and the check-in ask it.
  const [askDisplay, setAskDisplay] = useState(false);
  const [shows, setShows] = useState<'number' | 'HI' | 'LO'>('number');
  const display = shows === 'number' ? null : shows;
  const [unit, setUnit] = useState(profile.health.glucoseUnit);
  /** The person said the number really is in the unit shown (the check-in's "really"). */
  const [unitConfirmed, setUnitConfirmed] = useState(false);
  const [neededHelp, setNeededHelp] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const typed = value.trim();
  const n = Number(typed);
  const sanity = typed !== '' && Number.isFinite(n) ? glucoseSanity(n, unit, unitConfirmed) : null;
  const usable = display !== null || sanity === 'ok';
  const now = new Date();
  const due = record?.readiness.recheckAt ? Date.parse(record.readiness.recheckAt) : Number.NaN;
  const wait = (permission && record ? recheckCountdown(permission, record.readiness, now) : null)
    // On the low screen the re-check is the low's own (H-HYPO), not a way back
    // to exercise: shown whatever today's answer is, after the run has ended
    // or the date has changed.
    ?? (kind === 'low' && due > now.getTime() ? { due, minutes: Math.ceil((due - now.getTime()) / 60_000) } : null);
  const countdown = wait ? `Measure again in ${wait.minutes} minute${wait.minutes === 1 ? '' : 's'}, at ${timeOf(wait.due)}.` : null;
  const save = async () => {
    if (!usable || busy) return;
    setBusy(true);
    const source = profile.health.glucoseMonitor === 'cgm' ? 'sensor' as const : 'meter' as const;
    const measuredAt = new Date().toISOString();
    try {
      await onSave(display
        ? { display, measuredAt, source }
        : { value: n, unit, measuredAt, source, ...(unitConfirmed ? { unitConfirmed: true } : {}) }, { neededHelp, recovered });
    } finally {
      setBusy(false);
      setValue('');
      setUnitConfirmed(false);
      setShows('number');
    }
  };
  const title = kind === 'low' ? 'Treat the low first' : kind === 'checkpoint' ? 'Check your glucose' : 'Check your glucose before you carry on';
  const lead = kind === 'low'
    ? ended
      ? 'No exercise today: this session has ended. Stay sitting down, and enter your next reading here.'
      : measured
      ? 'Stay sitting down, and enter your next reading here.'
      : 'Stop and sit down. Check your glucose now, before you treat it if you can, and enter what the meter shows.'
    : kind === 'checkpoint'
      ? 'Measure now and enter the reading. Cardio starts once it is in.'
      : 'Starting again after a break needs a recent reading.';
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
        <h1 ref={heading} tabIndex={-1} className="text-[length:var(--text-title-2)] font-bold leading-tight outline-none">{title}</h1>
        <p className="text-[length:var(--text-body)]">{lead}</p>
        {permission?.reasons.slice(0, 2).map(r => <p key={r} className="text-[length:var(--text-subhead)] text-muted-foreground">{r}</p>)}
        {kind === 'low' && (
          <>
            {/* The check-in's own treatment sentence, so the two never disagree (H-HYPO). */}
            <div className="flex flex-col gap-1 text-[length:var(--text-subhead)]">
              <p className="font-semibold">If it is low</p>
              <p>{TREAT}</p>
            </div>
            {/* The walk's words, word for word: nothing by mouth for someone who cannot swallow safely (E-HYPO, scan X2-17). */}
            <div className="flex flex-col gap-1 text-[length:var(--text-subhead)]">
              <p className="font-semibold">{CANNOT_SWALLOW.title}</p>
              <p>{CANNOT_SWALLOW.line}</p>
              <p><span className="font-semibold text-stop">{PERMISSION_TEXT.emergencyTitle}.</span> {PERMISSION_TEXT.emergencyCall}</p>
            </div>
          </>
        )}
        {countdown && <p role="status" className="text-[length:var(--text-subhead)] font-semibold">{countdown}</p>}
        {!display && (
          <>
          <div className="flex items-center gap-2 rounded-xl bg-grouped-card px-4 py-3">
            <label htmlFor="session-glucose" className="flex-1 text-[length:var(--text-body)]">Glucose now</label>
            <input id="session-glucose" type="text" inputMode="decimal" autoComplete="off" value={value} placeholder="Reading"
              onChange={e => { setValue(e.target.value.replace(',', '.')); setUnitConfirmed(false); }}
              className="h-11 w-24 rounded-lg bg-muted px-3 text-right text-base tabular-nums outline-none" />
            <button type="button" onClick={() => { setUnit(unit === 'mg/dL' ? 'mmol/L' : 'mg/dL'); setUnitConfirmed(false); }}
              aria-label={`Unit: ${unit}. Tap to change.`} className="min-h-11 min-w-[4.25rem] rounded-lg px-1 text-sm text-tint">{unit}</button>
          </div>
          {/* The check-in's unit question: over 34 mmol/L is past what a meter reads. */}
          {sanity === 'suspectUnit' && (
            <div role="alert" className="flex flex-col gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
              <p>That looks like mg/dL rather than mmol/L. Which does your meter show?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setUnit('mg/dL')} className={UNIT_CHOICE}>{typed} mg/dL</button>
                <button type="button" onClick={() => setUnitConfirmed(true)} className={UNIT_CHOICE}>{typed} mmol/L, really</button>
              </div>
            </div>
          )}
          {/* Under 34 mg/dL is a severe low or a mmol/L number: asked plainly, without leaning either way. */}
          {sanity === 'ambiguousLow' && (
            <div role="alert" className="flex flex-col gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
              <p>Check the unit. Which does your meter show?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setUnitConfirmed(true)} className={UNIT_CHOICE}>{typed} mg/dL</button>
                <button type="button" onClick={() => setUnit('mmol/L')} className={UNIT_CHOICE}>{typed} mmol/L</button>
              </div>
            </div>
          )}
          {sanity === 'implausible' && (
            <p role="alert" className="text-[length:var(--text-subhead)] text-stop">That reading can’t be used. Measure again and enter the number shown.</p>
          )}
          </>
        )}
        {/* Quick Log's and the check-in's question: a meter past what it can measure shows HI or LO, not a number. */}
        {askDisplay ? (
          <div className="flex flex-col gap-2 rounded-xl bg-grouped-card px-4 py-3">
            <span className="text-[length:var(--text-body)]">What the meter shows</span>
            <Segmented<'number' | 'HI' | 'LO'> label="What the meter shows" value={shows} onChange={setShows}
              options={[{ value: 'number', label: 'A number' }, { value: 'HI', label: 'HI' }, { value: 'LO', label: 'LO' }]} />
            {display && <p className="text-[length:var(--text-subhead)] text-muted-foreground">{`A meter shows ${display} when the glucose is past what it can measure.`}</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setAskDisplay(true)} className="min-h-11 self-start px-1 text-[length:var(--text-body)] font-medium text-tint">
            Meter shows HI or LO?
          </button>
        )}
        {kind !== 'checkpoint' && !ended && (
          <label className={ROW}>
            <input type="checkbox" className="mt-1 size-5 shrink-0" checked={recovered} onChange={e => setRecovered(e.target.checked)} />
            <span>My symptoms have gone, and my care plan lets me exercise after a treated low.</span>
          </label>
        )}
        {kind === 'low' && (
          <label className={ROW}>
            <input type="checkbox" className="mt-1 size-5 shrink-0" checked={neededHelp} onChange={e => setNeededHelp(e.target.checked)} />
            <span>Someone else had to help me treat this low.</span>
          </label>
        )}
        <div className="mt-auto flex flex-col gap-2">
          <Button className="h-12" disabled={!usable || busy} onClick={() => void save()}>Save this reading</Button>
          {ended ? (
            <Button variant="outline" className="h-12" onClick={onLeave}>Back to Today</Button>
          ) : (
            <>
              <Button variant="outline" className="h-12" onClick={onEnd}>End session</Button>
              <Button variant="ghost" className="h-12" onClick={onLeave}>Leave, and come back later</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A unit answer on the reading screen: a tap target never under 44 points. */
const UNIT_CHOICE = 'min-h-11 rounded-lg bg-muted px-3 text-tint';

/**
 * Today's check-in, asked in the player when a restart needs it (scan M-01):
 * a session left open past midnight, a day started only by something said
 * during movement, or a hold only a changed answer settles. The same sheet
 * body as Today's, so the same rules decide; its Start carries on here.
 */
function CheckInScreen({ permission, profile, date, record, recent, mode, starting, onSave, onCarryOn, onEnd, onLeave }: {
  permission: Permission;
  profile: UserProfile;
  date: string;
  record?: CheckInRecord;
  recent: CheckInRecord[];
  mode: Mode;
  /** Not started yet: its button starts rather than carries on. */
  starting: boolean;
  onSave: (c: DailyCheckIn) => Promise<SaveOutcome>;
  onCarryOn: () => void;
  onEnd: () => void;
  onLeave: () => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        <h1 ref={heading} tabIndex={-1} className="px-1 text-[length:var(--text-title-2)] font-bold leading-tight outline-none">
          {starting ? 'Check in to start' : 'Check in to carry on'}
        </h1>
        {permission.reasons.slice(0, 2).map(r => <p key={r} className="px-1 text-[length:var(--text-body)]">{r}</p>)}
        <CheckInBody open onOpenChange={() => {}} profile={profile} date={date} {...(record ? { initial: record } : {})} recent={recent}
          onSave={onSave} onStart={onCarryOn} mode={mode} {...(starting ? {} : { startLabel: 'Carry on' })} />
        <div className="mt-auto flex flex-col gap-2">
          <Button variant="outline" className="h-12" onClick={onEnd}>End session</Button>
          <Button variant="ghost" className="h-12" onClick={onLeave}>Leave, and come back later</Button>
        </div>
      </div>
    </div>
  );
}

/** Leg answers, as one screen shows them: how far down, and the questions with "getting worse quickly" under a weakness. */
function LegQuestions({ answers, setAnswers, reachAsked, spreadAsked }: {
  answers: LegAnswers;
  setAnswers: (f: (a: LegAnswers) => LegAnswers) => void;
  reachAsked: boolean;
  spreadAsked: boolean;
}) {
  type Key = (typeof LEG_QUESTIONS)[number]['key'] | typeof SPREAD_QUESTION.key;
  const toggle = (k: Key) => setAnswers(a => ({ ...a, [k]: !a[k], ...(k === 'weakness' && a.weakness ? { fast: false } : {}) }));
  const rows = [...(spreadAsked ? [SPREAD_QUESTION] : []), ...LEG_QUESTIONS.filter(q => q.key !== 'fast' || answers.weakness)];
  return (
    <>
      {reachAsked && (
        <div className="flex flex-col gap-2 rounded-xl bg-grouped-card px-4 py-3">
          <span id="leg-reach" className="text-[length:var(--text-body)]">How far down symptoms reach now</span>
          <div role="radiogroup" aria-labelledby="leg-reach" className="flex flex-wrap gap-1.5">
            {REACH.map(r => (
              <button key={r} type="button" role="radio" aria-checked={answers.reach === r} onClick={() => setAnswers(x => ({ ...x, reach: r }))}
                className={cn('min-h-11 min-w-11 rounded-lg px-3 text-[length:var(--text-subhead)]', answers.reach === r ? 'bg-tint font-semibold text-on-tint' : 'bg-muted')}>
                {REACH_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      {rows.map(q => (
        <label key={q.key} className={ROW}>
          <input type="checkbox" className="mt-1 size-5 shrink-0" checked={answers[q.key] === true} onChange={() => toggle(q.key)} />
          <span>{q.label}</span>
        </label>
      ))}
    </>
  );
}

/**
 * What changed, when a back or leg checkpoint is answered "worse" (contract
 * A-BACK; re-audit F14, round 3 B09). The movement that provoked it is
 * already left out for the day by the time this shows. Full screen, with no
 * close button: it is answered, or the session ends. The answers go into
 * today's check-in through the same builder as the stop control's and the
 * walk's, so the engine chooses between a stop and carrying on; no pain
 * number clears anything here.
 */
function SymptomsScreen({ profile, reach, onSave, onEnd }: {
  profile: UserProfile;
  reach?: SymptomReach;
  onSave: (a: LegAnswers) => Promise<void>;
  onEnd: () => void;
}) {
  const [a, setA] = useState<LegAnswers>({ ...NO_LEG, ...(reach ? { reach } : {}) });
  const [busy, setBusy] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const save = async () => {
    setBusy(true);
    try { await onSave(a); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
        <h1 ref={heading} tabIndex={-1} className="text-[length:var(--text-title-2)] font-bold leading-tight outline-none">That exercise stops here</h1>
        <p className="text-[length:var(--text-body)]">It is left out for the rest of today. Before carrying on: is any of this true now?</p>
        <LegQuestions answers={a} setAnswers={setA} reachAsked={profile.pain.areas.includes('sciatica')} spreadAsked={false} />
        <div className="mt-auto flex flex-col gap-2">
          <Button className="h-12" disabled={busy} onClick={() => void save()}>Save, and carry on without it</Button>
          <Button variant="outline" className="h-12" onClick={onEnd}>End session</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Stop: something's wrong" (acceptance J02, J08, J16): the player is
 * already paused and quiet when this shows. The same rows as the walk's "I
 * need to stop", from the same builder: an emergency in one tap ends the
 * session; dizziness is reported, and for someone who can go low it asks
 * about a low; leg symptoms are answered here and leave the movement that
 * brought them on out for the day; a rest records nothing. Nothing but an
 * emergency ends the session, and nothing here resumes it: carrying on is
 * the restart question's.
 */
function StopScreen({ reach, onChoice: choose, onLeg }: {
  reach?: SymptomReach;
  onChoice: (c: 'chest' | 'stroke' | 'breathless' | 'dizzy' | 'rest') => void;
  onLeg: (a: LegAnswers) => Promise<void>;
}) {
  const [leg, setLeg] = useState<LegAnswers>({ ...NO_LEG, spread: false, ...(reach ? { reach } : {}) });
  const [busy, setBusy] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const urgent = STOP_CHOICES.filter(c => c.choice === 'chest' || c.choice === 'stroke' || c.choice === 'breathless');
  const label = (c: StopChoice) => STOP_CHOICES.find(x => x.choice === c)!.label;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stop-title" className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
        <h1 id="stop-title" ref={heading} tabIndex={-1} className="text-[length:var(--text-title-2)] font-bold leading-tight outline-none">Stop: something’s wrong</h1>
        <p className="text-[length:var(--text-body)]">The session is paused. What is happening?</p>
        <div className="flex flex-col gap-2">
          {urgent.map(c => (
            <button key={c.choice} type="button" onClick={() => choose(c.choice as 'chest' | 'stroke' | 'breathless')}
              className={cn(ROW, 'font-semibold text-[var(--safety)]')}>{c.label}</button>
          ))}
          <button type="button" onClick={() => choose('dizzy')} className={ROW}>{label('dizzy')}</button>
          <button type="button" onClick={() => choose('rest')} className={ROW}>{label('rest')}</button>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-[length:var(--text-body)] font-semibold">{label('leg')}</legend>
          <LegQuestions answers={leg} setAnswers={setLeg} reachAsked spreadAsked />
          <Button className="h-12" disabled={busy} onClick={() => { setBusy(true); void onLeg(leg).finally(() => setBusy(false)); }}>
            Save, and leave this movement out today
          </Button>
        </fieldset>
      </div>
    </div>
  );
}

/** Dizziness, for someone whose medicines can cause a low: it may be one, so the low path is offered first. */
function DizzyScreen({ onLow, onBack }: { onLow: () => void; onBack: () => void }) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dizzy-title" className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
        <h1 id="dizzy-title" ref={heading} tabIndex={-1} className="text-[length:var(--text-title-2)] font-bold leading-tight outline-none">Sit down</h1>
        <p className="text-[length:var(--text-body)]">With your medicines, dizziness can be a low. Check your glucose now.</p>
        <div className="mt-auto flex flex-col gap-2">
          <Button className="h-12" onClick={onLow}>I feel low</Button>
          <Button variant="outline" className="h-12" onClick={onBack}>It is not a low</Button>
        </div>
      </div>
    </div>
  );
}

function StartScreen({ plan, voiceName, muted, setMuted, mix, note, onStart, onExit }: { plan: SessionPlan; voiceName: string | null; muted: boolean; setMuted: (m: boolean) => void; mix: boolean; note?: string; onStart: () => void; onExit: () => void }) {
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.kind === 'recovery' ? 'Recovery session' : plan.kind === 'stretch' ? 'Stretch' : 'Today'}</p>
          <h1 className="text-3xl font-bold tracking-tight">{plan.label}</h1>
        </div>
        {note && <p role="status" className="rounded-xl bg-caution/15 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">{note}</p>}
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
            {mix && !muted && <p className="text-muted-foreground">{SILENT_SWITCH_NOTE}</p>}
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

/**
 * The end of a session: what was done, the back rating the wrap-up asks
 * for, and whatever the day still asks — a low to look after, say — since
 * nothing here carries on (scan M-09).
 *
 * "Saved" is said only of a session the device has durably stored. When the
 * device is not saving at all ("Continue without saving"), the session is
 * kept only until the app closes, and the summary says so (scan M-07).
 */
function Summary({ plan, state, guidance, onSave, onExit }: {
  plan: SessionPlan;
  state: RunnerState;
  /** A hold still open when the session ended: what it asks, shown before anything else. */
  guidance?: Permission;
  onSave: (s: RunnerState, painAfter?: number) => Promise<boolean>;
  onExit: () => void;
}) {
  const [pain, setPain] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const notSaving = useStore().status === 'unavailable';
  const setsDone = state.logs.filter(l => l.kind === 'set' && l.completed).length;
  const mobilityDone = state.logs.filter(l => (l.kind === 'hold' || l.kind === 'drill') && l.completed).length;
  const minutes = Math.round((activeSeconds(plan, state) ?? plan.totalSeconds) / 60);
  const stretch = plan.kind === 'stretch';
  const stats: [string, number][] = plan.kind === 'full'
    ? [['Stretches', mobilityDone], ['Sets', setsDone], ['Minutes', minutes]]
    : [['Stretches', mobilityDone], ['Minutes', minutes]];

  // Saved the moment the summary appears, so the session is in History even
  // if the phone locks here; Save and finish adds the back rating to the same
  // record (it carries the same id).
  const firstSave = useRef(onSave);
  useEffect(() => { void firstSave.current(state); }, [state]);

  const finish = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave(state, pain);
    setSaving(false);
    if (ok) { toast.success('Saved'); onExit(); return; }
    // Nothing is being saved on this device: there is nothing to try again,
    // so it goes, kept for now, and says so.
    if (notSaving) { toast.warning('Kept until you close the app: this device isn’t saving.'); onExit(); return; }
    setFailed(true);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-tint/15 animate-pop"><CheckIcon className="size-8 text-tint" aria-hidden /></div>
          <h1 className="text-[length:var(--text-large-title)] font-bold leading-tight">{stretch ? 'Stretch complete' : 'Session complete'}</h1>
          <p className="text-[length:var(--text-body)] text-muted-foreground">{plan.label} · {minutes} minutes</p>
        </div>
        {guidance && guidance.reasons.length > 0 && (
          <div role="status" className="flex flex-col gap-1.5 rounded-xl bg-caution/15 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
            {guidance.reasons.slice(0, 2).map(r => <p key={r}>{r}</p>)}
          </div>
        )}
        <div className={cn('grid gap-2 text-center', stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {stats.map(([l, v]) => (
            <div key={l} className="rounded-xl bg-grouped-card p-3"><p className="numeric text-2xl font-bold">{v}</p><p className="text-[length:var(--text-footnote)] text-muted-foreground">{l}</p></div>
          ))}
        </div>
        {/* The wrap-up voice asks for this number, so the question is always here. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-[length:var(--text-body)] font-medium">How does your back feel now? <span className="text-muted-foreground">(0 = no pain)</span></legend>
          {/* Keys never narrower than 44 points: at 320 they wrap to a second row. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i).map(i => (
              <button key={i} type="button" onClick={() => setPain(i)} aria-pressed={pain === i}
                className={cn('numeric h-11 min-w-11 rounded-lg text-[length:var(--text-body)] font-semibold', pain === i ? 'bg-tint text-on-tint' : 'bg-grouped-card active:bg-muted')}>{i}</button>
            ))}
          </div>
        </fieldset>
        <div className="mt-auto flex flex-col gap-2">
          {notSaving && <p role="status" className="text-center text-[length:var(--text-subhead)]">This device isn’t saving right now, so this session is kept only until you close the app.</p>}
          {failed && <p role="alert" className="text-center text-[length:var(--text-subhead)] text-stop">This device couldn’t save just now. Your session is still here — try again.</p>}
          <Button className="h-14 text-base" disabled={saving} onClick={() => void finish()}>
            <CheckIcon /> {notSaving ? 'Finish' : 'Save and finish'}
          </Button>
        </div>
      </div>
    </div>
  );
}
