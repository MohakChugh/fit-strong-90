/**
 * Height, weight and waist as the person types them (journey §6.2 ch. 2). A
 * field shows the stored value in the unit chosen. While it still shows that,
 * the stored value is kept exactly, so saving in feet or pounds never drifts
 * it or adds a reading (Review Focus 2, board D83). Problems are checked at
 * Next or Save, never per keystroke.
 */
import { weightFieldText } from '@/components/profile/wizardSteps';
import { LB_PER_KG } from '@/lib/utils';
import type { RawKey } from './limits';

export const CM_PER_INCH = 2.54;
const tenth = (n: number) => Math.round(n * 10) / 10;

/** A number's text: as typed while the draft keeps it (`draft.raw`), else its answer's (H5R-15). */
export const textOf = (raw: Readonly<Record<string, string>>, key: RawKey, answer: number | string | undefined): string =>
  raw[key] ?? (answer === undefined ? '' : String(answer));

/** A number as typed: nothing for an empty field; NaN for one that isn't a number yet. */
export function numberFrom(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  return t === '' ? undefined : Number(t);
}

export interface HeightText { cm: string; ft: string; inch: string }

/** What the height fields show for a height: cm, or feet and inches. */
export function heightText(cm: number | undefined, metric: boolean): HeightText {
  if (cm === undefined || !Number.isFinite(cm) || cm <= 0) return { cm: '', ft: '', inch: '' };
  if (metric) return { cm: String(tenth(cm)), ft: '', inch: '' };
  const inches = Math.round(cm / CM_PER_INCH);
  return { cm: '', ft: String(Math.floor(inches / 12)), inch: String(inches % 12) };
}

/** The height the fields give, in cm: the stored one while they still show it. */
export function heightFrom(t: HeightText, metric: boolean, stored: number | undefined): number | undefined {
  const shown = heightText(stored, metric);
  if (stored !== undefined && (metric ? t.cm === shown.cm : t.ft === shown.ft && t.inch === shown.inch)) return stored;
  if (metric) return numberFrom(t.cm);
  const ft = numberFrom(t.ft);
  const inch = numberFrom(t.inch);
  if (ft === undefined && inch === undefined) return undefined;
  return tenth(((ft ?? 0) * 12 + (inch ?? 0)) * CM_PER_INCH);
}

/** The weight the field gives, in kg: the stored one while it still shows it. */
export function weightFrom(text: string, metric: boolean, stored: number | undefined): number | undefined {
  if (stored !== undefined && stored > 0 && text === weightFieldText(stored, metric)) return stored;
  const n = numberFrom(text);
  return n === undefined || metric ? n : tenth(n / LB_PER_KG);
}

/** What the waist field shows: cm, or whole inches. */
export function waistText(cm: number | undefined, metric: boolean): string {
  if (cm === undefined || !Number.isFinite(cm) || cm <= 0) return '';
  return String(metric ? tenth(cm) : Math.round(cm / CM_PER_INCH));
}

export function waistFrom(text: string, metric: boolean, stored: number | undefined): number | undefined {
  if (stored !== undefined && text === waistText(stored, metric)) return stored;
  const n = numberFrom(text);
  return n === undefined || metric ? n : tenth(n * CM_PER_INCH);
}

const outside = (n: number | undefined, lo: number, hi: number) => n !== undefined && (!Number.isFinite(n) || n < lo || n > hi);

export const heightProblem = (cm: number | undefined): string | null =>
  (outside(cm, 50, 260) ? 'Enter a height between 50 and 260 cm (1 ft 8 in and 8 ft 6 in).' : null);
export const weightProblem = (kg: number | undefined): string | null =>
  (outside(kg, 10, 400) ? 'Enter a weight between 10 and 400 kg (22 and 880 lb).' : null);
export const waistProblem = (cm: number | undefined): string | null =>
  (outside(cm, 30, 250) ? 'Enter a waist between 30 and 250 cm (12 and 98 inches).' : null);
