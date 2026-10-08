import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CandyIcon, FlagIcon, HandIcon, PauseIcon, PlayIcon, TriangleAlertIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Sheet } from '@/components/hig/Sheet';
import { Stat } from '@/components/hig/Stat';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { useGuided } from '@/hooks/useGuided';
import type { SymptomReport } from '@/components/checkin/pending';
import type { GlucoseEntry } from '@/types/checkin';
import { deriveHealth } from '@/engine/health';
import { PERMISSION_TEXT } from '@/engine/permission';
import { reachableHistory, walkInput, walkRefusal, type Clinical } from '@/walk/gate';
import { cn, toDateString } from '@/lib/utils';
import { clock, spokenClock, timeOfDay } from '@/walk/format';
import { feelLow, lowReading } from '@/walk/low';
import { walkFromSearch } from '@/walk/plan';
import {
  distanceFigure,
  draftWarning,
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
import { useLiveWalk } from './useLiveWalk';

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
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            <button type="button" onClick={() => live.dismissNotice()} className="press-feedback min-h-11 rounded-lg bg-tint px-3 text-[length:var(--text-body)] font-semibold text-on-tint">
              Continue walking
            </button>
            <button type="button" onClick={() => live.finish('finish')} className="press-feedback min-h-11 rounded-lg bg-grouped-bg px-3 text-[length:var(--text-body)] font-semibold text-tint">
              Finish
            </button>
          </div>
          {text.add && (
            <button type="button" onClick={() => live.addAwayTime()} className="min-h-11 self-start text-left text-[length:var(--text-body)] text-tint">
              {text.add}
            </button>
          )}
        </>
      ) : (
        <button type="button" onClick={() => live.dismissNotice()} className="min-h-11 min-w-11 self-start text-left text-[length:var(--text-body)] text-tint">
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
  const [sheet, setSheet] = useState<'stop' | 'finish' | 'checkIn' | null>(null);
  // The last report from this screen that the device would not keep (N01).
  const [unsaved, setUnsaved] = useState(false);

  // Opening the screen returns to the walk in progress, or starts the one in
  // the address. A new walk is asked the same permission the Start button
  // asked, so an old address in the history cannot step around the check-in.
  // The controller asks again itself, and asks a restored walk the restart
  // question (F06, B03).
  const open = useEffectEvent(() => {
    const now = new Date();
    const request = walkFromSearch(params, now.getTime());
    const allowed = !!request && !walkRefusal(walkInput(clinical, now), 'start');
    if (live.attach(allowed ? request : undefined) === 'none') navigate('/walk', { replace: true });
  });

  useEffect(() => {
    open();
    return () => live.detach();
  }, [live]);

  const finished = snapshot?.walk.status === 'finished';
  useEffect(() => {
    if (finished) navigate('/walk/summary', { replace: true });
  }, [finished, navigate]);

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
  const refusal = question ? walkRefusal(walkInput(clinical, new Date(snapshot.now)), question) : undefined;
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
  const steps = stepsFigure(snapshot.stepsState, snapshot.steps);

  const stopNow = () => {
    live.pause();
    setSheet('stop');
  };

  /**
   * A walk held for an emergency ended because of it; so did one held after a
   * low it reported — a severe one stays held after its symptoms pass (M-05).
   */
  const end = () => live.finish(emergency ? 'emergency' : low || (refusal && lowReportedDuring(checkIn, snapshot.walk)) ? 'low' : 'stop');

  /** "I need to stop": what happened, into today's check-in through the shared path. */
  const reportStop = (r: SymptomReport) => {
    void reportSymptoms(r, new Date()).then(res => setUnsaved(!res.stored));
  };

  /**
   * "I feel low": recording stops at the tap, and the symptoms go into
   * today's check-in through the shared path, so this walk and the next start
   * are held until a reading taken afterwards answers it (N01).
   */
  const reportLow = () => {
    void feelLow(live, reportSymptoms).then(r => setUnsaved(!r.stored));
  };
  const saveLowReading = async (reading: GlucoseEntry, symptomsGone: boolean, neededHelp: boolean) => {
    const r = await reportSymptoms(lowReading(reading, symptomsGone, neededHelp), new Date());
    setUnsaved(!r.stored);
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
          </div>

          <div aria-live="polite">
            {refusal ? (
              <section role="status" className="flex gap-3 rounded-xl bg-grouped-card p-4">
                <TriangleAlertIcon className={cn('mt-0.5 size-5 shrink-0', emergency ? 'text-stop' : 'text-caution')} aria-hidden />
                <div className="flex min-w-0 flex-col gap-2 text-[length:var(--text-body)] leading-snug">
                  <p className={cn('font-semibold', emergency && 'text-stop')}>
                    {emergency ? PERMISSION_TEXT.emergencyTitle : 'This walk is on hold'}
                  </p>
                  {refusal.reasons.map(r => <p key={r}>{r}</p>)}
                  {refusal.release && <p className="text-muted-foreground">{refusal.release}</p>}
                  <p className="text-muted-foreground">Your walk so far is kept. Finish to save it.</p>
                  {action === 'checkIn' && (
                    <button type="button" onClick={() => setSheet('checkIn')} className="press-feedback mt-1 min-h-11 self-start rounded-lg bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint">
                      Check in
                    </button>
                  )}
                  {action === 'profile' && (
                    <button type="button" onClick={() => navigate('/you/profile')} className="press-feedback mt-1 min-h-11 self-start rounded-lg bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint">
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

          <div className="flex flex-col items-center gap-2 text-center">
            <div role="timer">
              <Stat
                label="Walking time"
                unit=""
                size="timer"
                className="items-center [&>span:last-child]:justify-center"
                value={<><span aria-hidden>{clock(snapshot.observedMs)}</span><span className="sr-only">{spokenClock(snapshot.observedMs)}</span></>}
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
            <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-grouped-card">
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
                    <button type="button" onClick={() => void live.enableMotion()} className="min-h-11 self-start text-[length:var(--text-body)] text-tint">
                      Allow motion and count steps
                    </button>
                  )}
                />
              )}
            </div>
          )}

          <div className={cn('grid grid-cols-1 gap-2', hypoRisk && !refusal && 'min-[360px]:grid-cols-2')}>
            <button type="button" onClick={stopNow} className="press-feedback flex min-h-12 items-center justify-center gap-2 rounded-xl bg-grouped-card px-3 text-[length:var(--text-body)] font-medium text-stop">
              <HandIcon className="size-5 shrink-0" aria-hidden />
              I need to stop
            </button>
            {hypoRisk && !refusal && (
              <button type="button" onClick={reportLow} className="press-feedback flex min-h-12 items-center justify-center gap-2 rounded-xl bg-grouped-card px-3 text-[length:var(--text-body)] font-medium text-caution">
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
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
            {running ? (
              <PrimaryButton onClick={() => live.pause()}>
                <PauseIcon className="size-5" aria-hidden />
                Pause
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={carryOn}>
                <PlayIcon className="size-5" aria-hidden />
                Resume
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => setSheet('finish')}>
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
