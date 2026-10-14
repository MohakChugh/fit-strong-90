import { Group } from '@/components/hig/List';
import { Segmented } from '@/screens/you/controls';
import { metforminYearProblem } from '@/components/profile/wizardSteps';
import { factsOf } from '@/setup/facts';
import { glucoseStartOk, pageDone } from '@/setup/graph';
import { numberFrom, textOf } from '@/setup/units';
import { CLASS_ROWS, TRI, YES_NO } from '../choices';
import { Ask, Missing, NumberAnswer, TriChecklist, type PageProps } from '../controls';

export function MedicinesRegular({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you take any regular medicines?" header="Do you take any regular medicines?" options={TRI} tried={tried}
      value={a.regular} onChange={regular => set({ regular })} footer="For any condition. Some change what’s safe before exercise." />
  );
}

/** The classes, whatever they're for (A-06, K-05), as one checklist (B-08). */
export function MedicinesWhich({ a, raw, set, tried, ctx }: PageProps) {
  const since = textOf(raw, 'metforminSince', a.metforminSince);
  const problem = metforminYearProblem(since.trim(), ctx.thisYear);
  const typeSince = (t: string) => set({ metforminSince: metforminYearProblem(t.trim(), ctx.thisYear) === null ? t.trim() : undefined }, { metforminSince: t });
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Whatever they’re for. Tick each one you take.</p>
      <TriChecklist label="Do any of these apply?" rows={CLASS_ROWS} value={a.classes} onChange={classes => set({ classes })}
        all={{ label: 'Not sure about any of these', to: 'unsure' }} tried={tried} />
      {a.classes?.metformin === 'yes' && (
        <>
          <Group>
            <NumberAnswer label="Year you started metformin (optional)" placeholder="2019" text={since} onText={typeSince} />
          </Group>
          <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
        </>
      )}
    </>
  );
}

/** The start figure typed, once it's one exercise can start at in its unit (`glucoseStartOk`). */
const glucoseFrom = (text: string, unit: 'mg/dL' | 'mmol/L'): number | undefined => {
  const n = numberFrom(text);
  return n !== undefined && glucoseStartOk(n, unit) ? n : undefined;
};

export function MedicinesLows({ a, raw, set, tried, ctx }: PageProps) {
  const answered = a.lowsRisk !== undefined && (!factsOf(a).insulin || a.insulinHow !== undefined);
  const unit = a.glucoseStartUnit ?? a.glucoseUnit ?? 'mg/dL';
  const start = textOf(raw, 'glucoseStartMin', a.glucoseStartMin);
  // An answer only once valid in its unit, so a change of unit checks it again (H5R-15).
  const typeStart = (t: string) => set({ glucoseStartMin: glucoseFrom(t, unit) }, { glucoseStartMin: t });
  const startProblem = start.trim() !== '' && glucoseFrom(start, unit) === undefined;
  return (
    <>
      {factsOf(a).insulin && (
        <Ask label="How do you take insulin?" header="How do you take insulin?" tried={tried} value={a.insulinHow} onChange={insulinHow => set({ insulinHow })}
          options={[
            { value: 'basalOnly', label: 'Long-acting only' }, { value: 'multipleDaily', label: 'Several injections a day' },
            { value: 'pump', label: 'A pump' }, { value: 'closedLoop', label: 'A pump that adjusts itself (closed-loop system)' }, { value: 'unsure', label: 'Not sure' },
          ]} />
      )}
      <Ask label="A severe low in the last 6 months, or do you often not feel lows coming?" header="A severe low in the last 6 months, or do you often not feel lows coming?"
        options={TRI} value={a.lowsRisk} onChange={lowsRisk => set({ lowsRisk })} tried={tried} />
      <Group header="Your care team’s starting glucose (optional)" footer="Only if your care team gave you one. Otherwise the app uses the usual figure for your medicines.">
        <NumberAnswer label="Lowest glucose to start exercise at" decimals text={start} onText={typeStart} />
        <div className="px-4 pb-3">
          <Segmented label="Its unit" value={unit} onChange={u => set({ glucoseStartUnit: u, glucoseStartMin: glucoseFrom(start, u) }, { glucoseStartMin: start })}
            options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]} />
        </div>
      </Group>
      <Missing show={tried && (startProblem || (answered && !pageDone('medicines.lows', a, ctx)))}>
        Check the glucose number: 70 to 300 mg/dL, or 3.9 to 17 mmol/L. Below 70 mg/dL (3.9 mmol/L) is a low, so exercise never starts there.
      </Missing>
    </>
  );
}

export function MedicinesKetones({ a, set, tried }: PageProps) {
  const f = factsOf(a);
  return (
    <>
      {f.diabetic && (
        <Ask label="Ever been very ill from high ketones (diabetic ketoacidosis, or DKA), or been told your body makes too little insulin?"
          header="Ever been very ill from high ketones (diabetic ketoacidosis, or DKA), or been told your body makes too little insulin?"
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
