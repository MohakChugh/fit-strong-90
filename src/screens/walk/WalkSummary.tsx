import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';
import { cameFrom, markBack } from '@/components/hig/navigation';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { Stat } from '@/components/hig/Stat';
import { useGuided } from '@/hooks/useGuided';
import { todayString } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getState, removeWalk, saveWalk as saveWalkToStore, useStorageNotice, useStore } from '@/store/useStore';
import type { Walk } from '@/walk/clock';
import { walkSettings } from '@/walk/consent';
import { energyFix, energyText, walkEnergy } from '@/walk/energy';
import { clock, spokenClock, timeOfDay } from '@/walk/format';
import { clearWalk, draftStored, loadWalk, sessionWalkStorage, storeWalk } from '@/walk/persist';
import { hasRecord, saveOutcome, summarise, walkObservationIds, type SaveOutcome } from '@/walk/record';
import { ROUTE_ERASED, ROUTE_LOADING, ROUTE_UNREADABLE, draftWarning, endingLine, lowAdvice, lowStage, noRouteLine, splitRows, summaryRows, walkSpan, walkTitle } from '@/walk/readout';
import { splitsOf } from '@/walk/route';
import { bboxOf } from '@/walk/routeRecord';
import { walkSave } from '@/walk/save';
import { useNow } from '@/screens/workout/useNow';
import { EmergencyGuidance, LowGuidance } from './guidance';
import { PainPicker, PrimaryButton, SecondaryButton } from './parts';
import { RouteFrame } from './RouteFrame';
import { useWalkRoute } from './useWalkRoute';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | SaveOutcome;


/**
 * Activity Summary (codex-vision §4): what was observed, how, and its
 * coverage limits; an optional back-and-leg check; then Save. "Saved on this
 * device" appears only once the store says the write happened. The walk is
 * saved in one transaction, so a failure leaves nothing half-written; it is
 * shown, the walk is kept, and Save can be tried again.
 */
export function WalkSummary() {
  const navigate = useNavigate();
  const { profile, checkIn } = useGuided();
  const { observations, status, settings } = useStore();
  // "Continue without saving": writes live in memory until the app closes (M-07).
  const memoryOnly = status === 'unavailable';
  const notice = useStorageNotice();
  const storage = sessionWalkStorage();
  const [walk, setWalk] = useState<Walk | null>(() => loadWalk(storage));
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string>();
  // Whether a reload would find this walk: asked on arrival, since the live
  // screen's last write may have been refused, then after each write here.
  const [draftKept, setDraftKept] = useState(() => draftStored(storage));

  // Re-read while open after a low, so "waiting" turns into "due" on time.
  const now = useNow(walk?.endedBy === 'low', 15_000);
  // The kept route: saved, or journalled as it was walked (journey §9.5). Kept
  // only while this phone says yes to keeping routes, as the save asks (H6-04).
  const keepsRoute = walk?.plan.keepRoute === true && walkSettings(settings).saveRoutes === true;
  // Loading, unreadable, or here (with no lines when the walk kept none), told apart (H6-06).
  const route = useWalkRoute(walk?.id ?? '', keepsRoute);
  const lines = route.state === 'ready' ? route.lines : undefined;
  const reduce = useReducedMotion();

  if (!walk) return <Navigate to="/hub/walk" replace />;
  if (walk.status !== 'finished') return <Navigate to="/walk/live" replace />;

  const summary = summarise(walk);
  // About how much energy it used, with the weight in effect then (journey §12.4, B-16, B-18).
  const energy = walkEnergy(walk, {
    observations,
    ...(profile.birthYear !== undefined ? { birthYear: profile.birthYear } : {}),
    ...(profile.weightKg > 0 ? { profileKg: profile.weightKg } : {}),
  });
  const rows = summaryRows(walk, summary, { energy: energyText(energy.estimate, energy.weight) });
  // The way to an estimate it couldn't make, where there is one (KH-13).
  const fix = energyFix(energy.estimate);
  const box = lines ? bboxOf(lines) : undefined;
  const splits = lines ? splitRows(splitsOf(lines)) : [];
  const mapOn = walkSettings(settings).map === 'on';
  // Done returns to where the walk was started (M12).
  const origin = walk.plan.from ?? '/home';
  /**
   * Back to where the walk came from, through history, as the session player
   * closes and as Back goes (M12): the entry behind this summary is the screen
   * the walk was started on, as it was left. Pushing it again would leave this
   * summary, gone once saved, behind that screen's Back. With nothing behind
   * it, as after a fresh launch, the origin takes this entry's place.
   */
  const leave = () => {
    markBack();
    if (cameFrom()) navigate(-1);
    else navigate(origin, { replace: true });
  };
  const ending = endingLine(walk);
  const back = profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica');
  const leg = profile.pain.areas.includes('sciatica');
  const saved = save.kind === 'saved';
  const busy = save.kind === 'saving';
  const anything = hasRecord(walk);
  // Records of this walk already on the device — a save from an older
  // version interrupted part-way — fix its answers: a retry writes only what
  // is missing, so a changed answer would never reach the device.
  const onDevice = walkObservationIds(walk.id, observations).length > 0;
  const answersLocked = saved || busy || onDevice;
  const draftNote = saved ? undefined : draftWarning(draftKept, 'summary');

  const keep = (next: Walk) => {
    setWalk(next);
    setDraftKept(storeWalk(storage, next));
  };

  const answer = (which: 'back' | 'leg', value: number | undefined) => {
    const pain = { ...walk.pain };
    if (value === undefined) delete pain[which];
    else pain[which] = { value, at: Date.now() };
    keep({ ...walk, pain });
  };

  const saveWalk = async () => {
    setSave({ kind: 'saving' });
    // One transaction: the records, the route and the journal's retirement
    // (journey §18.3). A retry writes only what is missing. A route not in
    // hand yet is read from the journal inside it, never left behind (H6-06).
    const result = await saveWalkToStore(walkSave(walk, { ...(lines ? { route: lines } : {}), ...(energy.input ? { energy: energy.input } : {}) }));
    // Saved only by a device that is saving; kept for now otherwise, and the
    // draft — the copy that outlives a reload — stays until it truly is.
    const outcome = saveOutcome(result, getState().status === 'unavailable');
    if (outcome.kind === 'saved') clearWalk(storage);
    setSave(outcome);
  };

  const discard = async () => {
    // Every record of this walk on the device, found by its context — not a
    // list kept with the draft, which a reload mid-save could lose — removed
    // with its route and its journal in one transaction, so a discarded walk
    // leaves nothing behind (F09).
    const removed = await removeWalk(walk.id, walkObservationIds(walk.id, getState().observations));
    if (!removed.ok) {
      setDiscardError(removed.failure.message);
      return;
    }
    clearWalk(storage);
    leave();
  };

  return (
    <Screen title="Your walk" back={{ to: origin, label: origin === '/hub/walk' ? 'Walk' : 'Home' }}>
      {/* The guidance is for how this walk ended. The decision standing now is the
          task's shared surface, above it, whatever it is (codex V1-03, W-01). */}
      {walk.endedBy === 'emergency' && <EmergencyGuidance />}
      {walk.endedBy === 'low' && <LowGuidance unit={profile.health.glucoseUnit ?? 'mg/dL'} advice={(s => (s ? lowAdvice(s, t => timeOfDay(t)) : undefined))(lowStage(checkIn, walk, now))} />}

      <section className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4" style={reduce ? undefined : { viewTransitionName: 'walk-stats' }}>
        <p className="text-[length:var(--text-subhead)] text-muted-foreground">
          {walkTitle(walk)} · {walkSpan(summary.from, summary.to, { today: todayString() })}
        </p>
        <Stat
          label="Time recorded"
          unit=""
          size="reading"
          value={<><span aria-hidden>{clock(summary.observedMs)}</span><span className="sr-only">{spokenClock(summary.observedMs)}</span></>}
        />
        <p className="text-[length:var(--text-footnote)] text-muted-foreground">Counted only while the app was open.</p>
        {ending && <p className="text-[length:var(--text-subhead)] leading-snug">{ending}</p>}
        {draftNote && <p role="status" className="text-[length:var(--text-subhead)] font-medium leading-snug text-caution">{draftNote}</p>}
      </section>

      {lines && box ? (
        <RouteFrame walkId={walk.id} lines={lines} bbox={box} mapOn={mapOn} />
      ) : (
        <p role={route.state === 'loading' || route.state === 'failed' ? 'status' : undefined} className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          {route.state === 'loading' ? ROUTE_LOADING : route.state === 'failed' ? ROUTE_UNREADABLE : route.state === 'erased' ? ROUTE_ERASED : noRouteLine({ ...walk.plan, keepRoute: keepsRoute })}
        </p>
      )}

      {rows.length > 0 && (
        <Group>
          {rows.map(r => <Row key={r.label} label={r.label} value={r.value} detail={r.detail} numeric />)}
          {fix && <Row as={Link} to={fix.to} viewTransition label={fix.label} detail="In Me → Profile & health, for an energy estimate" chevron />}
        </Group>
      )}

      {splits.length > 0 && (
        <Group header="Splits" footer="Each complete kilometre, worked out from your route.">
          {splits.map(r => <Row key={r.label} label={r.label} value={r.value} numeric />)}
        </Group>
      )}

      {/* "Now" means just after the walk; hours later, for a walk left open, it would describe something else. */}
      {/* Not after an emergency: getting help comes first. */}
      {anything && (back || leg) && walk.endedBy !== 'stale' && walk.endedBy !== 'emergency' && (
        <Group header="How is your back and leg now?" footer="Optional. It goes into Track beside this walk, so you can see how walking suits you.">
          {back && <PainPicker id="walk-back-pain" label="Back pain" value={walk.pain?.back?.value} disabled={answersLocked} onChange={v => answer('back', v)} />}
          {leg && <PainPicker id="walk-leg-pain" label="Leg pain" value={walk.pain?.leg?.value} disabled={answersLocked} onChange={v => answer('leg', v)} />}
        </Group>
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {saved && (
          <p className="flex items-center gap-2 text-[length:var(--text-body)] font-semibold">
            <CircleCheckIcon className="size-5 shrink-0 text-tint" aria-hidden />
            Saved on this device
          </p>
        )}
        {save.kind === 'kept' && memoryOnly && (
          <p role="status" className="text-[length:var(--text-body)] font-semibold leading-snug">
            Kept for now, not saved: this device isn’t saving, so this walk stays only until you close the app.
          </p>
        )}
        {save.kind === 'failed' && (
          // A status, not a second alert: the storage notice at the top already alerts.
          <div role="status" className="flex gap-2 rounded-xl bg-grouped-card p-4 text-[length:var(--text-body)] leading-snug">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-stop" aria-hidden />
            <p>
              <span className="font-semibold">This walk did not save.</span>{' '}
              {/* The reason once: the notice at the top says it already when it is showing. */}
              {notice?.detail === save.message ? '' : `${save.message} `}
              It is kept here, so you can try again.
            </p>
          </div>
        )}
      </div>

      {saved || (save.kind === 'kept' && memoryOnly) ? (
        <PrimaryButton onClick={leave}>Done</PrimaryButton>
      ) : anything ? (
        <>
          <PrimaryButton onClick={() => void saveWalk()} disabled={busy}>
            {busy ? 'Saving…' : save.kind === 'failed' ? 'Try again' : 'Save walk'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setDiscarding(true)} disabled={busy} className="text-stop">Discard walk</SecondaryButton>
        </>
      ) : (
        <>
          <p className="text-[length:var(--text-body)] text-muted-foreground">Nothing was recorded on this walk, so there is nothing to save.</p>
          <PrimaryButton onClick={() => void discard()}>Done</PrimaryButton>
        </>
      )}

      <Sheet open={discarding} onOpenChange={o => { if (!o) setDiscarding(false); }} title="Discard walk" detent="medium">
        <p className="text-[length:var(--text-body)] leading-snug">This walk will not be saved. It cannot be brought back.</p>
        {discardError && <p role="alert" className="text-[length:var(--text-body)] text-stop">{discardError}</p>}
        <div className="flex flex-col gap-3">
          <SecondaryButton onClick={() => void discard()} className="text-stop">Discard walk</SecondaryButton>
          <PrimaryButton onClick={() => setDiscarding(false)}>Keep it</PrimaryButton>
        </div>
      </Sheet>
    </Screen>
  );
}
