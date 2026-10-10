import { useEffect, useMemo, useRef, useState } from 'react';
import { getState, readWalkJournals, retireWalkJournals, saveWalk, useStore } from '@/store/useStore';
import { walkEnergy } from '@/walk/energy';
import type { JournalEntry } from '@/walk/journal';
import { peekWalk } from '@/walk/persist';
import { recoveryPlan, recoveryText, type Recoverable } from '@/walk/recovery';
import { walkSave } from '@/walk/save';
import { PrimaryButton, SecondaryButton } from '@/screens/walk/parts';

const TEXT = 'text-[length:var(--text-body)] leading-snug';
/** This moment, read when a check is made, never while rendering. */
const clockNow = () => Date.now();

/**
 * Home's inline row for a walk the app lost mid-way (journey §9.4, V-J34):
 * "Your walk on Tuesday was interrupted at 18 min. Save it?" with Save and
 * Discard. It sits under the Right now card, so any urgent card ranks above
 * it (A-57). Save writes the walk, its route and the journal's retirement in
 * one transaction, once however often it's tapped.
 */
export function WalkRecoveryRow() {
  const { observations, settings, saving: storing } = useStore();
  // B-05: an erase, here or in another tab, strips the journals' routes: read them again.
  const erasedAt = settings.walk?.routesErasedAt;
  const [checkedAt, setCheckedAt] = useState(clockNow);
  // Bumped after a save or a discard, so the journals are read again even within the same moment.
  const [reads, setReads] = useState(0);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [draftId] = useState(() => peekWalk()?.id);
  const [confirming, setConfirming] = useState<string>();
  const [message, setMessage] = useState<string>();
  const saving = useRef(false);
  /** Walks this row is saving or has saved: their save retires their journal itself. */
  const handled = useRef(new Set<string>());

  useEffect(() => {
    let current = true;
    void readWalkJournals().then(r => { if (current) setEntries(r.ok ? r.value : []); });
    return () => { current = false; };
  }, [checkedAt, reads, erasedAt]);

  /** Look again, now: after a save or a discard. */
  const recheck = () => {
    setCheckedAt(clockNow());
    setReads(n => n + 1);
  };

  const plan = useMemo(
    () => (entries ? recoveryPlan({ entries, now: checkedAt, observations, ...(draftId ? { draftId } : {}) }) : undefined),
    [entries, checkedAt, observations, draftId],
  );

  // Tidying only: journals of walks already saved, or with nothing in them.
  // Never while a write is on its way: the store shows a save's records at
  // once, and that save may yet fail, so "already saved" is read only from
  // what is stored. Otherwise a failed save would lose both (A-55, V-J34).
  useEffect(() => {
    if (!plan || storing) return;
    const ids = plan.retire.filter(id => !handled.current.has(id));
    if (ids.length > 0) void retireWalkJournals(ids);
  }, [plan, storing]);

  // A journal still fresh may be another tab's walk in progress: look again once it would be stale.
  const wakeAt = plan?.wakeAt;
  useEffect(() => {
    if (wakeAt === undefined) return;
    const id = setTimeout(() => setCheckedAt(clockNow()), Math.max(0, wakeAt - clockNow()));
    return () => clearTimeout(id);
  }, [wakeAt]);

  const save = async (r: Recoverable) => {
    // One save, however many taps arrive before the next render (Review Focus 2).
    if (saving.current) return;
    saving.current = true;
    handled.current.add(r.entry.id);
    const { profile, observations: now } = getState();
    const energy = walkEnergy(r.walk, {
      observations: now,
      ...(profile?.birthYear !== undefined ? { birthYear: profile.birthYear } : {}),
      ...(profile && profile.weightKg > 0 ? { profileKg: profile.weightKg } : {}),
    }).input;
    const result = await saveWalk(walkSave(r.walk, { ...(r.entry.route ? { route: r.entry.route } : {}), ...(energy ? { energy } : {}) }));
    saving.current = false;
    if (!result.ok) handled.current.delete(r.entry.id);
    setMessage(result.ok ? 'Walk saved.' : `The walk did not save. ${result.failure.message} It is kept, so you can try again.`);
    if (result.ok) recheck();
  };

  const discard = async (r: Recoverable) => {
    const result = await retireWalkJournals([r.entry.id]);
    setConfirming(undefined);
    setMessage(result.ok ? undefined : `The walk was not discarded. ${result.failure.message}`);
    if (result.ok) recheck();
  };

  if (!plan) return null;
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {plan.offer.map(r => (
        <section key={r.entry.id} className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
          {confirming === r.entry.id ? (
            <>
              <p className={TEXT}>Discard this walk? It can’t be brought back.</p>
              <SecondaryButton onClick={() => void discard(r)} className="text-stop">Discard walk</SecondaryButton>
              <PrimaryButton onClick={() => setConfirming(undefined)}>Keep it</PrimaryButton>
            </>
          ) : (
            <>
              <p className={TEXT}>{recoveryText(r, checkedAt)}</p>
              <p className="text-[length:var(--text-footnote)] text-muted-foreground">Nothing is in your record until you save it.</p>
              <div className="grid grid-cols-2 gap-3">
                <PrimaryButton onClick={() => void save(r)}>Save</PrimaryButton>
                <SecondaryButton onClick={() => setConfirming(r.entry.id)}>Discard</SecondaryButton>
              </div>
            </>
          )}
        </section>
      ))}
      {message && <p role="status" className="px-1 text-[length:var(--text-subhead)]">{message}</p>}
    </div>
  );
}
