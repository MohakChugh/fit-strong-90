import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import type { SymptomReport } from '@/components/checkin/pending';
import { AnsweringStopContext } from '@/components/checkin/sayWhatHappened';
import type { SymptomReach } from '@/types/checkin';
import { TARGET } from '@/components/hig/targets';
import { cn } from '@/lib/utils';
import { answering, LEG_QUESTIONS, legReport, NO_LEG, REACH, REACH_LABEL, SPREAD_QUESTION, STOP_CHOICES, STOP_LOW, stopAnswer, type LegAnswers, type StopChoice } from '@/walk/stop';
import { PrimaryButton, SecondaryButton } from './parts';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Dizziness can be a low: then it says so, and offers the low path. */
  hypoRisk: boolean;
  /** How far down symptoms reached earlier today, so "further" can be told. */
  before: SymptomReach | undefined;
  /**
   * Into today's check-in through the shared path, resolving whether the
   * device kept it. Every answer answers the stop the tap saved (§4.4).
   */
  onReport: (report: SymptomReport) => Promise<boolean>;
  /** The "I feel low" path, resolving whether the device kept it. */
  onLow: () => Promise<boolean>;
  /** On the walk: end it. Asked off it (Say what happened, K6R-03), the walk has already ended. */
  onEnd?: () => void;
}

/**
 * "I need to stop" (safety consistency with the player's B09 and its "Stop:
 * something's wrong"; acceptance J16 step 6). Recording is already paused
 * when this opens, and the stop already saved (journey §4.4). One tap says
 * what is happening, in the check-in's own words; leg symptoms — spread
 * further down, new weakness or foot drop, and the emergencies — are answered
 * on the same screen, from the builder the player uses. The answer goes into
 * today's check-in, answering the stop, and the walk screen behind shows what
 * the engine makes of it: an emergency there offers only "Finish and save". A
 * rest records only that the stop is answered. Closing answers nothing: the
 * walk stays held until an answer comes. Each answer waits for the device to
 * keep it before the sheet moves on; refused, it stays here, as given, with
 * Try again (H6R-11, §4.5, B-03). While one is being stored, nothing closes
 * the sheet, its Close and End walk wait, and a way on from the safety
 * surface waits and says so (H6R-11, board D213).
 */
export function StopSheet(props: Props) {
  const [step, setStep] = useState<'choose' | 'dizzy'>('choose');
  // An answer being stored keeps the questions open: closing them would let go of the answer,
  // and of its Try again, before the device has said whether it kept it (H6R-11, board D213).
  const [saving, setSaving] = useState(false);
  const title = step === 'dizzy' ? 'Check your glucose now' : 'What’s happening?';
  // An answer's own way on is the close of the moment it was given, when nothing was being stored.
  const close = () => {
    if (saving) return;
    props.onClose();
    setStep('choose');
  };
  return (
    <AnsweringStopContext value>
      <Sheet open={props.open} onOpenChange={o => { if (!o) close(); }} dismissible={!saving} title={title} detent="large">
        {props.open && <Body {...props} step={step} setStep={setStep} close={close} saving={saving} setSaving={setSaving} />}
      </Sheet>
    </AnsweringStopContext>
  );
}

function Body({ hypoRisk, before, onReport, onLow, onEnd, step, setStep, close, saving, setSaving }: Props & {
  step: 'choose' | 'dizzy';
  setStep: (s: 'choose' | 'dizzy') => void;
  close: () => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const [leg, setLeg] = useState<LegAnswers>({ ...NO_LEG, spread: false });
  /** The answer the device refused, to give again as it was. */
  const [retry, setRetry] = useState<(() => void) | null>(null);

  /** Give an answer, and move on only once the device has kept it. */
  const submit = (write: () => Promise<boolean>, then: () => void) => {
    setSaving(true);
    setRetry(null);
    void write().then(ok => {
      setSaving(false);
      if (ok) then();
      else setRetry(() => () => submit(write, then));
    });
  };

  const choose = (choice: StopChoice) => {
    const { report, next } = stopAnswer(choice, hypoRisk);
    const then = () => (next === 'dizzy' ? setStep('dizzy') : close());
    if (report) submit(() => onReport(report), then);
    else then();
  };

  const refused = retry && (
    <div role="alert" className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4 text-[length:var(--text-body)] leading-snug">
      <p><span className="font-semibold">Your answer didn’t save.</span> It’s kept here as you gave it.</p>
      <PrimaryButton onClick={retry} disabled={saving}>Try again</PrimaryButton>
    </div>
  );

  if (step === 'dizzy') {
    return (
      <div className="flex flex-col gap-4">
        {refused}
        <p className="text-[length:var(--text-body)] leading-snug">Sit down somewhere safe. With your diabetes medicines, dizziness can be a low coming on.</p>
        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={() => submit(onLow, close)} disabled={saving}>I feel low</PrimaryButton>
          <SecondaryButton onClick={close} disabled={saving}>Close</SecondaryButton>
        </div>
      </div>
    );
  }

  type Key = (typeof LEG_QUESTIONS)[number]['key'] | typeof SPREAD_QUESTION.key;
  const toggle = (k: Key) => setLeg(a => ({ ...a, [k]: !a[k], ...(k === 'weakness' && a.weakness ? { fast: false } : {}) }));
  const questions = [SPREAD_QUESTION, ...LEG_QUESTIONS.filter(q => q.key !== 'fast' || leg.weakness)];
  return (
    <div className="flex flex-col gap-4">
      {refused}
      <Group footer="General information, not medical advice. This app cannot tell an emergency from anything else.">
        {/* For anyone who can go low, the low path first: it answers the stop too (K6R-01). */}
        {hypoRisk && <Row label={<span className="leading-snug">I feel low</span>} onClick={() => { if (!saving) submit(() => onReport(STOP_LOW), close); }} />}
        {STOP_CHOICES.filter(c => c.choice !== 'leg').map(c => (
          <Row
            key={c.choice}
            label={<span className={cn('leading-snug', c.choice === 'chest' || c.choice === 'stroke' || c.choice === 'breathless' ? 'text-stop' : '')}>{c.label}</span>}
            onClick={() => { if (!saving) choose(c.choice); }}
          />
        ))}
      </Group>
      {onEnd && <SecondaryButton onClick={() => { close(); onEnd(); }} disabled={saving}>End walk</SecondaryButton>}
      <Group header={STOP_CHOICES.find(c => c.choice === 'leg')!.label}>
        <div className="flex flex-col gap-2 px-4 py-3">
          <span id="walk-leg-reach" className="text-[length:var(--text-subhead)] text-muted-foreground">How far down symptoms reach now</span>
          {/* The most stressful screen: every choice a full target, 12 px apart (§20.4 rule 1, K6R-07). */}
          <div role="radiogroup" aria-labelledby="walk-leg-reach" className={cn('flex flex-wrap', TARGET.gap)}>
            {REACH.map(r => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={leg.reach === r}
                onClick={() => setLeg(a => ({ ...a, reach: r }))}
                className={cn('rounded-lg px-3 text-[length:var(--text-subhead)]', TARGET.tap, leg.reach === r ? 'bg-tint font-semibold text-on-tint' : 'bg-grouped-bg')}
              >
                {REACH_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        {questions.map(q => (
          <label key={q.key} className={cn('flex items-start gap-3 px-4 py-3 text-[length:var(--text-body)] leading-snug', TARGET.tap)}>
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={leg[q.key] === true} onChange={() => toggle(q.key)} />
            <span>{q.label}</span>
          </label>
        ))}
      </Group>
      {/* Walking is what was being done, asked on the walk or after it (only a walk says "I need to stop"): it stops for the day (X2-09). */}
      <PrimaryButton onClick={() => submit(() => onReport(answering(legReport(leg, before, 'brisk-walking'))), close)} disabled={saving}>Save leg symptoms</PrimaryButton>
    </div>
  );
}
