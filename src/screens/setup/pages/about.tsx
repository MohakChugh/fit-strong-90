import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Segmented } from '@/screens/you/controls';
import { convertWeightText, weightFieldText } from '@/components/profile/wizardSteps';
import { asksAdult, birthYearProblem } from '@/setup/age';
import { NAME_MAX, nameProblem } from '@/setup/limits';
import { heightFrom, heightProblem, heightText, numberFrom, textOf, waistFrom, waistProblem, waistText, weightFrom, weightProblem, type HeightText } from '@/setup/units';
import { YES_NO } from '../choices';
import { Ask, Missing, NumberAnswer, TextInput, type PageProps } from '../controls';

/** About you, page 1: what to call the person, and the year they were born (B-31). */
export function AboutName({ a, raw, set, tried, ctx }: PageProps) {
  const year = textOf(raw, 'birthYear', a.birthYear);
  const problem = birthYearProblem(numberFrom(year), ctx.thisYear);
  const nameIssue = nameProblem(a.name);
  const typeYear = (t: string) => {
    const n = numberFrom(t);
    set({ birthYear: birthYearProblem(n, ctx.thisYear) === null ? n : undefined }, { birthYear: t });
  };
  return (
    <>
      <Group footer="Shown on screen only. The voice coach never says it.">
        <TextInput label="Name (optional)" text={a.name ?? ''} onText={name => set({ name })} autoComplete="given-name" maxLength={NAME_MAX} />
      </Group>
      <Missing show={tried && nameIssue !== null}>{nameIssue ?? ''}</Missing>
      <Group footer="Some advice changes with age.">
        <NumberAnswer label="Year you were born (optional)" placeholder="1958" text={year} onText={typeYear} />
      </Group>
      <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
      {asksAdult(a.birthYear, ctx.thisYear) && (
        <>
          <Ask label="Are you 18 or over?" header="Are you 18 or over?" options={YES_NO}
            value={a.adult === undefined ? undefined : a.adult ? 'yes' : 'no'} onChange={v => set({ adult: v === 'yes' })} tried={tried} />
          <Missing show={a.adult === false}>FitStrong is made for adults aged 18 and over.</Missing>
        </>
      )}
    </>
  );
}

/** About you, page 2: the figure in the exercise demos, and nothing else (A-14). */
export function AboutFigure({ a, set, tried }: PageProps) {
  return (
    <Ask label="Body for the exercise demos" tried={tried} value={a.figure} onChange={figure => set({ figure })}
      options={[{ value: 'male', label: 'Male figure' }, { value: 'female', label: 'Female figure' }, { value: 'either', label: 'Either' }]}
      footer="Only the figure in the exercise demos. Nothing else is worked out from it." />
  );
}

/** A measure's answer: what its text gives, once that's a valid one (H5R-15). */
const valid = (n: number | undefined, problem: string | null) => (problem === null ? n : undefined);

/** About you, page 3: height and weight, with the waist folded away (journey §6.2 ch. 2; board D83). */
export function AboutBody({ a, raw, set, tried }: PageProps) {
  // What was stored when the page opened: a field still showing it keeps it exactly, in either unit (Review Focus 2).
  const [stored] = useState(() => ({ height: a.heightCm, weight: a.weightKg, waist: a.waistCm }));
  const metric = a.metric ?? true;
  const shown = heightText(a.heightCm, metric);
  const height: HeightText = { cm: raw.heightCm ?? shown.cm, ft: raw['heightCm.ft'] ?? shown.ft, inch: raw['heightCm.inch'] ?? shown.inch };
  const weight = raw.weightKg ?? weightFieldText(a.weightKg, metric);
  const waist = raw.waistCm ?? waistText(a.waistCm, metric);
  const cm = heightFrom(height, metric, stored.height);
  const kg = weightFrom(weight, metric, stored.weight);
  const wc = waistFrom(waist, metric, stored.waist);

  // The texts in the other unit, the answers as they are.
  const switchUnits = (to: boolean) => {
    if (to === metric) return;
    const h = heightText(cm, to);
    set({ metric: to }, { heightCm: h.cm, 'heightCm.ft': h.ft, 'heightCm.inch': h.inch, weightKg: convertWeightText(weight, to), waistCm: waistText(wc, to) });
  };
  const changeHeight = (next: HeightText) => {
    const value = heightFrom(next, metric, stored.height);
    set({ heightCm: valid(value, heightProblem(value)) }, metric ? { heightCm: next.cm } : { 'heightCm.ft': next.ft, 'heightCm.inch': next.inch });
  };
  const changeWeight = (t: string) => {
    const value = weightFrom(t, metric, stored.weight);
    set({ weightKg: valid(value, weightProblem(value)) }, { weightKg: t });
  };
  const changeWaist = (t: string) => {
    const value = waistFrom(t, metric, stored.waist);
    set({ waistCm: valid(value, waistProblem(value)) }, { waistCm: t });
  };
  const problem = heightProblem(cm) ?? weightProblem(kg);
  const waistIssue = waistProblem(wc);

  return (
    <>
      <div className="px-1">
        <Segmented label="Units" value={metric ? 'metric' : 'imperial'} onChange={v => switchUnits(v === 'metric')}
          options={[{ value: 'metric', label: 'cm and kg' }, { value: 'imperial', label: 'ft, in and lb' }]} />
      </div>
      <Group footer="Optional. Each one you give is kept as a dated reading.">
        {metric
          ? <NumberAnswer label="Height in cm" decimals text={height.cm} onText={t => changeHeight({ ...height, cm: t })} placeholder="160" />
          : (
            <>
              <NumberAnswer label="Height, feet" text={height.ft} onText={ft => changeHeight({ ...height, ft })} placeholder="5" />
              <NumberAnswer label="Height, inches" text={height.inch} onText={inch => changeHeight({ ...height, inch })} placeholder="3" />
            </>
          )}
        <NumberAnswer label={metric ? 'Weight in kg' : 'Weight in lb'} decimals text={weight} onText={changeWeight} placeholder={metric ? '65' : '143'} />
      </Group>
      <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
      <details className="overflow-hidden rounded-xl bg-grouped-card">
        <summary className="press-feedback flex min-h-12 cursor-pointer items-center px-4 text-[length:var(--text-body)]">Waist (optional)</summary>
        <NumberAnswer label={metric ? 'Waist in cm' : 'Waist in inches'} decimals text={waist} onText={changeWaist} placeholder={metric ? '85' : '34'} />
        <p className="px-4 pb-3 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          How to measure: stand up, breathe out normally, and measure around your middle at the level of your belly button.
        </p>
      </details>
      <Missing show={tried && waistIssue !== null}>{waistIssue ?? ''}</Missing>
    </>
  );
}
