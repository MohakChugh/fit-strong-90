import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { Stat } from '@/components/hig/Stat';
import { useGuided } from '@/hooks/useGuided';
import { todayString } from '@/lib/utils';
import { addObservations, getState, removeObservations, useStorageNotice, useStore } from '@/store/useStore';
import type { Walk } from '@/walk/clock';
import { clock, spokenClock, timeOfDay } from '@/walk/format';
import { clearWalk, draftStored, loadWalk, sessionWalkStorage, storeWalk } from '@/walk/persist';
import { hasRecord, saveObservations, saveOutcome, summarise, walkObservationIds, walkObservations, type SaveOutcome } from '@/walk/record';
import { draftWarning, endingLine, lowAdvice, lowStage, summaryRows, walkSpan, walkTitle } from '@/walk/readout';
import { useNow } from '@/screens/workout/useNow';
import { EmergencyGuidance, LowGuidance } from './guidance';
import { PainPicker, PrimaryButton, SecondaryButton } from './parts';

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
  const { observations, status } = useStore();
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

  if (!walk) return <Navigate to="/walk" replace />;
  if (walk.status !== 'finished') return <Navigate to="/walk/live" replace />;

  const summary = summarise(walk);
  const rows = summaryRows(walk, summary);
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
    // Asked of the store before every batch, not of this render: what is
    // already on the device is left out, and the rest goes in one batch.
    const storedIds = () => new Set(getState().observations.map(o => o.id));
    const result = await saveObservations(walkObservations(walk), storedIds, addObservations);
    // Saved only by a device that is saving; kept for now otherwise, and the
    // draft — the copy that outlives a reload — stays until it truly is.
    const outcome = saveOutcome(result, getState().status === 'unavailable');
    if (outcome.kind === 'saved') clearWalk(storage);
    setSave(outcome);
  };

  const discard = async () => {
    // Every record of this walk on the device, found by its context — not a
    // list kept with the draft, which a reload mid-save could lose — removed
    // in one transaction, so a discarded walk leaves nothing behind (F09).
    const removed = await removeObservations(walkObservationIds(walk.id, getState().observations));
    if (!removed.ok) {
      setDiscardError(removed.failure.message);
      return;
    }
    clearWalk(storage);
    navigate('/walk', { replace: true });
  };

  const done = () => navigate('/today', { viewTransition: true });

  return (
    <Screen title="Your walk">
      {walk.endedBy === 'emergency' && <EmergencyGuidance />}
      {walk.endedBy === 'low' && <LowGuidance unit={profile.health.glucoseUnit ?? 'mg/dL'} advice={(s => (s ? lowAdvice(s, t => timeOfDay(t)) : undefined))(lowStage(checkIn, walk, now))} />}

      <section className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
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

      {rows.length > 0 && (
        <Group>
          {rows.map(r => <Row key={r.label} label={r.label} value={r.value} detail={r.detail} numeric />)}
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
        <PrimaryButton onClick={done}>Done</PrimaryButton>
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
