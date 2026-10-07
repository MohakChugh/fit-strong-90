/**
 * Morning check-in (spec §3.2): about 20 seconds on most days because rare
 * items default to "none". Questions appear only when the profile needs them.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CheckInRecord, DailyCheckIn, GlucoseTrend, NewsItem, Readiness, SymptomReach } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { deriveHealth } from '@/engine/health';
import { glucoseSanity, toMgdl } from '@/engine/readiness';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChipOption } from '@/components/profile/ChipGroup';
import { ChipGroup, YesNo } from '@/components/profile/ChipGroup';
import { OutcomeBanner } from './OutcomeBanner';
import { initialBp, submitBlocked, submitsGlucose } from './form';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  date: string;
  initial?: CheckInRecord;
  onSave: (c: DailyCheckIn) => Readiness;
  onStart: () => void;
}

function PainSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn('text-2xl font-bold tabular-nums', value > 5 ? 'text-[var(--safety)]' : value >= 3 ? 'text-[var(--block-strength-ink)]' : '')}>{value}</span>
      </div>
      <input id={id} type="range" min={0} max={10} step={1} value={value} onChange={e => onChange(Number(e.target.value))}
        className="h-11 w-full accent-[var(--primary)]" aria-valuetext={`${value} out of 10`} />
      <div className="flex justify-between text-xs text-muted-foreground"><span>No pain</span><span>Worst</span></div>
    </div>
  );
}

/** Urine strips are marked in mg/dL, so the engine reads them on that scale. */
const URINE_KETONES: ChipOption<string>[] = [
  { value: '0', label: 'Negative' },
  { value: '5', label: 'Trace' },
  { value: '15', label: 'Small' },
  { value: '40', label: 'Moderate' },
  { value: '80', label: 'Large' },
];

/** When a recheck is due; only ever called from the submit tap. */
const minutesFromNow = (minutes: number) => Date.now() + minutes * 60_000;

export function CheckInSheet({ open, onOpenChange, profile, date, initial, onSave, onStart }: Props) {
  const h = profile.health;
  const d = deriveHealth(h);
  const back = profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica');
  const sciatica = profile.pain.areas.includes('sciatica');
  const diabetic = d.diabetic || h.diabetes === 'prediabetes';

  const [urgent, setUrgent] = useState(initial?.urgentSymptoms ?? false);
  const [pain, setPain] = useState(initial?.back?.pain ?? 0);
  const [legPain, setLegPain] = useState(initial?.back?.legPain ?? 0);
  const [reach, setReach] = useState<SymptomReach>(initial?.back?.reach ?? 'back');
  const [newNeuro, setNewNeuro] = useState(initial?.back?.newNeuro ?? false);
  const [cauda, setCauda] = useState(initial?.back?.caudaEquinaFlag ?? false);
  const [news, setNews] = useState<NewsItem[]>(initial?.news ?? []);
  const [glucose, setGlucose] = useState(initial?.glucose ? String(initial.glucose.value) : '');
  const [unit, setUnit] = useState(initial?.glucose?.unit ?? h.glucoseUnit);
  const [trend, setTrend] = useState<GlucoseTrend>(initial?.glucose?.trend ?? 'flat');
  const [rapid, setRapid] = useState(initial?.glucose?.rapidInsulinLast2h ?? false);
  const [ketones, setKetones] = useState(initial?.ketones ? String(initial.ketones.value) : '');
  const [bp, setBp] = useState(() => initialBp(initial?.bp));
  const [sleep, setSleep] = useState<DailyCheckIn['sleep']>(initial?.sleep ?? 'gt7');
  const [energy, setEnergy] = useState<DailyCheckIn['energy']>(initial?.energy ?? 4);
  const [result, setResult] = useState<Readiness | null>(null);
  // A low at check-in needs a new reading before anything else.
  const [needsReading, setNeedsReading] = useState(!!initial?.readiness.recheckMinutes);
  const [recheckEnds, setRecheckEnds] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!recheckEnds) return;
    const tick = () => setRemaining(Math.max(0, recheckEnds - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [recheckEnds]);

  const glucoseValue = glucose ? Number(glucose) : undefined;
  const sanity = glucoseValue !== undefined ? glucoseSanity(glucoseValue, unit) : 'ok';
  const mg = glucoseValue !== undefined && sanity === 'ok' ? toMgdl(glucoseValue, unit) : undefined;
  // Anyone who can make ketones may enter a reading at any glucose: an SGLT2
  // inhibitor can cause ketoacidosis at a normal level.
  const needKetones = d.ketoneRisk;
  const urineKetones = h.ketoneTest === 'urine';
  const bpAvg = useMemo(() => {
    const s = [bp.s1, bp.s2].map(Number).filter(n => n > 0);
    const di = [bp.d1, bp.d2].map(Number).filter(n => n > 0);
    if (!s.length || !di.length) return undefined;
    return { sys: Math.round(s.reduce((a, b) => a + b, 0) / s.length), dia: Math.round(di.reduce((a, b) => a + b, 0) / di.length) };
  }, [bp]);

  const submit = () => {
    const c: DailyCheckIn = {
      date,
      urgentSymptoms: urgent,
      news,
      sleep,
      energy,
      ...(back ? { back: { pain, ...(sciatica ? { legPain, reach } : {}), newNeuro, caudaEquinaFlag: cauda } } : {}),
      ...(glucoseValue !== undefined && submitsGlucose(sanity)
        ? { glucose: { value: glucoseValue, unit, ...(h.glucoseMonitor === 'cgm' ? { trend } : {}), ...(h.insulin !== 'none' ? { rapidInsulinLast2h: rapid } : {}) } }
        : {}),
      ...(needKetones && ketones ? { ketones: { value: Number(ketones), kind: urineKetones ? 'urine' as const : 'blood' as const } } : {}),
      ...(bpAvg ? { bp: bpAvg } : {}),
    };
    const r = onSave(c);
    setResult(r);
    setNeedsReading(!!r.recheckMinutes);
    setRecheckEnds(r.recheckMinutes ? minutesFromNow(r.recheckMinutes) : null);
    if (!r.recheckMinutes) setRemaining(0);
  };

  // A treat-and-recheck outcome needs a new reading, not just the timer running out.
  const canStart = result && ['green', 'amber', 'recovery'].includes(result.outcome) && !result.recheckMinutes;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">Morning check-in</SheetTitle>
          <SheetDescription>About 20 seconds. Today’s session adapts to your answers.</SheetDescription>
        </SheetHeader>

        {!result ? (
          <div className="flex flex-col gap-6 px-4 pb-6">
            <YesNo label="Right now: chest pain or pressure, unusual breathlessness, a racing heartbeat at rest, sudden weakness, trouble speaking, or a sudden change in vision?"
              value={urgent} onChange={v => setUrgent(v === true)} />

            {back && (
              <div className="flex flex-col gap-5 rounded-xl border p-3">
                <PainSlider id="back-pain" label="Lower-back pain now" value={pain} onChange={setPain} />
                {sciatica && <PainSlider id="leg-pain" label="Leg pain now" value={legPain} onChange={setLegPain} />}
                {sciatica && (
                  <ChipGroup<SymptomReach> label="How far down do symptoms reach?" value={[reach]}
                    options={[{ value: 'back', label: 'Back only' }, { value: 'buttock', label: 'Buttock' }, { value: 'thigh', label: 'Thigh' }, { value: 'belowKnee', label: 'Below knee' }, { value: 'foot', label: 'Foot' }]}
                    onChange={([v]) => setReach(v)} />
                )}
                <YesNo label="New or worse numbness, tingling or weakness in a leg?" value={newNeuro} onChange={v => setNewNeuro(v === true)} />
                <YesNo label="Any numbness around the groin or inner thighs, or new bladder or bowel changes?" value={cauda} onChange={v => setCauda(v === true)} />
              </div>
            )}

            <ChipGroup<NewsItem | 'none'> label="Anything new today?" multiple exclusive="none" value={news.length ? news : ['none']}
              options={[
                { value: 'none', label: 'None of these' },
                { value: 'unwell', label: 'Unwell or fever' },
                ...(diabetic ? [{ value: 'lowOne' as const, label: 'A low in the last 24 h' }, { value: 'lowTwoPlus' as const, label: 'Two or more lows' }, { value: 'lowSevere' as const, label: 'A low that needed help' }] : []),
                { value: 'dizzy', label: 'Dizzy on standing' },
                { value: 'fainted', label: 'Fainted today' },
                ...(diabetic || h.peripheralNeuropathy !== 'no' ? [{ value: 'footProblem' as const, label: 'New foot blister or sore' }] : []),
                { value: 'steroid', label: 'Steroid in last 3 days' },
                { value: 'hot', label: 'Hot or humid today' },
                { value: 'unusualFatigue', label: 'Unusually tired or breathless' },
              ]}
              onChange={v => setNews(v.filter((x): x is NewsItem => x !== 'none'))} />

            {diabetic && (
              <div className="flex flex-col gap-3 rounded-xl border p-3">
                <Label htmlFor="glucose">Glucose now {d.hypoRisk ? '(strongly recommended)' : '(optional)'}</Label>
                <div className="flex gap-2">
                  <Input id="glucose" type="number" inputMode="decimal" step="0.1" placeholder={unit === 'mg/dL' ? 'e.g. 140' : 'e.g. 7.8'}
                    value={glucose} onChange={e => setGlucose(e.target.value)} className="h-11 text-base flex-1" />
                  <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Glucose unit">
                    {(['mg/dL', 'mmol/L'] as const).map(u => (
                      <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)}
                        className={cn('rounded-md px-2.5 text-xs font-medium min-h-10', unit === u ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{u}</button>
                    ))}
                  </div>
                </div>
                {sanity === 'ambiguousLow' && glucoseValue !== undefined && (
                  <div role="alert" className="rounded-lg bg-[var(--safety)]/15 p-2.5 text-sm flex flex-col gap-2">
                    <p><strong>Treat this low now</strong> — 15 g of fast carbs, then re-check in 15 minutes.</p>
                    <p className="text-muted-foreground">If you meant {glucoseValue} mmol/L, switch the unit.</p>
                    <Button size="lg" variant="outline" className="h-11" onClick={() => setUnit('mmol/L')}>
                      I meant {glucoseValue} mmol/L
                    </Button>
                  </div>
                )}
                {sanity === 'suspectUnit' && glucoseValue !== undefined && (
                  <div role="alert" className="rounded-lg bg-[var(--block-strength)]/15 p-2.5 text-sm flex flex-col gap-2">
                    <p>That looks like {unit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}. Did you mean {glucoseValue} {unit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}?</p>
                    <Button size="lg" variant="outline" className="h-11" onClick={() => setUnit(unit === 'mg/dL' ? 'mmol/L' : 'mg/dL')}>
                      Yes, use {unit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}
                    </Button>
                  </div>
                )}
                {sanity === 'implausible' && <p role="alert" className="text-sm text-[var(--safety)]">That reading looks implausible. Please measure again.</p>}
                {h.glucoseMonitor === 'cgm' && (
                  <ChipGroup<GlucoseTrend> label="CGM arrow" value={[trend]}
                    options={[{ value: 'rising', label: 'Rising' }, { value: 'flat', label: 'Flat' }, { value: 'slowFall', label: 'Falling slowly' }, { value: 'fastFall', label: 'Falling fast' }]}
                    onChange={([v]) => setTrend(v)} />
                )}
                {h.insulin !== 'none' && <YesNo label="Rapid-acting insulin in the last 2 hours?" value={rapid} onChange={v => setRapid(v === true)} />}
                {needKetones && (urineKetones ? (
                  <ChipGroup label="Ketones (urine strip)" value={[ketones]} hint={mg !== undefined && mg >= 250 ? 'Needed above 250 mg/dL.' : undefined}
                    options={URINE_KETONES} onChange={([v]) => setKetones(v)} />
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ketones">Ketones (blood, mmol/L){mg !== undefined && mg >= 250 ? ' — needed above 250 mg/dL' : ''}</Label>
                    <Input id="ketones" type="number" inputMode="decimal" step="0.1" placeholder="e.g. 0.3" value={ketones}
                      onChange={e => setKetones(e.target.value)} className="h-11 text-base" />
                  </div>
                ))}
              </div>
            )}

            {h.bpMonitor && (
              <div className="flex flex-col gap-2 rounded-xl border p-3">
                <Label>Blood pressure (two readings, 1 minute apart)</Label>
                {(['1', '2'] as const).map(n => (
                  <div key={n} className="flex items-center gap-2">
                    <Input aria-label={`Reading ${n} systolic`} type="number" inputMode="numeric" placeholder="120" className="h-11 text-base"
                      value={bp[`s${n}`]} onChange={e => setBp(v => ({ ...v, [`s${n}`]: e.target.value }))} />
                    <span className="text-muted-foreground">/</span>
                    <Input aria-label={`Reading ${n} diastolic`} type="number" inputMode="numeric" placeholder="80" className="h-11 text-base"
                      value={bp[`d${n}`]} onChange={e => setBp(v => ({ ...v, [`d${n}`]: e.target.value }))} />
                  </div>
                ))}
                {bpAvg && <p className="text-xs text-muted-foreground">Average {bpAvg.sys}/{bpAvg.dia}</p>}
              </div>
            )}

            <ChipGroup label="Sleep last night" value={[sleep]}
              options={[{ value: 'lt5', label: 'Under 5 h' }, { value: '5to7', label: '5 to 7 h' }, { value: 'gt7', label: 'Over 7 h' }]}
              onChange={([v]) => setSleep(v)} />
            <ChipGroup label="Energy" value={[String(energy) as '1' | '2' | '3' | '4' | '5']}
              options={(['1', '2', '3', '4', '5'] as const).map(v => ({ value: v, label: ['', 'Very low', 'Low', 'OK', 'Good', 'Great'][Number(v)] }))}
              onChange={([v]) => setEnergy(Number(v) as DailyCheckIn['energy'])} />

            {/* An ambiguous low must still be submittable: the engine treats it as a low. */}
            {needsReading && glucoseValue === undefined && <p className="text-sm font-medium">Enter your new glucose reading to carry on.</p>}
            <Button className="h-14 text-base" disabled={!!submitBlocked({ sanity, needsReading, hasReading: glucoseValue !== undefined })} onClick={submit}>See today’s plan</Button>
            <p className="text-xs text-muted-foreground">
              General information, not medical advice. Stop and seek help if you feel chest pain, severe breathlessness, faintness or new weakness.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pb-6">
            <OutcomeBanner readiness={result} />
            {!!result.recheckMinutes && (
              <div className="rounded-xl border p-4 text-center">
                {remaining > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">Treat and re-check</p>
                    <p className="text-4xl font-bold tabular-nums">{Math.floor(remaining / 60000)}:{String(Math.floor(remaining / 1000) % 60).padStart(2, '0')}</p>
                  </>
                ) : (
                  <p className="text-sm font-medium">Time to re-check. The session starts once the new reading is in range.</p>
                )}
                <Button variant={remaining > 0 ? 'outline' : 'default'} className="mt-3 h-11 w-full" onClick={() => { setResult(null); setRecheckEnds(null); setRemaining(0); }}>
                  Enter a new reading
                </Button>
              </div>
            )}
            {canStart && (
              <Button className="h-14 text-base" onClick={onStart}>
                {result.outcome === 'recovery' ? 'Start recovery session' : 'Start session'}
              </Button>
            )}
            <Button variant="outline" className="h-12" onClick={() => setResult(null)}>Change answers</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
