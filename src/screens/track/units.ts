/**
 * Unit conversion for display.
 *
 * Records keep the unit they were entered in (`Observation.unit`); nothing
 * here rewrites a stored value. Screens convert when they show a reading in
 * the person's preferred unit, and every comparison against a threshold says
 * which unit it was made in.
 */

import { canonicalUnit, type ObservationKind } from '@/health/observation';

export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type MassUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';

/**
 * Glucose: 1 mmol/L = 18 mg/dL. ADA Standards of Care 2026, Table 6.3 pairs
 * 80–130 mg/dL with 4.4–7.2 mmol/L and 180 with 10.0, which is this factor;
 * board D29(1) fixes it unrounded (glucose's molar mass, 180.16 g/mol, makes
 * the exact figure 18.016, which no guideline uses).
 */
export const MGDL_PER_MMOL = 18;

/**
 * HbA1c: the IFCC–NGSP master equation, IFCC (mmol/mol) = 10.929 × (NGSP % − 2.15)
 * (Hoelzel et al., Clin Chem 2004;50:166–74, as published by the NGSP). 7% is
 * 53 mmol/mol, the pairing ADA 2026 recommendation 6.3a states.
 */
export const IFCC_PER_NGSP = 10.929;
export const NGSP_OFFSET = 2.15;

/**
 * Vitamin B12: cobalamin's molar mass is 1355.37 g/mol, so 1 pg/mL is
 * 0.7378 pmol/L. NIH ODS (Vitamin B12 fact sheet) pairs 148 pmol/L with
 * 200 pg/mL, the same factor. pg/mL and ng/L are the same number, which is
 * how NICE NG239 states its thresholds.
 */
export const PMOL_PER_PG_B12 = 0.7378;

/** Vitamin D, 25(OH)D: 1 ng/mL = 2.5 nmol/L (NIH ODS, Vitamin D fact sheet, Table 1). */
export const NMOL_PER_NG_VITD = 2.5;

/** Exact by definition: the 1959 international yard and pound agreement. */
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

/** A unit the screen can show. Stored units plus the display-only lb and in. */
export type DisplayUnit = string;

/**
 * Convert a value between two units of the same kind. Returns the value
 * unchanged when the units match, and throws for a pair this module does not
 * know — a silent pass-through would chart pounds on a kilogram axis.
 */
export function convert(kind: ObservationKind, value: number, from: DisplayUnit, to: DisplayUnit): number {
  if (from === to) return value;
  const pair = `${from}>${to}`;
  switch (kind) {
    case 'glucose':
      if (pair === 'mmol/L>mg/dL') return value * MGDL_PER_MMOL;
      if (pair === 'mg/dL>mmol/L') return value / MGDL_PER_MMOL;
      break;
    case 'hba1c':
      if (pair === '%>mmol/mol') return IFCC_PER_NGSP * (value - NGSP_OFFSET);
      if (pair === 'mmol/mol>%') return value / IFCC_PER_NGSP + NGSP_OFFSET;
      break;
    case 'b12':
      if (pair === 'pg/mL>pmol/L') return value * PMOL_PER_PG_B12;
      if (pair === 'pmol/L>pg/mL') return value / PMOL_PER_PG_B12;
      break;
    case 'vitaminD':
      if (pair === 'ng/mL>nmol/L') return value * NMOL_PER_NG_VITD;
      if (pair === 'nmol/L>ng/mL') return value / NMOL_PER_NG_VITD;
      break;
    case 'weight':
      if (pair === 'kg>lb') return value / KG_PER_LB;
      if (pair === 'lb>kg') return value * KG_PER_LB;
      break;
    case 'waist':
      if (pair === 'cm>in') return value / CM_PER_IN;
      if (pair === 'in>cm') return value * CM_PER_IN;
      break;
    default:
      break;
  }
  throw new Error(`No conversion for ${kind} from ${from} to ${to}`);
}

/** The value in the kind's canonical (stored-first) unit, unrounded. */
export function toCanonical(kind: ObservationKind, value: number, unit: DisplayUnit): number {
  return convert(kind, value, unit, canonicalUnit(kind));
}

/** Glucose in mg/dL, unrounded: the unit every glucose threshold is defined in (D29). */
export function glucoseMgdl(value: number, unit: GlucoseUnit): number {
  return unit === 'mg/dL' ? value : value * MGDL_PER_MMOL;
}

/**
 * How many decimals a unit is read to. Meters show whole mg/dL and one decimal
 * of mmol/L; labs report HbA1c to one decimal of a percent and whole mmol/mol.
 */
export function decimalsFor(kind: ObservationKind, unit: DisplayUnit): number {
  switch (kind) {
    case 'glucose':
      return unit === 'mmol/L' ? 1 : 0;
    case 'hba1c':
      return unit === '%' ? 1 : 0;
    case 'vitaminD':
      return unit === 'ng/mL' ? 1 : 0;
    case 'weight':
    case 'waist':
    case 'sleep':
    case 'walkDistance':
      return 1;
    default:
      return 0;
  }
}

/** Round half away from zero, without float dust: 2.675 → 2.68, not 2.67. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  // A hair of epsilon so 1.005 × 100 = 100.49999… still rounds up.
  const rounded = Math.round(scaled + 1e-9) / factor;
  return Math.sign(value) * rounded;
}

/**
 * A threshold a value is judged against, and which side its own value falls
 * on: `lt` for a rule like "under 180" (180 itself is above it), `le` for one
 * like "180 to 350" (350 itself is inside it).
 */
export interface Boundary {
  value: number;
  op: 'lt' | 'le';
}

const sideOf = (x: number, b: Boundary) => (b.op === 'lt' ? x < b.value : x <= b.value);

/**
 * How many decimals to show `value` with, so the figure shown sits on the
 * same side of every threshold it is judged against as the value itself:
 * 53.9 mg/dL is a serious low, so it is never shown as "54", the first value
 * that is not (acceptance J06). The unit's usual precision when that is
 * already safe, which is nearly always.
 */
export function safeDecimals(value: number, decimals: number, boundaries: readonly Boundary[]): number {
  if (!Number.isFinite(value) || boundaries.length === 0) return decimals;
  for (let d = decimals; d < decimals + 6; d++) {
    const shown = roundTo(value, d);
    if (boundaries.every(b => sideOf(shown, b) === sideOf(value, b))) return d;
  }
  return decimals + 6;
}

/** The value as shown: converted, then rounded to the unit's reading precision. */
export function displayValue(kind: ObservationKind, value: number, from: DisplayUnit, to: DisplayUnit): number {
  return roundTo(convert(kind, value, from, to), decimalsFor(kind, to));
}

const grouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/**
 * A number for reading: Indian digit grouping (12,500 and 1,25,000), a fixed
 * number of decimals so a column of readings lines up, and never `-0`.
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '';
  const rounded = roundTo(value, decimals);
  const clean = Object.is(rounded, -0) ? 0 : rounded;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(clean);
}

/** As `formatNumber`, but keeps only the decimals the value actually has (7.5 h, 8 h). */
export function formatCompact(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '';
  return grouping.format(roundTo(value, maxDecimals));
}
