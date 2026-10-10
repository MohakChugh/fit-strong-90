import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Segmented } from '@/screens/you/controls';
import { convertWeightText, weightFieldText } from '@/components/profile/wizardSteps';
import { asksAdult, birthYearProblem } from '@/setup/age';
import { heightFrom, heightProblem, heightText, waistFrom, waistProblem, waistText, weightFrom, weightProblem, type HeightText } from '@/setup/units';
import { YES_NO } from '../choices';
import { Ask, Missing, NumberAnswer, TextInput, type PageProps } from '../controls';

/** About you, page 1: what to call the person, and the year they were born (B-31). */
export function AboutName({ a, set, tried, ctx }: PageProps) {
  const problem = birthYearProblem(a.birthYear, ctx.thisYear);
  return (
    <>
      <Group footer="Shown on screen only. The voice coach never says it.">
        <TextInput label="Name (optional)" text={a.name ?? ''} onText={name => set({ name })} autoComplete="given-name" />
      </Group>
      <Group footer="Some advice changes with age.">
        <NumberAnswer label="Year you were born (optional)" placeholder="1958" value={a.birthYear} onChange={birthYear => set({ birthYear })} />
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

/** About you, page 3: height and weight, with the waist folded away (journey §6.2 ch. 2; board D83). */
export function AboutBody({ a, set, tried }: PageProps) {
  // What was stored when the page opened: a field still showing it keeps it exactly, in either unit (Review Focus 2).
  const [stored] = useState(() => ({ height: a.heightCm, weight: a.weightKg, waist: a.waistCm }));
  const metric = a.metric ?? true;
  const [height, setHeight] = useState<HeightText>(() => heightText(a.heightCm, metric));
  const [weight, setWeight] = useState(() => weightFieldText(a.weightKg, metric));
  const [waist, setWaist] = useState(() => waistText(a.waistCm, metric));

  const switchUnits = (to: boolean) => {
    if (to === metric) return;
    const cm = heightFrom(height, metric, stored.height);
    const wc = waistFrom(waist, metric, stored.waist);
    setHeight(heightText(cm, to));
    setWeight(convertWeightText(weight, to));
    setWaist(waistText(wc, to));
    set({ metric: to });
  };
  const changeHeight = (next: HeightText) => { setHeight(next); set({ heightCm: heightFrom(next, metric, stored.height) }); };
  const problem = heightProblem(a.heightCm) ?? weightProblem(a.weightKg);
  const waistIssue = waistProblem(a.waistCm);

  return (
    <>
      <div className="px-1">
        <Segmented label="Units" value={metric ? 'metric' : 'imperial'} onChange={v => switchUnits(v === 'metric')}
          options={[{ value: 'metric', label: 'cm and kg' }, { value: 'imperial', label: 'ft, in and lb' }]} />
      </div>
      <Group footer="Optional. Each one you give is kept as a dated reading.">
        {metric
          ? <TextInput label="Height in cm" inputMode="decimal" text={height.cm} onText={cm => changeHeight({ ...height, cm })} placeholder="160" />
          : (
            <>
              <TextInput label="Height, feet" inputMode="numeric" text={height.ft} onText={ft => changeHeight({ ...height, ft })} placeholder="5" />
              <TextInput label="Height, inches" inputMode="numeric" text={height.inch} onText={inch => changeHeight({ ...height, inch })} placeholder="3" />
            </>
          )}
        <TextInput label={metric ? 'Weight in kg' : 'Weight in lb'} inputMode="decimal" text={weight}
          onText={t => { setWeight(t); set({ weightKg: weightFrom(t, metric, stored.weight) }); }} placeholder={metric ? '65' : '143'} />
      </Group>
      <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
      <details className="overflow-hidden rounded-xl bg-grouped-card">
        <summary className="press-feedback flex min-h-12 cursor-pointer items-center px-4 text-[length:var(--text-body)]">Waist (optional)</summary>
        <TextInput label={metric ? 'Waist in cm' : 'Waist in inches'} inputMode="decimal" text={waist}
          onText={t => { setWaist(t); set({ waistCm: waistFrom(t, metric, stored.waist) }); }} placeholder={metric ? '85' : '34'} />
        <p className="px-4 pb-3 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          How to measure: stand up, breathe out normally, and measure around your middle at the level of your belly button.
        </p>
      </details>
      <Missing show={tried && waistIssue !== null}>{waistIssue ?? ''}</Missing>
    </>
  );
}
