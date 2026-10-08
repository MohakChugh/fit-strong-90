import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import type { SymptomReport } from '@/components/checkin/pending';
import type { SymptomReach } from '@/types/checkin';
import { cn } from '@/lib/utils';
import { LEG_QUESTIONS, legReport, NO_LEG, onChoice, REACH, REACH_LABEL, SPREAD_QUESTION, STOP_CHOICES, type LegAnswers, type StopChoice } from '@/walk/stop';
import { PrimaryButton, SecondaryButton } from './parts';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Dizziness can be a low: then it says so, and offers the low path. */
  hypoRisk: boolean;
  /** How far down symptoms reached earlier today, so "further" can be told. */
  before: SymptomReach | undefined;
  /** Into today's check-in through the shared path. */
  onReport: (report: SymptomReport) => void;
  /** The "I feel low" path. */
  onLow: () => void;
  onEnd: () => void;
}

/**
 * "I need to stop" (safety consistency with the player's B09 and its "Stop:
 * something's wrong"; acceptance J16 step 6). Recording is already paused
 * when this opens. One tap says what is happening, in the check-in's own
 * words; leg symptoms — spread further down, new weakness or foot drop, and
 * the emergencies — are answered on the same screen, from the builder the
 * player uses. The answer goes into today's check-in and the walk screen
 * behind shows what the engine makes of it: an emergency there offers only
 * "Finish and save". A rest records nothing.
 */
export function StopSheet(props: Props) {
  const [step, setStep] = useState<'choose' | 'dizzy'>('choose');
  const title = step === 'dizzy' ? 'Check your glucose now' : 'What’s happening?';
  const close = () => {
    props.onClose();
    setStep('choose');
  };
  return (
    <Sheet open={props.open} onOpenChange={o => { if (!o) close(); }} title={title} detent="large">
      {props.open && <Body {...props} step={step} setStep={setStep} close={close} />}
    </Sheet>
  );
}

function Body({ hypoRisk, before, onReport, onLow, onEnd, step, setStep, close }: Props & {
  step: 'choose' | 'dizzy';
  setStep: (s: 'choose' | 'dizzy') => void;
  close: () => void;
}) {
  const [leg, setLeg] = useState<LegAnswers>({ ...NO_LEG, spread: false });

  const choose = (choice: StopChoice) => {
    const { report, next } = onChoice(choice, hypoRisk);
    if (report) onReport(report);
    if (next === 'dizzy') setStep('dizzy');
    else close();
  };

  if (step === 'dizzy') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[length:var(--text-body)] leading-snug">Sit down somewhere safe. With your diabetes medicines, dizziness can be a low coming on.</p>
        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={() => { onLow(); close(); }}>I feel low</PrimaryButton>
          <SecondaryButton onClick={close}>Close</SecondaryButton>
        </div>
      </div>
    );
  }

  type Key = (typeof LEG_QUESTIONS)[number]['key'] | typeof SPREAD_QUESTION.key;
  const toggle = (k: Key) => setLeg(a => ({ ...a, [k]: !a[k], ...(k === 'weakness' && a.weakness ? { fast: false } : {}) }));
  const questions = [SPREAD_QUESTION, ...LEG_QUESTIONS.filter(q => q.key !== 'fast' || leg.weakness)];
  return (
    <div className="flex flex-col gap-4">
      <Group footer="General information, not medical advice. This app cannot tell an emergency from anything else.">
        {STOP_CHOICES.filter(c => c.choice !== 'leg').map(c => (
          <Row
            key={c.choice}
            label={<span className={cn('leading-snug', c.choice === 'chest' || c.choice === 'stroke' || c.choice === 'breathless' ? 'text-stop' : '')}>{c.label}</span>}
            onClick={() => choose(c.choice)}
          />
        ))}
      </Group>
      <SecondaryButton onClick={() => { close(); onEnd(); }}>End walk</SecondaryButton>
      <Group header={STOP_CHOICES.find(c => c.choice === 'leg')!.label}>
        <div className="flex flex-col gap-2 px-4 py-3">
          <span id="walk-leg-reach" className="text-[length:var(--text-subhead)] text-muted-foreground">How far down symptoms reach now</span>
          <div role="radiogroup" aria-labelledby="walk-leg-reach" className="flex flex-wrap gap-1.5">
            {REACH.map(r => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={leg.reach === r}
                onClick={() => setLeg(a => ({ ...a, reach: r }))}
                className={cn('min-h-11 min-w-11 rounded-lg px-3 text-[length:var(--text-subhead)]', leg.reach === r ? 'bg-tint font-semibold text-on-tint' : 'bg-grouped-bg')}
              >
                {REACH_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        {questions.map(q => (
          <label key={q.key} className="flex min-h-11 items-start gap-3 px-4 py-3 text-[length:var(--text-body)] leading-snug">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={leg[q.key] === true} onChange={() => toggle(q.key)} />
            <span>{q.label}</span>
          </label>
        ))}
      </Group>
      {/* Walking is what was being done: it stops for the day (X2-09). */}
      <PrimaryButton onClick={() => { onReport(legReport(leg, before, 'brisk-walking')); close(); }}>Save leg symptoms</PrimaryButton>
    </div>
  );
}
