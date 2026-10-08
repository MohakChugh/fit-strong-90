import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserProfile } from '@/types/profile';
import {
  BMI_FRAMEWORKS_NOTE, b12Reference, bmiOf, bmiShown, glucoseGroup, glucoseReference, hba1cReference,
  HBA1C_CADENCE, HBA1C_CADENCE_SOURCE, ageForTargets, healthyWeightBand, interpretB12, interpretBmi, interpretGlucose, interpretHba1c, interpretPressure,
  interpretVitaminD, minutesAfterMealStart, pressureReference, rssdiCategory, vitaminDReference, waistFrameworksNote, waistNote, waterAdviceBlocked, waterNote,
} from './targets';

describe('glucose: the band follows the reading’s time of day', () => {
  it('groups fasting with before-meal, as ADA’s premeal target covers both', () => {
    expect(glucoseGroup('fasting')).toBe('beforeMeal');
    expect(glucoseGroup('beforeMeal')).toBe('beforeMeal');
    expect(glucoseGroup('afterMeal')).toBe('afterMeal');
    expect(glucoseGroup('bedtime')).toBe('other');
    expect(glucoseGroup(undefined)).toBe('other');
  });

  it('draws ADA’s own figures in each unit, labelled with the framework', () => {
    expect(glucoseReference('beforeMeal', 'mg/dL')).toEqual({ band: { from: 80, to: 130, label: 'ADA target before meals' }, framework: 'ADA Standards of Care 2026, Table 6.3' });
    expect(glucoseReference('beforeMeal', 'mmol/L')?.band).toMatchObject({ from: 4.4, to: 7.2 });
    expect(glucoseReference('afterMeal', 'mg/dL')).toMatchObject({ target: { value: 180, label: 'ADA limit after meals' } });
    expect(glucoseReference('afterMeal', 'mmol/L')?.target?.value).toBe(10);
    expect(glucoseReference('other', 'mg/dL')).toBeUndefined();
  });

  it('lets a clinician’s target replace the default, and says whose it is', () => {
    const own = { glucoseBeforeMeal: { min: 90, max: 140 }, glucoseAfterMealMax: 200 };
    expect(glucoseReference('beforeMeal', 'mg/dL', own)?.band).toEqual({ from: 90, to: 140, label: 'Your clinician’s target before meals' });
    expect(glucoseReference('beforeMeal', 'mmol/L', own)?.band?.from).toBe(5);
    expect(glucoseReference('afterMeal', 'mg/dL', own)?.target).toEqual({ value: 200, label: 'Your clinician’s limit after meals' });
    expect(interpretGlucose(135, 'mg/dL', 'beforeMeal', {}, own).text).toBe('Within your clinician’s target before meals, 90 to 140 mg/dL.');
  });
});

describe('interpretGlucose', () => {
  it('judges a before-meal reading against 80–130, ends included', () => {
    expect(interpretGlucose(80, 'mg/dL', 'beforeMeal').text).toMatch(/^Within the ADA target before meals, 80 to 130 mg\/dL/);
    expect(interpretGlucose(130, 'mg/dL', 'fasting').text).toMatch(/^Within/);
    expect(interpretGlucose(131, 'mg/dL', 'fasting').text).toMatch(/^Above/);
    expect(interpretGlucose(79, 'mg/dL', 'beforeMeal').text).toMatch(/^Below/);
  });

  it('compares the figure as shown, so a label never contradicts it', () => {
    // 4.4 and 7.2 mmol/L are ADA's published bounds and read as within.
    expect(interpretGlucose(4.4, 'mmol/L', 'beforeMeal').text).toMatch(/^Within the ADA target before meals, 4\.4 to 7\.2 mmol\/L/);
    expect(interpretGlucose(7.2, 'mmol/L', 'beforeMeal').text).toMatch(/^Within/);
    // Judged unrounded: 7.24 is above 7.2, and is shown as 7.24, never as a "7.2" above the target.
    expect(interpretGlucose(7.24, 'mmol/L', 'beforeMeal').text).toMatch(/^Above/);
    expect(interpretGlucose(4.36, 'mmol/L', 'beforeMeal').text).toMatch(/^Below/);
    expect(interpretGlucose(79.6, 'mg/dL', 'fasting').text).toMatch(/^Below/);
    expect(interpretGlucose(130.4, 'mg/dL', 'fasting').text).toMatch(/^Above/);
    expect(interpretGlucose(179.6, 'mg/dL', 'afterMeal').text).toMatch(/^Under/);
  });

  it('after a meal, under 180 is under the limit and 180 itself is at it', () => {
    expect(interpretGlucose(179, 'mg/dL', 'afterMeal').text).toMatch(/^Under the ADA limit after meals, 180 mg\/dL/);
    expect(interpretGlucose(180, 'mg/dL', 'afterMeal').text).toMatch(/^At or above/);
    expect(interpretGlucose(10.0, 'mmol/L', 'afterMeal').text).toMatch(/^At or above the ADA limit after meals, 10\.0 mmol\/L/);
  });

  it('times an after-meal reading from the meal’s start', () => {
    const at = '2026-10-08T14:30:00.000+05:30';
    expect(minutesAfterMealStart(at, '2026-10-08T13:00:00.000+05:30')).toBe(90);
    expect(interpretGlucose(150, 'mg/dL', 'afterMeal', { at, mealStartedAt: '2026-10-08T13:00:00.000+05:30' }).text)
      .toMatch(/Taken 90 minutes after the meal started\.$/);
    expect(interpretGlucose(150, 'mg/dL', 'afterMeal', { at, mealStartedAt: '2026-10-08T14:00:00.000+05:30' }).text)
      .toMatch(/30 minutes .* only a rough comparison/);
    expect(interpretGlucose(150, 'mg/dL', 'afterMeal').text).toMatch(/start time was not recorded/);
  });

  it('labels a low first, whatever the time of day, using the escalation’s own test', () => {
    expect(interpretGlucose(69, 'mg/dL', 'afterMeal')).toMatchObject({ tone: 'caution', text: 'A low (ADA level 1): under 70 mg/dL.' });
    expect(interpretGlucose(53, 'mg/dL', undefined)).toMatchObject({ tone: 'stop' });
    expect(interpretGlucose(54, 'mg/dL', undefined).tone).toBe('caution');
    expect(interpretGlucose(70, 'mg/dL', 'beforeMeal').text).toMatch(/^Below the ADA target/);
    expect(interpretGlucose(3.8, 'mmol/L', 'beforeMeal').text).toBe('A low (ADA level 1): under 3.9 mmol/L.');
    expect(interpretGlucose(3.9, 'mmol/L', 'beforeMeal').text).toMatch(/^Below the ADA target before meals/);
  });

  it('marks an extreme reading, and only at the escalation’s boundary', () => {
    expect(interpretGlucose(600, 'mg/dL', 'afterMeal').tone).toBe('stop');
    expect(interpretGlucose(599, 'mg/dL', 'afterMeal').tone).toBe('default');
  });

  it('does not invent a target where ADA sets none', () => {
    expect(interpretGlucose(150, 'mg/dL', 'bedtime').text).toBe('ADA does not set a target for readings at this time.');
    expect(interpretGlucose(150, 'mg/dL', undefined).text).toMatch(/No time of day was recorded/);
  });
});

describe('blood pressure', () => {
  it('uses the NICE home threshold of 135/85, not the clinic 140/90', () => {
    const r = pressureReference(56, 'treated');
    expect(r).toMatchObject({ systolic: 135, diastolic: 85, label: 'NICE home threshold, 135/85' });
    expect(r.framework).toMatch(/NICE NG136/);
    expect(r.note).toMatch(/average/);
  });

  it('uses NICE’s 145/85 home target for treated people aged 80 and over', () => {
    expect(pressureReference(80, 'treated')).toMatchObject({ systolic: 145, diastolic: 85 });
    expect(pressureReference(79, 'treated').systolic).toBe(135);
    expect(pressureReference(85, 'untreated').systolic).toBe(135);
    expect(pressureReference(undefined, 'treated').systolic).toBe(135);
  });

  it('takes the younger possible age from a birth year, so 80-and-over starts no earlier than it should', () => {
    expect(ageForTargets(1946, '2026-10-08')).toBe(79);
    expect(pressureReference(ageForTargets(1946, '2026-10-08'), 'treated').systolic).toBe(135);
    expect(pressureReference(ageForTargets(1945, '2026-10-08'), 'treated').systolic).toBe(145);
    expect(ageForTargets(undefined, '2026-10-08')).toBeUndefined();
  });

  it('lets a clinician’s target replace both', () => {
    expect(pressureReference(56, 'treated', { pressureHome: { systolic: 130, diastolic: 80 } }))
      .toMatchObject({ systolic: 130, diastolic: 80, framework: 'Set by your clinician' });
  });

  it('gives a single reading a verdict only when it is severe', () => {
    expect(interpretPressure(180, 80)?.tone).toBe('stop');
    expect(interpretPressure(150, 120)?.tone).toBe('stop');
    expect(interpretPressure(179, 119)).toBeUndefined();
    // Either number on its own: 185/90 must not read as if both had to be high.
    expect(interpretPressure(185, 90)?.text).toMatch(/top number of 180 or more, or a bottom number of 120 or more/);
    expect(interpretPressure(142, 91)).toBeUndefined();
  });
});

describe('weight and BMI: Indian cut-offs, named', () => {
  it('computes BMI unrounded and shows it cut to one decimal', () => {
    expect(bmiOf(80, 178)).toBeCloseTo(25.249, 3);
    expect(bmiOf(80, 0)).toBeUndefined();
    expect(bmiShown(22.97)).toBe(22.9);
    expect(bmiShown(23)).toBe(23);
    expect(bmiShown(24.999)).toBe(24.9);
  });

  it('applies RSSDI 2020 bounds with their own operators', () => {
    // RSSDI-ESI 2020's lower bound is 18, not WHO's 18.5.
    expect(rssdiCategory(17.99)).toBe('underweight');
    expect(rssdiCategory(18)).toBe('healthy');
    expect(rssdiCategory(18.49)).toBe('healthy');
    expect(rssdiCategory(22.99)).toBe('healthy');
    expect(rssdiCategory(23)).toBe('overweight');
    expect(rssdiCategory(24.99)).toBe('overweight');
    expect(rssdiCategory(25)).toBe('obesity');
  });

  it('names the framework and never the WHO cut-off alone', () => {
    const i = interpretBmi(25.25);
    expect(i.text).toBe('BMI 25.2: in the obesity range (25 or more) on the Indian cut-offs.');
    expect(i.framework).toMatch(/RSSDI/);
    expect(BMI_FRAMEWORKS_NOTE).toMatch(/ICMR-NIN/);
    expect(BMI_FRAMEWORKS_NOTE).toMatch(/WHO/);
  });

  it('turns the healthy BMI range into weights at this height, in the chart’s unit', () => {
    const kg = healthyWeightBand(178, 'kg')!.band!;
    // RSSDI's 18 to under 23 at 1.78 m.
    expect(kg.from).toBeCloseTo(57.0, 1);
    expect(kg.to).toBeCloseTo(72.9, 1);
    expect(healthyWeightBand(178, 'lb')!.band!.from).toBeCloseTo(125.7, 1);
    expect(healthyWeightBand(0, 'kg')).toBeUndefined();
  });

  it('states both waist cut-offs, as the profile does not hold sex', () => {
    expect(waistNote('cm').text).toMatch(/90 cm or more for men and 80 cm or more for women/);
    expect(waistNote('in').text).toMatch(/35\.4 in .* 31\.5 in/);
  });

  it('sets ICMR-NIN’s strict lines beside RSSDI’s, where they differ (J06 step 5)', () => {
    expect(waistFrameworksNote('cm')).toMatch(/ICMR-NIN 2024 uses more than 90 cm for men and more than 80 cm for women/);
    expect(waistFrameworksNote('cm')).toMatch(/exactly at the line meets RSSDI’s cut-off but not NIN’s/);
    expect(waistFrameworksNote('in')).toMatch(/more than 35\.4 in for men and more than 31\.5 in/);
    // Never applied to the person by sex: the profile does not hold it.
    expect(waistFrameworksNote('cm')).not.toMatch(/\byou(r)?\b/i);
  });
});

describe('lab results', () => {
  it('HbA1c: under 7% is under the ADA goal; 7.0% is at it', () => {
    expect(interpretHba1c(6.9, '%').text).toMatch(/^Under 7%, the ADA goal for many adults/);
    expect(interpretHba1c(7.0, '%').text).toMatch(/^At or above 7%/);
    expect(interpretHba1c(6.96, '%').text).toMatch(/^At or above/); // shows as 7.0
    expect(interpretHba1c(52, 'mmol/mol').text).toMatch(/^Under 53 mmol\/mol/);
    expect(interpretHba1c(53, 'mmol/mol').text).toMatch(/^At or above 53 mmol\/mol/);
    expect(interpretHba1c(7.4, '%').text).toMatch(/not an emergency/);
    expect(hba1cReference('%').target).toEqual({ value: 7, label: 'ADA goal for many adults, under 7%' });
  });

  it('HbA1c: a clinician’s goal replaces ADA’s', () => {
    expect(interpretHba1c(7.4, '%', { hba1cBelowPercent: 7.5 }).text).toBe('Under 7.5%, your clinician’s goal.');
    expect(hba1cReference('mmol/mol', { hba1cBelowPercent: 7.5 }).target?.value).toBe(58);
  });

  it('B12: NICE NG239 bands, 350 itself indeterminate', () => {
    expect(interpretB12(179, 'pg/mL')).toMatchObject({ tone: 'caution' });
    expect(interpretB12(180, 'pg/mL').text).toMatch(/^Between 180 and 350/);
    expect(interpretB12(350, 'pg/mL').text).toMatch(/^Between 180 and 350/);
    expect(interpretB12(351, 'pg/mL').text).toMatch(/^Above 350/);
    expect(interpretB12(258, 'pmol/L').text).toMatch(/^Between/); // 349.7 pg/mL
    expect(interpretB12(259, 'pmol/L').text).toMatch(/^Above/); // 351.0 pg/mL
    expect(interpretB12(400, 'pg/mL').text).toMatch(/lab’s own reference range/);
    expect(b12Reference('pmol/L').target?.value).toBeCloseTo(258.2, 1);
  });

  it('vitamin D: NIH ODS bands in both published scales, high overriding adequate', () => {
    expect(interpretVitaminD(11.9, 'ng/mL')).toMatchObject({ tone: 'caution' });
    expect(interpretVitaminD(12, 'ng/mL').text).toMatch(/^12 to under 20/);
    expect(interpretVitaminD(19.9, 'ng/mL').text).toMatch(/^12 to under 20/);
    expect(interpretVitaminD(20, 'ng/mL').text).toMatch(/adequate for most people/);
    expect(interpretVitaminD(50, 'ng/mL').text).toMatch(/adequate/);
    expect(interpretVitaminD(50.1, 'ng/mL')).toMatchObject({ tone: 'caution', text: expect.stringMatching(/^Above 50/) });
    expect(interpretVitaminD(29, 'nmol/L').tone).toBe('caution');
    expect(interpretVitaminD(125, 'nmol/L').text).toMatch(/adequate/);
    expect(interpretVitaminD(126, 'nmol/L').text).toMatch(/^Above 125/);
    expect(vitaminDReference('nmol/L').band).toMatchObject({ from: 50, to: 125 });
  });
});

describe('habits', () => {
  const profile = (health: Partial<UserProfile['health']> = {}) => {
    const p = createDefaultProfile();
    return { ...p, needsHealthReview: false, health: { ...p.health, kidneyDisease: 'none' as const, heartOrVascularDisease: false, ...health } };
  };

  it('gives NIN’s general water figure only when nothing calls for a fluid limit', () => {
    expect(waterNote(profile(), undefined).text).toMatch(/about 2 litres/);
    expect(waterAdviceBlocked(profile(), undefined)).toBe(false);
  });

  it('puts the care team’s fluid plan first when fluids are limited, or might be (F05)', () => {
    for (const answer of [true, 'unsure'] as const) {
      const note = waterNote(profile({ fluidRestriction: answer }), undefined);
      expect(note.text).not.toMatch(/litre/);
      expect(note.text).toMatch(/care team/);
      expect(waterAdviceBlocked(profile({ fluidRestriction: answer }), undefined)).toBe(true);
    }
    // The older place the answer was kept still counts.
    expect(waterNote(profile(), { fluidLimit: true }).text).not.toMatch(/litre/);
  });

  it('gives no general amount with kidney or heart conditions, or before the health answers are reviewed', () => {
    expect(waterNote(profile({ kidneyDisease: 'ckd' }), undefined).text).not.toMatch(/litre/);
    expect(waterNote(profile({ kidneyDisease: 'unsure' }), undefined).text).not.toMatch(/litre/);
    expect(waterNote(profile({ heartOrVascularDisease: true }), undefined).text).not.toMatch(/litre/);
    expect(waterNote({ ...profile(), needsHealthReview: true }, undefined).text).not.toMatch(/litre/);
    expect(waterNote(undefined, undefined).text).not.toMatch(/litre/);
  });
});

describe('every interpreter judges the value itself, not a rounded copy (acceptance J06)', () => {
  it('B12: 179.9 is a deficiency and 350.1 is above the indeterminate band, at NICE’s inclusive 180 to 350', () => {
    expect(interpretB12(179.9, 'pg/mL').text).toMatch(/^Under 180/);
    expect(interpretB12(180, 'pg/mL').text).toMatch(/indeterminate/);
    expect(interpretB12(350, 'pg/mL').text).toMatch(/indeterminate/);
    expect(interpretB12(350.1, 'pg/mL').text).toMatch(/deficiency is unlikely/);
    expect(interpretB12(132.8, 'pmol/L').text).toMatch(/^Under 180/);
  });

  it('vitamin D: 11.96 is under 12, 19.96 under 20, 50.04 above 50', () => {
    expect(interpretVitaminD(11.96, 'ng/mL').text).toMatch(/^Under 12/);
    expect(interpretVitaminD(19.96, 'ng/mL').text).toMatch(/generally inadequate/);
    expect(interpretVitaminD(50, 'ng/mL').text).toMatch(/adequate for most/);
    expect(interpretVitaminD(50.04, 'ng/mL').text).toMatch(/possible harm/);
    expect(interpretVitaminD(29.6, 'nmol/L').text).toMatch(/^Under 30/);
  });

  it('HbA1c is the exception, by the lab convention the testing cadence shares: judged as labs report it', () => {
    // 53 mmol/mol is 6.9995%: labs and the cadence call it 7.0%, at the goal, not under it.
    expect(interpretHba1c(6.9995, '%').text).toMatch(/^At or above 7%/);
    expect(interpretHba1c(53, 'mmol/mol').text).toMatch(/^At or above 53/);
  });

  it('BP and BMI already judge the value itself', () => {
    expect(interpretPressure(179, 119)).toBeUndefined();
    expect(rssdiCategory(22.999)).toBe('healthy');
    expect(rssdiCategory(23)).toBe('overweight');
  });
});

describe('the HbA1c testing cadence has one source', () => {
  it('cites ADA Standards of Care 2026 recommendation 6.2, the same words Today uses', () => {
    expect(HBA1C_CADENCE_SOURCE).toBe('ADA Standards of Care 2026, recommendation 6.2');
    expect(HBA1C_CADENCE).toMatch(/twice a year/);
    expect(HBA1C_CADENCE).toMatch(/3 months/);
  });
});
