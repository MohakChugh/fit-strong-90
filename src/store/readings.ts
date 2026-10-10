/**
 * The readings a check-in holds, read for damage (R5-01, N-07, P-03): what
 * makes one unreadable, in words for the person, or nothing. Shared by an
 * import, which refuses a file holding one, and by this device's own store,
 * which folds nothing into a record it cannot read.
 *
 * The engine passes over a reading it cannot read, so a dangerous one would
 * be lost without a word; a file holding one is refused whole instead,
 * naming it.
 *
 * Every time in a check-in is an instant with its offset, as every build
 * writes it. Any other text is still read as a moment, some other one: "5" is
 * a day in 2001, so a serious reading is years old, a stale one looks fresh,
 * and an answer given today is not today's.
 */

import { isAt } from '@/health/observation';
import type { GlucoseUnit, UrineKetoneCategory } from '@/types/checkin';

export type Problem = string | undefined;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === 'string';
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const optional = (x: unknown, ok: (v: unknown) => boolean) => x === undefined || ok(x);
const named = (names: Readonly<Record<string, true>>) => (x: unknown) => isText(x) && Object.hasOwn(names, x);

const GLUCOSE_UNITS: Record<GlucoseUnit, true> = { 'mg/dL': true, 'mmol/L': true };
const URINE: Record<UrineKetoneCategory, true> = { negative: true, trace: true, small: true, moderate: true, large: true };
/** What the file says, briefly, so the person can find it. */
const quoted = (x: unknown) => (isText(x) ? ` ("${x.slice(0, 20)}")` : '');
const timeProblem = (at: unknown, what: string): Problem => (optional(at, isAt) ? undefined : `${what} whose time cannot be read`);

/**
 * As the engine reads one: a meter's HI or LO where there is a `display`, a
 * number in its unit otherwise. One with both would be read as its display,
 * not the number it says, so it is neither.
 */
function glucoseProblem(x: unknown, as: 'number' | 'display' | 'either'): Problem {
  if (!isRecord(x)) return 'a glucose reading this app cannot read';
  if ('display' in x && x.value !== undefined) return 'a glucose reading that is both a number and a meter display';
  if (as === 'display' || (as === 'either' && 'display' in x)) {
    if (x.display !== 'HI' && x.display !== 'LO') return `a glucose meter display other than HI or LO${quoted(x.display)}`;
    return timeProblem(x.measuredAt, 'a glucose meter display');
  }
  if (!isNumber(x.value)) return 'a glucose reading whose number cannot be read';
  if (!named(GLUCOSE_UNITS)(x.unit)) return `a glucose reading in a unit this app does not know${quoted(x.unit)}`;
  return timeProblem(x.measuredAt, 'a glucose reading');
}

function ketoneProblem(x: unknown): Problem {
  if (!isRecord(x)) return 'a ketone reading this app cannot read';
  if (x.kind === 'blood') {
    if (!isNumber(x.value)) return 'a blood ketone reading whose number cannot be read';
  } else if (x.kind === 'urine') {
    // A strip is its colour; before v5 it was stored as the number the old sheet gave that colour.
    if (!optional(x.category, named(URINE))) return `a urine ketone strip reading this app does not know${quoted(x.category)}`;
    if (!optional(x.value, isNumber)) return 'a urine ketone strip reading whose number cannot be read';
    if (x.category === undefined && x.value === undefined) return 'a urine ketone strip reading with no result';
  } else {
    return `a ketone reading of a kind this app does not know${quoted(x.kind)}`;
  }
  return timeProblem(x.measuredAt, 'a ketone reading');
}

/**
 * A partial reading is one severe number with the other box left empty (B07),
 * and the whole reading that completed it, once there is one, is a reading
 * like any other (N-04, P-02).
 */
function pressureProblem(x: unknown, partial = false): Problem {
  if (!isRecord(x)) return 'a blood pressure reading this app cannot read';
  const number = partial ? (n: unknown) => optional(n, isNumber) : isNumber;
  if (!number(x.sys) || !number(x.dia)) return 'a blood pressure reading whose numbers cannot be read';
  if (x.sys === undefined && x.dia === undefined) return 'a blood pressure reading with no numbers in it';
  return timeProblem(x.at, 'a blood pressure reading') ?? (partial && x.completion !== undefined ? pressureProblem(x.completion) : undefined);
}

/** Every reading a check-in holds: the field, what is wrong with one, and whether the field is a list of them. */
const READINGS: [string, (x: unknown) => Problem, boolean][] = [
  ['glucose', x => glucoseProblem(x, 'number'), false],
  ['glucoseDisplay', x => glucoseProblem(x, 'display'), false],
  ['glucoseEarlier', x => glucoseProblem(x, 'either'), true],
  ['ketones', ketoneProblem, false],
  ['ketonesEarlier', ketoneProblem, true],
  ['bp', x => pressureProblem(x), false],
  ['bpReadings', x => pressureProblem(x), true],
  ['bpEarlier', x => pressureProblem(x), true],
  ['bpPartial', x => pressureProblem(x, true), true],
];

/** The first reading in a check-in this app cannot read, in words; nothing when every one can be read. */
export function unreadableReading(c: Record<string, unknown>, fields = READINGS): Problem {
  for (const [field, problem, list] of fields) {
    const value = c[field];
    if (value === undefined) continue;
    // A list that is not one holds nothing that can be read.
    for (const reading of list ? (Array.isArray(value) ? value : [null]) : [value]) {
      const found = problem(reading);
      if (found) return found;
    }
  }
  return undefined;
}

/** The readings Track attaches to the screens' copy of a day (`logged`), each a reading as any other. */
const ATTACHED: typeof READINGS = [
  ['glucose', x => glucoseProblem(x, 'number'), true],
  ['bp', x => pressureProblem(x), true],
];

/** The first reading a check-in holds, or has attached, that cannot be read: what it says, and what was folded into it. */
export function damagedReading(c: Record<string, unknown>): Problem {
  const logged = c.logged;
  if (logged !== undefined && !isRecord(logged)) return 'readings from Track this app cannot read';
  return unreadableReading(c) ?? (isRecord(logged) ? unreadableReading(logged, ATTACHED) : undefined);
}
