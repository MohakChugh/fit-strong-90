import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CandyIcon, FlagIcon, HandIcon, PauseIcon, PlayIcon, TriangleAlertIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Sheet } from '@/components/hig/Sheet';
import { Stat } from '@/components/hig/Stat';
import { TARGET } from '@/components/hig/targets';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { useGuided } from '@/hooks/useGuided';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SymptomReport } from '@/components/checkin/pending';
import type { GlucoseEntry } from '@/types/checkin';
import { deriveHealth } from '@/engine/health';
import { PERMISSION_TEXT } from '@/engine/permission';
import { heldBy, reachableHistory, statusRefusal, walkInput, walkRefusal, type Clinical } from '@/walk/gate';
import { statusOn } from '@/health/status';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { cn, toDateString } from '@/lib/utils';
import { clock, spokenClock, timeOfDay } from '@/walk/format';
import { feelLow, lowReading } from '@/walk/low';
import { needToStop } from '@/walk/stop';
import { walkFromSearch, walkSetupHref } from '@/walk/plan';
import { takeStarted } from '@/walk/started';
import { walkSettings, withConsent } from '@/walk/consent';
import { getState, useStore } from '@/store/useStore';
import {
  STEPS_DENIED,
  cueLine,
  distanceFigure,
  draftWarning,
  journalLine,
  routePlaceholder,
  heldAction,
  heldLowAdvice,
  lowOpen,
  lowReportedDuring,
  lowStage,
  noticeText,
  reportNote,
  paceFigure,
  recordingLine,
  spokenProgress,
  stepsFigure,
  liveTitle,
  targetLine,
  wakeHint,
  type Figure,
} from '@/walk/readout';
import type { LiveSnapshot, LiveWalk } from '@/walk/live';
import { LowFollowUp } from './guidance';
import { StopSheet } from './StopSheet';
import { PrimaryButton, SecondaryButton } from './parts';
import { ClaimedDecisions, OwnsUrgent } from '@/screens/home/UrgentBanner';
import { useLiveWalk } from './useLiveWalk';
import { LiveRoute } from './RouteView';
import { useWalkCues } from './useWalkCues';
import { walkVoice } from '@/walk/voice';

/** Pause or Resume, and Finish: side by side while their words fit, each wrapping inside itself, or stacked (J§20.4 rule 1). */
const PAUSE_FINISH = 'min-w-[min(100%,10rem)] flex-1 whitespace-normal';

/** A figure's block: a number with its unit, or a word in its place, and how it was observed. */
function FigureBlock({ label, figure, action, className }: { label: string; figure: Figure; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 p-4', className)}>
      {figure.unit ? (
        <Stat label={label} value={figure.value} unit={figure.unit} size="reading" />
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="text-[length:var(--text-footnote)] text-muted-foreground">{label}</span>
          <span className="text-[length:var(--text-title-2)] font-semibold leading-tight">{figure.value}</span>
        </div>
      )}
      <span className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{figure.note}</span>
      {action}
    </div>
  );
}

/** Text captured when mounted, so a live region speaks once per key rather than on every tick. */
function Frozen({ text }: { text: string }) {
  const [said] = useState(text);
  return <>{said}</>;
}

function Notice({ snapshot, live }: { snapshot: LiveSnapshot; live: LiveWalk }) {
  const notice = snapshot.notice;
  if (!notice) return null;
  const text = noticeText(notice);
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
      <p className="text-[length:var(--text-body)] leading-snug">{text.message}</p>
      {notice.kind === 'away' ? (
        <>
          <div className={cn('grid grid-cols-1 min-[360px]:grid-cols-2', TARGET.gap)}>
            <button type="button" onClick={() => live.dismissNotice()} className={cn('press-feedback rounded-lg bg-tint px-3 text-[length:var(--text-body)] font-semibold text-on-tint', TARGET.primary)}>
              Continue walking
            </button>
            <button type="button" onClick={() => live.finish('finish')} className={cn('press-feedback rounded-lg bg-grouped-bg px-3 text-[length:var(--text-body)] font-semibold text-tint', TARGET.primary)}>
              Finish
            </button>
          </div>
          {text.add && (
            <button type="button" onClick={() => live.addAwayTime()} className={cn('self-start text-left text-[length:var(--text-body)] text-tint', TARGET.tap)}>
              {text.add}
            </button>
          )}
        </>
      ) : (
        <button type="button" onClick={() => live.dismissNotice()} className={cn('self-start text-left text-[length:var(--text-body)] text-tint', TARGET.tap)}>
          Done
        </button>
      )}
    </section>
  );
}

/**
 * The live walk (codex-vision §4 and §5 D): the time recorded, pace and
 * distance when GPS is on, steps when counted, Pause and Finish, and a way to
 * stop safely. Full screen, outside the tab bar, and nothing on it that
 * draws with WebGL: GPS with a lit screen is already the heaviest thing the
 * app does.
 */
export default function LiveWalkScreen() {
  const { live, snapshot } = useLiveWalk();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Every day's effective check-in: an answer the device refused to store
  // still counts, today's and the days before — so a chest-pain answer whose
  // save failed, or one given at 23:59, still stops a walk (B04, B01). Today's
  // record is the check-in, the whole list the earlier days (`walkInput`),
  // exactly as the controller reads them for itself.
  const { profile, checkIn, checkIns, date, reportSymptoms, saveCheckIn } = useGuided();
  // Only the days the rules can reach, worked out when the history or the day
  // changes — this screen draws every second (C2-05). The answers are the
  // same as from the whole history.
  const day = snapshot ? toDateString(new Date(snapshot.now)) : date;
  const clinical: Clinical = useMemo(() => ({ profile, checkIns: reachableHistory(checkIns, day, profile) }), [profile, checkIns, day]);
  const hypoRisk = deriveHealth(profile.health).hypoRisk;
  const [sheet, setSheet] = useState<'stop' | 'finish' | 'checkIn' | 'status' | null>(null);
  // Today's status, which carrying the walk on asks first (H2-01).
  const { settings } = useStore();
  // The last report from this screen that the device would not keep (N01).
  const [unsaved, setUnsaved] = useState(false);

  // Opening the screen returns to the walk in progress, or starts the one the
  // shared start flow has just started. The address's fields are choices,
  // never authorisation (H6-04): an arrival the flow didn't make — a link, a
  // typed address, history — goes to the Walk hub, whose Start runs the
  // first-walk questions and B-01's sequence; its meal goes with it. The plan
  // is the flow's own, the route kept only on this phone's yes as it is now
  // (KH-12). A new walk is asked the same permission the Start button asked,
  // and the controller asks again itself, and asks a restored walk the
  // restart question (F06, B03).
  const open = useEffectEvent(() => {
    const now = new Date();
    const asked = walkFromSearch(params, now.getTime());
    const plan = asked ? takeStarted(asked.id) : undefined;
    const request = asked && plan ? { id: asked.id, plan: withConsent(plan, walkSettings(getState().settings)) } : undefined;
    const allowed = !!request && !walkRefusal(walkInput(clinical, now), 'start');
    if (live.attach(allowed ? request : undefined) === 'none') navigate(walkSetupHref(asked?.plan.meal?.which), { replace: true });
  });

  useEffect(() => {
    open();
    return () => live.detach();
  }, [live]);

  const finished = snapshot?.walk.status === 'finished';
  const reduce = useReducedMotion();
  // After the walk is kept (finish() writes the draft first), the figures panel grows into the summary (M13).
  useEffect(() => {
    if (finished) navigate('/walk/summary', { replace: true, viewTransition: !reduce });
  }, [finished, navigate, reduce]);

  // The cue player, its state read on every render (journey §9.2), and the cues spoken while recording.
  const player = walkVoice();
  const voiceTrouble = useSyncExternalStore(player.subscribe, () => player.trouble);
  const voiceStatus = useSyncExternalStore(player.subscribe, () => player.status);
  useWalkCues(snapshot, profile.voice.muted);

  if (!snapshot || finished) return <div className="min-h-dvh" aria-busy="true" />;

  const running = snapshot.walk.status === 'running';
  /**
   * Why this walk may not move, if it may not. The question that refused it
   * when the controller has, from the same effective record at the
   * controller's clock reading; and for a walk not recording, the restart
   * question Resume would ask — so a hold is shown, with what answers it,
   * before anyone taps Resume (N06). Resume still asks for itself.
   */
  const question = snapshot.blocked ?? (running ? null : 'restart');
  // After a change to the phone's clock, the readings from before it, which the engine holds on (B-19); its reason says so.
  // Carrying on asks the status too, after a stop and before any other hold (H2-01).
  const refusal = question
    ? heldBy(walkRefusal(walkInput(clinical, new Date(snapshot.now)), question), statusRefusal(statusOn(settings.statusPeriods, day), question))
    : undefined;
  const emergency = refusal?.disposition === 'emergency';
  const low = lowOpen(checkIn, snapshot.walk);
  const action = refusal ? heldAction(refusal, low) : 'none';
  // Once a low reading is in: the treatment and the re-check time, the same words as the summary (J2-03).
  const lowNow = refusal && !emergency ? heldLowAdvice(lowStage(checkIn, snapshot.walk, snapshot.now), t => timeOfDay(t)) : undefined;
  const unsavedNote = reportNote(!unsaved);
  const hint = wakeHint(snapshot);
  const draftNote = draftWarning(snapshot.draftKept, 'live');
  const target = targetLine(snapshot.observedMs, snapshot.walk.plan.targetMinutes);
  const pace = paceFigure(snapshot.gps);
  const distance = distanceFigure(snapshot);
  const steps = snapshot.walk.plan.stepsDenied ? STEPS_DENIED : stepsFigure(snapshot.stepsState, snapshot.steps);
  const full = journalLine(snapshot);
  const cue = profile.voice.muted ? undefined : cueLine({ status: voiceStatus, trouble: voiceTrouble }, typeof navigator === 'undefined' || navigator.onLine);

  /**
   * "I need to stop": recording stops, and the stop is saved through the
   * shared path, at the tap (journey §4.4). Closing the question leaves it
   * standing: the walk stays held until it is answered.
   */
  const stopNow = () => {
    void needToStop(live, reportSymptoms).then(r => setUnsaved(!r.stored));
    setSheet('stop');
  };

  /**
   * A walk held for an emergency ended because of it; so did one held after a
   * low it reported — a severe one stays held after its symptoms pass (M-05).
   */
  const end = () => live.finish(emergency ? 'emergency' : low || (refusal && lowReportedDuring(checkIn, snapshot.walk)) ? 'low' : 'stop');

  /** "I need to stop": what happened, into today's check-in through the shared path. */
  const reportStop = async (r: SymptomReport): Promise<boolean> => {
    const res = await reportSymptoms(r, new Date());
    setUnsaved(!res.stored);
    return res.stored;
  };

  /**
   * "I feel low": recording stops at the tap, and the symptoms go into
   * today's check-in through the shared path, so this walk and the next start
   * are held until a reading taken afterwards answers it (N01).
   */
  const reportLow = async (): Promise<boolean> => {
    const r = await feelLow(live, reportSymptoms);
    setUnsaved(!r.stored);
    return r.stored;
  };
  /** The reading after "I feel low": whether the device stored it, so a refused one stays to try again (F-walk-03). */
  const saveLowReading = async (reading: GlucoseEntry, symptomsGone: boolean, neededHelp: boolean): Promise<boolean> => {
    const r = await reportSymptoms(lowReading(reading, symptomsGone, neededHelp), new Date());
    setUnsaved(!r.stored);
    return r.stored;
  };

  /**
   * Carry on walking. `live.resume` asks the engine itself and refuses, which
   * is what makes this safe; the tap only has to not pretend otherwise.
   */
  const carryOn = () => {
    setSheet(null);
    live.resume();
  };

  return (
    <>
      {/* A held walk draws the gate's answer itself, whole (codex V1-03, W-01). */}
      {refusal && <OwnsUrgent shows={refusal} />}
      <Screen title={liveTitle(snapshot.walk)} inline>
        {/* One column with its own, tighter rhythm: on a small phone the
            figures should still be in view above the controls. */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p role="status" className="flex items-center gap-2 text-[length:var(--text-subhead)] text-muted-foreground">
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full', running ? 'bg-tint' : 'bg-separator')} />
              {recordingLine({ walk: snapshot.walk, blocked: refusal ? question : null })}
            </p>
            {hint && <p className="text-[length:var(--text-subhead)] font-medium text-caution">{hint}</p>}
            {draftNote && <p role="status" className="text-[length:var(--text-subhead)] font-medium leading-snug text-caution">{draftNote}</p>}
            {full && <p role="status" className="text-[length:var(--text-subhead)] font-medium leading-snug text-caution">{full}</p>}
            {cue && (
              <div className="flex flex-wrap items-center gap-x-3">
                <p role="status" className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{cue.text}</p>
                {cue.unlock && (
                  // In this tap: iOS unlocks audio only inside one (A-53).
                  <button type="button" onClick={() => void player.unlock(profile.voice.pack ?? 'af_heart')} className={cn('text-[length:var(--text-subhead)] font-semibold text-tint', TARGET.tap)}>
                    Turn the voice on
                  </button>
                )}
              </div>
            )}
          </div>

          <div aria-live="polite" className="@container">
            {refusal ? (
              // Narrow for its text size, the icon goes above the words, and the one way on wraps its own words,
              // so nothing reaches past the phone (200% text on a 320 px phone).
              <section role="status" className="flex gap-3 rounded-xl bg-grouped-card p-4 @max-[14rem]:flex-col">
                <TriangleAlertIcon className={cn('mt-0.5 size-5 shrink-0', emergency ? 'text-stop' : 'text-caution')} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-2 text-[length:var(--text-body)] leading-snug [&_button]:max-w-full [&_button]:whitespace-normal">
                  <p className={cn('font-semibold', emergency && 'text-stop')}>
                    {emergency ? PERMISSION_TEXT.emergencyTitle : 'This walk is on hold'}
                  </p>
                  {/* The shared decisions it claims, whole: when measured or answered, and what is due (F-walk-04). */}
                  <ClaimedDecisions shows={refusal} />
                  {refusal.reasons.map(r => <p key={r}>{r}</p>)}
                  {refusal.release && <p className="text-muted-foreground">{refusal.release}</p>}
                  <p className="text-muted-foreground">Your walk so far is kept. Finish to save it.</p>
                  {/* The one way on from the hold: a main target (§20.4 rule 1, K6R-07). */}
                  {action === 'stop' && (
                    <button type="button" onClick={() => setSheet('stop')} className={cn('press-feedback mt-1 self-start rounded-lg bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint', TARGET.primary)}>
                      Say what happened
                    </button>
                  )}
                  {action === 'status' && (
                    <button type="button" onClick={() => setSheet('status')} className={cn('press-feedback mt-1 self-start rounded-lg bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint', TARGET.primary)}>
                      Change status
                    </button>
                  )}
                  {action === 'checkIn' && (
                    <button type="button" onClick={() => setSheet('checkIn')} className={cn('press-feedback mt-1 self-start rounded-lg bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint', TARGET.primary)}>
                      Check in
                    </button>
                  )}
                  {action === 'profile' && (
                    <button type="button" onClick={() => navigate('/you/profile')} className={cn('press-feedback mt-1 self-start rounded-lg bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint', TARGET.primary)}>
                      Health questions
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <Notice snapshot={snapshot} live={live} />
            )}
            {lowNow && (
              <section aria-labelledby="walk-low-now" className="mt-3 flex flex-col gap-2 rounded-xl bg-grouped-card p-4 text-[length:var(--text-body)] leading-snug">
                <h2 id="walk-low-now" className="font-semibold">{lowNow.title}</h2>
                {lowNow.lines.map(line => <p key={line}>{line}</p>)}
              </section>
            )}
            {unsavedNote && <p role="status" className="mt-3 rounded-xl bg-caution/15 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">{unsavedNote}</p>}
          </div>

          {action === 'lowReading' && (
            <LowFollowUp
              unit={profile.health.glucoseUnit ?? 'mg/dL'}
              source={profile.health.glucoseMonitor === 'cgm' ? 'sensor' : 'meter'}
              onSave={saveLowReading}
            />
          )}

          {/* The route on a plain grid, with location on (journey §9.2, M13): no map pictures while walking. */}
          {snapshot.walk.plan.gps && (
            <LiveRoute lines={snapshot.route} {...(snapshot.here ? { here: snapshot.here } : {})} waiting={routePlaceholder(snapshot.gps)} />
          )}

          <div className="flex flex-col items-center gap-2 text-center">
            {/* Paused, the time dims, with no pulse (M13, A-67): the figure only,
                so its label keeps its contrast. */}
            <div role="timer">
              <Stat
                label="Walking time"
                unit=""
                size="timer"
                className="items-center [&>span:last-child]:justify-center"
                value={<span className={cn(!running && 'opacity-60')}><span aria-hidden>{clock(snapshot.observedMs)}</span><span className="sr-only">{spokenClock(snapshot.observedMs)}</span></span>}
              />
            </div>
            {target && <p className="text-[length:var(--text-subhead)] text-muted-foreground">{target}</p>}
          </div>
          <div aria-live="polite" className="sr-only">
            <Frozen key={Math.floor(snapshot.observedMs / 60_000)} text={spokenProgress(snapshot)} />
          </div>

          {/* Distance and pace always have a place: "Not measured" when GPS is
              off, as the walk's record says it, never a blank or a zero (J10). */}
          {refusal ? null : (
            <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-grouped-card" style={reduce ? undefined : { viewTransitionName: 'walk-stats' }}>
              {pace && distance ? (
                <>
                  <FigureBlock label="Pace" figure={pace} />
                  <FigureBlock label="Distance" figure={distance} className="border-l border-separator" />
                </>
              ) : (
                <FigureBlock
                  label="Distance and pace"
                  figure={{ value: 'Not measured', note: 'GPS is off for this walk.' }}
                  className="col-span-2"
                />
              )}
              {steps && (
                <FigureBlock
                  label="Steps"
                  figure={steps}
                  className="col-span-2 border-t border-separator"
                  action={snapshot.stepsState === 'needsPermission' && (
                    <button type="button" onClick={() => void live.enableMotion()} className={cn('self-start text-[length:var(--text-body)] text-tint', TARGET.tap)}>
                      Allow motion and count steps
                    </button>
                  )}
                />
              )}
            </div>
          )}

          {/* "I feel low" stays for anyone who can go low under any hold but an emergency (K6R-01). */}
          <div className={cn('grid grid-cols-1', TARGET.gap, hypoRisk && !emergency && 'min-[360px]:grid-cols-2')}>
            <button type="button" data-main="" onClick={stopNow} className={cn('press-feedback flex items-center justify-center gap-2 rounded-xl bg-grouped-card px-3 text-[length:var(--text-body)] font-medium text-stop', TARGET.primary)}>
              <HandIcon className="size-5 shrink-0" aria-hidden />
              I need to stop
            </button>
            {hypoRisk && !emergency && (
              <button type="button" data-main="" onClick={() => void reportLow()} className={cn('press-feedback flex items-center justify-center gap-2 rounded-xl bg-grouped-card px-3 text-[length:var(--text-body)] font-medium text-caution', TARGET.primary)}>
                <CandyIcon className="size-5 shrink-0" aria-hidden />
                I feel low
              </button>
            )}
          </div>

          {/* Room for the controls fixed below, so nothing scrolls out from under them. */}
          <div aria-hidden className="h-20" />
        </div>
      </Screen>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-separator bg-grouped-bg/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl supports-backdrop-filter:bg-grouped-bg/70">
        {refusal ? (
          <div className="mx-auto max-w-2xl">
            <PrimaryButton onClick={end}>
              <FlagIcon className="size-5" aria-hidden />
              Finish and save
            </PrimaryButton>
          </div>
        ) : (
          // At 200% text a long label wraps inside its own button, or the two stack, rather than spilling out of a half-width slot.
          <div className="mx-auto flex max-w-2xl flex-wrap gap-3">
            {running ? (
              <PrimaryButton onClick={() => live.pause()} className={PAUSE_FINISH}>
                <PauseIcon className="size-5" aria-hidden />
                Pause
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={carryOn} className={PAUSE_FINISH}>
                <PlayIcon className="size-5" aria-hidden />
                Resume
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => setSheet('finish')} className={PAUSE_FINISH}>
              <FlagIcon className="size-5" aria-hidden />
              Finish
            </SecondaryButton>
          </div>
        )}
      </div>

      <StopSheet
        open={sheet === 'stop'}
        onClose={() => setSheet(null)}
        hypoRisk={hypoRisk}
        before={checkIn?.back?.reach}
        onReport={reportStop}
        onLow={reportLow}
        onEnd={end}
      />

      {/* The shared check-in, for a hold a check-in can answer (N06). Its Start
          carries on through Resume, which asks the restart question itself. */}
      <CheckInSheet
        open={sheet === 'checkIn'}
        onOpenChange={o => { if (!o) setSheet(null); }}
        profile={profile}
        date={date}
        {...(checkIn ? { initial: checkIn } : {})}
        recent={checkIns}
        onSave={saveCheckIn}
        mode="walk"
        startLabel="Carry on walking"
        onStart={() => { setSheet(null); live.resume(); }}
      />

      {/* Today's status, as the hubs offer it, for a walk the status holds (H2-01). */}
      <StatusSheet open={sheet === 'status'} onOpenChange={o => { if (!o) setSheet(null); }} today={day} periods={settings.statusPeriods} startDate={settings.startDate} />

      <Sheet open={sheet === 'finish'} onOpenChange={o => { if (!o) setSheet(null); }} title="Finish walk" detent="medium">
        <p className="text-[length:var(--text-body)] leading-snug">
          {clock(snapshot.observedMs)} recorded. Finish now and see what to save?
        </p>
        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={() => { setSheet(null); live.finish('finish'); }}>Finish walk</PrimaryButton>
          <SecondaryButton onClick={() => setSheet(null)}>Keep walking</SecondaryButton>
        </div>
      </Sheet>
    </>
  );
}
