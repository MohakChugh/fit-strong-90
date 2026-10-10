/**
 * The safety contract's guidance for a reading, as Quick Log and a correction
 * show it.
 *
 * It is shown from the values entered, before the write has settled, with the
 * save's own status beside it: "Saving…", then saved — or not, with a retry
 * (F01). A reading given its own time is asked when it was taken; one that
 * stays in force (an extreme glucose, a severe blood pressure) is then asked
 * whether a clinician has checked the person since, and until each answer the
 * help action holds (F03, R03). A meter's HI or LO has nothing to save.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Stat } from '@/components/hig/Stat';
import { cn } from '@/lib/utils';
import { guidanceView, type Escalation, type GuidanceAnswer } from './escalation';
import { SAVE_WORDS, saveLabel, settle, type SaveState, type SaveWords } from './saving';
import { NOT_ADVICE } from './targets';
import { Hint, PrimaryButton, SecondaryButton } from './ui';

export interface Shown {
  figure: string;
  unit: string;
  escalation: Escalation;
  /** The reading was given its own time: ask when it was taken, and whether it has been settled. */
  ask?: boolean;
  /** Said under the guidance. */
  note?: string;
  /** The write behind it, already started. Absent when there is nothing to save. */
  pending?: Promise<string | undefined>;
  /** The same write again, after a refusal. */
  retry?: () => Promise<string | undefined>;
  /** With nothing being saved: why. */
  label?: string;
  /** What the save is called; a correction is "corrected". */
  words?: SaveWords;
}

const QUESTION = {
  when: { title: 'Is this reading from just now?', detail: 'What to do depends on whether it is happening now or has passed.' },
  settled: { title: 'Has a clinician checked you since?', detail: 'A reading this serious still needs the help below until then, however long ago it was taken.' },
} as const;

export function Guidance({ shown, onDone }: { shown: Shown; onDone: () => void }) {
  const [answer, setAnswer] = useState<GuidanceAnswer>();
  const top = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(shown.pending);
  const [save, setSave] = useState<SaveState | undefined>(shown.pending ? { state: 'saving' } : undefined);
  // Once a save has failed, its retry control keeps its place — disabled while
  // saving, then saying it saved — so a second tap lands on it and nothing
  // else moves under the finger, Done least of all (T3-05).
  const [refusedOnce, setRefusedOnce] = useState(false);

  // The guidance is already on screen; how the write ends only changes the status line.
  useEffect(() => {
    if (!pending) return;
    let live = true;
    void settle(pending).then(next => {
      if (!live) return;
      setSave(next);
      if (next.state === 'failed') setRefusedOnce(true);
    });
    return () => {
      live = false;
    };
  }, [pending]);

  // It replaces a form the person may have scrolled to the end of: the title
  // and the save status come into view, and the focus starts here.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
    top.current?.focus({ preventScroll: true });
  }, []);

  const retry = () => {
    if (!shown.retry || save?.state !== 'failed') return;
    setSave({ state: 'saving' });
    setPending(shown.retry());
  };

  const status = save ? saveLabel(save, shown.words ?? SAVE_WORDS) : (shown.label ?? '');
  const view = guidanceView(shown.escalation, shown.ask === true, answer);
  const e = 'escalation' in view ? view.escalation : undefined;
  const tone = shown.escalation.disposition === 'treatNow' ? 'caution' : 'stop';

  return (
    <>
      <div ref={top} role="alert" tabIndex={-1} className="flex scroll-mt-4 flex-col gap-4 outline-none">
        {/* The figure settles into place; the words below carry the urgency,
            in colour and in words, so the readout itself stays plain. */}
        <Stat value={shown.figure} unit={shown.unit} label={status} size="reading" className="animate-in fade-in zoom-in-110 duration-500" />
        {/* How the save ended, said when it changes. */}
        <p aria-live="polite" className="sr-only">{save && save.state !== 'saving' ? status : ''}</p>
        {'question' in view ? (
          <div className="flex flex-col gap-3">
            <p className="text-[length:var(--text-title-2)] font-semibold leading-snug">{QUESTION[view.question].title}</p>
            <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">{QUESTION[view.question].detail}</p>
            {/* Whatever the answers, the help action is never held back while they are open. */}
            <p className={cn('rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-body)] font-medium leading-snug', tone === 'stop' ? 'text-stop' : 'text-caution')}>
              {view.hold}
            </p>
            {view.question === 'when' ? (
              <>
                <PrimaryButton onClick={() => setAnswer({ when: 'now' })}>Yes, just now</PrimaryButton>
                <SecondaryButton onClick={() => setAnswer({ when: 'earlier' })}>No, it was earlier</SecondaryButton>
              </>
            ) : (
              <>
                <PrimaryButton onClick={() => setAnswer({ when: 'earlier', settled: 'open' })}>No, not yet</PrimaryButton>
                <SecondaryButton onClick={() => setAnswer({ when: 'earlier', settled: 'assessed' })}>Yes, a clinician has checked me since</SecondaryButton>
              </>
            )}
          </div>
        ) : (
          <>
            <p className={cn('text-[length:var(--text-title-2)] font-semibold leading-snug', tone === 'stop' ? 'text-stop' : 'text-caution')}>
              {view.escalation.title}
            </p>
            <ol className="flex flex-col gap-3">
              {view.escalation.steps.map((line, i) => (
                <GuidanceStep key={line} n={i + 1}>{line}</GuidanceStep>
              ))}
            </ol>
          </>
        )}
        {shown.note && <p className="px-1 text-[length:var(--text-subhead)] font-medium">{shown.note}</p>}
        {e && <Hint>Based on {e.basis}. {NOT_ADVICE}</Hint>}
      </div>
      {refusedOnce && shown.retry && (
        <SecondaryButton onClick={retry} disabled={save?.state !== 'failed'}>
          {save?.state === 'saving' ? 'Saving…' : save?.state === 'saved' ? 'Saved' : 'Try saving again'}
        </SecondaryButton>
      )}
      {e && <PrimaryButton onClick={onDone}>Done</PrimaryButton>}
    </>
  );
}

function GuidanceStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-body)] leading-snug">
      <span aria-hidden className="numeric w-5 shrink-0 font-semibold text-muted-foreground">{n}</span>
      <span>{children}</span>
    </li>
  );
}
