/**
 * Whole first runs, for the setup tests only: every page on each one's path
 * is answered, so `missingPages` is empty for each. Nothing in the app
 * imports this file.
 */
import type { ConditionId, JoinAnswers, MedicineClass, SetupAnswers, Tri } from '@/types/setup';

export const NO_CONDITIONS = { diabetes: 'no', bp: 'no', heart: 'no', kidney: 'no', eyes: 'no', feet: 'no', pain: 'no', other: 'no' } as const satisfies Record<ConditionId, Tri>;
export const NO_CLASSES = { insulin: 'no', lowsTablet: 'no', gliflozin: 'no', metformin: 'no', betaBlocker: 'no', diuretic: 'no', other: 'no' } as const satisfies Record<MedicineClass, Tri>;

/** No conditions, no medicines and nothing turned on: the minimal path (journey §1.2). */
export const MINIMAL: SetupAnswers = {
  figure: 'either', metric: true,
  conditions: { ...NO_CONDITIONS },
  regular: 'no',
  glucoseMonitor: 'none', bpCuff: false,
  focus: 'explore', active: 'yes', weeklyGoal: 'none', programme: 'notNow',
  pattern: 'vegetarian', allergies: [], foodLevel: 'ideas',
  delivery: 'app', voice: { muted: false },
};

/** MINIMAL with these chips, and anything else given. */
export const withC = (c: Partial<Record<ConditionId, Tri>>, extra: SetupAnswers = {}): SetupAnswers =>
  ({ ...MINIMAL, conditions: { ...NO_CONDITIONS, ...c }, ...extra });
/** MINIMAL with regular medicines of these classes. */
export const withMeds = (classes: Partial<Record<MedicineClass, Tri>>, extra: SetupAnswers = {}): SetupAnswers =>
  ({ ...MINIMAL, regular: 'yes', classes: { ...NO_CLASSES, ...classes }, ...extra });

/** Diabetes on insulin, treated high blood pressure and sciatica: the complex path (journey §1.2). */
export const COMPLEX: SetupAnswers = {
  name: 'Asha', birthYear: 1958, figure: 'female', metric: true, heightCm: 158, weightKg: 68,
  conditions: { ...NO_CONDITIONS, diabetes: 'yes', bp: 'yes', pain: 'yes' },
  diabetesType: 'type2', bpMedicine: 'yes', clearance: 'moderate', targets: 'no',
  regular: 'yes', classes: { ...NO_CLASSES, insulin: 'yes', metformin: 'yes', other: 'yes' }, metforminSince: '2015',
  insulinHow: 'multipleDaily', lowsRisk: 'no', priorDka: 'no', dizzy: 'no',
  glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', bpCuff: true,
  painAreas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: 'no',
  focus: 'stretch', active: 'no', weeklyGoal: 90, programme: 'notNow',
  pattern: 'vegetarian', allergies: ['peanut'], foodLevel: 'estimates', hardBefore: 'no',
  water: { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' }, fluidLimit: 'no',
  mealWalk: { on: true, meals: ['lunch', 'dinner'] }, mealFinish: { lunch: '13:30', dinner: '20:30' },
  quiet: { from: '22:00', to: '07:00' }, delivery: 'app', voice: { muted: false },
};

/** Every chip yes, every follow-up answered: the longest path there is. */
export const EVERYTHING: SetupAnswers = {
  ...COMPLEX,
  conditions: { diabetes: 'yes', bp: 'yes', heart: 'yes', kidney: 'yes', eyes: 'yes', feet: 'yes', pain: 'yes', other: 'yes' },
  kidneyTreatment: 'no', eyeTreatment: 'no', eyeDisease: 'mild', feetNumb: 'no', footWound: 'no', footRestriction: 'no',
};

/** P05-like: type 2 diabetes, numb feet and a wound now; no regular medicines. */
export const FOOT_WOUND: SetupAnswers = withC({ diabetes: 'yes', feet: 'yes' }, {
  diabetesType: 'type2', feetNumb: 'yes', footWound: 'now', footRestriction: 'no', clearance: 'none', targets: 'no', priorDka: 'no', dizzy: 'no',
});

/** A "-gliflozin" for the heart or kidneys, with no diabetes (A-06). */
export const GLIFLOZIN_NO_DIABETES: SetupAnswers = withMeds({ gliflozin: 'yes' }, { ketoneTest: 'none' });

/** Insulin ticked with diabetes "No" (board D78; Review Focus 3). */
export const INSULIN_NO_DIABETES: SetupAnswers = withMeds({ insulin: 'yes' }, {
  insulinHow: 'basalOnly', lowsRisk: 'no', priorDka: 'no', ketoneTest: 'none', clearance: 'none', targets: 'no', dizzy: 'no',
});

/** "Not sure" wherever it's offered, with high blood pressure (V-J17). */
export const UNSURE: SetupAnswers = withC({ diabetes: 'unsure', bp: 'yes', heart: 'unsure' }, {
  diabetesType: 'unsure', bpMedicine: 'unsure', fluidLimit: 'unsure', clearance: 'unsure', targets: 'unsure',
  regular: 'unsure',
  classes: { insulin: 'unsure', lowsTablet: 'unsure', gliflozin: 'unsure', metformin: 'unsure', betaBlocker: 'unsure', diuretic: 'unsure', other: 'unsure' },
  insulinHow: 'unsure', lowsRisk: 'unsure', priorDka: 'unsure', ketoneTest: 'none', dizzy: 'unsure',
});

export const JOIN: JoinAnswers = { experience: 'beginner', equipment: 'homeNone', days: ['monday', 'thursday', 'saturday'], minutes: 45, startDate: '2026-10-12' };
