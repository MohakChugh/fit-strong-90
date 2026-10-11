import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { factsOf } from '@/setup/facts';
import { pageDone } from '@/setup/graph';
import { numberFrom } from '@/setup/units';
import { CONDITION_ROWS, TRI, YES_NO } from '../choices';
import { Ask, Missing, NumberAnswer, TextInput, TriChecklist, type PageProps } from '../controls';

/** "Do you have any of these?": one checklist, "Not sure" on every row (journey §6.2 ch. 3; B-08). */
export function HealthConditions({ a, set, tried }: PageProps) {
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Tick what applies. “Not sure” is a real answer: the app then plays safe.</p>
      <TriChecklist label="Do you have any of these?" rows={CONDITION_ROWS} value={a.conditions} onChange={conditions => set({ conditions })}
        all={{ label: 'None of these', to: 'no' }} tried={tried} />
    </>
  );
}

export function HealthDiabetes({ a, set, tried }: PageProps) {
  return (
    <Ask label="Which type of diabetes?" tried={tried} value={a.diabetesType} onChange={diabetesType => set({ diabetesType })}
      options={[
        { value: 'type1', label: 'Type 1' }, { value: 'type2', label: 'Type 2' }, { value: 'prediabetes', label: 'Prediabetes' },
        { value: 'other', label: 'Another type' }, { value: 'unsure', label: 'Not sure' },
      ]} />
  );
}

export function HealthBp({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you take medicine for high blood pressure?" header="Do you take medicine for high blood pressure?" options={TRI}
      value={a.bpMedicine} onChange={bpMedicine => set({ bpMedicine })} tried={tried} />
  );
}

export function HealthFluid({ a, set, tried }: PageProps) {
  return (
    <>
      {factsOf(a).kidney && (
        <Ask label="Are you on dialysis, or have you had a kidney transplant?" header="Are you on dialysis, or have you had a kidney transplant?"
          options={YES_NO} value={a.kidneyTreatment} onChange={kidneyTreatment => set({ kidneyTreatment })} tried={tried} />
      )}
      <Ask label="Has a doctor given you a fluid limit?" header="Has a doctor given you a fluid limit?" options={TRI}
        value={a.fluidLimit} onChange={fluidLimit => set({ fluidLimit })} tried={tried} footer="It changes your rest-time and water advice." />
    </>
  );
}

export function HealthEyes({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="Eye treatment or surgery in the last 3 months?" header="Eye treatment or surgery in the last 3 months?" options={YES_NO}
        value={a.eyeTreatment} onChange={eyeTreatment => set({ eyeTreatment })} tried={tried} />
      {a.eyeTreatment === 'no' && (
        <Ask label="How bad is the eye disease from diabetes?" header="How bad is the eye disease from diabetes?" tried={tried}
          value={a.eyeDisease} onChange={eyeDisease => set({ eyeDisease })} footer="As your eye doctor last said. “Not sure” is fine."
          options={[{ value: 'mild', label: 'Mild, or none' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe' }, { value: 'unsure', label: 'Not sure' }]} />
      )}
    </>
  );
}

export function HealthFeet({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="Numbness or loss of feeling in your feet?" header="Numbness or loss of feeling in your feet?" options={TRI}
        value={a.feetNumb} onChange={feetNumb => set({ feetNumb })} tried={tried} />
      <Ask label="A wound, an ulcer or a Charcot foot?" header="A wound, an ulcer or a Charcot foot?" tried={tried}
        value={a.footWound} onChange={footWound => set({ footWound })}
        options={[{ value: 'now', label: 'Yes, now' }, { value: 'past', label: 'In the past' }, { value: 'no', label: 'No' }]}
        footer="A wound now keeps walks off until it has healed." />
    </>
  );
}

/** Two numbers that go together, kept as typed, stored only when both are there. */
function BpPermission({ a, set }: PageProps) {
  const [sys, setSys] = useState(a.bpPermission ? String(a.bpPermission.sys) : '');
  const [dia, setDia] = useState(a.bpPermission ? String(a.bpPermission.dia) : '');
  const write = (s: string, d: string) => {
    const top = numberFrom(s);
    const bottom = numberFrom(d);
    set({ bpPermission: top === undefined || bottom === undefined ? undefined : { sys: top, dia: bottom } });
  };
  return (
    <>
      <TextInput label="Top number exercise is fine up to" inputMode="numeric" text={sys} placeholder="170" onText={t => { setSys(t); write(t, dia); }} />
      <TextInput label="Bottom number exercise is fine up to" inputMode="numeric" text={dia} placeholder="105" onText={t => { setDia(t); write(sys, t); }} />
    </>
  );
}

export function HealthLimits(props: PageProps) {
  const { a, set, tried } = props;
  const f = factsOf(a);
  const targets = f.bp || f.diabetic;
  return (
    <>
      <Ask label="Has a clinician cleared you to exercise?" header="Has a clinician cleared you to exercise?" tried={tried}
        value={a.clearance} onChange={clearance => set({ clearance })}
        options={[
          { value: 'none', label: 'Not yet' }, { value: 'moderate', label: 'Yes, for moderate exercise' },
          { value: 'vigorous', label: 'Yes, for vigorous exercise' }, { value: 'unsure', label: 'Not sure' },
        ]} />
      {targets && (
        <Ask label="Has a clinician given you any limits or targets?" header="Has a clinician given you any limits or targets?" options={TRI}
          value={a.targets} onChange={t => set({ targets: t })} tried={tried} />
      )}
      {targets && a.targets === 'yes' && (
        <Group header="Your limits and targets" footer="Only what your clinician gave you. Leave the rest empty.">
          {f.bp && <NumberAnswer label="Stop exercise if the top number is above (optional)" placeholder="180" value={a.bpStopSystolic} onChange={bpStopSystolic => set({ bpStopSystolic })} />}
          {f.bp && <BpPermission {...props} />}
          {f.diabetic && <NumberAnswer label="HbA1c target, % (optional)" decimals placeholder="7" value={a.hba1cPercent} onChange={hba1cPercent => set({ hba1cPercent })} />}
        </Group>
      )}
      <Missing show={tried && a.clearance !== undefined && (!targets || a.targets !== undefined) && !pageDone('health.limits', a, props.ctx)}>
        Check the numbers: blood pressure between 90 and 250 over 50 and 150, and HbA1c between 4 and 15.
      </Missing>
    </>
  );
}
