/**
 * A glucose or blood-pressure reading typed into Quick Log and not saved yet,
 * kept in the tab's `sessionStorage` so a reload — or a save the device
 * refused, then a reload — brings it back instead of losing it (acceptance
 * J17). It is kept until it is saved or the form is closed, and it never
 * becomes part of the record until Save succeeds.
 *
 * The draft carries the record's id (or a pressure pair's stem), fixed when
 * the draft began, so saving it twice cannot store the reading twice; and
 * the moment Save was first tapped, which an untouched time stands for, so a
 * retry later does not re-time the reading.
 *
 * What is read back is checked field by field against what the form can
 * hold; anything else is dropped rather than guessed at.
 */

import { isAt, type ObservationTag } from '@/health/observation';
import { GLUCOSE_WHEN, PRESSURE_WHEN } from './logKinds';
import type { GlucoseUnit } from './units';

export const DRAFT_KEY = 'fit-strong-quicklog-draft';

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface GlucoseDraft {
  kind: 'glucose';
  /** The record's id, fixed when the draft began. */
  id: string;
  raw: string;
  unit: GlucoseUnit;
  tag?: ObservationTag;
  /** When the meal started, as typed (`HH:MM`). */
  meal?: string;
  /** The reading's time as typed (`datetime-local`), when it was changed. */
  time?: string;
  /** The moment Save was first tapped: what an untouched time stands for. */
  at?: string;
  /** A save of it was refused, so a reload opens it again rather than leaving it to be found. */
  refused?: true;
}

export interface PressureDraft {
  kind: 'bloodPressure';
  /** The pair's id stem, fixed when the draft began. */
  stem: string;
  s1: string;
  d1: string;
  second?: true;
  s2?: string;
  d2?: string;
  tag?: 'morning' | 'evening';
  time?: string;
  time2?: string;
  /** When the first reading was entered, if the person moved on to a second. */
  firstEntered?: string;
  /** The moment Save was first tapped. */
  at?: string;
  refused?: true;
}

export type QuickLogDraft = GlucoseDraft | PressureDraft;

const ID = /^[\w:-]{1,80}$/;
const NUMBER = /^[\w .,/-]{0,24}$/;
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const CLOCK = /^\d{2}:\d{2}$/;
const GLUCOSE_TAGS: readonly string[] = GLUCOSE_WHEN.map(w => w.tag);
const PRESSURE_TAGS: readonly string[] = PRESSURE_WHEN.map(w => w.tag);

const fits = (v: unknown, pattern: RegExp): v is string => typeof v === 'string' && pattern.test(v);
/** An optional field: absent, or valid. */
const optional = (v: unknown, valid: (v: unknown) => boolean) => v === undefined || valid(v);

/** A stored draft, or nothing if any part of it is not what a form can hold. */
export function parseQuickLogDraft(raw: unknown): QuickLogDraft | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const v = raw as Record<string, unknown>;
  const local = (x: unknown) => fits(x, LOCAL);
  if (!optional(v.time, local) || !optional(v.at, isAt) || !optional(v.refused, r => r === true)) return undefined;
  // Rebuilt from the fields checked, so nothing else read back comes with it.
  const when = {
    ...(v.time !== undefined ? { time: v.time as string } : {}),
    ...(v.at !== undefined ? { at: v.at as string } : {}),
    ...(v.refused === true ? { refused: true as const } : {}),
  };

  if (v.kind === 'glucose') {
    if (!fits(v.id, ID) || !fits(v.raw, NUMBER) || (v.unit !== 'mg/dL' && v.unit !== 'mmol/L')) return undefined;
    if (!optional(v.tag, t => GLUCOSE_TAGS.includes(t as string)) || !optional(v.meal, m => fits(m, CLOCK))) return undefined;
    return {
      kind: 'glucose', id: v.id, raw: v.raw, unit: v.unit,
      ...(v.tag !== undefined ? { tag: v.tag as ObservationTag } : {}),
      ...(v.meal !== undefined ? { meal: v.meal as string } : {}),
      ...when,
    };
  }

  if (v.kind === 'bloodPressure') {
    const number = (x: unknown) => fits(x, NUMBER);
    if (!fits(v.stem, ID) || !number(v.s1) || !number(v.d1) || !optional(v.s2, number) || !optional(v.d2, number)) return undefined;
    if (!optional(v.second, s => s === true) || !optional(v.time2, local) || !optional(v.firstEntered, isAt)) return undefined;
    if (!optional(v.tag, t => PRESSURE_TAGS.includes(t as string))) return undefined;
    return {
      kind: 'bloodPressure', stem: v.stem, s1: v.s1 as string, d1: v.d1 as string,
      ...(v.second === true ? { second: true as const } : {}),
      ...(v.s2 !== undefined ? { s2: v.s2 as string } : {}),
      ...(v.d2 !== undefined ? { d2: v.d2 as string } : {}),
      ...(v.tag !== undefined ? { tag: v.tag as 'morning' | 'evening' } : {}),
      ...(v.time2 !== undefined ? { time2: v.time2 as string } : {}),
      ...(v.firstEntered !== undefined ? { firstEntered: v.firstEntered as string } : {}),
      ...when,
    };
  }
  return undefined;
}

/** The kept draft, if there is one this form can trust. Never throws. */
export function loadQuickLogDraft(storage: DraftStorage | undefined): QuickLogDraft | undefined {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    return raw ? parseQuickLogDraft(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

/** Keep the draft. False when the browser would not keep it. */
export function storeQuickLogDraft(storage: DraftStorage | undefined, draft: QuickLogDraft): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearQuickLogDraft(storage: DraftStorage | undefined): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // A storage that refuses removal refused the write too.
  }
}

/** The tab's own storage, if this browser offers it. */
export function draftStorage(): DraftStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/** Has the draft's reading been stored already — saved, with only the clearing lost to a reload? */
export function draftSaved(draft: QuickLogDraft, observations: readonly { id: string }[]): boolean {
  return draft.kind === 'glucose'
    ? observations.some(o => o.id === draft.id)
    : observations.some(o => o.id.startsWith(`${draft.stem}-a:`));
}

/**
 * The kept draft for a form of `kind`, if its reading is not stored yet. One
 * whose reading is stored already is finished with, so it is forgotten here.
 */
export function keptDraft<K extends QuickLogDraft['kind']>(
  kind: K,
  observations: readonly { id: string }[],
  storage: DraftStorage | undefined = draftStorage(),
): Extract<QuickLogDraft, { kind: K }> | undefined {
  const draft = loadQuickLogDraft(storage);
  if (!draft) return undefined;
  if (draftSaved(draft, observations)) {
    clearQuickLogDraft(storage);
    return undefined;
  }
  return draft.kind === kind ? draft as Extract<QuickLogDraft, { kind: K }> : undefined;
}
