/**
 * Household units (journey §11.6; board D98). No source defines a katori or
 * a roti, so each food's portion is stated by us in grams, every portion shows
 * its grams, and the person can weigh their own.
 */
import type { Portion } from './types';

export type UnitId = 'piece' | 'katori' | 'plate' | 'glass' | 'cup' | 'tbsp' | 'handful';

export interface Unit {
  one: string;
  many: string;
  /** What the stepper moves by. */
  step: 0.5 | 1;
  /** How far a standard portion's weight may vary, as a fraction (D97). */
  variance: number;
  /** The volume we take it to be, shown beside the grams. */
  volume?: string;
}

export const UNITS: Readonly<Record<UnitId, Unit>> = {
  piece: { one: 'piece', many: 'pieces', step: 1, variance: 0.2 },
  katori: { one: 'katori', many: 'katoris', step: 0.5, variance: 0.2, volume: '1 katori ≈ 150 ml' },
  plate: { one: 'plate', many: 'plates', step: 0.5, variance: 0.25 },
  glass: { one: 'glass', many: 'glasses', step: 0.5, variance: 0.15, volume: '1 glass ≈ 200 ml' },
  cup: { one: 'cup', many: 'cups', step: 0.5, variance: 0.15, volume: '1 cup ≈ 150 ml' },
  tbsp: { one: 'tablespoon', many: 'tablespoons', step: 1, variance: 0.25, volume: '1 tablespoon ≈ 15 ml' },
  handful: { one: 'handful', many: 'handfuls', step: 0.5, variance: 0.25 },
};

export function isUnitId(x: unknown): x is UnitId {
  return typeof x === 'string' && Object.hasOwn(UNITS, x);
}

/** 0.5 → "½", 1.5 → "1½", 2 → "2". Counts move in halves at most. */
export function countText(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  return `${whole > 0 ? whole : ''}${half ? '½' : ''}` || '0';
}

/** "2 rotis (≈ 80 g)", "½ katori (≈ 75 g)". */
export function portionText(p: Pick<Portion, 'unit' | 'noun'>, count: number, gramsPerPortion: number): string {
  const unit = UNITS[p.unit];
  const [one, many] = p.unit === 'piece' && p.noun ? p.noun : [unit.one, unit.many];
  return `${countText(count)} ${count > 1 ? many : one} (≈ ${Math.round(count * gramsPerPortion)} g)`;
}
