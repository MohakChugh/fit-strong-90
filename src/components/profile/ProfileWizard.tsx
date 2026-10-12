/**
 * The profile (spec §3.1): about you and your schedule → your body → your
 * health, then a summary. Follow-up questions appear only when relevant, so a
 * user with no conditions taps through in under a minute. Used for first-run
 * setup and for editing.
 *
 * `steps` picks which of the four a flow shows (`wizardSteps.ts`): first run
 * for someone who only wants to stretch asks body, health and the summary,
 * with no training questions and no weekly plan; an edit can open one step.
 */

import { useMemo, useState } from 'react';
import type { DayOfWeek } from '@/types';
import type { Goal, HealthProfile, MedicineAnswer, PainArea, UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { bpMedicinesAsked, profileRules, deriveHealth } from '@/engine/health';
import { weekFocus, focusLabel, WEEK } from '@/engine/templates';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn, todayString } from '@/lib/utils';
import { ChipGroup, YesNo } from './ChipGroup';
import {
  BP_MEDICINES, DIABETES_MEDICINES, answeredOnOpen, asksStartDate, canLeave, finalProfile, finishLabel,
  convertWeightText, medicinesAnswered as allMedicinesAnswered, metforminYearProblem, programmeInFlow, startDateMissing, stepTitle,
  submittedWeightKg, weightFieldText, wizardSteps,
  type MedicineQuestion, type WizardStep,
} from './wizardSteps';
import { ShieldAlertIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from 'lucide-react';

/** A footer button that grows with its label: never shorter than 48 px, never wider than the screen. */
const FOOTER_BUTTON = 'h-auto min-h-12 min-w-0 whitespace-normal py-2 text-base';

export interface WizardResult {
  profile: UserProfile;
  startDate: string;
  useMetric: boolean;
  /**
   * What the wizard opened with, so a save can write only what the person
   * changed, on top of whatever another open copy saved meanwhile (D-03).
   */
  opened?: { profile?: UserProfile; useMetric: boolean; startDate?: string };
}

interface Props {
  mode: 'onboarding' | 'edit';
  initial?: Partial<WizardResult>;
  /**
   * Which steps to show, in the wizard's order; all four when absent. A
   * first-time profile always includes the summary.
   */
  steps?: readonly WizardStep[];
  /**
   * Whether the person is in the 12-week programme, so its questions and its
   * weekly plan are asked and shown. When absent they come with `about`.
   */
  programme?: boolean;
  /**
   * Ask the programme start date with the programme's questions. Asked when
   * first setting up unless a flow says otherwise; in an edit only when asked
   * for, so a flow that asks the date itself does not ask it twice.
   */
  askStartDate?: boolean;
  /** What is wrong with a start date, or `null`; any real day by default. */
  startDateRule?: (date: string) => string | null;
  /** The last button's words, when the flow has a better name than Save. */
  submitLabel?: string;
  /**
   * The answers are being saved. Every button waits, so nothing is sent twice
   * and nothing closes: the answers stay here until the save is confirmed.
   */
  busy?: boolean;
  /** Why the last save failed, shown where the person is, with the answers still in place to try again. */
  error?: string;
  onComplete: (r: WizardResult) => void;
  onCancel?: () => void;
}

const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};


export function ProfileWizard({
  mode, initial, steps: requested, programme: inProgramme, askStartDate, startDateRule, submitLabel, busy = false, error, onComplete, onCancel,
}: Props) {
  const steps = wizardSteps(requested, mode);
  const programme = programmeInFlow(steps, inProgramme);
  const asksDate = asksStartDate(programme, mode, askStartDate);
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const [p, setP] = useState<UserProfile>(() => initial?.profile ?? createDefaultProfile());
  const [useMetric, setUseMetric] = useState(initial?.useMetric ?? true);
  const [startDate, setStartDate] = useState(initial?.startDate || todayString());
  const [opened] = useState<NonNullable<WizardResult['opened']>>(() => ({
    ...(initial?.profile ? { profile: initial.profile } : {}),
    useMetric: initial?.useMetric ?? true,
    ...(initial?.startDate ? { startDate: initial.startDate } : {}),
  }));
  // The stored weight is the weight until the person types in the field:
  // switching kg and lb shows it in the other unit, never changes it (N05).
  const storedKg = initial?.profile?.weightKg || undefined;
  const [weightText, setWeightText] = useState(() => weightFieldText(storedKg, initial?.useMetric ?? true));
  const [weightTyped, setWeightTyped] = useState(false);
  const switchUnit = (metric: boolean) => {
    if (metric === useMetric) return;
    setUseMetric(metric);
    setWeightText(text => convertWeightText(text, metric));
  };
  const [ack, setAck] = useState(mode === 'edit');
  // Medicine answers count only once given here: an untouched default must
  // never read as "no insulin", or "no SGLT2 inhibitor" (contract H-DATA, B08).
  // A reviewed profile shows its answers.
  const [answered, setAnswered] = useState<Set<MedicineQuestion>>(() => answeredOnOpen(initial?.profile?.health));
  const answer = (q: MedicineQuestion) => setAnswered(prev => new Set(prev).add(q));
  // The metformin year as typed: kept while typing ("2", "20", "201" on the
  // way to "2019"), stored only once it reads as a year (J02).
  const [sinceText, setSinceText] = useState(() => initial?.profile?.health.metforminSince?.slice(0, 4) ?? '');
  const thisYear = Number(todayString().slice(0, 4));

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => setP(prev => ({ ...prev, [k]: v }));
  const setHealth = (patch: Partial<HealthProfile>) => setP(prev => ({ ...prev, health: { ...prev.health, ...patch } }));
  const weight = Number(weightText);
  const weightKg = submittedWeightKg({ text: weightText, metric: useMetric, ...(weightTyped ? {} : { untouchedKg: storedKg }) });
  const medicinesAnswered = allMedicinesAnswered(p.health, answered);
  const dateProblem = asksDate ? (startDateRule ?? startDateMissing)(startDate) : null;
  const yearProblem = answered.has('metformin') && p.health.metformin === true ? metforminYearProblem(sinceText, thisYear) : null;
  const ready = canLeave(step, {
    programme, startDateProblem: dateProblem, fieldProblem: step === 'health' ? yearProblem : null,
    weight, trainingDays: p.trainingDays.length, medicinesAnswered, acknowledged: ack,
  });

  // The medicines answered here count as reviewed (`finalProfile`); without
  // that the engine keeps treating them as unknown.
  const final = (): UserProfile => finalProfile({
    draft: p, before: initial?.profile, steps, mode, typedWeightKg: weightTyped ? weightKg : undefined, today: todayString(),
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-safe">
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-4 pt-4 [@media(max-height:500px)]:pb-2">
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {steps.length > 1 && <span>Step {index + 1} of {steps.length}</span>}
            <span>{stepTitle(step, programme)}</span>
          </div>
          {steps.length > 1 && <Progress value={((index + 1) / steps.length) * 100} className="h-1.5" />}
        </div>

        {step === 'about' && (
          <Card className="p-4 sm:p-6 animate-scale-in flex flex-col gap-6">
            <header>
              <h1 className="text-2xl font-bold tracking-tight">About you</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {programme ? 'This sets your loads and schedule. You can change it any time.' : 'All optional. You can change it any time.'}
              </p>
            </header>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-2">
                <Label htmlFor="weight">Body weight</Label>
                <div className="flex gap-2">
                  <Input id="weight" inputMode="decimal" type="number" min={20} max={400} step="0.1" placeholder={useMetric ? '82' : '180'}
                    value={weightText} onChange={e => { setWeightText(e.target.value); setWeightTyped(true); }} className="h-11 text-base flex-1" />
                  <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Units">
                    {(['kg', 'lb'] as const).map(u => (
                      <button key={u} type="button" role="radio" aria-checked={(u === 'kg') === useMetric}
                        onClick={() => switchUnit(u === 'kg')}
                        className={cn('min-w-11 rounded-md px-3 text-sm font-medium', (u === 'kg') === useMetric ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="height">Height ({useMetric ? 'cm' : 'in'})</Label>
                <Input id="height" inputMode="numeric" type="number" placeholder="optional" className="h-11 text-base"
                  value={p.heightCm ? Math.round(useMetric ? p.heightCm : p.heightCm / 2.54) : ''}
                  onChange={e => set('heightCm', e.target.value ? Number(e.target.value) * (useMetric ? 1 : 2.54) : undefined)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="birth">Birth year</Label>
                <Input id="birth" inputMode="numeric" type="number" placeholder="optional" className="h-11 text-base"
                  value={p.birthYear ?? ''} onChange={e => set('birthYear', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
            {programme && (
              <>
                <ChipGroup label="Training experience" value={[p.experience]}
                  options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]}
                  onChange={([v]) => set('experience', v)} />
                <ChipGroup label="Training days" multiple value={p.trainingDays} hint="Six days gives every muscle 2 to 3 sessions a week."
                  options={WEEK.map(d => ({ value: d, label: DAY_SHORT[d] }))}
                  onChange={v => set('trainingDays', WEEK.filter(d => v.includes(d)))} />
                <ChipGroup label="Session length" value={[String(p.sessionMinutes) as '45' | '60' | '75']}
                  options={[{ value: '45', label: '45 min' }, { value: '60', label: '60 min' }, { value: '75', label: '75 min' }]}
                  onChange={([v]) => set('sessionMinutes', Number(v) as 45 | 60 | 75)} />
                <ChipGroup label="Where you train" value={[p.equipment]}
                  options={[{ value: 'fullGym', label: 'Full gym' }, { value: 'homeDumbbells', label: 'Home, dumbbells' }, { value: 'homeNone', label: 'Home, no equipment' }]}
                  onChange={([v]) => set('equipment', v)} />
                {asksDate && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="start">Program start date</Label>
                    <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 text-base"
                      aria-invalid={dateProblem !== null} aria-describedby={dateProblem ? 'start-problem' : undefined} />
                    {dateProblem && <p id="start-problem" className="text-sm text-[var(--safety)]">{dateProblem}</p>}
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {step === 'body' && (
          <Card className="p-4 sm:p-6 animate-scale-in flex flex-col gap-6">
            <header>
              <h1 className="text-2xl font-bold tracking-tight">Your body</h1>
              <p className="text-sm text-muted-foreground mt-1">Pain or past injuries change which exercises and stretches you get.</p>
            </header>
            <ChipGroup<PainArea | 'none'> label="Pain or past injury" multiple exclusive="none"
              value={p.pain.areas.length ? p.pain.areas : ['none']}
              options={[
                { value: 'lowerBack', label: 'Lower back' }, { value: 'sciatica', label: 'Sciatica' }, { value: 'neck', label: 'Neck' },
                { value: 'shoulder', label: 'Shoulder' }, { value: 'hip', label: 'Hip' }, { value: 'knee', label: 'Knee' },
                { value: 'hamstring', label: 'Hamstring' }, { value: 'calf', label: 'Calf' }, { value: 'none', label: 'None' },
              ]}
              onChange={v => setP(prev => ({ ...prev, pain: { ...prev.pain, areas: v.filter((x): x is PainArea => x !== 'none') } }))} />
            {p.pain.areas.includes('sciatica') && (
              <ChipGroup label="Which leg?" value={[p.pain.sciaticaSide ?? 'left']}
                options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]}
                onChange={([v]) => setP(prev => ({ ...prev, pain: { ...prev.pain, sciaticaSide: v } }))} />
            )}
            {p.pain.areas.includes('sciatica') && p.pain.sciaticaSide === 'both' && (
              <p role="alert" className="rounded-lg border border-[var(--safety)]/40 bg-[var(--safety)]/10 p-3 text-sm">
                Sciatica in both legs should be checked by a doctor promptly. If it came on suddenly, or comes with numbness around the groin or bladder or bowel changes, get emergency care.
              </p>
            )}
            {(p.pain.areas.includes('lowerBack') || p.pain.areas.includes('sciatica')) && (
              <ChipGroup label="Which makes it worse?" value={[p.pain.worseWith]}
                hint="This sets which back stretches you start with. The app keeps learning from your check-ins."
                options={[
                  { value: 'flexion', label: 'Sitting or bending forward' },
                  { value: 'extension', label: 'Standing, walking or arching back' },
                  { value: 'unknown', label: 'Not sure' },
                ]}
                onChange={([v]) => setP(prev => ({ ...prev, pain: { ...prev.pain, worseWith: v } }))} />
            )}
            {/* Goals shape the programme's plan, so they are asked only with it. */}
            {programme && (
              <ChipGroup<Goal> label="Goals" multiple value={p.goals}
                options={[
                  { value: 'strong', label: 'Strong' }, { value: 'lean', label: 'Lean' }, { value: 'flexible', label: 'Flexible' },
                  { value: 'athletic', label: 'Athletic' }, { value: 'painFreeBack', label: 'Pain-free back' },
                ]}
                onChange={v => set('goals', v)} />
            )}
          </Card>
        )}

        {step === 'health' && (
          <HealthStep p={p} setHealth={setHealth} answered={answered} answer={answer}
            year={{ text: sinceText, problem: yearProblem, set: text => {
              setSinceText(text);
              setHealth({ metforminSince: text !== '' && metforminYearProblem(text, thisYear) === null ? text : undefined });
            } }} />
        )}

        {step === 'summary' && <Summary p={{ ...p, weightKg }} programme={programme} ack={ack} setAck={setAck} />}
      </div>

      {/* Sticky in the page rather than fixed over it: it stays in reach while
          the form scrolls, and its own height — taller with a save error —
          is room it takes, never a part of the form it hides. On short
          landscape screens the buttons follow the form instead. */}
      <footer className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur pb-safe [@media(max-height:500px)]:static [@media(max-height:500px)]:border-t-0">
        {error && (
          <p role="alert" className="mx-auto w-full max-w-lg px-4 pt-3 text-sm font-medium text-[var(--safety)]">{error}</p>
        )}
        {/* At large text on a narrow screen the buttons stack, and a label
            wraps rather than run off the screen (D-10). */}
        <div className="mx-auto flex w-full max-w-lg flex-wrap gap-3 px-4 py-3">
          {(index > 0 || onCancel) && (
            <Button variant="outline" className={cn(FOOTER_BUTTON, 'flex-1 basis-24')} disabled={busy} onClick={() => (index > 0 ? setIndex(index - 1) : onCancel?.())}>
              <ArrowLeftIcon /> {index > 0 ? 'Back' : 'Cancel'}
            </Button>
          )}
          {!last ? (
            <Button className={cn(FOOTER_BUTTON, 'flex-[2] basis-32')} disabled={!ready || busy} onClick={() => setIndex(index + 1)}>
              Continue <ArrowRightIcon />
            </Button>
          ) : (
            <Button className={cn(FOOTER_BUTTON, 'flex-[2] basis-32')} disabled={!ready || busy}
              onClick={() => onComplete({ profile: final(), startDate, useMetric, opened })}>
              <CheckIcon /> {busy ? 'Saving…' : submitLabel ?? finishLabel(mode, programme)}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

const SGLT2_QUESTION = 'An SGLT2 inhibitor, for diabetes, heart or kidney? (e.g. empagliflozin, dapagliflozin)';


/** Insulin and how it is taken, asked as one question. */
type InsulinChoice = 'none' | 'basalOnly' | 'multipleDaily' | 'pump' | 'closedLoop' | 'unsure';

function insulinChoice(h: HealthProfile): InsulinChoice | undefined {
  if (h.insulin === 'none') return 'none';
  if (h.insulin === 'unsure') return 'unsure';
  if (h.insulin === 'automated_delivery') return 'closedLoop';
  return h.insulinRegimen;
}

const INSULIN_PATCH: Record<InsulinChoice, Partial<HealthProfile>> = {
  none: { insulin: 'none', insulinRegimen: undefined },
  basalOnly: { insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' },
  multipleDaily: { insulin: 'injections_or_pump', insulinRegimen: 'multipleDaily' },
  pump: { insulin: 'injections_or_pump', insulinRegimen: 'pump' },
  closedLoop: { insulin: 'automated_delivery', insulinRegimen: 'pump' },
  unsure: { insulin: 'unsure', insulinRegimen: undefined },
};

/** Yes, no or not sure, with nothing chosen until the person answers. */
function MedicineAnswerChips({ label, value, answered, onChange, hint }: {
  label: string; value: MedicineAnswer | undefined; answered: boolean; onChange: (v: MedicineAnswer) => void; hint?: string;
}) {
  const current = !answered || value === undefined ? [] : value === 'unsure' ? ['unsure' as const] : value ? ['yes' as const] : ['no' as const];
  return (
    <ChipGroup<'no' | 'yes' | 'unsure'> label={label} value={current} hint={hint}
      options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }, { value: 'unsure', label: 'Not sure' }]}
      onChange={([v]) => onChange(v === 'unsure' ? 'unsure' : v === 'yes')} />
  );
}

/** A number box in the profile's own type size, so iOS does not zoom on focus. */
function SmallNumber({ id, label, value, onChange, placeholder }: { id: string; label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={id} inputMode="decimal" type="number" placeholder={placeholder} className="h-11 text-base"
        value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    </div>
  );
}

function HealthStep({ p, setHealth, answered, answer, year }: {
  p: UserProfile;
  setHealth: (h: Partial<HealthProfile>) => void;
  answered: Set<MedicineQuestion>;
  answer: (q: MedicineQuestion) => void;
  /** The metformin year field: its text, what is wrong with it, and how to change it. */
  year: { text: string; problem: string | null; set: (text: string) => void };
}) {
  const h = p.health;
  // Said once the field is left, or at once for four digits that are no year.
  const [yearLeft, setYearLeft] = useState(false);
  const showYearProblem = year.problem !== null && (yearLeft || year.text.length >= 4);
  const d = deriveHealth(h);
  const diabetic = d.diabetic;
  const bp = h.hypertension !== 'none';
  const insulin = answered.has('insulin') ? insulinChoice(h) : undefined;
  const unanswered = diabetic && DIABETES_MEDICINES.some(q => !answered.has(q));
  // Also asked for heart, vessel or kidney disease without high blood pressure (B08).
  const asksBp = bpMedicinesAsked(h);
  const bpUnanswered = asksBp && BP_MEDICINES.some(q => !answered.has(q));
  const sglt2Unanswered = !diabetic && !answered.has('sglt2i');
  const bpMedicines = (
    <>
      <MedicineAnswerChips label="Beta-blocker? (e.g. bisoprolol, metoprolol)" value={h.betaBlocker}
        answered={answered.has('betaBlocker')} onChange={v => { setHealth({ betaBlocker: v }); answer('betaBlocker'); }} />
      <MedicineAnswerChips label="Diuretic or water pill?" value={h.diuretic}
        answered={answered.has('diuretic')} onChange={v => { setHealth({ diuretic: v }); answer('diuretic'); }} />
      {bpUnanswered && <p role="status" className="text-sm font-medium">Answer both medicine questions to continue.</p>}
    </>
  );
  const other: ('heart' | 'kidney' | 'dizzy' | 'none')[] = [
    ...(h.heartOrVascularDisease ? ['heart' as const] : []),
    ...(h.kidneyDisease !== 'none' ? ['kidney' as const] : []),
    ...(h.dizzyOnStandingOrAutonomicNeuropathy ? ['dizzy' as const] : []),
  ];
  const target = h.clinicianTargets;
  const setTargets = (patch: Partial<NonNullable<HealthProfile['clinicianTargets']>>) => setHealth({ clinicianTargets: { ...target, ...patch } });
  return (
    <Card className="p-4 sm:p-6 animate-scale-in flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your health</h1>
        <p className="text-sm text-muted-foreground mt-1">Stays on this phone. Only used to keep each session safe.</p>
      </header>

      <ChipGroup label="Diabetes" value={[h.diabetes]}
        options={[
          { value: 'none', label: 'None' }, { value: 'prediabetes', label: 'Prediabetes' },
          { value: 'type1', label: 'Type 1' }, { value: 'type2', label: 'Type 2' }, { value: 'other', label: 'Other' },
        ]}
        onChange={([v]) => setHealth({ diabetes: v })} />

      {diabetic && (
        <div className="flex flex-col gap-5 rounded-xl border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            Some diabetes medicines change what is safe before exercise, so each question needs an answer. Choose Not sure if you don’t know.
          </p>
          <ChipGroup<InsulinChoice> label="Insulin" value={insulin ? [insulin] : []}
            options={[
              { value: 'none', label: 'No insulin' },
              { value: 'basalOnly', label: 'Long-acting only' },
              { value: 'multipleDaily', label: 'Several injections a day' },
              { value: 'pump', label: 'Pump' },
              { value: 'closedLoop', label: 'Closed-loop system' },
              { value: 'unsure', label: 'Not sure' },
            ]}
            onChange={([v]) => { setHealth(INSULIN_PATCH[v]); answer('insulin'); }} />
          <MedicineAnswerChips label="Sulfonylurea or meglitinide? (e.g. gliclazide, glimepiride)" value={h.sulfonylureaOrMeglitinide}
            answered={answered.has('sulfonylurea')} onChange={v => { setHealth({ sulfonylureaOrMeglitinide: v }); answer('sulfonylurea'); }} />
          <MedicineAnswerChips label={SGLT2_QUESTION} value={h.sglt2i}
            answered={answered.has('sglt2i')} onChange={v => { setHealth({ sglt2i: v }); answer('sglt2i'); }} />
          <MedicineAnswerChips label="Metformin?" value={h.metformin}
            answered={answered.has('metformin')} onChange={v => {
              setHealth({ metformin: v, ...(v === true ? {} : { metforminSince: undefined }) });
              // Back to yes: the year still in the field counts again.
              if (v === true) year.set(year.text);
              answer('metformin');
            }} />
          {answered.has('metformin') && h.metformin === true && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="metformin-since">Year you started metformin (optional)</Label>
              <Input id="metformin-since" inputMode="numeric" type="number" autoComplete="off" placeholder="2019" className="h-11 text-base"
                value={year.text}
                aria-invalid={showYearProblem}
                aria-describedby={showYearProblem ? 'metformin-since-problem' : undefined}
                onChange={e => year.set(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onBlur={() => setYearLeft(true)} />
              {showYearProblem && <p id="metformin-since-problem" role="alert" className="text-sm font-medium text-[var(--safety)]">{year.problem}</p>}
              <p className="text-xs text-muted-foreground">Long-term metformin can lower vitamin B12, so the app suggests when to ask about a check.</p>
            </div>
          )}
          <MedicineAnswerChips label="Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?" value={h.priorDkaOrInsulinDeficiency}
            answered={answered.has('priorDka')} onChange={v => { setHealth({ priorDkaOrInsulinDeficiency: v }); answer('priorDka'); }} />
          {unanswered && <p role="status" className="text-sm font-medium">Answer each medicine question to continue.</p>}
          <YesNo label="A severe low in the last 6 months, or do you often not feel lows coming?" value={h.highHypoRisk}
            onChange={v => setHealth({ highHypoRisk: v === true })} />
          <ChipGroup label="Glucose monitoring" value={[h.glucoseMonitor]}
            options={[{ value: 'none', label: 'None' }, { value: 'meter', label: 'Meter' }, { value: 'cgm', label: 'CGM' }]}
            onChange={([v]) => setHealth({ glucoseMonitor: v })} />
          <ChipGroup label="Glucose unit" value={[h.glucoseUnit]}
            options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]}
            onChange={([v]) => setHealth({ glucoseUnit: v })} />
          {d.hypoRisk && (
            <SmallNumber id="start-min" label={`Lowest glucose your care team says you can start exercise at, in ${target?.glucoseStartUnit ?? h.glucoseUnit} (optional)`}
              value={target?.glucoseStartMin} placeholder={h.glucoseUnit === 'mg/dL' ? '90' : '5.0'}
              onChange={v => setTargets(v === undefined ? { glucoseStartMin: undefined, glucoseStartUnit: undefined } : { glucoseStartMin: v, glucoseStartUnit: target?.glucoseStartUnit ?? h.glucoseUnit })} />
          )}
          {d.ketoneRisk && (
            <ChipGroup label="Ketone testing" value={[h.ketoneTest]}
              options={[{ value: 'none', label: 'None' }, { value: 'urine', label: 'Urine strips' }, { value: 'blood', label: 'Blood meter' }]}
              onChange={([v]) => setHealth({ ketoneTest: v })} />
          )}
          <ChipGroup label="Diabetic eye disease (retinopathy)" value={[h.retinopathy]}
            options={[
              { value: 'none_or_mild', label: 'None or mild' }, { value: 'moderate', label: 'Moderate' },
              { value: 'severe_or_proliferative', label: 'Severe' }, { value: 'recent_eye_treatment', label: 'Recent eye treatment' },
              { value: 'unknown', label: "Don't know" },
            ]}
            onChange={([v]) => setHealth({ retinopathy: v })} />
          <ChipGroup label="Nerve damage in your feet" value={[h.peripheralNeuropathy]}
            options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }, { value: 'unsure', label: 'Not sure' }]}
            onChange={([v]) => setHealth({ peripheralNeuropathy: v })} />
          <ChipGroup label="Your feet today" value={[h.footStatus]}
            options={[{ value: 'healthy', label: 'Healthy' }, { value: 'past_ulcer_or_charcot', label: 'Past ulcer or Charcot' }, { value: 'current_wound_or_active_charcot', label: 'Current wound' }]}
            onChange={([v]) => setHealth({ footStatus: v })} />
        </div>
      )}

      <ChipGroup label="High blood pressure" value={[h.hypertension]}
        options={[{ value: 'none', label: 'None' }, { value: 'treated', label: 'Treated' }, { value: 'untreated', label: 'Untreated' }, { value: 'unsure', label: 'Not sure' }]}
        onChange={([v]) => setHealth({ hypertension: v })} />
      {bp && (
        <div className="flex flex-col gap-5 rounded-xl border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            These change how the app judges effort and fluids, so each needs an answer. Choose Not sure if you don’t know.
          </p>
          {bpMedicines}
          <YesNo label="Home blood-pressure monitor?" value={h.bpMonitor} onChange={v => setHealth({ bpMonitor: v === true })} />
          <YesNo label="Has a clinician said exercise is fine with readings above 160 over 100?" value={!!h.bpExercisePermission}
            onChange={v => setHealth({ bpExercisePermission: v === true ? (h.bpExercisePermission ?? { sys: 0, dia: 0, recordedOn: todayString() }) : undefined })} />
          {h.bpExercisePermission && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Up to which reading?</p>
              <div className="grid grid-cols-2 gap-3">
                <SmallNumber id="bp-perm-sys" label="Top number" value={h.bpExercisePermission.sys || undefined} placeholder="170"
                  onChange={v => setHealth({ bpExercisePermission: { ...h.bpExercisePermission!, sys: v ?? 0, recordedOn: todayString() } })} />
                <SmallNumber id="bp-perm-dia" label="Bottom number" value={h.bpExercisePermission.dia || undefined} placeholder="105"
                  onChange={v => setHealth({ bpExercisePermission: { ...h.bpExercisePermission!, dia: v ?? 0, recordedOn: todayString() } })} />
              </div>
              <p className="text-xs text-muted-foreground">Readings of 180 over 120 or higher always stop exercise, whatever this says.</p>
            </div>
          )}
        </div>
      )}

      <ChipGroup<'heart' | 'kidney' | 'dizzy' | 'none'> label="Anything else?" multiple exclusive="none"
        value={other.length ? other : ['none']}
        options={[{ value: 'heart', label: 'Heart or circulation' }, { value: 'kidney', label: 'Kidney disease' }, { value: 'dizzy', label: 'Dizzy when standing' }, { value: 'none', label: 'None' }]}
        onChange={v => setHealth({
          heartOrVascularDisease: v.includes('heart'),
          kidneyDisease: v.includes('kidney') ? (h.kidneyDisease === 'none' ? 'ckd' : h.kidneyDisease) : 'none',
          dizzyOnStandingOrAutonomicNeuropathy: v.includes('dizzy'),
        })} />

      {/* SGLT2 inhibitors are also prescribed for heart failure and kidney
          disease, without diabetes, and carry ketone risk either way (Codex
          re-audit F12). With diabetes it is asked with the other medicines. */}
      {!bp && asksBp && (
        <div className="flex flex-col gap-5 rounded-xl border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            Heart and kidney conditions are often treated with these, and they change how the app judges effort and fluids, so each needs an answer. Choose Not sure if you don’t know.
          </p>
          {bpMedicines}
        </div>
      )}

      {/* Nothing is chosen until the person answers: an untouched No would
          hide a ketone risk (B08). Required before the health review is done. */}
      {!diabetic && (
        <div className="flex flex-col gap-2">
          <MedicineAnswerChips label={SGLT2_QUESTION} value={h.sglt2i}
            answered={answered.has('sglt2i')} onChange={v => { setHealth({ sglt2i: v }); answer('sglt2i'); }} />
          {sglt2Unanswered && <p role="status" className="text-sm font-medium">Answer this to continue. Choose Not sure if you don’t know.</p>}
        </div>
      )}
      {!diabetic && d.ketoneRisk && (
        <ChipGroup label="Ketone testing" value={[h.ketoneTest]}
          options={[{ value: 'none', label: 'None' }, { value: 'urine', label: 'Urine strips' }, { value: 'blood', label: 'Blood meter' }]}
          onChange={([v]) => setHealth({ ketoneTest: v })} />
      )}

      {/* Withholds every water reminder and "drink more" nudge when yes or not
          sure (Codex re-audit F13). */}
      <MedicineAnswerChips label="Has your care team told you to limit how much you drink?" value={h.fluidRestriction}
        answered={h.fluidRestriction !== undefined} hint="Kidney and heart conditions sometimes need a fluid limit."
        onChange={v => setHealth({ fluidRestriction: v })} />

      <YesNo label="Active at least 30 minutes, 3 days a week, for the last 3 months?" value={h.currentlyActive}
        onChange={v => setHealth({ currentlyActive: v === true })} />
      {(diabetic || h.heartOrVascularDisease || h.kidneyDisease !== 'none' || bp) && (
        <ChipGroup label="Has a clinician cleared you for exercise?" value={[h.clearance]}
          options={[{ value: 'none', label: 'Not yet' }, { value: 'moderate', label: 'For moderate' }, { value: 'vigorous', label: 'For vigorous' }]}
          onChange={([v]) => setHealth({ clearance: v })} />
      )}
    </Card>
  );
}

function Summary({ p, programme, ack, setAck }: { p: UserProfile; programme: boolean; ack: boolean; setAck: (v: boolean) => void }) {
  const rules = useMemo(() => profileRules(p), [p]);
  const d = deriveHealth(p.health);
  const back = p.pain.areas.includes('lowerBack') || p.pain.areas.includes('sciatica');
  const leg = p.pain.sciaticaSide === 'both' ? 'legs' : `${p.pain.sciaticaSide ?? 'left'} leg`;
  // Without the programme there is no plan to describe, only how movement is
  // kept safe for this person.
  const adaptations = (programme ? [
    back && 'Back-safe exercise choices; heavier squats and deadlifts unlock as your back proves it is ready.',
    p.pain.areas.includes('sciatica') && `Daily nerve glides for your ${leg}, and no stretches that pull on the nerve.`,
    d.hypoRisk && 'Glucose checks before cardio, fast-carb reminders, and an "I feel low" button.',
    d.diabetic && !d.hypoRisk && 'Glucose-aware cardio and post-meal walk reminders.',
    (p.health.hypertension !== 'none' || d.onBpMeds) && 'No breath-holding, sets stop well short of failure, and longer cool-downs.',
    p.health.peripheralNeuropathy !== 'no' && 'Low-impact cardio and foot checks.',
    'A 15-minute stretch and mobility block before every session, linked to the day’s muscles.',
  ] : [
    back && 'Back-safe stretches and movements, chosen from how your back feels that day.',
    p.pain.areas.includes('sciatica') && `No stretches that pull on the nerve in your ${leg}.`,
    d.hypoRisk && 'A glucose check before you move, and an "I feel low" button.',
    d.diabetic && !d.hypoRisk && 'Glucose-aware walks, and after-meal walk reminders you can turn on.',
    (p.health.hypertension !== 'none' || d.onBpMeds) && 'No breath-holding, and slow, steady rises from the floor.',
    p.health.peripheralNeuropathy !== 'no' && 'Low-impact choices and foot checks.',
    'A short check of how you are before any movement.',
  ]).filter(Boolean) as string[];
  const clearance = rules.reasons.filter(r => r.code.startsWith('clearance') || r.code === 'bpUnknown' || r.code === 'eyeTreatment');

  return (
    <Card className="p-4 sm:p-6 animate-scale-in flex flex-col gap-5">
      {programme ? (
        <>
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Your plan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {p.trainingDays.length} days a week · {p.sessionMinutes} minutes · rebuilt every day from your morning check-in.
            </p>
          </header>
          <WeekPlan p={p} />
        </>
      ) : (
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Before you start</h1>
          <p className="text-sm text-muted-foreground mt-1">What the app does with your answers.</p>
        </header>
      )}
      <div>
        <p className="text-sm font-semibold mb-2">Built around you</p>
        <ul className="flex flex-col gap-2 text-sm">
          {adaptations.map(a => (
            <li key={a} className="flex gap-2"><CheckIcon className="size-4 mt-0.5 shrink-0 text-[var(--block-mobility)]" />{a}</li>
          ))}
        </ul>
      </div>
      {clearance.length > 0 && (
        <div role="note" className="rounded-xl border border-[var(--safety)]/40 bg-[var(--safety)]/10 p-3 text-sm flex gap-2">
          <ShieldAlertIcon className="size-5 shrink-0 text-[var(--safety)]" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Before vigorous exercise</p>
            {clearance.map(r => <p key={r.code}>{r.message}</p>)}
            <p className="text-muted-foreground">You can update your clearance in You, under Profile & health, once you have it.</p>
          </div>
        </div>
      )}
      {/* The whole row is the control, with an iOS-style round check: a
          44-point target, not a 13-pixel box (acceptance tap targets). */}
      <button type="button" role="checkbox" aria-checked={ack} onClick={() => setAck(!ack)}
        className="press-feedback flex min-h-11 w-full items-start gap-3 rounded-xl border p-3 text-left text-sm">
        <span aria-hidden className={cn(
          'mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          ack ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground' : 'border-muted-foreground',
        )}>
          {ack && <CheckIcon className="size-4" strokeWidth={3} />}
        </span>
        <span>
          I understand this is general information, not medical advice. I will stop and get help for chest pain, faintness or severe breathlessness, and follow my care team’s medication plan.
        </span>
      </button>
    </Card>
  );
}

/** The programme's week, day by day. */
function WeekPlan({ p }: { p: UserProfile }) {
  const week = weekFocus(p);
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-sm">
      {WEEK.map(day => (
        <li key={day} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="font-medium">{DAY_SHORT[day]}</span>
          <span className={cn(week[day] === 'rest' && 'text-muted-foreground')}>{focusLabel(week[day])}</span>
        </li>
      ))}
    </ul>
  );
}
