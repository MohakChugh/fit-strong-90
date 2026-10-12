/**
 * What a typed number may be before it is saved.
 *
 * These ranges catch typing slips — 1380 for 138, 7,2 read as 72 — not
 * clinical states. They are deliberately wide: refusing a real reading is the
 * worse failure, because the person then gets no guidance at all. Where the
 * wrong unit is the likely slip, the message says so.
 */

import type { ObservationKind } from '@/health/observation';
import { formatCompact, formatNumber } from './units';

export type Checked = { ok: true; value: number } | { ok: false; message: string };

interface Range {
  min: number;
  max: number;
  /** `min` itself is refused: a glucose of 0 is no reading. */
  minExclusive?: boolean;
  /** Whole numbers only: a cuff and a pedometer do not show decimals. */
  integer?: boolean;
  /** Said when the value is under `min`. */
  low?: string;
  /** Said when the value is over `max`. */
  high?: string;
}

/**
 * Glucose follows the check-in's rule (`glucoseSanity` in engine/readiness.ts),
 * so the two places a reading is typed can never disagree. Any reading above
 * zero is a reading: a very high mg/dL number is acted on (E-EXTREME-GLUCOSE),
 * never refused as implausible, and under 34 mg/dL is accepted as the severe
 * low it may be, with a question about the unit (`unitQuestion`). Over 34
 * mmol/L is past what any meter reads and almost certainly mg/dL, so it is not
 * saved until the unit is right — but the message still says what to do if it
 * really is mmol/L. A meter's HI or LO is not a number at all (`meterDisplay`).
 */
const MMOL_MAX = 34;
const UNUSABLE = 'That reading can’t be used. Measure again and enter the number your meter shows.';

const RANGES: Partial<Record<ObservationKind, Record<string, Range>>> = {
  glucose: {
    'mg/dL': { min: 0, minExclusive: true, max: Infinity, low: UNUSABLE },
    'mmol/L': {
      min: 0, minExclusive: true, max: MMOL_MAX, low: UNUSABLE,
      high: 'That does not look like mmol/L: meters read up to about 33. If your meter shows mg/dL, switch the unit. If it really is mmol/L, it is extremely high: get emergency medical help now.',
    },
  },
  bloodPressureSystolic: { mmHg: { min: 50, max: 300, integer: true } },
  bloodPressureDiastolic: { mmHg: { min: 25, max: 200, integer: true } },
  weight: { kg: { min: 20, max: 400 }, lb: { min: 44, max: 880 } },
  waist: { cm: { min: 40, max: 250 }, in: { min: 16, max: 98 } },
  water: { ml: { min: 10, max: 5000, integer: true } },
  steps: { steps: { min: 0, max: 100_000, integer: true } },
  sleep: { h: { min: 0, max: 24 } },
  backPain: { '0-10': { min: 0, max: 10, integer: true } },
  legPain: { '0-10': { min: 0, max: 10, integer: true } },
  hba1c: { '%': { min: 3, max: 20 }, 'mmol/mol': { min: 9, max: 195, integer: true } },
  b12: { 'pg/mL': { min: 30, max: 5000 }, 'pmol/L': { min: 22, max: 3700 } },
  vitaminD: { 'ng/mL': { min: 2, max: 200 }, 'nmol/L': { min: 5, max: 500 } },
};

/**
 * Read what was typed. Spaces and digit grouping are dropped; a lone comma is
 * a decimal comma ("7,2"), because an iPhone set to a European region shows
 * one on the decimal pad. Anything else that is not a plain number is refused
 * rather than guessed at.
 */
export function parseNumber(raw: string): number | undefined {
  // `\s` covers the no-break and thin spaces some keyboards insert as grouping.
  let text = raw.replace(/\s/g, '');
  if (text === '') return undefined;
  const commas = (text.match(/,/g) ?? []).length;
  if (commas > 0) {
    if (text.includes('.')) {
      // 1,250.5 — commas are grouping.
      text = text.replace(/,/g, '');
    } else if (commas === 1 && /^\d+,\d{1,2}$/.test(text)) {
      // 7,2 — a decimal comma. Three digits after it (4,820) is grouping.
      text = text.replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  }
  // "5." is still being typed, and means 5.
  if (!/^\d+\.?\d*$|^\.\d+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function shown(value: number, unit: string): string {
  if (unit === 'steps') return formatNumber(value);
  // A 0 to 10 scale has no unit to write after each end.
  if (unit === '0-10') return String(value);
  return `${formatCompact(value, 2)} ${unit}`;
}

/** Check one typed value for a kind, in the unit it was typed in. */
export function checkValue(kind: ObservationKind, raw: string, unit: string): Checked {
  const value = parseNumber(raw);
  if (value === undefined) {
    return { ok: false, message: raw.trim() === '' ? 'Enter a number.' : 'Enter a number, using digits only.' };
  }
  const range = RANGES[kind]?.[unit];
  if (!range) return { ok: false, message: `This app does not record ${unit} for this.` };
  if (range.integer && !Number.isInteger(value)) {
    return { ok: false, message: 'Enter a whole number.' };
  }
  if (range.minExclusive ? value <= range.min : value < range.min) {
    return { ok: false, message: range.low ?? `That looks too low. Enter a value from ${shown(range.min, unit)} to ${shown(range.max, unit)}.` };
  }
  if (value > range.max) {
    return { ok: false, message: range.high ?? `That looks too high. Enter a value from ${shown(range.min, unit)} to ${shown(range.max, unit)}.` };
  }
  return { ok: true, value };
}

export type CheckedPressure =
  | { ok: true; systolic: number; diastolic: number }
  | { ok: false; field: 'systolic' | 'diastolic' | 'both'; message: string };

/**
 * A blood-pressure reading: both numbers, each in range, top above bottom.
 * A reading whose top number is not above its bottom one is two numbers
 * typed in the wrong boxes, not a physiology.
 */
export function checkPressure(systolicRaw: string, diastolicRaw: string): CheckedPressure {
  if (systolicRaw.trim() === '' && diastolicRaw.trim() === '') {
    return { ok: false, field: 'both', message: 'Enter both numbers from the monitor.' };
  }
  const systolic = checkValue('bloodPressureSystolic', systolicRaw, 'mmHg');
  if (!systolic.ok) {
    return { ok: false, field: 'systolic', message: systolicRaw.trim() === '' ? 'Enter the top number.' : `Top number: ${lower(systolic.message)}` };
  }
  const diastolic = checkValue('bloodPressureDiastolic', diastolicRaw, 'mmHg');
  if (!diastolic.ok) {
    return { ok: false, field: 'diastolic', message: diastolicRaw.trim() === '' ? 'Enter the bottom number.' : `Bottom number: ${lower(diastolic.message)}` };
  }
  if (systolic.value <= diastolic.value) {
    return { ok: false, field: 'both', message: 'The top number is higher than the bottom one on every monitor. Check the order.' };
  }
  return { ok: true, systolic: systolic.value, diastolic: diastolic.value };
}

function lower(message: string): string {
  return message.charAt(0).toLowerCase() + message.slice(1);
}

/** A question about the unit, and the unit that would answer it. */
export interface UnitQuestion {
  text: string;
  to: 'mg/dL' | 'mmol/L';
}

/**
 * Asked as the number is typed, the same two zones the check-in asks about.
 * Under 34 mg/dL is either a severe low or a mmol/L number with the wrong
 * unit; it can still be saved as the low it may be, because treating a
 * mistyped high as a low costs a snack, while the reverse costs a missed low.
 * Over 34 mmol/L is mg/dL in all likelihood, and is refused until the unit is
 * right (see RANGES).
 */
export function unitQuestion(kind: ObservationKind, value: number, unit: string): UnitQuestion | undefined {
  if (kind !== 'glucose' || !(value > 0)) return undefined;
  if (unit === 'mg/dL' && value < 34) {
    return { text: 'Under 34 mg/dL is a serious low, or a mmol/L reading with the wrong unit. If your meter shows mmol/L, switch the unit before saving.', to: 'mmol/L' };
  }
  if (unit === 'mmol/L' && value > MMOL_MAX) {
    return { text: 'That does not look like mmol/L. If your meter shows mg/dL, switch the unit.', to: 'mg/dL' };
  }
  return undefined;
}

/**
 * A meter's "HI" or "LO", typed as letters. Neither is a number, and none is
 * invented for it (contract H-DATA): it is answered with guidance, not saved.
 */
export function meterDisplay(raw: string): 'HI' | 'LO' | undefined {
  const text = raw.trim().toUpperCase();
  return text === 'HI' || text === 'LO' ? text : undefined;
}
