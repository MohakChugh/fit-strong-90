/**
 * Daily readiness: the check-in plus the profile, judged against the Safety
 * contract (docs/research/clinical-tracking-protocols.md) with the policy
 * calls in board D29. The result carries the contract action (emergency,
 * today, hold, adjust, reassure), the session modifiers, the reasons and
 * what would release a hold; `permission.ts` turns it into a per-mode answer.
 *
 * Every rule is evaluated on its own and contributes to one merge; no rule
 * returns early and hides another, and the merge never lowers a
 * contribution (board D28). The colour (`outcome`) is kept for older screens:
 * a hold is red, except a glucose re-check, which keeps its colour and sets
 * `recheckMinutes` the way those screens expect.
 *
 * Glucose thresholds are canonical in mg/dL and compared in the reading's own
 * unit (the threshold divided by 18, never rounded), so x/18 mmol/L meets
 * exactly what x mg/dL meets (D29(1)).
 */

import type { UserProfile } from '@/types/profile';
import type {
  BackLight, BpPartialReading, BpReading, DailyCheckIn, Disposition, EmergencyFlag, EpisodeAnswer, EpisodeKind,
  EpisodeReading, EpisodeResolution, EpisodeSummary, GlucoseEntry, GlucoseUnit, KetoneReading, Mode, Modifier, NewsItem,
  Outcome, Readiness, Reason, RedFlag, SymptomReach, UrineKetoneCategory,
} from '@/types/checkin';
import { DISPOSITION_ORDER, OUTCOME_ORDER } from '@/types/checkin';
import type { HealthProfile } from '@/types/profile';
import { MGDL_PER_MMOL, bpMedicinesUnknown, deriveHealth, glucoseStartIsCareTeams, glucoseStartMin, profileRules, takes, type DerivedHealth } from './health';
import { getMobility } from '@/data/catalog';
import { prefersHour12, timeOf } from '@/lib/time';

export { MGDL_PER_MMOL };

/** A treat-and-recheck waits this long (ADA 2026, recommendation 6.15). */
export const RECHECK_MINUTES = 15;

export type GlucoseSanity = 'ok' | 'ambiguousLow' | 'suspectUnit' | 'implausible';

const isUnit = (u: unknown): u is GlucoseUnit => u === 'mg/dL' || u === 'mmol/L';

/** Unrounded. A unit it does not know is an error, never assumed to be mmol/L. */
export function toMgdl(value: number, unit: GlucoseUnit): number {
  if (unit === 'mg/dL') return value;
  if (unit === 'mmol/L') return value * MGDL_PER_MMOL;
  throw new RangeError(`Unknown glucose unit: ${String(unit)}`);
}

/**
 * Catch a reading typed in the other unit before it triggers the wrong rule.
 *
 * Under 34 mg/dL is either a severe low or a mmol/L number with the wrong
 * unit; it is treated as the low, because a real one needs carbohydrate now.
 * Over 34 mmol/L is past what a meter reads and is almost certainly mg/dL, so
 * it is not used until the unit is confirmed. A very high mg/dL reading and a
 * very low mmol/L one are readings to act on (E-EXTREME-GLUCOSE, a severe
 * low), never "implausible" numbers to discard.
 */
export function glucoseSanity(value: number, unit: GlucoseUnit, unitConfirmed = false): GlucoseSanity {
  if (!isUnit(unit) || !Number.isFinite(value) || value <= 0) return 'implausible';
  // A confirmed unit is read as given, so an extreme mmol/L reading reaches the
  // same rule as its mg/dL equal (Codex re-audit F10).
  if (unitConfirmed) return 'ok';
  if (unit === 'mg/dL') return value < 34 ? 'ambiguousLow' : 'ok';
  return value > 34 ? 'suspectUnit' : 'ok';
}

interface Contribution {
  outcome: Outcome;
  /** Defaults from the outcome: urgent is an emergency, red a hold, anything else an adjustment. */
  disposition?: Disposition;
  modifiers?: Modifier[];
  reason?: Reason;
  actions?: string[];
  /** Eating or drinking: dropped when the person cannot swallow safely (E-HYPO). */
  oral?: string[];
  /** Getting ready to exercise: dropped when the answer is no exercise today or an emergency. */
  prep?: string[];
  /** A hold that says no exercise today, whatever its release (scan J2-14): no exercise preparation beside it. */
  endsDay?: true;
  notices?: string[];
  recheckMinutes?: number;
  recheckAt?: string;
  nerveFlag?: boolean;
  back?: BackLight;
  capHeavy?: boolean;
  release?: string;
  awaitingReading?: boolean;
  refuses?: Mode[];
  /** Suppresses every `oral` instruction in the merge. */
  noOral?: boolean;
  /** An earlier serious reading still deciding today's answer. */
  unresolved?: EpisodeKind;
}

// ─── Serious readings and what has been said about them (B01) ──────────────

/**
 * A stable name for one reading: what it measured, when, and what it said.
 * An answer names readings by this, so a reading taken later — even of the
 * same value — is a new incident that no earlier answer covers.
 */
/** When a reading was taken, for its id: its time, or for an untimed one the day it was recorded on, so two untimed readings of one value on different days are two incidents (X2-10). */
const stampOf = (iso: string | undefined, day: string | undefined) => iso ?? (day ? `@${day}` : '-');
export function glucoseReadingId(e: GlucoseEntry, day?: string): string {
  return 'display' in e ? `g:${stampOf(e.measuredAt, day)}:${e.display}` : `g:${stampOf(e.measuredAt, day)}:${e.value}${e.unit}`;
}
export function ketoneReadingId(k: KetoneReading, day?: string): string {
  return `k:${stampOf(k.measuredAt, day)}:${k.kind}:${k.kind === 'blood' ? k.value : k.category ?? k.value}`;
}
export function bpReadingId(r: BpReading, day?: string): string {
  return `bp:${stampOf(r.at, day)}:${r.sys}/${r.dia}`;
}
export function bpPartialId(r: BpPartialReading, day?: string): string {
  return `bpp:${stampOf(r.at, day)}:${r.sys ?? ''}/${r.dia ?? ''}`;
}
const newsReadingId = (date: string, item: NewsItem) => `news:${item}@${date}`;

/**
 * What a reading has been settled as, by the latest answer that names it
 * (re-audit decision 3, round 3 B01). A later ordinary reading is not an
 * answer: a typing mistake and a real event look the same in the numbers, so
 * the person says which it was. `mistake` removes the reading; `assessed`
 * keeps the day's no-exercise rule without calling for help again; no answer,
 * or `reopened`, leaves its own action in force.
 */
function settledAs(id: string, answers: readonly EpisodeAnswer[]): EpisodeResolution | undefined {
  let latest: EpisodeAnswer | undefined;
  for (const a of answers) if (a.readings.includes(id) && (!latest || a.at >= latest.at)) latest = a;
  return latest && latest.resolution !== 'reopened' ? latest.resolution : undefined;
}

/** This record's answers, plus those given on later days (the answer to yesterday's reading lives in today's record). */
function answersFor(c: DailyCheckIn, later: readonly DailyCheckIn[] = []): EpisodeAnswer[] {
  return [...(c.resolutions ?? []), ...later.flatMap(x => x.resolutions ?? [])];
}

const R = (code: string, message: string, outcome: Outcome, disposition: Disposition, refuses?: Mode[]): Reason =>
  ({ code, message, outcome, disposition, ...(refuses ? { refuses } : {}) });

const rank = (d: Disposition) => DISPOSITION_ORDER.indexOf(d);

const RELEASE = {
  emergencyFirst: undefined,
  today: 'No exercise today. Contact your care team today, and follow their advice.',
  tomorrow: 'No more exercise today. Try again tomorrow.',
  clinician: 'Ask your clinician before exercising again.',
} as const;

// ─── Time ───────────────────────────────────────────────────────────────────

const time = (iso: string | undefined): number | undefined => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
};
const plusMinutes = (t: number, minutes: number) => new Date(t + minutes * 60_000).toISOString();
/**
 * A time of day as every screen writes it (`timeOf`, scan J2-14). The
 * device's clock preference is read once: the gates label readings across
 * the whole history on every tick.
 */
let hour12: boolean | undefined;
const clock = (t: number | string) => timeOf(t, hour12 ??= prefersHour12());
const minutesApart = (a?: number, b?: number) => (a === undefined || b === undefined ? undefined : (b - a) / 60_000);

// ─── Readings logged outside the check-in (scan X2-01) ──────────────────────

/** Oldest first; one with no time first of all. */
const byMeasured = <T extends GlucoseEntry>(list: readonly T[]): T[] => [...list].sort((a, b) => (time(a.measuredAt) ?? -Infinity) - (time(b.measuredAt) ?? -Infinity));
const byAt = (list: readonly BpReading[]): BpReading[] => [...list].sort((a, b) => (time(a.at) ?? -Infinity) - (time(b.at) ?? -Infinity));

/**
 * The day as every rule must read it: its check-in's readings and the ones
 * logged in Track (`logged`), in one timeline, in the order they were taken.
 * The newest reading is the current one, whichever screen took it and in
 * whatever order it was entered: a 50 logged after a 140 check-in holds
 * movement, a fresh Track reading counts for the 30-minute rule, and a 140
 * timed 09:00 entered after a 320 timed 09:10 does not clear it (R5-03). An
 * untimed current reading keeps its place, since nothing says another came
 * after it. Everything older is an earlier reading of the day, so a serious
 * one still counts and carries.
 *
 * Reading the result again changes nothing (R5-08): the logged readings are
 * folded in once and `logged` is not kept, and a reading the record already
 * holds is not added a second time. The record itself is never changed: what
 * the person answered in the check-in stays theirs.
 */
export function withLogged(c: DailyCheckIn): DailyCheckIn {
  const { logged, ...plain } = c;
  const ownGlucose = [...(plain.glucoseEarlier ?? []), plain.glucose, plain.glucoseDisplay].filter((x): x is GlucoseEntry => !!x);
  const held = new Set(ownGlucose.map(e => glucoseReadingId(e, c.date)));
  const glucose = (logged?.glucose ?? []).filter(e => !held.has(glucoseReadingId(e, c.date)));
  const ownBp: BpReading[] = [...(plain.bpReadings ?? (plain.bp ? [plain.bp] : [])), ...(plain.bpEarlier ?? [])];
  const pressure = (logged?.bp ?? []).filter(r => !ownBp.some(o => o.sys === r.sys && o.dia === r.dia && o.at === r.at));
  let out: DailyCheckIn = plain;
  if (glucose.length) {
    const own: GlucoseEntry[] = [plain.glucose, plain.glucoseDisplay].filter((x): x is GlucoseEntry => !!x);
    const ownLatest = Math.max(-Infinity, ...own.map(e => time(e.measuredAt) ?? -Infinity));
    const sorted = byMeasured(glucose);
    const newest = sorted.at(-1)!;
    if ((time(newest.measuredAt) ?? -Infinity) > ownLatest) {
      const { glucoseDisplay: _shown, ...rest } = plain;
      void _shown;
      out = { ...rest, glucose: newest, glucoseEarlier: byMeasured([...(plain.glucoseEarlier ?? []), ...own, ...sorted.slice(0, -1)]) };
    } else {
      out = { ...plain, glucoseEarlier: byMeasured([...(plain.glucoseEarlier ?? []), ...sorted]) };
    }
  }
  if (pressure.length) {
    const own: BpReading[] = plain.bpReadings?.length ? plain.bpReadings : plain.bp ? [plain.bp] : [];
    const ownLatest = Math.max(-Infinity, ...own.map(r => time(r.at) ?? -Infinity));
    const newer = pressure.filter(r => (time(r.at) ?? -Infinity) > ownLatest);
    const older = pressure.filter(r => !newer.includes(r));
    out = newer.length
      ? { ...out, bpReadings: byAt(newer), bpEarlier: byAt([...(out.bpEarlier ?? []), ...own, ...older]) }
      : { ...out, bpEarlier: byAt([...(out.bpEarlier ?? []), ...older]) };
  }
  return latestTaken(out);
}

/**
 * The glucose reading taken last in the current place (R5-03): one entered
 * after it but timed before it is an earlier reading. Kept as entered when
 * the current reading has no time. The earlier readings are oldest first
 * whatever order they were entered in: the re-check rules count from the
 * first low, and a 58 timed 09:00 typed after a 60 at 09:20 is the first.
 */
function latestTaken(record: DailyCheckIn): DailyCheckIn {
  const c = record.glucoseEarlier ? { ...record, glucoseEarlier: byMeasured(record.glucoseEarlier) } : record;
  const current = [c.glucose, c.glucoseDisplay].filter((x): x is GlucoseEntry => !!x);
  const times = current.map(e => time(e.measuredAt));
  if (!current.length || times.some(t => t === undefined)) return c;
  const at = Math.max(...(times as number[]));
  const later = (c.glucoseEarlier ?? []).filter(e => (time(e.measuredAt) ?? -Infinity) > at);
  if (!later.length) return c;
  const newest = byMeasured(later).at(-1)!;
  const { glucose: _g, glucoseDisplay: _d, ...rest } = c;
  void _g;
  void _d;
  return {
    ...rest,
    ...('display' in newest ? { glucoseDisplay: newest } : { glucose: newest }),
    glucoseEarlier: byMeasured([...(c.glucoseEarlier ?? []).filter(e => e !== newest), ...current]),
  };
}

// ─── Emergency answers ──────────────────────────────────────────────────────

/**
 * The words for "get emergency help", shared by every screen. No telephone
 * number: the number depends on the country, and a UK one would be wrong here.
 */
export const EMERGENCY_CALL = 'Call your local emergency number now; do not drive yourself.';
const CALL = EMERGENCY_CALL;

const EMERGENCY: Record<EmergencyFlag, { code: string; message: string }> = {
  chest: { code: 'chest', message: `Chest pain or pressure, or a racing heartbeat at rest, needs help now. ${CALL}` },
  stroke: { code: 'stroke', message: `Face drooping, arm or leg weakness, slurred speech or a sudden change in vision can be a stroke. ${CALL} Note the time it started.` },
  collapse: { code: 'collapse', message: `Collapsing without coming back to normal needs help now. ${CALL}` },
  breathless: { code: 'breathless', message: `Severe breathlessness that is new needs help now. ${CALL}` },
  bladderBowel: { code: 'caudaEquina', message: `New bladder, bowel, genital or saddle symptoms can mean pressure on the nerves at the base of the spine. This needs emergency assessment now. ${CALL}` },
  saddle: { code: 'caudaEquina', message: `New bladder, bowel, genital or saddle symptoms can mean pressure on the nerves at the base of the spine. This needs emergency assessment now. ${CALL}` },
  bothLegs: { code: 'bothLegs', message: `New weakness or numbness in both legs needs emergency assessment now. ${CALL}` },
  lowCantTreat: { code: 'lowCantTreat', message: `A low that cannot be treated by mouth needs help now. ${CALL} Give nothing to eat or drink if swallowing is not safe. Someone trained can use prescribed glucagon by its own instructions.` },
  dka: { code: 'dka', message: `Vomiting with tummy pain, deep or unusual breathing, fruity breath, or being very drowsy or confused can be diabetic ketoacidosis, even with a normal glucose. This needs emergency assessment now. ${CALL}` },
  accident: { code: 'accident', message: `After a serious accident, get checked before any exercise. ${CALL}` },
  heatConfusion: { code: 'heatConfusion', message: `Confusion or being hard to wake in the heat needs help now. ${CALL}` },
};

function emergencyRules(c: DailyCheckIn): Contribution[] {
  const out: Contribution[] = [];
  for (const flag of c.emergency ?? []) {
    const e = EMERGENCY[flag];
    if (!e) continue;
    out.push({ outcome: 'urgent', disposition: 'emergency', reason: R(e.code, e.message, 'urgent', 'emergency'), ...(flag === 'lowCantTreat' ? { noOral: true } : {}) });
  }
  // Older records asked one question for several emergencies.
  if (c.urgentSymptoms && !(c.emergency?.length)) {
    out.push({
      outcome: 'urgent', disposition: 'emergency',
      reason: R('urgentSymptoms', `Chest pain, unusual breathlessness, a racing heartbeat, sudden weakness or vision change need help now. ${CALL}`, 'urgent', 'emergency'),
    });
  }
  return out;
}

// ─── Back and legs ──────────────────────────────────────────────────────────

const REACH: SymptomReach[] = ['back', 'buttock', 'thigh', 'belowKnee', 'foot'];
/** The movement ids that are walking, as `provoked` names them. */
const WALKING = ['brisk-walking', 'treadmill-walk'];

function backRules(c: DailyCheckIn, recent: DailyCheckIn[]): Contribution[] {
  // An exercise that made symptoms worse during a session is left out for the
  // rest of the day, whatever else is said (A-BACK: stop the provoking movement).
  const provoked: Contribution[] = c.provoked?.length
    ? [{
      outcome: 'amber', disposition: 'adjust', back: 'amber',
      reason: R('provoked', 'Symptoms got worse during an exercise today: it is left out for the rest of the day. Keep to movements that felt fine, and stop anything that makes them worse.', 'amber', 'adjust'),
    }]
    : [];
  // Walking is the movement when the walk's own stop reported it (scan X2-09):
  // the walk does not resume, and no walk starts, for the rest of the day.
  if (c.provoked?.some(id => WALKING.includes(id))) {
    provoked.push({
      outcome: 'amber', disposition: 'adjust', back: 'amber', refuses: ['walk'],
      reason: R('provokedWalk', 'Walking made your leg symptoms worse today: no more walking today. Gentle movement that felt fine is fine.', 'amber', 'adjust', ['walk']),
    });
  }
  // A stretch that sent leg symptoms further down ends stretching for the day,
  // as a walk that did ends walking (scan J2-04).
  if (c.back?.spreadToday && c.provoked?.some(id => getMobility(id))) {
    provoked.push({
      outcome: 'amber', disposition: 'adjust', back: 'amber', refuses: ['stretch'],
      reason: R('provokedStretch', 'A stretch sent your leg symptoms further down today: no more stretching today. Rest, or keep to gentle movement that felt fine, and see your clinician if they stay further down.', 'amber', 'adjust', ['stretch']),
    });
  }
  // Answers already given are always honoured: editing the profile later must
  // not turn a cauda equina flag, or any reported pain, back into a green day.
  if (!c.back) return provoked;
  const b = c.back;
  const out: Contribution[] = [];
  const legPain = b.legPain ?? 0;
  const legReach = b.reach === 'thigh' || b.reach === 'belowKnee' || b.reach === 'foot';
  // Records before v5 asked about numbness, tingling and weakness in one
  // question, so an older "yes" is read as possible weakness.
  const asked = b.newWeakness !== undefined || b.newSensory !== undefined;
  const weakness = b.newWeakness === true || (!asked && b.newNeuro);
  const sensory = !weakness && (b.newSensory === true);
  const nerveFlag = weakness || sensory || b.newNeuro || legPain > 0 || legReach;

  if (b.caudaEquinaFlag) {
    out.push({ outcome: 'urgent', disposition: 'emergency', reason: R('caudaEquina', EMERGENCY.saddle.message, 'urgent', 'emergency') });
  }
  if (weakness && b.weaknessFast) {
    out.push({
      outcome: 'urgent', disposition: 'emergency', back: 'red', nerveFlag: true,
      reason: R('weaknessFast', `Leg weakness that is getting worse over hours or days needs emergency assessment now. ${CALL}`, 'urgent', 'emergency'),
    });
  }
  if (weakness) {
    out.push({
      outcome: 'red', disposition: 'today', back: 'red', nerveFlag: true, release: 'No exercise until a clinician has checked your leg.',
      reason: asked
        ? R('newWeakness', 'New foot drop, foot dragging or a leg getting weaker needs a doctor today. No exercise until you have been checked.', 'red', 'today')
        : R('legacyNeuro', 'New or worse numbness, tingling or weakness in a leg: no exercise today, and get it checked today. Weakness that is getting worse needs a doctor today.', 'red', 'today'),
    });
  }
  if (sensory) {
    // A-BACK: stop what provokes it and keep to what was tolerated. Gentle
    // movement stays open; the full session, with its loading, does not.
    out.push({
      outcome: 'recovery', disposition: 'adjust', back: 'amber', nerveFlag: true, refuses: ['guided'],
      reason: R('newSensory', 'New or worse tingling or numbness in a leg: no workout today. Gentle movement that felt fine before is fine; stop anything that sends symptoms further down. If it does not settle, or it spreads further down your leg, see your clinician — and see a doctor today if weakness starts.', 'recovery', 'adjust', ['guided']),
    });
  }
  // T-BACK. Feeling feverish counts even with a normal temperature.
  // An unanswered pain is no reported pain, as the old default meant.
  const pain = b.pain ?? 0;
  const backPain = pain > 0 || legPain > 0;
  if (b.feverish || (backPain && c.news.includes('unwell'))) {
    out.push({
      outcome: 'red', disposition: 'today', back: 'red', release: RELEASE.today,
      reason: R('backFever', 'Back pain with fever, shivering or feeling unwell needs a doctor today, even if your temperature is normal. No exercise today.', 'red', 'today'),
    });
  }
  if (b.suddenSevere) {
    out.push({
      outcome: 'red', disposition: 'today', back: 'red', release: RELEASE.today,
      reason: R('backSudden', 'Sudden severe back pain, or pain getting worse fast, needs a doctor today. No exercise today.', 'red', 'today'),
    });
  }
  if (b.worseFunction) {
    out.push({
      outcome: 'amber', disposition: 'adjust', back: 'amber', nerveFlag,
      reason: R('worseFunction', 'Walking or sitting is harder than after your last session: no progression today. Keep to movements that felt fine last time.', 'amber', 'adjust'),
    });
  }
  // Said during a session: symptoms now reach further than earlier today (A-BACK).
  if (b.spreadToday) {
    out.push({
      outcome: 'amber', disposition: 'adjust', back: 'amber', nerveFlag: true,
      reason: R('spreadToday', 'Leg symptoms reach further down than earlier today: no progression, and stop anything that sends them further.', 'amber', 'adjust'),
    });
  }
  // Symptoms reaching further down than last time is a worse pattern (A-BACK),
  // whatever the pain score says.
  const previous = [...recent].filter(r => r.date < c.date && r.back?.reach).sort((x, y) => (x.date < y.date ? 1 : -1))[0];
  if (b.reach && previous?.back?.reach && REACH.indexOf(b.reach) > REACH.indexOf(previous.back.reach) && legReach) {
    out.push({
      outcome: 'amber', disposition: 'adjust', back: 'amber', nerveFlag: true,
      reason: R('spread', 'Leg symptoms reach further down than at your last check-in: no progression today, and stop anything that sends them further.', 'amber', 'adjust'),
    });
  }
  // Pain bands are comfort adjustments only and never defer a red flag (D29(7)).
  const worst = Math.max(pain, legPain);
  if (worst > 5) {
    out.push({
      outcome: 'recovery', disposition: 'adjust', back: 'red', nerveFlag,
      reason: R('painRed', 'Pain above 5 out of 10: walking, gentle mobility and nerve glides today, no lifting. See a clinician if it lasts 3 or more days.', 'recovery', 'adjust'),
    });
  } else if (worst >= 3) {
    out.push({
      outcome: 'amber', disposition: 'adjust', back: 'amber', nerveFlag,
      reason: R('painAmber', 'Pain 3 to 5 out of 10: same plan, no progression today, and smaller range on anything that provokes it.', 'amber', 'adjust'),
    });
  } else {
    out.push({ outcome: 'green', back: 'green', nerveFlag });
  }
  if (nerveFlag && worst <= 5 && !weakness && !sensory && !b.newNeuro) {
    out.push({
      outcome: 'green', nerveFlag: true,
      notices: ['Leg symptoms today: nerve sliders only, no long hamstring holds, and stop anything that sends symptoms further down the leg.'],
    });
  }
  return [...provoked, ...out];
}

// ─── Anything else today ────────────────────────────────────────────────────

/**
 * Answers that end exercise for the day they are said, each a `today`:
 * fainting, a high glucose that will not come down, vomiting with diabetes,
 * and a low that needed help. Said earlier today and unticked since
 * (`newsEarlier`), each still holds for the rest of the day, as a red flag
 * does (R5-01): a later answer is about now and releases nothing, and only
 * "I ticked it by mistake" does. Named in the words they were ticked in.
 */
const DAY_ENDING = {
  fainted: 'Fainted today, and back to normal now',
  highNotFalling: 'A high glucose that won’t come down with your usual plan',
  vomiting: 'Vomiting, or can’t keep fluids down',
  lowSevere: 'A low in the last 24 hours that needed someone’s help',
} as const satisfies Partial<Record<NewsItem, string>>;
type DayEnding = keyof typeof DAY_ENDING;
export const endsTheDay = (n: NewsItem): n is DayEnding => Object.hasOwn(DAY_ENDING, n);

/** Those said earlier on the record's day and unticked since. Vomiting ends the day only with diabetes; without, it is a rest until it settles. */
const newsSaidEarlier = (c: DailyCheckIn, d: DerivedHealth): DayEnding[] =>
  [...new Set(Array.isArray(c.newsEarlier) ? c.newsEarlier : [])].filter(endsTheDay).filter(n => !c.news.includes(n) && (n !== 'vomiting' || d.diabetic));

function newsRules(p: UserProfile, c: DailyCheckIn, d: DerivedHealth, recorded: readonly string[] = []): Contribution[] {
  const out: Contribution[] = [];
  const answers = c.resolutions ?? [];
  const earlier: NewsItem[] = newsSaidEarlier(c, d).filter(n => settledAs(newsReadingId(c.date, n), answers) !== 'mistake');
  const has = (n: NewsItem) => c.news.includes(n) || earlier.includes(n);
  const limit = fluidLimit(p.health);

  if (has('unwell')) {
    out.push({
      outcome: 'red', disposition: 'hold', release: 'Rest today. If you feel well again later, change today’s answers.',
      reason: R('unwell', 'Unwell, feverish or shivery: rest today and follow your sick-day plan.', 'red', 'hold'),
      actions: d.ketoneRisk ? ['Check ketones: illness raises the risk of ketoacidosis.'] : [],
    });
  }
  if (has('vomiting')) {
    out.push(d.diabetic
      ? {
        outcome: 'red', disposition: 'today', release: RELEASE.today,
        reason: R('vomiting', 'Vomiting or not keeping fluids down with diabetes: contact your diabetes team or urgent care now. No exercise.', 'red', 'today'),
      }
      : {
        outcome: 'red', disposition: 'hold', release: 'Rest until it has settled. Get advice if it does not.',
        reason: R('vomitingRest', 'Vomiting or not keeping fluids down: rest, and get advice if it does not settle. No exercise.', 'red', 'hold'),
        oral: [limit === 'limited' ? 'Keep to your fluid plan.' : limit === 'free' ? 'Sip fluids if you can.' : 'Sip fluids if you can, unless you have a fluid limit.'],
      });
  }
  if (has('highNotFalling')) {
    out.push({
      outcome: 'red', disposition: 'today', release: RELEASE.today,
      reason: R('highNotFalling', 'A high glucose that will not come down with your usual plan: contact your diabetes team or urgent care now. No exercise.', 'red', 'today'),
    });
  }
  if (has('lowSymptoms')) {
    const sensor = c.glucose?.source === 'sensor';
    out.push({
      outcome: 'red', disposition: 'hold', awaitingReading: true,
      release: 'Check with a meter, treat a low by your plan, and change today’s answers once you feel normal.',
      reason: R('lowSymptoms', `Feeling like a low is coming: check your glucose with a meter now and treat a low by your plan.${sensor ? ' Sensors lag behind, so confirm with a fingerstick.' : ''} No exercise until you feel normal.`, 'red', 'hold'),
    });
  }
  // A past level 3 is not present inability to swallow (D29(2)): review today.
  if (has('lowSevere')) {
    out.push({
      outcome: 'red', disposition: 'today', release: RELEASE.today,
      reason: R('lowNeededHelp', 'A low that needed someone else’s help in the last 24 hours: no exercise today, and contact your care team today.', 'red', 'today'),
    });
  }
  // Lows in the last 24 hours: the answer, or the lows the app itself holds
  // when it holds more (scan J2-01), named so a wrong one can be put right.
  const answered = has('lowTwoPlus') ? 2 : has('lowOne') ? 1 : 0;
  const lows = Math.max(answered, recorded.length);
  const named = recorded.length > answered ? ` Recorded in the app: ${recorded.join(', ')}.` : '';
  if (lows >= 2) {
    out.push({
      outcome: 'red', disposition: 'hold', release: RELEASE.tomorrow,
      reason: R('recentLows', `Two or more lows in the last 24 hours: no exercise today, because another low is more likely. Tell your care team if lows keep happening.${named}`, 'red', 'hold'),
    });
  } else if (lows === 1) {
    out.push({ outcome: 'amber', disposition: 'adjust', modifiers: ['HYPO', 'INT'], reason: R('oneLow', `A low in the last 24 hours: moderate effort, fast carbs within reach, and extra glucose checks.${named}`, 'amber', 'adjust') });
  }
  if (has('fainted')) {
    out.push({
      outcome: 'red', disposition: 'today', release: RELEASE.today,
      reason: R('fainted', 'You fainted today: no exercise, and get medical advice today.', 'red', 'today'),
    });
  }
  // H-DIZZY: a stop whatever the blood pressure.
  if (has('dizzy')) {
    out.push({
      outcome: 'red', disposition: 'hold', release: 'Once the dizziness has passed, change today’s answers. If it keeps happening, get it checked.',
      reason: R('dizzy', 'Dizzy or faint on standing or when active: sit or lie down somewhere safe. No exercise while it lasts, and get it checked if it does not settle or keeps coming back.', 'red', 'hold'),
    });
  }
  if (has('footProblem')) {
    out.push({
      outcome: 'amber', disposition: 'adjust', modifiers: ['FOOT'], refuses: ['walk'],
      reason: R('foot', 'New foot sore or blister: seated and floor work only today, and no walking. Have it looked at promptly.', 'amber', 'adjust', ['walk']),
    });
  }
  if (has('hotSwollenFoot')) {
    out.push({
      outcome: 'amber', disposition: 'adjust', modifiers: ['FOOT'], refuses: ['walk'],
      reason: R('hotFoot', 'A hot, red or swollen foot needs a clinician promptly, today if you can. Seated and floor work only; no walking or standing exercise.', 'amber', 'adjust', ['walk']),
    });
  }
  if (has('unusualFatigue')) {
    out.push({
      outcome: 'red', disposition: 'hold', release: RELEASE.clinician,
      reason: R('fatigue', 'Unusually tired or breathless in everyday activities: rest and check with your clinician before training.', 'red', 'hold'),
    });
  }
  if (has('hot')) {
    out.push({ outcome: 'green', disposition: 'adjust', modifiers: ['HEAT'], notices: [`Hot or humid: shorter, easier cardio, ${limit === 'limited' ? 'fluids by your plan' : limit === 'free' ? 'extra fluids' : 'fluids by your plan if you have one'}, and the coolest spot you can find.`] });
  }
  if (has('steroid') && d.diabetic) {
    out.push({ outcome: 'green', disposition: 'adjust', prep: ['Steroids raise glucose: check before and after the session.'] });
  }
  return out;
}

// ─── Glucose ────────────────────────────────────────────────────────────────

type G =
  | { kind: 'number'; value: number; unit: GlucoseUnit; t?: number; ambiguous: boolean; trend?: string; rapid?: boolean }
  | { kind: 'HI' | 'LO'; t?: number }
  | { kind: 'invalid'; t?: number; unknownUnit: boolean }
  | { kind: 'suspectUnit'; value: number; t?: number };

function readGlucose(e: GlucoseEntry): G {
  const t = time(e.measuredAt);
  if ('display' in e) return e.display === 'HI' || e.display === 'LO' ? { kind: e.display, t } : { kind: 'invalid', t, unknownUnit: false };
  const s = glucoseSanity(e.value, e.unit, e.unitConfirmed === true);
  if (s === 'implausible') return { kind: 'invalid', t, unknownUnit: !isUnit(e.unit) };
  if (s === 'suspectUnit') return { kind: 'suspectUnit', value: e.value, t };
  return { kind: 'number', value: e.value, unit: e.unit, t, ambiguous: s === 'ambiguousLow', trend: e.trend, rapid: e.rapidInsulinLast2h };
}

/** In the reading's own unit, so x/18 mmol/L meets exactly what x mg/dL meets. */
const threshold = (mgdl: number, unit: GlucoseUnit) => (unit === 'mg/dL' ? mgdl : mgdl / MGDL_PER_MMOL);
const below = (g: G, mgdl: number) => g.kind === 'number' && g.value < threshold(mgdl, g.unit);
const atLeast = (g: G, mgdl: number) => g.kind === 'number' && g.value >= threshold(mgdl, g.unit);
const above = (g: G, mgdl: number) => g.kind === 'number' && g.value > threshold(mgdl, g.unit);
const isLow = (g: G) => g.kind === 'LO' || below(g, 70);
const isSevereLow = (g: G) => g.kind === 'LO' || below(g, 54);
const shown = (g: G) => (g.kind === 'number' ? `${formatNumber(g.value)} ${g.unit}` : g.kind === 'LO' ? 'LO' : 'that reading');
const formatNumber = (v: number) => String(Math.round(v * 10) / 10);
/**
 * A glucose level in the person's own unit (D29(1), scan X2-19): x mg/dL, or
 * x/18 mmol/L to one decimal — the line the rules compare against, said the
 * way their meter says it.
 */
const level = (mg: number, unit: GlucoseUnit) => (unit === 'mmol/L' ? `${(mg / MGDL_PER_MMOL).toFixed(1)} mmol/L` : `${formatNumber(mg)} mg/dL`);
export { level as glucoseLevel };
/** The level 1 band, "from 54 to 69 mg/dL", in the person's unit. */
const lowBand = (unit: GlucoseUnit) => (unit === 'mmol/L' ? `from ${level(54, unit).replace(' mmol/L', '')} to under ${level(70, unit)}` : 'from 54 to 69 mg/dL');

/** The current reading or readings, oldest first: a number and a HI/LO display can both be present only in a malformed record. */
function currentGlucose(c: DailyCheckIn): G[] {
  const list = [c.glucose, c.glucoseDisplay].filter((x): x is NonNullable<typeof x> => !!x).map(readGlucose);
  return list.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

/** The level 1 low rescue, word for word wherever the app says it. */
export const TREAT = 'Take 15 g of fast-acting carbohydrate now, re-check in 15 minutes, and repeat if still low.';

/**
 * What goes with `TREAT` wherever it is shown: someone who is confused or
 * cannot swallow safely is never told to eat or drink (E-HYPO). Always shown
 * with the emergency call (`PERMISSION_TEXT.emergencyTitle`, `emergencyCall`).
 */
export const CANNOT_SWALLOW = {
  title: 'If you feel confused or cannot swallow safely',
  line: 'Do not eat or drink, and ask someone nearby for help.',
} as const;

/** Readings closer together than this are one low episode: its re-checks, a treatment, the next check (X2-08). */
const EPISODE_GAP_MINUTES = 120;

/**
 * The previous day's readings that lead into today's, for a low that runs
 * past midnight (scan X2-08): chained back from today's first reading, each
 * no more than two hours before the next. Readings answered as mistakes are
 * left out, as they are on their own day.
 */
function leadIn(previous: DailyCheckIn | undefined, firstToday: number | undefined, answers: readonly EpisodeAnswer[]): G[] {
  if (!previous || firstToday === undefined) return [];
  const view = withLogged(previous);
  const said = [...answers, ...(view.resolutions ?? [])];
  const entries = [...(view.glucoseEarlier ?? []), ...[view.glucose, view.glucoseDisplay].filter((x): x is GlucoseEntry => !!x)]
    .filter(e => settledAs(glucoseReadingId(e, view.date), said) !== 'mistake')
    .map(readGlucose)
    .filter(g => g.t !== undefined)
    .sort((a, b) => b.t! - a.t!);
  const chained: G[] = [];
  let cursor = firstToday;
  for (const g of entries) {
    if (cursor - g.t! > EPISODE_GAP_MINUTES * 60_000) break;
    chained.unshift(g);
    cursor = g.t!;
  }
  return chained;
}

/** "Lows in the last 24 hours" counts the app's own record as well as the answer (scan J2-01). */
const LOW_WINDOW_HOURS = 24;

/**
 * The lows the app itself holds from the 24 hours before `now`, named as the
 * sheet names readings: today's and earlier days', the check-in's and
 * Track's alike. Readings under 70 with no recovery between them and no more
 * than two hours apart are one low, as a re-check belongs to its low. A
 * reading answered as a typing mistake is none. Without `now`, the window
 * starts a day before `checkIn.date` does, which can only count more; an
 * untimed reading counts as late in its day as it could be.
 */
export function recordedLows(checkIn: DailyCheckIn, recent: readonly DailyCheckIn[], now?: Date): string[] {
  const from = (now?.getTime() ?? dayStart(checkIn.date)) - LOW_WINDOW_HOURS * 3_600_000;
  // Only the days that can hold a reading that recent, whatever the history's length.
  const start = new Date(from);
  const firstDay = previousDay(`${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`);
  const days = [...recent.filter(r => r.date < checkIn.date && r.date >= firstDay), checkIn].sort((a, b) => a.date.localeCompare(b.date));
  const readings = days.flatMap((day, i) => {
    const view = withLogged(day);
    const said = answersFor(view, days.slice(i + 1));
    return [...(view.glucoseEarlier ?? []), view.glucose, view.glucoseDisplay]
      .filter((e): e is GlucoseEntry => !!e && settledAs(glucoseReadingId(e, view.date), said) !== 'mistake')
      .map(e => ({ e, g: readGlucose(e), day: view.date, t: time(e.measuredAt) ?? dayEnd(view.date) }));
  }).filter(x => x.t >= from).sort((a, b) => a.t - b.t);
  const lows: string[] = [];
  let last: number | undefined;
  for (const x of readings) {
    if (atLeast(x.g, 70)) last = undefined;
    if (!isLow(x.g)) continue;
    if (last === undefined || x.t - last > EPISODE_GAP_MINUTES * 60_000) lows.push(`${glucoseLabel(x.e)}${when(x.e.measuredAt, x.day, checkIn.date)}`);
    last = x.t;
  }
  return lows;
}

function glucoseRules(p: UserProfile, c: DailyCheckIn, d: DerivedHealth, ketones: KetoneLevel | undefined, recent: readonly DailyCheckIn[] = []): Contribution[] {
  const out: Contribution[] = [];
  const answers = c.resolutions ?? [];
  const u = p.health.glucoseUnit ?? 'mg/dL';
  // A reading the person said they typed wrongly never happened: it counts for nothing (B01).
  const kept = (c.glucoseEarlier ?? []).filter(e => settledAs(glucoseReadingId(e, c.date), answers) !== 'mistake');
  const earlier = kept.map(readGlucose);
  const current = currentGlucose(c);
  const latest = current.at(-1);
  const today = [...earlier, ...current];
  const firstToday = today.reduce<number | undefined>((m, g) => (g.t !== undefined && (m === undefined || g.t < m) ? g.t : m), undefined);
  // A low just before midnight belongs to the same episode as the readings after it (X2-08).
  const prior = leadIn(recent.find(r => r.date === previousDay(c.date)), firstToday, answers);
  const all = [...prior, ...today];
  const startMin = glucoseStartMin(p.health);
  // After a treated low, start only once 90 or above, or the care team's start
  // level if that is higher (diabetes-hypertension-exercise.md §1.3, 54–69 row).
  const afterLowMin = Math.max(90, startMin);
  const firstLow = all.findIndex(isLow);
  const severeEarlierEntries = kept.filter(e => isSevereLow(readGlucose(e)));
  const severeEarlier = severeEarlierEntries.length > 0;

  // ── A required reading that is missing or unusable (H-DATA) ──
  if (!latest) {
    if (d.hypoRisk) {
      out.push({
        outcome: 'red', disposition: 'hold', awaitingReading: true, release: 'Check your glucose and add the reading.',
        reason: R('noReading', 'No glucose reading: with insulin or a sulfonylurea, check your glucose before you start.', 'red', 'hold'),
      });
    }
  } else if (latest.kind === 'invalid') {
    out.push({
      outcome: 'red', disposition: 'hold', awaitingReading: true, release: 'Enter the reading again.',
      reason: latest.unknownUnit
        ? R('readingInvalid', 'That glucose reading has no unit the app recognises. Enter it again in mg/dL or mmol/L.', 'red', 'hold')
        : R('readingInvalid', 'That glucose reading cannot be used. Measure again and enter the number your meter shows.', 'red', 'hold'),
    });
  } else if (latest.kind === 'suspectUnit') {
    // Either way this number is serious: as mmol/L it is an extreme high, and
    // under 54 as mg/dL it is a severe low. So it holds and says both, rather
    // than being read as the gentler one (Codex re-audit F10).
    const n = formatNumber(latest.value);
    const asMmol = latest.value * MGDL_PER_MMOL;
    const lowIfMgdl = latest.value < 54;
    const serious = asMmol >= 600 || lowIfMgdl;
    out.push({
      outcome: 'red', disposition: serious ? 'today' : 'hold',
      awaitingReading: true, release: serious ? RELEASE.today : 'Confirm the unit and enter the reading again.',
      reason: R('suspectUnit', `${n} does not look like mmol/L. ${asMmol >= 600 ? `If it really is ${n} mmol/L, that is extremely high and needs emergency assessment now. ` : ''}${lowIfMgdl ? `If your meter shows ${n} mg/dL, that is a severe low. ` : `If your meter shows ${n} mg/dL, change the unit. `}No exercise until the unit is confirmed.`, 'red', serious ? 'today' : 'hold'),
      oral: lowIfMgdl ? [`If it is ${n} mg/dL, treat it as a low: ${TREAT}`] : [],
    });
  } else if (latest.kind === 'HI') {
    const again = earlier.some(g => g.kind === 'HI');
    out.push(again
      ? {
        outcome: 'red', disposition: 'today', release: RELEASE.today,
        reason: R('persistentHi', 'Your meter has read HI more than once: contact your diabetes team or urgent care now. No exercise.', 'red', 'today'),
        actions: d.ketoneRisk ? ['Check ketones now.'] : [],
      }
      : {
        outcome: 'red', disposition: 'hold', awaitingReading: true, release: 'Check again and add the new reading.',
        reason: R('meterHi', 'Your meter says HI, higher than it can measure. Wash and dry your hands and check again. If it still says HI, contact your diabetes team or urgent care now.', 'red', 'hold'),
        actions: d.ketoneRisk ? ['Check ketones now.'] : [],
      });
  }

  // ── Level 2 at any point today ends today (T-HYPO-REVIEW) ──
  if (latest && isSevereLow(latest)) {
    const typed = latest.kind === 'number' && latest.ambiguous ? formatNumber(latest.value) : undefined;
    // A meter that reads LO shows no number, so it is never told one.
    const shownLow = latest.kind === 'LO'
      ? 'Your meter shows LO, lower than it can measure. Treat this as a severe low now. No exercise today, and contact your care team today.'
      : typed
        ? `A reading of ${typed} is a severe low. No exercise today, and contact your care team today.`
        : `Glucose below ${level(54, u)} is a severe low. No exercise today, and contact your care team today.`;
    out.push({
      outcome: 'red', disposition: 'today', release: RELEASE.today,
      reason: R('severeLow', shownLow, 'red', 'today'),
      oral: [`${TREAT} Then eat.`],
      actions: typed ? [`If you meant ${typed} mmol/L, change the unit and check in again.`] : [],
      ...(latest.t !== undefined ? { recheckAt: plusMinutes(latest.t, RECHECK_MINUTES) } : {}),
    });
  } else if (severeEarlier) {
    // Seen by a clinician or not, a severe low ends the day's exercise (D29(3)).
    const seen = severeEarlierEntries.every(e => settledAs(glucoseReadingId(e, c.date), answers) === 'assessed');
    out.push({
      outcome: 'red', disposition: 'today', release: RELEASE.today, ...(seen ? {} : { unresolved: 'severeLow' as const }),
      reason: seen
        ? R('severeLowAssessed', 'A clinician has checked that severe low from earlier today: no more exercise today, and follow their advice.', 'red', 'today')
        : R('severeLowEarlier', `Your glucose was below ${level(54, u)} earlier today: no more exercise today, and contact your care team today.`, 'red', 'today'),
    });
  }

  // ── An extreme reading earlier today is still an extreme reading ──
  // Replacing it with a lower number is not a correction and not an
  // assessment. Each extreme reading is its own incident: an answer about one
  // never settles another taken later (F10, round 3 B01).
  const extremeEarlier = kept.filter(e => atLeast(readGlucose(e), 600));
  if (extremeEarlier.length && !(latest && atLeast(latest, 600))) {
    const open = extremeEarlier.filter(e => settledAs(glucoseReadingId(e, c.date), answers) === undefined);
    out.push(open.length
      ? {
        outcome: 'urgent', disposition: 'emergency', unresolved: 'extremeGlucose',
        reason: R('extremeGlucoseEarlier', `A glucose reading of ${level(600, u)} or more earlier today still needs emergency assessment. ${CALL} If you typed it by mistake, say so in today’s answers.`, 'urgent', 'emergency'),
      }
      : {
        outcome: 'red', disposition: 'today', release: RELEASE.tomorrow,
        reason: R('extremeGlucoseAssessed', 'A clinician has seen that very high reading from earlier today: no exercise today, and follow their advice.', 'red', 'today'),
      });
  }

  // ── "Feeling like a low is coming" needs a reading taken after it ──
  // A reading from before the symptoms says nothing about them, so with a
  // meter or sensor only a later one can settle the report (round 3 B06).
  const reported = time(c.lowSymptomsAt);
  if (reported !== undefined && p.health.glucoseMonitor !== 'none') {
    const since = all.filter(g => g.kind !== 'invalid' && g.kind !== 'suspectUnit' && g.t !== undefined && g.t >= reported);
    if (!since.length) {
      out.push({
        outcome: 'red', disposition: 'hold', awaitingReading: true, release: 'Check your glucose now and enter the reading.',
        reason: R('lowReported', `You said you feel low. Check your glucose now and enter the reading. If you cannot check, treat it as a low: ${TREAT}`, 'red', 'hold'),
        oral: [TREAT],
      });
    }
  }

  // ── Still under 70 at the 15-minute re-check, or low again after recovering (D29(3)) ──
  let repeated = false;
  for (let j = firstLow + 1; firstLow >= 0 && j < all.length && !repeated; j++) {
    if (!isLow(all[j])) continue;
    const recoveredBetween = all.slice(firstLow + 1, j).some(g => atLeast(g, 70));
    const gap = minutesApart(all[firstLow].t, all[j].t);
    // Without both times, the re-check is taken to be the 15-minute one: the stricter reading.
    repeated = recoveredBetween || gap === undefined || gap >= RECHECK_MINUTES;
  }
  if (repeated) {
    const stillLow = !!latest && isLow(latest);
    out.push({
      outcome: 'red', disposition: 'hold', release: RELEASE.tomorrow,
      reason: R('lowRepeat', `Your glucose was still under ${level(70, u)} when you re-checked, or went low again after recovering. That ends exercise for today. Keep treating it by your plan, and tell your care team if lows keep happening.`, 'red', 'hold'),
      oral: stillLow ? [TREAT] : [],
      ...(stillLow && latest?.t !== undefined ? { recheckAt: plusMinutes(latest.t, RECHECK_MINUTES) } : {}),
    });
  }

  if (latest?.kind === 'number') {
    const lowBefore = (i: number) => firstLow >= 0 && firstLow < i;
    /** A reading that asked for a re-check when it was taken. */
    const askedRecheck = (g: G, i: number) => isLow(g)
      || (d.hypoRisk && below(g, startMin))
      || (lowBefore(i) && below(g, afterLowMin))
      || (d.hypoRisk && g.kind === 'number' && (g.trend === 'slowFall' || g.trend === 'fastFall') && below(g, 126));
    const last = all.length - 1;
    const lowEarlierToday = lowBefore(last);
    const releaseMin = lowEarlierToday ? afterLowMin : startMin;
    const latestAsks = askedRecheck(latest, last);

    // ── The extreme high (E-EXTREME-GLUCOSE) ──
    if (atLeast(latest, 600)) {
      out.push({
        outcome: 'urgent', disposition: 'emergency',
        reason: R('extremeGlucose', `Glucose ${shown(latest)}: ${level(600, u)} or more needs emergency assessment now. ${CALL} No exercise.`, 'urgent', 'emergency'),
      });
    }

    if (isLow(latest) && !isSevereLow(latest) && !repeated) {
      // ── A level 1 low now: treat, then a real re-check (H-HYPO) ──
      const episodeStart = all[firstLow] ?? latest;
      out.push({
        outcome: 'amber', disposition: 'hold', modifiers: ['HYPO', 'INT'], recheckMinutes: RECHECK_MINUTES, awaitingReading: true,
        ...(episodeStart.t !== undefined ? { recheckAt: plusMinutes(episodeStart.t, RECHECK_MINUTES) } : {}),
        release: `Treat it, then re-check in 15 minutes. Start only when you are ${level(afterLowMin, u)} or above and feel fine.`,
        reason: R('low', `Glucose ${shown(latest)}, ${lowBand(u)}, is a low. Start only when you are ${level(afterLowMin, u)} or above and feel fine.`, 'amber', 'hold'),
        oral: [TREAT],
      });
    } else if (!isLow(latest)) {
      // ── A reading that would release an earlier one must be a real re-check ──
      const pending = latestAsks ? undefined : all.slice(0, last).map((g, i) => [g, i] as const).reverse().find(([g, i]) => askedRecheck(g, i))?.[0];
      let recheckProblem = false;
      if (pending && !repeated && !severeEarlier) {
        if (pending.t === undefined) {
          // Without the earlier reading's time, nothing proves the wait happened (F08/L01).
          recheckProblem = true;
          out.push({
            outcome: 'amber', disposition: 'hold', modifiers: ['HYPO'], recheckMinutes: RECHECK_MINUTES, awaitingReading: true,
            release: 'Add the time of the earlier reading, or check again now and enter that reading with its time.',
            reason: R('recheckUnknownTime', 'The earlier reading has no time, so there is nothing to show the 15 minutes have passed. Check again now and enter the new reading with its time.', 'amber', 'hold'),
          });
        } else if (latest.t === undefined || latest.t <= pending.t) {
          recheckProblem = true;
          out.push({
            outcome: 'amber', disposition: 'hold', modifiers: ['HYPO'], recheckMinutes: RECHECK_MINUTES, awaitingReading: true,
            release: 'Add the new reading with the time you took it.',
            reason: R('recheckNoTime', 'The new reading needs the time you took it, after the earlier one, before it can count as a re-check.', 'amber', 'hold'),
          });
        } else if (pending.t !== undefined && latest.t !== undefined && (latest.t - pending.t) / 60_000 < RECHECK_MINUTES) {
          recheckProblem = true;
          const due = pending.t + RECHECK_MINUTES * 60_000;
          out.push({
            outcome: 'amber', disposition: 'hold', modifiers: ['HYPO'], recheckMinutes: RECHECK_MINUTES, recheckAt: new Date(due).toISOString(),
            awaitingReading: true, release: `Check again at ${clock(due)}.`,
            reason: R('tooSoon', `That re-check came less than 15 minutes after the earlier reading. Check again at ${clock(due)}.`, 'amber', 'hold'),
          });
        }
      }

      if (!recheckProblem && below(latest, releaseMin) && (d.hypoRisk || lowEarlierToday)) {
        // ── Below the start level for someone who can go low (H-PRE-LOW) ──
        out.push({
          outcome: 'green', disposition: 'hold', modifiers: ['HYPO'], recheckMinutes: RECHECK_MINUTES, awaitingReading: true,
          ...(latest.t !== undefined ? { recheckAt: plusMinutes(latest.t, RECHECK_MINUTES) } : {}),
          release: `Re-check in 15 minutes. Start once you are ${level(releaseMin, u)} or above.`,
          // Whose number this is, said plainly: the care team's own, or the
          // standard one for these medicines, or the level after a low.
          reason: R('belowStart', `Glucose under ${level(releaseMin, u)}, ${lowEarlierToday && releaseMin > startMin
            ? 'the level to reach after a low'
            : glucoseStartIsCareTeams(p.health) ? 'your care team’s start level' : 'the start level with your medicines'}: follow your exercise plan, wait 15 minutes, then check again.`, 'green', 'hold'),
          prep: ['Keep fast-acting carbohydrate within reach, and have the carbs your plan sets before exercise.'],
        });
      } else if (!recheckProblem && lowEarlierToday && !repeated && !c.lowRecovered) {
        // Crossing 70 never releases on its own (H-HYPO): symptoms and the plan must agree.
        out.push({
          outcome: 'amber', disposition: 'hold', modifiers: ['HYPO', 'INT'], awaitingReading: true,
          release: 'Once your symptoms have gone and your care plan allows exercise after a treated low, say so in today’s answers.',
          reason: R('lowNotRecovered', `Your glucose is back to ${shown(latest)}. Start only once your symptoms have gone and your care plan allows exercise after a treated low.`, 'amber', 'hold'),
        });
      } else if (!recheckProblem && lowEarlierToday && !repeated) {
        out.push({
          outcome: 'amber', disposition: 'adjust', modifiers: ['HYPO', 'INT'],
          reason: R('afterLow', 'After a treated low: moderate effort, fast carbs within reach, and check again before cardio.', 'amber', 'adjust'),
        });
      }

      if (d.hypoRisk) {
        const carbBelow = p.health.highHypoRisk ? 162 : 126;
        if (!below(latest, startMin) && below(latest, carbBelow)) {
          out.push({
            outcome: 'green', disposition: 'adjust', modifiers: ['HYPO'],
            prep: [`Under ${level(carbBelow, u)}: keep fast-acting carbohydrate within reach, follow your plan for carbs before exercise, and check again before cardio.`],
          });
        }
        if ((latest.trend === 'slowFall' || latest.trend === 'fastFall') && below(latest, 126)) {
          out.push({
            outcome: 'green', disposition: 'hold', modifiers: ['HYPO'], recheckMinutes: RECHECK_MINUTES, awaitingReading: true,
            ...(latest.t !== undefined ? { recheckAt: plusMinutes(latest.t, RECHECK_MINUTES) } : {}),
            release: 'Wait 15 minutes, then check again.',
            reason: R('falling', 'Your glucose is falling: wait 15 minutes, follow your exercise plan, then check again before starting.', 'green', 'hold'),
          });
        }
        if (latest.rapid) {
          out.push({
            outcome: 'green', disposition: 'adjust', modifiers: ['HYPO'],
            prep: ['Rapid-acting insulin in the last 2 hours makes a low more likely: follow your plan for exercise after a dose, and check before cardio.'],
          });
        }
      }

      // ── Highs ──
      // A high reading is movement preparation, not a verdict on the reading:
      // whether it is in range needs a meal context this check-in does not
      // hold (Codex re-audit, decision 1).
      if (above(latest, 180) && below(latest, 600)) {
        out.push({ outcome: 'green', disposition: 'adjust', prep: [fluidLine(p, `Glucose over ${level(180, u)}: strength work can push it a little higher.`)] });
      }
      const usableKetones = ketones !== undefined && ketones !== 'invalid';
      if (d.ketoneRisk && atLeast(latest, 250) && !usableKetones) {
        out.push({
          outcome: 'red', disposition: 'hold', awaitingReading: true,
          release: 'Test ketones and add the result. If you cannot test, follow your care team’s plan.',
          reason: R('noKetones', `Glucose ${level(250, u)} or higher without a ketone result: test ketones before any exercise. If you cannot test, follow your care team’s plan.`, 'red', 'hold'),
          actions: ['Test ketones if you can.'],
        });
      }
      // H-T2-HIGH: a workout is never a treatment for a high.
      if (p.health.diabetes !== 'type1' && above(latest, 300) && below(latest, 600)) {
        out.push({
          outcome: 'red', disposition: 'hold', awaitingReading: true, release: `Check again later; exercise once it is ${level(300, u)} or lower and you feel well.`,
          reason: R('high', `Glucose above ${level(300, u)}: no exercise session until it is lower. Follow your care team’s plan and check again.`, 'red', 'hold'),
          oral: [fluidLine(p, `Glucose over ${level(300, u)}.`)],
        });
      } else if (d.diabetic && ketones === 'negative' && above(latest, 270)) {
        out.push({ outcome: 'amber', disposition: 'adjust', modifiers: ['INT', 'LOAD'], reason: R('veryHighGlucose', `Glucose above ${level(270, u)} with negative ketones: lighter, mostly aerobic work today.`, 'amber', 'adjust') });
      }
    }
  }
  return out;
}

// ─── Ketones ────────────────────────────────────────────────────────────────

type KetoneLevel = 'invalid' | 'negative' | 'positive' | 'high' | 'urgent';

const URINE: UrineKetoneCategory[] = ['negative', 'trace', 'small', 'moderate', 'large'];

/**
 * The old sheet stored a number for each strip colour (0, 5, 15, 40, 80).
 * That is decoded back to its strip category, never to blood ketones; a
 * number between two markings is read as the higher one.
 */
function urineCategory(k: Extract<KetoneReading, { kind: 'urine' }>): UrineKetoneCategory | undefined {
  if (k.category !== undefined) return URINE.includes(k.category) ? k.category : undefined;
  const v = k.value;
  if (v === undefined || !Number.isFinite(v) || v < 0) return undefined;
  return v === 0 ? 'negative' : v <= 5 ? 'trace' : v <= 15 ? 'small' : v <= 40 ? 'moderate' : 'large';
}

function ketoneLevel(k: KetoneReading): { level: KetoneLevel; label: string } {
  if (k.kind === 'blood') {
    if (typeof k.value !== 'number' || !Number.isFinite(k.value) || k.value < 0) return { level: 'invalid', label: '' };
    const label = `${formatNumber(k.value)} mmol/L`;
    return { level: k.value >= 3 ? 'urgent' : k.value >= 1.5 ? 'high' : k.value >= 0.6 ? 'positive' : 'negative', label };
  }
  if (k.kind === 'urine') {
    const cat = urineCategory(k);
    if (!cat) return { level: 'invalid', label: '' };
    const label = `${cat} on a urine strip`;
    return { level: cat === 'moderate' || cat === 'large' ? 'urgent' : cat === 'negative' ? 'negative' : 'positive', label };
  }
  return { level: 'invalid', label: '' };
}

function ketoneRules(c: DailyCheckIn): { contributions: Contribution[]; level?: KetoneLevel } {
  const out: Contribution[] = [];
  const unwell = c.news.includes('unwell') || c.news.includes('vomiting');
  const current = c.ketones ? ketoneLevel(c.ketones) : undefined;

  if (current) {
    const { level, label } = current;
    if (level === 'invalid') {
      out.push({
        outcome: 'red', disposition: 'hold', awaitingReading: true, release: 'Enter the ketone reading again.',
        reason: R('ketonesInvalid', 'That ketone reading cannot be used: check it and enter it again.', 'red', 'hold'),
      });
    } else if (level === 'urgent') {
      out.push({
        outcome: 'urgent', disposition: 'emergency',
        reason: R('ketonesUrgent', `Ketones ${label}: this needs emergency assessment now, whatever your glucose. ${CALL}`, 'urgent', 'emergency'),
      });
    } else if (level === 'high') {
      out.push({
        outcome: 'red', disposition: 'today', release: RELEASE.today,
        reason: R('ketonesHigh', `Ketones ${label}: no exercise. Follow your ketone plan and contact your diabetes team today.`, 'red', 'today'),
      });
    } else if (level === 'positive') {
      out.push({
        outcome: 'red', disposition: 'hold', release: 'Re-check ketones in 2 hours. Exercise again only when your care plan says so.',
        reason: R('ketonesTrace', `Ketones ${label}: no exercise. Follow your sick-day plan, re-check in 2 hours, and contact your diabetes team straight away if you feel unwell.`, 'red', 'hold'),
      });
    }
    if (unwell && (level === 'positive' || level === 'high')) {
      out.push({
        outcome: 'red', disposition: 'today', release: RELEASE.today,
        reason: R('illnessKetones', 'Positive ketones while unwell: contact your diabetes team or urgent care now. No exercise.', 'red', 'today'),
      });
    }
  }

  /**
   * A positive result earlier today keeps the action it asked for: a later
   * strip is not an assessment, and an emergency does not quietly become
   * "contact today" because the next reading was lower (Codex re-audit F11).
   * Being unwell escalates the unresolved episode too, not only the current
   * reading. Only the person saying it was a mistake, or that a clinician has
   * seen it, settles it.
   */
  const answers = c.resolutions ?? [];
  const order: KetoneLevel[] = ['invalid', 'negative', 'positive', 'high', 'urgent'];
  const worstOf = (levels: KetoneLevel[]) =>
    levels.reduce<KetoneLevel | undefined>((w, l) => (w === undefined || order.indexOf(l) > order.indexOf(w) ? l : w), undefined);
  // Each positive reading is its own incident; one the person typed wrongly never happened (round 3 B01).
  const positive = (c.ketonesEarlier ?? [])
    .filter(k => settledAs(ketoneReadingId(k, c.date), answers) !== 'mistake')
    .map(k => ({ id: ketoneReadingId(k, c.date), level: ketoneLevel(k).level }))
    .filter(x => x.level === 'positive' || x.level === 'high' || x.level === 'urgent');
  const open = positive.filter(x => settledAs(x.id, answers) === undefined);
  const worst = worstOf(open.map(x => x.level));
  const currentLevel = current?.level;
  const alreadySaid = (level: KetoneLevel) => currentLevel === level
    || (level === 'positive' && (currentLevel === 'high' || currentLevel === 'urgent'))
    || (level === 'high' && currentLevel === 'urgent');
  if (positive.length && !open.length) {
    out.push({
      outcome: 'red', disposition: 'today', release: RELEASE.tomorrow,
      reason: R('ketonesAssessed', 'A clinician has seen the ketone result from earlier today: no exercise today, and follow their advice.', 'red', 'today'),
    });
  } else if (worst && !alreadySaid(worst)) {
    if (worst === 'urgent') {
      out.push({
        outcome: 'urgent', disposition: 'emergency', unresolved: 'ketones',
        reason: R('ketonesEarlierUrgent', `Ketones were at the emergency level earlier today, and that still needs emergency assessment. ${CALL} If you typed the reading by mistake, say so in today’s answers.`, 'urgent', 'emergency'),
      });
    } else if (worst === 'high') {
      out.push({
        outcome: 'red', disposition: 'today', release: RELEASE.today, unresolved: 'ketones',
        reason: R('ketonesEarlier', 'Ketones were high earlier today: no exercise today, and contact your diabetes team today.', 'red', 'today'),
      });
    } else {
      out.push({
        outcome: 'red', disposition: unwell ? 'today' : 'hold', unresolved: 'ketones',
        release: unwell ? RELEASE.today : 'Exercise again only when your care plan says so.',
        reason: unwell
          ? R('illnessKetonesEarlier', 'A positive ketone reading earlier today, and you feel unwell: contact your diabetes team or urgent care now. No exercise.', 'red', 'today')
          : R('ketonesEarlierTrace', 'A positive ketone reading earlier today: no exercise until your care plan says so.', 'red', 'hold'),
      });
    }
  }
  return { contributions: out, ...(current ? { level: current.level } : {}) };
}

// ─── Blood pressure ─────────────────────────────────────────────────────────

const sysUsable = (n: number) => Number.isFinite(n) && n >= 40 && n <= 300;
const diaUsable = (n: number) => Number.isFinite(n) && n >= 20 && n <= 200;
const validBp = (r: BpReading) => sysUsable(r.sys) && diaUsable(r.dia);
const severe = (r: BpReading) => r.sys >= 180 || r.dia >= 120;
/** What can be used of a reading whose other number cannot, such as 190/10: a top number of 190 (R5-06). */
const usableHalf = (r: BpReading): BpPartialReading => ({ ...(sysUsable(r.sys) ? { sys: r.sys } : {}), ...(diaUsable(r.dia) ? { dia: r.dia } : {}), ...(r.at ? { at: r.at } : {}) });

/** What was severe in one reading: the number at or over its line, or both. */
const severeIn = (r: BpReading) => (r.sys >= 180 && r.dia >= 120 ? `${r.sys}/${r.dia}` : r.sys >= 180 ? `top number ${r.sys}` : `bottom number ${r.dia}`);

/** A severe number in one box, with the other empty. Out-of-range numbers are not readings. */
const severePartial = (r: BpPartialReading) =>
  (r.sys !== undefined && Number.isFinite(r.sys) && r.sys >= 180 && r.sys <= 300)
  || (r.dia !== undefined && Number.isFinite(r.dia) && r.dia >= 120 && r.dia <= 200);
const partialNamed = (r: BpPartialReading) => (r.sys !== undefined && r.sys >= 180 ? `Your top number is ${r.sys}` : `Your bottom number is ${r.dia}`);

/** The message names the number that tripped: on BP medication only one of the two is often high. */
function which(r: BpReading, hiSys: number, hiDia: number): string {
  return r.sys >= hiSys && r.dia >= hiDia ? `Blood pressure ${r.sys} over ${r.dia}`
    : r.sys >= hiSys ? `Your top number is ${r.sys}`
      : `Your bottom number is ${r.dia}`;
}

/**
 * What may be said about drinking (contract H-DIZZY; Codex re-audit F13).
 *
 * A prescribed fluid limit can come from the heart as well as the kidneys, so
 * it is its own recorded answer. Told there is one, the app never suggests
 * extra fluids; told there is none, it can; not told, it says it conditionally.
 * No amount is ever prescribed either way.
 */
export function fluidLimit(h: HealthProfile): 'limited' | 'free' | 'unknown' {
  if (takes(h.fluidRestriction) || h.kidneyDisease !== 'none') return 'limited';
  // A diuretic that has not been asked about leaves the advice conditional
  // rather than plain: on one the balance of fluids is a clinician's call.
  if (h.fluidRestriction === false && !bpMedicinesUnknown(h)) return 'free';
  return 'unknown';
}

/** `sentence` with the drinking advice this profile may be given, if any. */
function fluidLine(p: UserProfile, sentence: string): string {
  const limit = fluidLimit(p.health);
  if (limit === 'limited') return `${sentence} Keep to your fluid plan.`;
  return `${sentence} ${limit === 'free' ? 'Drink some water.' : 'Drink some water unless you have a fluid limit.'}`;
}

const BP_EMERGENCY_SIGNS = 'chest or back pain, breathlessness, confusion, weakness, numbness, a change in vision or trouble speaking';

function bpRules(p: UserProfile, c: DailyCheckIn): Contribution[] {
  const answers = c.resolutions ?? [];
  // A reading the person said they typed wrongly never happened (round 3 B01).
  const live = (r: BpReading) => settledAs(bpReadingId(r, c.date), answers) !== 'mistake';
  // Each reading is judged on its own, before any average (contract, boundary
  // tests). One taken after the readings the record holds as current is
  // current too, whatever order they were entered in (R5-03); with no time on
  // the current ones, nothing says another came after them.
  const own: BpReading[] = c.bpReadings?.length ? c.bpReadings : c.bp ? [c.bp] : [];
  const ownTimes = own.map(r => time(r.at));
  const ownLatest = own.length && ownTimes.every(t => t !== undefined) ? Math.max(...(ownTimes as number[])) : undefined;
  const later = ownLatest === undefined ? [] : (c.bpEarlier ?? []).filter(r => (time(r.at) ?? -Infinity) > ownLatest && live(r));
  const all: BpReading[] = [...own, ...later];
  const out: Contribution[] = [];
  if (all.some(r => !validBp(r))) {
    out.push({
      outcome: 'red', disposition: 'hold', awaitingReading: true, release: 'Check the reading and enter it again.',
      reason: R('bpInvalid', 'A blood pressure reading cannot be used: check it and enter it again.', 'red', 'hold'),
    });
  }
  const readings = all.filter(validBp);
  const earlierSevere = (c.bpEarlier ?? []).filter(r => !later.includes(r) && validBp(r) && severe(r) && live(r));
  const severeNow = readings.filter(severe);
  // One severe number with the other box empty (B07): it counts on its own,
  // and the missing half is never invented. So does a usable severe number in
  // a reading whose other number cannot be used, such as 190/10 (R5-06), and
  // still once the reading has been replaced, as a valid 190/100 would. Like
  // a half-entered reading, it does not confirm another: a typo corrected to
  // 190/100 is one measurement, not two.
  const halves: BpPartialReading[] = all.filter(r => !validBp(r)).map(usableHalf).filter(severePartial);
  const earlierHalves = (c.bpEarlier ?? []).filter(r => !later.includes(r) && !validBp(r) && severePartial(usableHalf(r)) && live(r));
  const partial = [...(c.bpPartial ?? []).filter(r => severePartial(r) && settledAs(bpPartialId(r, c.date), answers) !== 'mistake'), ...halves];
  const dizzy = c.news.includes('dizzy') || c.news.includes('fainted');
  // New numbness or weakness reported in the back questions of the same
  // check-in is one of the signs the severe reading's own message names (E-BP, scan X2-06).
  const b = c.back;
  const newNerve = b?.newSensory === true || b?.newWeakness === true || (b?.newNeuro === true && b.newWeakness === undefined && b.newSensory === undefined);
  const acute = c.bpSymptoms === true || b?.suddenSevere === true || newNerve
    || (c.emergency ?? []).some(f => f === 'chest' || f === 'stroke' || f === 'breathless');

  if (severeNow.length || earlierSevere.length || partial.length || earlierHalves.length) {
    /**
     * One severe episode, across every reading of the day and whichever save
     * each arrived in (Codex re-audit F09). A repeat that confirms it need not
     * be typed into the same form as the first. Two severe readings mean
     * contact today: the home protocol asks for a minute between them, but the
     * app does not police that gap — escalating a closely repeated severe
     * reading is the conservative error, and inventing a spacing it cannot
     * verify is not (round 3, policy judged safe). The times are kept so a
     * clinician can see them. A later ordinary reading does not settle the
     * episode; only an answer about these readings does.
     */
    const complete = [...earlierSevere, ...severeNow];
    const worst = [...complete].sort((a, b) => Math.max(b.sys - 180, b.dia - 120) - Math.max(a.sys - 180, a.dia - 120))[0];
    const named = worst ? which(worst, 180, 120) : partialNamed(partial[0] ?? usableHalf(earlierHalves[0]));
    const confirmed = complete.length >= 2;
    const seen = !severeNow.length && !partial.length && [...earlierSevere, ...earlierHalves].every(r => settledAs(bpReadingId(r, c.date), answers) === 'assessed');
    if (acute) {
      out.push({
        outcome: 'urgent', disposition: 'emergency',
        reason: R('bpEmergency', `${named}, with new symptoms: get emergency help now, without waiting for another reading. ${CALL}`, 'urgent', 'emergency'),
      });
    }
    if (seen) {
      out.push({
        outcome: 'red', disposition: 'today', release: RELEASE.tomorrow,
        reason: R('bpAssessed', `${named} earlier today, and a clinician has seen it: no exercise today, and follow their advice.`, 'red', 'today'),
      });
      return out;
    }
    if (confirmed) {
      // Each reading named by what was severe in it, in the order taken: two
      // readings can be severe for different numbers, and neither claim may
      // be put on the other (acceptance J04).
      const inOrder = complete.map(r => ({ r, t: time(r.at) })).sort((a, b) => (a.t ?? 0) - (b.t ?? 0)).map(x => severeIn(x.r));
      const listed = `${inOrder.slice(0, -1).join(', ')}, then ${inOrder.at(-1)}`;
      out.push({
        outcome: 'red', disposition: 'today', release: RELEASE.today, unresolved: 'severeBp',
        reason: R('bpSevere', `${inOrder.length === 2 ? 'Two readings were' : `${inOrder.length} readings were`} very high: ${listed}. No exercise. Contact your clinician today. Call emergency services if you get ${BP_EMERGENCY_SIGNS}.`, 'red', 'today'),
      });
    } else if (severeNow.length || partial.length) {
      out.push({
        outcome: 'red', disposition: 'hold', unresolved: 'severeBp', endsDay: true,
        release: 'Sit quietly for 5 minutes and measure again. No exercise today either way.',
        reason: R('bpSevereUnconfirmed', `${named}: no exercise today. Sit quietly for 5 minutes and measure again; if it is still this high, contact your clinician today. Call emergency services if you get ${BP_EMERGENCY_SIGNS}.`, 'red', 'hold'),
      });
    } else {
      out.push({
        outcome: 'red', disposition: 'hold', release: RELEASE.tomorrow, unresolved: 'severeBp',
        reason: R('bpSevereEarlier', `${named} earlier today: no exercise today, even though it has come down. If it is that high again, contact your clinician today.`, 'red', 'hold'),
      });
    }
    return out;
  }
  if (!readings.length) return out;

  const stop = p.health.clinicianTargets?.bpStopSystolic;
  if (stop !== undefined && Number.isFinite(stop) && stop > 0) {
    const over = readings.find(r => r.sys >= stop);
    if (over) {
      out.push({
        outcome: 'red', disposition: 'hold', release: RELEASE.clinician, endsDay: true,
        reason: R('bpClinicianLimit', `Your top number is ${over.sys}, at or above the ${stop} your clinician set as your limit: no exercise today. Talk to your clinician.`, 'red', 'hold'),
      });
    }
  }

  const hold = readings.find(r => r.sys > 160 || r.dia > 100);
  if (hold) {
    const perm = p.health.bpExercisePermission;
    const permitted = perm !== undefined && Number.isFinite(perm.sys) && Number.isFinite(perm.dia)
      && readings.every(r => r.sys <= perm.sys && r.dia <= perm.dia);
    out.push(permitted
      ? {
        outcome: 'amber', disposition: 'adjust', modifiers: ['INT', 'LOAD', 'HEAD', 'COOL'], capHeavy: true,
        reason: R('bpPermitted', `${which(hold, 161, 101)}: within the level your clinician cleared you for. Light work, no head-down positions, and a longer cool-down.`, 'amber', 'adjust'),
      }
      // D29(4): above 160 or 100 holds every movement mode.
      : {
        outcome: 'red', disposition: 'hold',
        release: 'Rest 5 minutes and measure again properly. If it stays above 160 over 100, ask your clinician whether exercise is fine at this level, and add their limit to your health profile.',
        reason: R('bpHold', `${which(hold, 161, 101)}: above 160 over 100, so no exercise for now. If a correct re-check stays this high, check with your clinician before exercising.`, 'red', 'hold'),
      });
    return out;
  }
  const amberHigh = readings.find(r => r.sys >= 160 || r.dia >= 100);
  if (amberHigh) {
    out.push({
      outcome: 'amber', disposition: 'adjust', modifiers: ['INT', 'LOAD', 'HEAD', 'COOL'], capHeavy: true,
      reason: R('bpAmberHigh', `${which(amberHigh, 160, 100)}: light work, no head-down positions, and a longer cool-down. Consider a clinician check.`, 'amber', 'adjust'),
    });
    return out;
  }
  const low = readings.find(r => r.sys < 90 || r.dia < 60);
  if (low) {
    out.push(dizzy
      ? {
        outcome: 'red', disposition: 'hold', release: 'Once the dizziness has passed, change today’s answers.', endsDay: true,
        reason: R('lowBpDizzy', 'Low blood pressure with dizziness: sit or lie down. No exercise today; tell your clinician if it happens again.', 'red', 'hold'),
        oral: [fluidLimit(p.health) === 'limited'
          ? 'Keep to your fluid plan; do not drink extra.'
          : fluidLimit(p.health) === 'free'
            ? 'Have a drink once you are sitting or lying down.'
            : 'Once you are sitting or lying down, have a drink unless you have a fluid limit.'],
      }
      : { outcome: 'amber', disposition: 'adjust', modifiers: ['COOL'], reason: R('lowBp', 'Blood pressure is on the low side: a longer cool-down and rising slowly.', 'amber', 'adjust') });
    return out;
  }
  if (readings.some(r => r.sys >= 140 || r.dia >= 90)) {
    out.push({
      outcome: 'amber', disposition: 'adjust', modifiers: ['INT'], capHeavy: true,
      reason: R('bpAmber', 'Blood pressure 140 over 90 or higher: no intervals and no heavy lifts today.', 'amber', 'adjust'),
    });
    return out;
  }
  out.push({ outcome: 'green' });
  return out;
}

// ─── Sleep and energy ───────────────────────────────────────────────────────

function sleepRules(c: DailyCheckIn, recent: DailyCheckIn[]): Contribution[] {
  // An unanswered sleep or energy is not a low one.
  const low = (x: DailyCheckIn) => x.sleep === 'lt5' || (x.energy !== undefined && x.energy <= 2);
  if (!low(c)) return [];
  const yesterday = previousDay(c.date);
  const lowYesterday = recent.some(r => r.date === yesterday && low(r));
  return lowYesterday
    ? [{ outcome: 'recovery', disposition: 'adjust', reason: R('lowTwoDays', 'Low sleep or energy two days running: a recovery session today.', 'recovery', 'adjust') }]
    : [{ outcome: 'amber', disposition: 'adjust', modifiers: ['INT', 'MINUS_SET'], reason: R('lowSleep', 'Short sleep or low energy: one set fewer per exercise and moderate effort.', 'amber', 'adjust') }];
}

function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

// ─── What an earlier day still asks of today (round 3 B01) ──────────────────

/** A serious reading that outlasts its day until the person says what happened. */
interface SeriousReading {
  kind: EpisodeKind;
  id: string;
  /** How it is named, e.g. "650 mg/dL at 23:59 on 9 Oct". */
  label: string;
  /** Its own action while unresolved. */
  disposition: 'emergency' | 'today';
  /** When it was taken; undefined when only the day is known. */
  takenAt?: number;
  /** The day of the record it came from. */
  day: string;
}

/** A carried item: a serious reading, or a red flag or foot problem said in a check-in (X2-02, X2-03), with the answers that settle it (R5-01). */
type Carried = SeriousReading & { settled?: EpisodeResolution; old?: true; accepts?: EpisodeResolution[] };

const pad2 = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "at 9:05 am" or "at 09:05", as the device writes times, plus the day when it is not `today`. */
function when(iso: string | undefined, recordDate: string, today: string): string {
  const t = iso ? clock(iso) : '';
  const at = t ? ` at ${t}` : '';
  if (recordDate === today) return at;
  const [, m, day] = recordDate.split('-').map(Number);
  return `${at} on ${day} ${MONTHS[m - 1]}`;
}

const glucoseLabel = (e: GlucoseEntry) => ('display' in e ? `Meter showing ${e.display}` : `${formatNumber(e.value)} ${e.unit}`);
const ketoneLabel = (k: KetoneReading) => (k.kind === 'blood' ? `Blood ketones ${formatNumber(k.value ?? 0)} mmol/L` : `Urine ketones ${ketoneLevel(k).label.replace(' on a urine strip', '')}`);

/**
 * The readings in one record that call for help now or today on their own:
 * an extreme glucose, a severe low (or a low that needed help), high or
 * urgent ketones (positive ones too when unwell), and a confirmed severe blood
 * pressure pair. Readings already answered as typing mistakes are left out
 * before the pair is counted. Readings logged in Track count as the
 * check-in's own do (X2-01).
 */
function seriousReadings(record: DailyCheckIn, answers: readonly EpisodeAnswer[], today: string): SeriousReading[] {
  const c = withLogged(record);
  const out: SeriousReading[] = [];
  const live = (id: string) => settledAs(id, answers) !== 'mistake';
  const glucose = [...(c.glucoseEarlier ?? []), ...[c.glucose, c.glucoseDisplay].filter((x): x is GlucoseEntry => !!x)];
  for (const e of glucose) {
    const g = readGlucose(e);
    const id = glucoseReadingId(e, c.date);
    if (!live(id)) continue;
    const base = { id, label: `${glucoseLabel(e)}${when(e.measuredAt, c.date, today)}`, takenAt: g.t, day: c.date };
    if (atLeast(g, 600)) out.push({ kind: 'extremeGlucose', disposition: 'emergency', ...base });
    else if (isSevereLow(g)) out.push({ kind: 'severeLow', disposition: 'today', ...base });
  }
  if (c.news.includes('lowSevere') || (Array.isArray(c.newsEarlier) && c.newsEarlier.includes('lowSevere'))) {
    const id = newsReadingId(c.date, 'lowSevere');
    if (live(id)) out.push({ kind: 'severeLow', id, label: `A low that needed help${when(undefined, c.date, today) || ' today'}`, disposition: 'today', day: c.date });
  }
  const unwell = c.news.includes('unwell') || c.news.includes('vomiting');
  for (const k of [...(c.ketonesEarlier ?? []), ...(c.ketones ? [c.ketones] : [])]) {
    const id = ketoneReadingId(k, c.date);
    if (!live(id)) continue;
    const { level } = ketoneLevel(k);
    const disposition = level === 'urgent' ? 'emergency' : level === 'high' || (level === 'positive' && unwell) ? 'today' : undefined;
    if (disposition) out.push({ kind: 'ketones', id, label: `${ketoneLabel(k)}${when(k.measuredAt, c.date, today)}`, disposition, takenAt: time(k.measuredAt), day: c.date });
  }
  const bp = ([...(c.bpEarlier ?? []), ...(c.bpReadings?.length ? c.bpReadings : c.bp ? [c.bp] : [])] as BpReading[])
    .filter(r => validBp(r) && severe(r) && live(bpReadingId(r, c.date)));
  if (bp.length >= 2) {
    for (const r of bp) out.push({ kind: 'severeBp', id: bpReadingId(r, c.date), label: `Blood pressure ${r.sys}/${r.dia}${when(r.at, c.date, today)}`, disposition: 'today', takenAt: time(r.at), day: c.date });
  }
  return out;
}

/**
 * Said in a check-in, and still there the next morning unless someone has
 * looked at it (scan X2-02, X2-03): a new foot drop or weakening leg, back
 * pain with fever or feeling unwell, sudden severe back pain, and a new foot
 * sore or a newly hot, swollen foot. The next check-in's "since your last
 * check-in" questions cannot answer them, because a symptom that persists is
 * not new; each is asked about by name until a clinician has checked it, or
 * it has gone or healed. They have no time of their own, so their age is
 * their day's.
 */
const FLAGS = {
  newWeakness: { kind: 'redFlag', label: 'New foot drop or foot dragging, or a leg getting weaker', code: 'newWeakness', also: ['legacyNeuro'] },
  backFever: { kind: 'redFlag', label: 'Back pain with fever, shivering or feeling unwell', code: 'backFever', also: [] },
  backSudden: { kind: 'redFlag', label: 'Sudden severe back pain, or pain getting worse fast', code: 'backSudden', also: [] },
  footProblem: { kind: 'foot', label: 'A new blister or sore on a foot', code: 'foot', also: [] },
  hotSwollenFoot: { kind: 'foot', label: 'A foot that was newly hot, red or swollen', code: 'hotFoot', also: [] },
} as const satisfies Record<RedFlag, unknown>;
type Flag = keyof typeof FLAGS;

/**
 * What settles each flag, as its own message says (R5-01): a clinician for a
 * red flag and for a hot, swollen foot; a sore may also heal; and anything
 * ticked by mistake. "It has gone" is no answer to something that needs
 * checking.
 */
const FLAG_ACCEPTS: Record<Flag, EpisodeResolution[]> = {
  newWeakness: ['assessed', 'mistake'],
  backFever: ['assessed', 'mistake'],
  backSudden: ['assessed', 'mistake'],
  footProblem: ['resolved', 'assessed', 'mistake'],
  hotSwollenFoot: ['assessed', 'mistake'],
};

/** Codes of the day rules these flags come from: the episode carry says them, so the answer carry-over does not too. */
const FLAG_CODES = new Set<string>(Object.values(FLAGS).flatMap(f => [f.code, ...f.also]));

/** Codes the reading rules above already carry, so the answer carry-over does not say them twice. */
const READING_CODES = new Set([
  'extremeGlucose', 'extremeGlucoseEarlier', 'extremeGlucoseAssessed', 'severeLow', 'severeLowEarlier', 'severeLowAssessed',
  'lowNeededHelp', 'ketonesUrgent', 'ketonesHigh', 'ketonesEarlier', 'ketonesEarlierUrgent', 'illnessKetones',
  'illnessKetonesEarlier', 'ketonesAssessed', 'bpSevere', 'bpAssessed',
]);

/** The flags a record reports now. */
export function flagsIn(c: DailyCheckIn): Flag[] {
  const b = c.back;
  const asked = b?.newWeakness !== undefined || b?.newSensory !== undefined;
  const weakness = b?.newWeakness === true || (!!b && !asked && b.newNeuro === true);
  const backPain = (b?.pain ?? 0) > 0 || (b?.legPain ?? 0) > 0;
  const out: Flag[] = [];
  if (weakness) out.push('newWeakness');
  if (b?.feverish || (backPain && c.news.includes('unwell'))) out.push('backFever');
  if (b?.suddenSevere) out.push('backSudden');
  if (c.news.includes('footProblem')) out.push('footProblem');
  if (c.news.includes('hotSwollenFoot')) out.push('hotSwollenFoot');
  return out;
}

/** The flags said earlier that day (R5-01), by the names the engine knows: a record from elsewhere may hold others, which are ignored. */
const flagsEarlierIn = (c: DailyCheckIn): Flag[] => (Array.isArray(c.flagsEarlier) ? c.flagsEarlier : []).filter((f): f is Flag => Object.hasOwn(FLAGS, f));

/** Every flag a record holds open: those it reports now, and those said earlier that day (R5-01). */
const flagsOf = (c: DailyCheckIn): Flag[] => [...new Set([...flagsIn(c), ...flagsEarlierIn(c)])];

const flagId = (flag: Flag, day: string) => `flag:${flag}@${day}`;

/**
 * An item said again today after an answer released it — a red flag, a foot
 * problem, or news that ends the day, ticked again — is a new report of it
 * (R5-01). These are the `reopened` answers that take each release back, so
 * the old answer cannot settle the item once it is unticked again, and it is
 * asked about by name. Each is dated a millisecond after the latest answer
 * about it: only the order of answers counts.
 */
export function reopenedByReport(saved: DailyCheckIn, next: DailyCheckIn): EpisodeAnswer[] {
  const before = flagsIn(saved);
  const again: { kind: EpisodeKind; id: string }[] = [
    ...flagsIn(next).filter(f => !before.includes(f)).map(f => ({ kind: FLAGS[f].kind, id: flagId(f, next.date) })),
    ...next.news.filter(n => endsTheDay(n) && !saved.news.includes(n)).map(n => ({ kind: 'news' as const, id: newsReadingId(next.date, n) })),
  ];
  const answers = next.resolutions ?? [];
  return again.flatMap(({ kind, id }) => {
    if (settledAs(id, answers) === undefined) return [];
    const last = answers.filter(a => a.readings.includes(id)).map(a => a.at).sort().at(-1)!;
    const t = Date.parse(last);
    return [{ kind, readings: [id], resolution: 'reopened' as const, at: Number.isFinite(t) ? new Date(t + 1).toISOString() : last }];
  });
}

const CARRY_MESSAGE: Record<'extremeGlucose' | 'severeLow' | 'ketones' | 'severeBp', (label: string, unit: GlucoseUnit, urgent: boolean) => string> = {
  extremeGlucose: (label, unit) => `${label}: a glucose of ${level(600, unit)} or more still needs emergency assessment. ${CALL} If you typed it by mistake, say so in today’s answers.`,
  severeLow: label => `${label}: a severe low. No exercise until you have contacted your care team, and contact them today.`,
  // Ketones as high as an emergency keep the emergency instruction (R5-05).
  ketones: (label, _unit, urgent) => (urgent
    ? `${label}: ketones this high still need emergency assessment now, whatever your glucose. ${CALL} If you typed it by mistake, say so in today’s answers.`
    : `${label}: no exercise until you have contacted your diabetes team, and contact them today.`),
  severeBp: label => `${label}, confirmed by a second high reading: no exercise until you have contacted your clinician, and contact them today.`,
};

/** What a carried red flag says while it is open: the day's own message on the next day; later, a question. */
const FLAG_MESSAGE: Record<Flag, string> = {
  newWeakness: 'New foot drop, foot dragging or a leg getting weaker needs a doctor. No exercise until a clinician has checked your leg.',
  backFever: 'Back pain with fever, shivering or feeling unwell needs a doctor, even if your temperature is normal. No exercise until you have been checked.',
  backSudden: 'Sudden severe back pain, or pain getting worse fast, needs a doctor. No exercise until you have been checked.',
  footProblem: 'Seated and floor work only, and no walking, until it has healed or a clinician has cleared it.',
  hotSwollenFoot: 'Seated and floor work only, and no walking or standing exercise, until a clinician has cleared it.',
};

/**
 * A carried reading this old asks whether it was settled instead of telling
 * the person to act now (scan X2-10): a reading months old, from a restored
 * backup or years of history, is not an emergency today. It still holds
 * movement until it is answered. A day is the line: within it, the reading's
 * own instruction stands, as D29(3) frames the level 2 response as a
 * same-day contact.
 */
export const CARRY_URGENT_HOURS = 24;

const dayStart = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const dayEnd = (date: string) => dayStart(date) + 24 * 3_600_000 - 1;

/**
 * What earlier check-ins still ask of today. Nothing here expires with the
 * date (Codex round 3 B01; board instruction: no invented hour window):
 *
 * - **Serious readings**, from any earlier day, until the person answers
 *   them: "I typed it wrongly" removes one; "A clinician has checked me"
 *   settles it, and keeps today's no-exercise rule only when that answer was
 *   given today (D29's day restriction). A later lower number answers
 *   nothing. More than a day old, a reading is asked about rather than acted
 *   on, and "dealt with at the time" is an answer too (X2-10).
 * - **Red flags and foot problems** said in a check-in (X2-02, X2-03),
 *   including earlier the same day and unticked since, until their own
 *   release: a clinician, a sore that has healed, or a tick made by mistake
 *   (R5-01).
 * - **The last check-in's own answers that call for help now or today** — an
 *   emergency symptom, being unwell with diabetes — until a newer check-in
 *   answers those questions again. Every check-in asks them, so the first
 *   one of the new day settles them either way.
 *
 * `now` dates "more than a day old"; without it, the start of `date`, which
 * can only make an item younger.
 */
function carriedRules(profile: UserProfile, c: DailyCheckIn | undefined, date: string, recent: readonly DailyCheckIn[], now?: Date): { contributions: Contribution[]; readings: Carried[] } {
  const earlier = [...recent].filter(x => x.date < date).sort((a, b) => a.date.localeCompare(b.date));
  const out: Contribution[] = [];
  const readings: Carried[] = [];
  const todayAnswers = c?.resolutions ?? [];
  const unit = profile.health.glucoseUnit ?? 'mg/dL';
  const ref = now?.getTime() ?? dayStart(date);
  const isOld = (r: { takenAt?: number; day: string }) => ref - (r.takenAt ?? dayEnd(r.day)) > CARRY_URGENT_HOURS * 3_600_000;
  const latestAnswer = (answers: readonly EpisodeAnswer[], id: string) =>
    [...answers].filter(a => a.readings.includes(id)).sort((x, y) => (x.at < y.at ? -1 : 1)).at(-1);
  /** One red flag or foot problem: asked about by name, and holding its own restriction until its own release (R5-01). */
  const flagIncident = (flag: Flag, day: string, label: string, from: string, old: boolean, answers: readonly EpisodeAnswer[]) => {
    const f = FLAGS[flag];
    const id = flagId(flag, day);
    const accepts = FLAG_ACCEPTS[flag];
    const latest = latestAnswer(answers, id);
    const settled = latest && accepts.includes(latest.resolution as EpisodeResolution) ? latest.resolution as EpisodeResolution : undefined;
    readings.push({ kind: f.kind, id, label, disposition: 'today', day, accepts, ...(settled ? { settled } : {}), ...(old ? { old: true as const } : {}) });
    if (settled) return;
    if (f.kind === 'foot') {
      out.push({
        outcome: 'amber', disposition: 'adjust', modifiers: ['FOOT'], refuses: ['walk'], unresolved: 'foot',
        reason: R(`carried:${f.code}`, `${label}: ${FLAG_MESSAGE[flag]} Say so in your check-in once it has.`, 'amber', 'adjust', ['walk']),
      });
    } else if (old) {
      out.push({
        outcome: 'red', disposition: 'hold', back: 'red', nerveFlag: flag === 'newWeakness', unresolved: 'redFlag',
        release: 'Say in your check-in whether a clinician has checked it.',
        reason: R(`carriedOld:${f.code}`, `${label}: has a clinician checked it? Say so in your check-in. No exercise until you have; if nobody has checked it, see a doctor.`, 'red', 'hold'),
      });
    } else {
      out.push({
        outcome: 'red', disposition: 'today', back: 'red', nerveFlag: flag === 'newWeakness', unresolved: 'redFlag',
        release: 'Say in your check-in once a clinician has checked it.',
        reason: R(`carried:${f.code}`, `${from}: ${FLAG_MESSAGE[flag]}`, 'red', 'today'),
      });
    }
  };

  for (let i = 0; i < earlier.length; i++) {
    const record = earlier[i];
    // The answer about a reading can be given on its own day or any day since.
    const answers = [...answersFor(record, earlier.slice(i + 1)), ...todayAnswers];
    for (const r of seriousReadings(record, answers, date)) {
      const old = isOld(r);
      const latest = latestAnswer(answers, r.id);
      // "Dealt with at the time" answers only a reading more than a day old.
      const settled = latest && latest.resolution !== 'reopened' && (latest.resolution !== 'resolved' || old) ? latest.resolution : undefined;
      readings.push({ ...r, ...(settled ? { settled } : {}), ...(old ? { old: true as const } : {}) });
      if (settled === 'assessed') {
        if (toLocalDate(latest!.at) === date) {
          out.push({
            outcome: 'red', disposition: 'today', release: RELEASE.tomorrow,
            reason: R(`carriedAssessed:${r.kind}`, `${r.label}: a clinician has checked it today. No exercise today, and follow their advice.`, 'red', 'today'),
          });
        }
        continue;
      }
      if (settled) continue;
      const kind = r.kind as keyof typeof CARRY_MESSAGE;
      if (old) {
        out.push({
          outcome: 'red', disposition: 'hold', unresolved: r.kind, release: 'Answer the question about it in your check-in.',
          reason: R(`carriedOld:${r.kind}`, `${r.label}: was it settled? Say in your check-in whether it was dealt with at the time, checked by a clinician, or typed wrongly. No exercise until you have.`, 'red', 'hold'),
        });
      } else {
        out.push(r.disposition === 'emergency'
          ? { outcome: 'urgent', disposition: 'emergency', unresolved: r.kind, reason: R(`carried:${r.kind}`, CARRY_MESSAGE[kind](r.label, unit, true), 'urgent', 'emergency') }
          : { outcome: 'red', disposition: 'today', release: 'Say what happened in today’s check-in.', unresolved: r.kind, reason: R(`carried:${r.kind}`, CARRY_MESSAGE[kind](r.label, unit, false), 'red', 'today') });
      }
    }
    // Red flags and foot problems, by name, until their own release is given (X2-02, X2-03, R5-01).
    if (record.readingsOnly) continue;
    for (const flag of flagsOf(record)) {
      const label = `${FLAGS[flag].label}${when(undefined, record.date, date)}`;
      flagIncident(flag, record.date, label, `From your check-in${when(undefined, record.date, date)}`, record.date < previousDay(date), answers);
    }
  }
  // Said earlier today and unticked since (R5-01): the same incident, by the
  // same id, as tomorrow's carry would be.
  if (c) {
    const now = flagsIn(c);
    for (const flag of flagsEarlierIn(c)) {
      if (!now.includes(flag)) flagIncident(flag, c.date, `${FLAGS[flag].label}, today`, 'Earlier today', false, todayAnswers);
    }
  }

  // The last check-in's answers stand until a newer one answers the same
  // questions: with no check-in yet today, a chest pain at 23:59 is still a
  // chest pain at 00:01. A day that holds only readings logged in Track, or
  // only what was reported during movement, is nobody's check-in (X2-01,
  // R5-07): it neither answers nor hides the last one.
  const last = earlier.filter(answeredCheckIn).at(-1);
  if (last && (!c || c.emergency === undefined)) {
    const before = earlier.filter(x => x.date < last.date);
    const r = evaluateCheckIn(profile, last, before);
    for (const reason of r.reasons) {
      const d = reason.disposition ?? 'adjust';
      if ((d !== 'emergency' && d !== 'today') || READING_CODES.has(reason.code) || FLAG_CODES.has(reason.code) || reason.code.startsWith('carried')) continue;
      out.push({
        outcome: reason.outcome, disposition: d,
        ...(d === 'emergency' ? {} : { release: 'Answer today’s check-in to update this.' }),
        reason: R(`carried:${reason.code}`, `From your last check-in${when(undefined, last.date, date)}: ${reason.message}`, reason.outcome, d),
      });
    }
  }
  return { contributions: out, readings };
}

/**
 * A record that answered the check-in's own questions (R5-07): not a day made
 * only by Track's readings or by something reported during movement. A report
 * of an emergency answers that question; records before v5 answered with
 * `urgentSymptoms`, sleep and energy.
 */
export function answeredCheckIn(c: DailyCheckIn): boolean {
  return !c.readingsOnly && (c.emergency !== undefined || c.urgentSymptoms || c.sleep !== undefined || c.energy !== undefined);
}

/** The calendar date of an instant, on this device. */
function toLocalDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Everything the sheet should ask about: today's earlier serious readings,
 * and earlier days' carried readings, red flags and foot problems, each with
 * what has been said about it.
 */
function episodeSummaries(record: DailyCheckIn | undefined, date: string, carried: Carried[], saidEarlier: readonly DayEnding[] = []): EpisodeSummary[] {
  const list: { kind: EpisodeKind; reading: EpisodeReading }[] = [];
  if (record) {
    const c = withLogged(record);
    const answers = c.resolutions ?? [];
    const add = (kind: EpisodeKind, id: string, label: string, accepts?: EpisodeResolution[]) => {
      const settled = settledAs(id, answers);
      // Today's readings are never "dealt with at the time": too recent for that answer.
      list.push({ kind, reading: { id, label, ...(settled && settled !== 'resolved' ? { settled } : {}), ...(accepts ? { accepts } : {}) } });
    };
    for (const e of c.glucoseEarlier ?? []) {
      const g = readGlucose(e);
      if (atLeast(g, 600)) add('extremeGlucose', glucoseReadingId(e, c.date), `${glucoseLabel(e)}${when(e.measuredAt, c.date, date)}`);
      else if (isSevereLow(g)) add('severeLow', glucoseReadingId(e, c.date), `${glucoseLabel(e)}${when(e.measuredAt, c.date, date)}`);
    }
    for (const k of c.ketonesEarlier ?? []) {
      const level = ketoneLevel(k).level;
      if (level === 'positive' || level === 'high' || level === 'urgent') add('ketones', ketoneReadingId(k, c.date), `${ketoneLabel(k)}${when(k.measuredAt, c.date, date)}`);
    }
    // One with a number that cannot be used is named as typed, so a typo can be answered as one (R5-06).
    for (const r of c.bpEarlier ?? []) if (validBp(r) ? severe(r) : severePartial(usableHalf(r))) add('severeBp', bpReadingId(r, c.date), `Blood pressure ${r.sys}/${r.dia}${when(r.at, c.date, date)}`);
    for (const r of c.bpPartial ?? []) if (severePartial(r)) add('severeBp', bpPartialId(r, c.date), `${partialNamed(r).replace('Your ', 'A ')}${when(r.at, c.date, date)}, other number not entered`);
    // It happened, and the day is over; or it was ticked by mistake.
    for (const n of saidEarlier) add('news', newsReadingId(c.date, n), DAY_ENDING[n], ['mistake']);
  }
  for (const r of carried) list.push({ kind: r.kind, reading: { id: r.id, label: r.label, ...(r.settled ? { settled: r.settled } : {}), ...(r.old ? { old: true as const } : {}), ...(r.accepts ? { accepts: r.accepts } : {}) } });
  const kinds: EpisodeKind[] = ['extremeGlucose', 'severeLow', 'ketones', 'severeBp', 'redFlag', 'foot', 'news'];
  return kinds
    .map(kind => ({ kind, readings: list.filter(x => x.kind === kind).map(x => x.reading) }))
    .filter(e => e.readings.length > 0);
}

// ─── Profile and merge ──────────────────────────────────────────────────────

function profileContributions(profile: UserProfile): { contributions: Contribution[]; vigorousLocked: boolean; rpeOnly: boolean } {
  const pr = profileRules(profile);
  return {
    contributions: [
      { outcome: pr.outcome, modifiers: pr.modifiers, notices: pr.notices, capHeavy: pr.capHeavy },
      ...pr.reasons.map(r => (r.outcome === 'red'
        ? { outcome: 'red' as const, disposition: 'hold' as const, release: 'Exercise again once your eye doctor clears you.', reason: { ...r, disposition: 'hold' as const } }
        : { outcome: 'green' as const, disposition: 'adjust' as const, reason: { ...r, outcome: 'green' as const, disposition: 'adjust' as const } })),
    ],
    vigorousLocked: pr.vigorousLocked,
    rpeOnly: pr.rpeOnly,
  };
}

/**
 * Evaluate today's check-in. `recent` holds earlier check-ins (any order).
 * `now` dates how old a carried reading is (X2-10); without it, the start of
 * the check-in's day.
 */
export function evaluateCheckIn(profile: UserProfile, checkIn: DailyCheckIn, recent: DailyCheckIn[] = [], now?: Date): Readiness {
  const d = deriveHealth(profile.health);
  const base = profileContributions(profile);
  // Readings logged in Track count as the check-in's own (X2-01).
  const c = withLogged(checkIn);
  const ketones = ketoneRules(c);
  const carried = carriedRules(profile, c, c.date, recent, now);
  const r = merge([
    ...base.contributions,
    ...emergencyRules(c),
    ...backRules(c, recent),
    ...newsRules(profile, c, d, recordedLows(checkIn, recent, now)),
    ...glucoseRules(profile, c, d, ketones.level, recent),
    ...ketones.contributions,
    ...bpRules(profile, c),
    ...sleepRules(c, recent),
    ...carried.contributions,
  ], base.vigorousLocked, base.rpeOnly);
  const episodes = episodeSummaries(c, c.date, carried.readings, newsSaidEarlier(c, d));
  return episodes.length ? { ...r, episodes } : r;
}

function defaultDisposition(c: Contribution): Disposition {
  if (c.outcome === 'urgent') return 'emergency';
  if (c.outcome === 'red') return 'hold';
  const says = (c.reason && c.reason.outcome !== 'green') || c.modifiers?.length || c.actions?.length || c.oral?.length
    || c.prep?.length || c.notices?.length || c.capHeavy;
  return says ? 'adjust' : 'reassure';
}

function merge(cs: Contribution[], vigorousLocked: boolean, rpeOnly: boolean): Readiness {
  let outcome: Outcome = 'green';
  let disposition: Disposition = 'reassure';
  const modifiers: Modifier[] = [];
  const reasons: Reason[] = [];
  const actions: string[] = [];
  const oral: string[] = [];
  const prep: string[] = [];
  const notices: string[] = [];
  let recheckMinutes: number | undefined;
  let recheckAt: string | undefined;
  let nerveFlag = false;
  let back: BackLight = 'none';
  let capHeavy = false;
  let release: string | undefined;
  let releaseRank = -1;
  let releaseTimed = false;
  let awaitingReading = false;
  let noOral = false;
  /** Something has ended exercise for the day, whatever the disposition. */
  let dayOver = false;
  const refused: Mode[] = [];
  const unresolved: EpisodeKind[] = [];
  const backRank: BackLight[] = ['none', 'green', 'amber', 'red'];

  for (const c of cs) {
    const dz = c.disposition ?? defaultDisposition(c);
    if (OUTCOME_ORDER.indexOf(c.outcome) > OUTCOME_ORDER.indexOf(outcome)) outcome = c.outcome;
    if (rank(dz) > rank(disposition)) disposition = dz;
    // At equal rank a timed re-check's release is the one said: what to do,
    // and when, for a low that is measured, not only suspected (scan J2-03).
    if (c.release && (rank(dz) > releaseRank || (rank(dz) === releaseRank && c.recheckAt !== undefined && !releaseTimed))) {
      release = c.release;
      releaseRank = rank(dz);
      releaseTimed = c.recheckAt !== undefined;
    }
    for (const m of c.modifiers ?? []) if (!modifiers.includes(m)) modifiers.push(m);
    if (c.reason && !reasons.some(r => r.code === c.reason!.code)) reasons.push({ ...c.reason, disposition: c.reason.disposition ?? dz });
    for (const a of c.actions ?? []) if (!actions.includes(a)) actions.push(a);
    for (const a of c.oral ?? []) if (!oral.includes(a)) oral.push(a);
    for (const a of c.prep ?? []) if (!prep.includes(a)) prep.push(a);
    for (const n of c.notices ?? []) if (!notices.includes(n)) notices.push(n);
    if (c.recheckMinutes) recheckMinutes = Math.max(recheckMinutes ?? 0, c.recheckMinutes);
    if (c.recheckAt && (!recheckAt || c.recheckAt > recheckAt)) recheckAt = c.recheckAt;
    if (c.nerveFlag) nerveFlag = true;
    if (c.back && backRank.indexOf(c.back) > backRank.indexOf(back)) back = c.back;
    if (c.capHeavy) capHeavy = true;
    if (c.awaitingReading) awaitingReading = true;
    if (c.noOral) noOral = true;
    if (c.release === RELEASE.tomorrow || c.endsDay) dayOver = true;
    if (c.unresolved && !unresolved.includes(c.unresolved)) unresolved.push(c.unresolved);
    for (const m of c.refuses ?? []) if (!refused.includes(m)) refused.push(m);
  }
  // Someone who cannot swallow safely is never told to eat or drink (E-HYPO).
  if (!noOral) actions.unshift(...oral.filter(a => !actions.includes(a)));
  // Advice for exercising has no place next to "no exercise today", "no more
  // exercise today" or "call now" (scan J2-14).
  if (rank(disposition) < rank('today') && !dayOver) actions.push(...prep.filter(a => !actions.includes(a)));
  reasons.sort((a, b) =>
    rank(b.disposition ?? 'adjust') - rank(a.disposition ?? 'adjust') || OUTCOME_ORDER.indexOf(b.outcome) - OUTCOME_ORDER.indexOf(a.outcome));

  return {
    outcome, modifiers, back, nerveFlag, reasons, actions, notices,
    ...(recheckMinutes ? { recheckMinutes } : {}),
    vigorousLocked, capHeavy, rpeOnly,
    disposition,
    ...(release && rank(disposition) > rank('adjust') ? { release } : {}),
    ...(recheckAt ? { recheckAt } : {}),
    ...(awaitingReading ? { awaitingReading } : {}),
    ...(refused.length ? { refusedModes: refused } : {}),
    ...(unresolved.length ? { unresolved } : {}),
  };
}

/**
 * Readiness with no check-in for `date`: the profile's rules, plus whatever
 * earlier check-ins still ask of that day (round 3 B01). Without `date` or
 * `recent` it is the profile alone.
 */
export function profileOnlyReadiness(profile: UserProfile, day?: { date: string; recent: readonly DailyCheckIn[]; now?: Date }): Readiness {
  const base = profileContributions(profile);
  const carried = day ? carriedRules(profile, undefined, day.date, day.recent, day.now) : { contributions: [], readings: [] };
  const r = merge([...base.contributions, ...carried.contributions], base.vigorousLocked, base.rpeOnly);
  const episodes = day ? episodeSummaries(undefined, day.date, carried.readings) : [];
  return episodes.length ? { ...r, episodes } : r;
}
