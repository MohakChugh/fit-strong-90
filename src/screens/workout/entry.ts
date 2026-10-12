/**
 * Numbers as the user types and taps them, turned into what is stored.
 *
 * Weight is stored in kilograms and shown in the user's unit. This file is the
 * only place in the Workout Log where the two meet — `kgToDisplay` on the way
 * into a field, `displayToKg` on the way out — so a pound figure can never be
 * saved as kilograms. Fields accept a comma as the decimal mark as well,
 * because that is what some iPhone keypads offer.
 */

import { displayToKg, kgToDisplay } from '@/lib/utils';

/** Ceilings that catch a slipped digit. They are not a judgement on anyone's training. */
export const MAX_REPS = 200;
export const MAX_SECONDS = 3600;
export const MAX_KG = 500;
export const MAX_ACTIVE_MINUTES = 600;

export type Read = { ok: true; value: number | null } | { ok: false; message: string };

/** The unit word, as `formatWeight` writes it everywhere else in the app. */
export function unitLabel(useMetric: boolean): string {
  return useMetric ? 'kg' : 'lbs';
}

/** A field's text as a number: blank is null, "22,5" is 22.5, anything else is NaN. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return Number.NaN;
  return Number(t);
}

/** Reps, or seconds for a hold or carry, as typed: required, whole, at least 1. */
export function readCount(text: string, timed: boolean): Read {
  const noun = timed ? 'seconds' : 'reps';
  const n = parseNumber(text);
  if (n === null) return { ok: false, message: `Enter the ${noun}.` };
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) return { ok: false, message: `Enter the ${noun} as a whole number.` };
  const max = timed ? MAX_SECONDS : MAX_REPS;
  if (n > max) return { ok: false, message: `That is more than ${max} ${noun}. Check the number.` };
  return { ok: true, value: n };
}

/**
 * The minutes the person says they were active, as typed. Optional: blank
 * means they did not say, which counts no movement rather than a guess.
 */
export function readMinutes(text: string): Read {
  const n = parseNumber(text);
  if (n === null) return { ok: true, value: null };
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) return { ok: false, message: 'Enter the minutes as a whole number, or leave it blank.' };
  if (n > MAX_ACTIVE_MINUTES) return { ok: false, message: `That is more than ${MAX_ACTIVE_MINUTES} minutes. Check the number.` };
  return { ok: true, value: n };
}

/**
 * Weight as typed in the user's unit, in kilograms for storage. Optional: a
 * blank field stores no weight, which reads back as "not entered", never 0.
 */
export function readWeight(text: string, useMetric: boolean): Read {
  const n = parseNumber(text);
  if (n === null) return { ok: true, value: null };
  if (Number.isNaN(n)) return { ok: false, message: 'Enter the weight as a number.' };
  const kg = displayToKg(n, useMetric);
  if (kg > MAX_KG) {
    return { ok: false, message: `That is more than ${Math.round(kgToDisplay(MAX_KG, useMetric))} ${unitLabel(useMetric)}. Check the number.` };
  }
  return { ok: true, value: kg };
}

/** A stored weight as field text, in the user's unit. */
export function weightText(kg: number | null | undefined, useMetric: boolean): string {
  return kg === null || kg === undefined ? '' : String(kgToDisplay(kg, useMetric));
}

/**
 * One stepper tap on the weight, in the user's unit: 2.5 kg or 5 lb — the
 * guided session's steps — and never below zero. Rounded to what the field
 * shows, so repeated taps cannot drift into float noise.
 */
export function stepWeight(text: string, direction: 1 | -1, useMetric: boolean): string {
  const step = useMetric ? 2.5 : 5;
  const n = parseNumber(text);
  const current = n === null || Number.isNaN(n) ? 0 : n;
  const places = useMetric ? 100 : 10;
  return String(Math.round(Math.max(0, current + direction * step) * places) / places);
}

/** One stepper tap on active minutes, in fives; stepping below five goes back to not said. */
export function stepMinutes(text: string, direction: 1 | -1): string {
  const n = parseNumber(text);
  const next = (n === null || Number.isNaN(n) ? 0 : Math.round(n)) + direction * 5;
  return next < 5 ? '' : String(Math.min(MAX_ACTIVE_MINUTES, next));
}

/** One stepper tap on reps (1) or a hold (5 s), kept between 1 and the ceiling. */
export function stepCount(text: string, direction: 1 | -1, timed: boolean): string {
  const n = parseNumber(text);
  const current = n === null || Number.isNaN(n) ? 0 : Math.round(n);
  const max = timed ? MAX_SECONDS : MAX_REPS;
  return String(Math.min(max, Math.max(1, current + direction * (timed ? 5 : 1))));
}
