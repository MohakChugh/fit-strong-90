/**
 * Three-screen profile (spec §3.1): schedule → body → health, then a summary.
 * Follow-up questions appear only when relevant, so a user with no conditions
 * taps through in under a minute. Used for onboarding and for editing.
 */

import { useMemo, useState } from 'react';
import type { DayOfWeek } from '@/types';
import type { Goal, HealthProfile, PainArea, UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { startingLadder } from '@/engine/progression';
import { profileRules, deriveHealth } from '@/engine/health';
import { weekFocus, focusLabel, WEEK } from '@/engine/templates';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn, todayString } from '@/lib/utils';
import { ChipGroup, YesNo } from './ChipGroup';
import { ShieldAlertIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from 'lucide-react';

export interface WizardResult {
  profile: UserProfile;
  startDate: string;
  useMetric: boolean;
}

interface Props {
  mode: 'onboarding' | 'edit';
  initial?: Partial<WizardResult>;
  onComplete: (r: WizardResult) => void;
  onCancel?: () => void;
}

const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const LB_PER_KG = 2.20462;

export function ProfileWizard({ mode, initial, onComplete, onCancel }: Props) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState<UserProfile>(() => initial?.profile ?? createDefaultProfile());
  const [useMetric, setUseMetric] = useState(initial?.useMetric ?? true);
  const [startDate, setStartDate] = useState(initial?.startDate || todayString());
  const [weightText, setWeightText] = useState(() => {
    const kg = initial?.profile?.weightKg;
    if (!kg) return '';
    return String(Math.round((initial?.useMetric ?? true ? kg : kg * LB_PER_KG) * 10) / 10);
  });
  const [ack, setAck] = useState(mode === 'edit');

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => setP(prev => ({ ...prev, [k]: v }));
  const setHealth = (patch: Partial<HealthProfile>) => setP(prev => ({ ...prev, health: { ...prev.health, ...patch } }));
  const weight = Number(weightText);
  const weightKg = useMetric ? weight : weight / LB_PER_KG;
  const steps = 4;
  const canContinue = step !== 1 || (weight > 0 && p.trainingDays.length > 0);

  const final = (): UserProfile => {
    const profile: UserProfile = { ...p, weightKg: Math.round(weightKg * 10) / 10, needsHealthReview: false };
    if (mode === 'onboarding') profile.ladder = startingLadder(profile);
    return profile;
  };

  return (
    <div className="min-h-dvh bg-background pt-safe">
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4 [@media(max-height:500px)]:pb-2">
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step} of {steps}</span>
            <span>{['', 'You and your schedule', 'Your body', 'Your health', 'Your plan'][step]}</span>
          </div>
          <Progress value={(step / steps) * 100} className="h-1.5" />
        </div>

        {step === 1 && (
          <Card className="p-4 sm:p-6 animate-scale-in flex flex-col gap-6">
            <header>
              <h1 className="text-2xl font-bold tracking-tight">About you</h1>
              <p className="text-sm text-muted-foreground mt-1">This sets your loads and schedule. You can change it any time.</p>
            </header>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-2">
                <Label htmlFor="weight">Body weight</Label>
                <div className="flex gap-2">
                  <Input id="weight" inputMode="decimal" type="number" min={20} max={400} step="0.1" placeholder={useMetric ? '82' : '180'}
                    value={weightText} onChange={e => setWeightText(e.target.value)} className="h-11 text-base flex-1" />
                  <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Units">
                    {(['kg', 'lb'] as const).map(u => (
                      <button key={u} type="button" role="radio" aria-checked={(u === 'kg') === useMetric}
                        onClick={() => setUseMetric(u === 'kg')}
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
            {mode === 'onboarding' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="start">Program start date</Label>
                <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 text-base" />
              </div>
            )}
          </Card>
        )}

        {step === 2 && (
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
            <ChipGroup<Goal> label="Goals" multiple value={p.goals}
              options={[
                { value: 'strong', label: 'Strong' }, { value: 'lean', label: 'Lean' }, { value: 'flexible', label: 'Flexible' },
                { value: 'athletic', label: 'Athletic' }, { value: 'painFreeBack', label: 'Pain-free back' },
              ]}
              onChange={v => set('goals', v)} />
          </Card>
        )}

        {step === 3 && <HealthStep p={p} setHealth={setHealth} />}

        {step === 4 && <Summary p={{ ...p, weightKg }} ack={ack} setAck={setAck} />}
      </div>

      {/* On short landscape screens the buttons follow the form instead of covering a third of it. */}
      <footer className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur pb-safe [@media(max-height:500px)]:static [@media(max-height:500px)]:border-t-0">
        <div className="mx-auto flex w-full max-w-lg gap-3 px-4 py-3">
          {(step > 1 || onCancel) && (
            <Button variant="outline" className="h-12 flex-1 text-base" onClick={() => (step > 1 ? setStep(step - 1) : onCancel?.())}>
              <ArrowLeftIcon /> {step > 1 ? 'Back' : 'Cancel'}
            </Button>
          )}
          {step < steps ? (
            <Button className="h-12 flex-[2] text-base" disabled={!canContinue} onClick={() => setStep(step + 1)}>
              Continue <ArrowRightIcon />
            </Button>
          ) : (
            <Button className="h-12 flex-[2] text-base" disabled={!ack}
              onClick={() => onComplete({ profile: final(), startDate, useMetric })}>
              <CheckIcon /> {mode === 'onboarding' ? 'Build my plan' : 'Save'}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function HealthStep({ p, setHealth }: { p: UserProfile; setHealth: (h: Partial<HealthProfile>) => void }) {
  const h = p.health;
  const diabetic = h.diabetes === 'type1' || h.diabetes === 'type2' || h.diabetes === 'other';
  const bp = h.hypertension !== 'none';
  const other: ('heart' | 'kidney' | 'dizzy' | 'none')[] = [
    ...(h.heartOrVascularDisease ? ['heart' as const] : []),
    ...(h.kidneyDisease !== 'none' ? ['kidney' as const] : []),
    ...(h.dizzyOnStandingOrAutonomicNeuropathy ? ['dizzy' as const] : []),
  ];
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
          <ChipGroup label="Insulin" value={[h.insulin]}
            options={[{ value: 'none', label: 'None' }, { value: 'injections_or_pump', label: 'Injections or pump' }, { value: 'automated_delivery', label: 'Closed-loop system' }]}
            onChange={([v]) => setHealth({ insulin: v })} />
          <YesNo unsure label="Sulfonylurea or meglitinide? (e.g. gliclazide, glimepiride)" value={h.sulfonylureaOrMeglitinide}
            onChange={v => setHealth({ sulfonylureaOrMeglitinide: v !== false })} />
          <YesNo unsure label="SGLT2 inhibitor? (e.g. empagliflozin, dapagliflozin)" value={h.sglt2i}
            onChange={v => setHealth({ sglt2i: v !== false })} />
          <YesNo label="A severe low in the last 6 months, or do you often not feel lows coming?" value={h.highHypoRisk}
            onChange={v => setHealth({ highHypoRisk: v === true })} />
          <ChipGroup label="Glucose monitoring" value={[h.glucoseMonitor]}
            options={[{ value: 'none', label: 'None' }, { value: 'meter', label: 'Meter' }, { value: 'cgm', label: 'CGM' }]}
            onChange={([v]) => setHealth({ glucoseMonitor: v })} />
          <ChipGroup label="Glucose unit" value={[h.glucoseUnit]}
            options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]}
            onChange={([v]) => setHealth({ glucoseUnit: v })} />
          {(h.diabetes === 'type1' || h.sglt2i) && (
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
          <YesNo unsure label="Beta-blocker? (e.g. bisoprolol, metoprolol)" value={h.betaBlocker} onChange={v => setHealth({ betaBlocker: v !== false })} />
          <YesNo unsure label="Diuretic or water pill?" value={h.diuretic} onChange={v => setHealth({ diuretic: v !== false })} />
          <YesNo label="Home blood-pressure monitor?" value={h.bpMonitor} onChange={v => setHealth({ bpMonitor: v === true })} />
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

function Summary({ p, ack, setAck }: { p: UserProfile; ack: boolean; setAck: (v: boolean) => void }) {
  const rules = useMemo(() => profileRules(p), [p]);
  const d = deriveHealth(p.health);
  const week = weekFocus(p);
  const back = p.pain.areas.includes('lowerBack') || p.pain.areas.includes('sciatica');
  const adaptations = [
    back && 'Back-safe exercise choices; heavier squats and deadlifts unlock as your back proves it is ready.',
    p.pain.areas.includes('sciatica') && `Daily nerve glides for your ${p.pain.sciaticaSide === 'both' ? 'legs' : `${p.pain.sciaticaSide ?? 'left'} leg`}, and no stretches that pull on the nerve.`,
    d.hypoRisk && 'Glucose checks before cardio, fast-carb reminders, and an "I feel low" button.',
    d.diabetic && !d.hypoRisk && 'Glucose-aware cardio and post-meal walk reminders.',
    (p.health.hypertension !== 'none' || d.onBpMeds) && 'No breath-holding, sets stop well short of failure, and longer cool-downs.',
    p.health.peripheralNeuropathy !== 'no' && 'Low-impact cardio and foot checks.',
    'A 15-minute stretch and mobility block before every session, linked to the day’s muscles.',
  ].filter(Boolean) as string[];
  const clearance = rules.reasons.filter(r => r.code.startsWith('clearance') || r.code === 'bpUnknown' || r.code === 'eyeTreatment');

  return (
    <Card className="p-4 sm:p-6 animate-scale-in flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {p.trainingDays.length} days a week · {p.sessionMinutes} minutes · rebuilt every day from your morning check-in.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-1.5 text-sm">
        {WEEK.map(day => (
          <li key={day} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="font-medium">{DAY_SHORT[day]}</span>
            <span className={cn(week[day] === 'rest' && 'text-muted-foreground')}>{focusLabel(week[day])}</span>
          </li>
        ))}
      </ul>
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
            <p className="text-muted-foreground">You can update your clearance in Settings once you have it.</p>
          </div>
        </div>
      )}
      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer">
        <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={ack} onChange={e => setAck(e.target.checked)} />
        <span>
          I understand this is general information, not medical advice. I will stop and get help for chest pain, faintness or severe breathlessness, and follow my care team’s medication plan.
        </span>
      </label>
    </Card>
  );
}
