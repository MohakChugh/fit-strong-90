import { Group } from '@/components/hig/List';
import { Segmented } from '@/screens/you/controls';
import { metforminYearProblem } from '@/components/profile/wizardSteps';
import { factsOf } from '@/setup/facts';
import { pageDone } from '@/setup/graph';
import { CLASS_ROWS, TRI, YES_NO } from '../choices';
import { Ask, Missing, NumberAnswer, TextInput, TriChecklist, type PageProps } from '../controls';

export function MedicinesRegular({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you take any regular medicines?" header="Do you take any regular medicines?" options={TRI} tried={tried}
      value={a.regular} onChange={regular => set({ regular })} footer="For any condition. Some change what’s safe before exercise." />
  );
}

/** The classes, whatever they're for (A-06, K-05), as one checklist (B-08). */
export function MedicinesWhich({ a, set, tried, ctx }: PageProps) {
  const problem = metforminYearProblem(a.metforminSince ?? '', ctx.thisYear);
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Whatever they’re for. Tick each one you take.</p>
      <TriChecklist label="Do any of these apply?" rows={CLASS_ROWS} value={a.classes} onChange={classes => set({ classes })}
        all={{ label: 'Not sure about any of these', to: 'unsure' }} tried={tried} />
      {a.classes?.metformin === 'yes' && (
        <>
          <Group>
            <TextInput label="Year you started metformin (optional)" inputMode="numeric" placeholder="2019" text={a.metforminSince ?? ''}
              onText={t => set({ metforminSince: t.trim() === '' ? undefined : t.trim() })} />
          </Group>
          <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
        </>
      )}
    </>
  );
}

export function MedicinesLows({ a, set, tried, ctx }: PageProps) {
  const answered = a.lowsRisk !== undefined && (!factsOf(a).insulin || a.insulinHow !== undefined);
  return (
    <>
      {factsOf(a).insulin && (
        <Ask label="How do you take insulin?" header="How do you take insulin?" tried={tried} value={a.insulinHow} onChange={insulinHow => set({ insulinHow })}
          options={[
            { value: 'basalOnly', label: 'Long-acting only' }, { value: 'multipleDaily', label: 'Several injections a day' },
            { value: 'pump', label: 'A pump' }, { value: 'closedLoop', label: 'A closed-loop system' }, { value: 'unsure', label: 'Not sure' },
          ]} />
      )}
      <Ask label="A severe low in the last 6 months, or do you often not feel lows coming?" header="A severe low in the last 6 months, or do you often not feel lows coming?"
        options={TRI} value={a.lowsRisk} onChange={lowsRisk => set({ lowsRisk })} tried={tried} />
      <Group header="Your care team’s starting glucose (optional)" footer="Only if your care team gave you one. Otherwise the app uses the usual figure for your medicines.">
        <NumberAnswer label="Lowest glucose to start exercise at" decimals value={a.glucoseStartMin} onChange={glucoseStartMin => set({ glucoseStartMin })} />
        <div className="px-4 pb-3">
          <Segmented label="Its unit" value={a.glucoseStartUnit ?? a.glucoseUnit ?? 'mg/dL'} onChange={glucoseStartUnit => set({ glucoseStartUnit })}
            options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]} />
        </div>
      </Group>
      <Missing show={tried && answered && !pageDone('medicines.lows', a, ctx)}>Check the glucose number: 54 to 300 mg/dL, or 3 to 17 mmol/L.</Missing>
    </>
  );
}

export function MedicinesKetones({ a, set, tried }: PageProps) {
  const f = factsOf(a);
  return (
    <>
      {f.diabetic && (
        <Ask label="Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?"
          header="Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?"
          options={TRI} value={a.priorDka} onChange={priorDka => set({ priorDka })} tried={tried} />
      )}
      {f.ketoneRisk && (
        <Ask label="Can you test ketones?" header="Can you test ketones?" tried={tried} value={a.ketoneTest} onChange={ketoneTest => set({ ketoneTest })}
          options={[{ value: 'none', label: 'No' }, { value: 'urine', label: 'Urine strips' }, { value: 'blood', label: 'Blood meter' }]}
          footer="Then each check-in can ask for a reading." />
      )}
    </>
  );
}

export function MedicinesStanding({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you get dizzy when you stand up?" header="Do you get dizzy when you stand up?" options={TRI} tried={tried}
      value={a.dizzy} onChange={dizzy => set({ dizzy })} footer="“Not sure” is fine: the app then plays safe." />
  );
}

/** "What do you have at home?", asked whether or not a medicine is taken (B-06). */
export function MedicinesMonitors({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="Glucose meter or sensor" header="Glucose meter or sensor" tried={tried} value={a.glucoseMonitor} onChange={glucoseMonitor => set({ glucoseMonitor })}
        options={[{ value: 'none', label: 'Neither' }, { value: 'meter', label: 'A glucose meter (finger-prick)' }, { value: 'cgm', label: 'A glucose sensor (CGM)' }]} />
      {a.glucoseMonitor !== undefined && a.glucoseMonitor !== 'none' && (
        <Ask label="Glucose unit" header="Its unit" tried={tried} value={a.glucoseUnit} onChange={glucoseUnit => set({ glucoseUnit })}
          options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]} />
      )}
      <Ask label="Home blood-pressure cuff" header="Home blood-pressure cuff" options={YES_NO} tried={tried}
        value={a.bpCuff === undefined ? undefined : a.bpCuff ? 'yes' : 'no'} onChange={v => set({ bpCuff: v === 'yes' })} />
    </>
  );
}
