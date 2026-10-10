/**
 * The check-in sheet's decisions, kept out of the component so they can be
 * tested: what is asked, what blocks saving, and how answers become a
 * `DailyCheckIn` without losing anything already saved.
 *
 * Two rules matter most:
 * - **Emergency answers come first.** A ticked emergency item is saved the
 *   moment it is ticked, and nothing else (an unusable glucose number, a half
 *   blood pressure) can stop it being saved.
 * - **Nothing saved is lost.** A question the profile no longer asks keeps
 *   its saved answer, and a reading that is replaced or cleared moves to the
 *   day's earlier readings, so "Change answers" can never erase a low, a
 *   positive ketone result or a severe blood pressure reading.
 */

import type {
  BpPartialReading, BpReading, CheckInRecord, DailyCheckIn, EmergencyFlag, EpisodeAnswer, EpisodeSummary, GlucoseDisplayReading,
  GlucoseEntry, GlucoseReading, GlucoseSource, GlucoseTrend, GlucoseUnit, KetoneReading, NewsItem, SymptomReach,
  UrineKetoneCategory,
} from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { deriveHealth } from '@/engine/health';
import { checkedIn } from '@/engine/permission';
import { bpPartialId, endsTheDay, evaluateCheckIn, flagsIn, glucoseSanity, profileOnlyReadiness, reopenedByReport, severePartial, standingAnswer, toMgdl, type GlucoseSanity } from '@/engine/readiness';

/**
 * Which glucose readings reach the readiness engine: plausible ones, and an
 * ambiguous low (5.5 entered in mg/dL), which the engine treats as a severe low.
 * Dropping that one would turn "treat this low now" into a full workout.
 */
export const submitsGlucose = (sanity: GlucoseSanity): boolean => sanity === 'ok' || sanity === 'ambiguousLow';

export interface BpFields {
  s1: string;
  d1: string;
  s2: string;
  d2: string;
  /** When each reading was entered (ISO); absent stamps it at save. */
  at1?: string;
  at2?: string;
}

export interface BackAnswers {
  /** The slider's position; saved only once `answered.pain`. */
  pain: number;
  /** The slider's position; saved only once `answered.legPain`. */
  legPain: number;
  /** `null` until chosen. */
  reach: SymptomReach | null;
  newWeakness: boolean;
  weaknessFast: boolean;
  newSensory: boolean;
  feverish: boolean;
  suddenSevere: boolean;
  worseFunction: boolean;
}

export interface CheckInForm {
  /** `null` until "Right now, any of these?" is answered; `[]` is "None of these". */
  emergency: EmergencyFlag[] | null;
  back: BackAnswers;
  /** Every saved item, including any the profile would no longer show. */
  news: NewsItem[];
  glucose: string;
  unit: GlucoseUnit;
  /** The person confirmed the unit when the number looked like the other one. */
  unitConfirmed: boolean;
  /** When the reading in `glucose` was taken; `null` stamps it at save. */
  glucoseAt: string | null;
  glucoseDisplay: 'HI' | 'LO' | null;
  source: GlucoseSource | null;
  /** `null` until chosen. */
  trend: GlucoseTrend | null;
  rapid: boolean;
  bloodKetones: string;
  urineKetones: UrineKetoneCategory | null;
  bp: BpFields;
  bpSymptoms: boolean;
  lowRecovered: boolean;
  /**
   * Every answer the day holds about serious readings, the form's own
   * included. The form's list replaces the saved one, so taking an answer back
   * ("Not settled yet") is honoured, never reinstated (round 3 B01, P04).
   */
  resolutions: EpisodeAnswer[];
  /** `null` until chosen. */
  sleep: NonNullable<DailyCheckIn['sleep']> | null;
  /** `null` until chosen. */
  energy: NonNullable<DailyCheckIn['energy']> | null;
  /**
   * Which controls the person has actually answered (acceptance J03, J16).
   * A slider, a toggle or a "None of these" row has a starting position
   * that is not an answer: an untouched one saves nothing, so no default is
   * ever stored, or lifted into the readings, as if it had been said.
   */
  answered: Partial<Record<Answerable, true>>;
}

/** Controls whose starting position is not an answer. */
export type Answerable = 'pain' | 'legPain' | 'backFlags' | 'news' | 'lows' | 'bpSymptoms' | 'lowRecovered';

const NO_BACK: BackAnswers = {
  pain: 0, legPain: 0, reach: null, newWeakness: false, weaknessFast: false, newSensory: false,
  feverish: false, suddenSevere: false, worseFunction: false,
};

const defaultSource = (p: UserProfile): GlucoseSource | null =>
  p.health.glucoseMonitor === 'cgm' ? 'sensor' : p.health.glucoseMonitor === 'meter' ? 'meter' : null;

export function emptyForm(profile: UserProfile): CheckInForm {
  return {
    emergency: null, back: { ...NO_BACK }, news: [],
    glucose: '', unit: profile.health.glucoseUnit, unitConfirmed: false, glucoseAt: null, glucoseDisplay: null, source: defaultSource(profile),
    trend: null, rapid: false, bloodKetones: '', urineKetones: null,
    bp: { s1: '', d1: '', s2: '', d2: '' }, bpSymptoms: false, lowRecovered: false, resolutions: [], sleep: null, energy: null, answered: {},
  };
}

/**
 * The blood-pressure fields for a check-in being edited: both raw readings
 * when they were kept, or an older record's single average as the first.
 */
export function initialBp(saved?: DailyCheckIn): BpFields {
  const readings = saved?.bpReadings?.length ? saved.bpReadings : saved?.bp ? [saved.bp] : [];
  const [a, b] = readings as (BpReading | undefined)[];
  return {
    s1: a ? String(a.sys) : '', d1: a ? String(a.dia) : '', s2: b ? String(b.sys) : '', d2: b ? String(b.dia) : '',
    ...(a?.at ? { at1: a.at } : {}), ...(b?.at ? { at2: b.at } : {}),
  };
}

/** Older records asked one question for these. */
const LEGACY_URGENT: EmergencyFlag[] = ['chest', 'breathless', 'stroke'];
const LEGACY_CAUDA: EmergencyFlag[] = ['bladderBowel', 'saddle'];

const URINE_FROM_VALUE = (v: number): UrineKetoneCategory =>
  v <= 0 ? 'negative' : v <= 5 ? 'trace' : v <= 15 ? 'small' : v <= 40 ? 'moderate' : 'large';

/** A saved check-in, back in the form, with every answer it held. */
export function formFromRecord(record: DailyCheckIn, profile?: UserProfile): CheckInForm {
  const b = record.back;
  const emergency = new Set<EmergencyFlag>(record.emergency ?? []);
  if (record.urgentSymptoms && !record.emergency?.length) for (const f of LEGACY_URGENT) emergency.add(f);
  if (b?.caudaEquinaFlag) for (const f of LEGACY_CAUDA) emergency.add(f);
  // An older "new numbness, tingling or weakness" answer is shown as weakness, the safer reading.
  const asked = b?.newWeakness !== undefined || b?.newSensory !== undefined;
  const g = record.glucose;
  const shown = record.glucoseDisplay;
  const useDisplay = !!shown && (!g || (Date.parse(shown.measuredAt ?? '') || 0) >= (Date.parse(g.measuredAt ?? '') || 0));
  const k = record.ketones;
  // A day started by a report has not been checked in: only what was said
  // shows as answered, never "None of these" (scan M-01).
  const asCheckIn = checkedIn(record) || record.urgentSymptoms;
  return {
    emergency: asCheckIn || emergency.size ? [...emergency] : null,
    back: b
      ? {
        pain: b.pain ?? 0, legPain: b.legPain ?? 0, reach: b.reach ?? null,
        newWeakness: asked ? b.newWeakness === true : b.newNeuro === true, weaknessFast: b.weaknessFast === true,
        newSensory: b.newSensory === true, feverish: b.feverish === true, suddenSevere: b.suddenSevere === true,
        worseFunction: b.worseFunction === true,
      }
      : { ...NO_BACK },
    news: [...record.news],
    glucose: g && !useDisplay ? String(g.value) : '',
    unit: g?.unit ?? profile?.health.glucoseUnit ?? 'mg/dL',
    unitConfirmed: g?.unitConfirmed === true,
    glucoseAt: useDisplay ? shown?.measuredAt ?? null : g?.measuredAt ?? null,
    glucoseDisplay: useDisplay && shown ? shown.display : null,
    source: (useDisplay ? shown?.source : g?.source) ?? null,
    trend: g?.trend ?? null,
    rapid: g?.rapidInsulinLast2h === true,
    bloodKetones: k?.kind === 'blood' ? String(k.value) : '',
    urineKetones: k?.kind === 'urine' ? (k.category ?? (k.value !== undefined && Number.isFinite(k.value) && k.value >= 0 ? URINE_FROM_VALUE(k.value) : null)) : null,
    bp: initialBp(record),
    bpSymptoms: record.bpSymptoms === true,
    lowRecovered: record.lowRecovered === true,
    resolutions: [...(record.resolutions ?? [])],
    sleep: record.sleep ?? null,
    energy: record.energy ?? null,
    // What the saved record holds was answered; what it lacks was not.
    answered: {
      ...(b?.pain !== undefined ? { pain: true as const } : {}),
      ...(b?.legPain !== undefined ? { legPain: true as const } : {}),
      ...(b && (b.newWeakness !== undefined || b.newSensory !== undefined || b.feverish !== undefined || b.newNeuro !== undefined) ? { backFlags: true as const } : {}),
      ...(asCheckIn ? { news: true as const, lows: true as const } : {}),
      ...(record.bpSymptoms !== undefined ? { bpSymptoms: true as const } : {}),
      ...(record.lowRecovered !== undefined ? { lowRecovered: true as const } : {}),
    },
  };
}

// ─── What is asked ──────────────────────────────────────────────────────────

const EMERGENCY_ORDER: EmergencyFlag[] = [
  'chest', 'stroke', 'breathless', 'collapse', 'bladderBowel', 'saddle', 'bothLegs', 'lowCantTreat', 'dka', 'accident', 'heatConfusion',
];
const DIABETES_EMERGENCIES: EmergencyFlag[] = ['lowCantTreat', 'dka'];
const NEWS_ORDER: NewsItem[] = [
  'unwell', 'vomiting', 'highNotFalling', 'lowSymptoms', 'lowOne', 'lowTwoPlus', 'lowSevere', 'dizzy', 'fainted',
  'footProblem', 'hotSwollenFoot', 'steroid', 'hot', 'unusualFatigue',
];
const DIABETES_NEWS: NewsItem[] = ['highNotFalling', 'lowSymptoms', 'lowOne', 'lowTwoPlus', 'lowSevere'];
const FOOT_NEWS: NewsItem[] = ['footProblem', 'hotSwollenFoot'];

export interface Visible {
  /** Serious readings, today's and earlier days', that the sheet asks about: settled or not, so an answer can be taken back. */
  episodes: EpisodeSummary[];
  /** "Right now" items, in order. Anything already ticked is always shown. */
  emergency: EmergencyFlag[];
  news: NewsItem[];
  glucose: boolean;
  glucoseTrend: boolean;
  rapidInsulin: boolean;
  ketones: 'blood' | 'urine' | null;
  back: boolean;
  sciatica: boolean;
  bp: boolean;
  /** Acute symptoms are asked only alongside a severe reading. */
  bpSymptoms: boolean;
  /** "Symptoms gone, and your plan allows exercise after a low?" — only after a low today. */
  lowRecovered: boolean;
}

/** The form's glucose number in mg/dL, if it is a usable one. */
function formMgdl(form: CheckInForm): number | undefined {
  const value = Number(form.glucose.trim());
  if (form.glucoseDisplay || !form.glucose.trim() || !submitsGlucose(formSanity(form))) return undefined;
  return toMgdl(value, form.unit);
}

/** The form's reading judged as typed, with the unit the person confirmed. */
export function formSanity(form: CheckInForm): GlucoseSanity {
  return glucoseSanity(Number(form.glucose.trim()), form.unit, form.unitConfirmed);
}

const isSevereBp = (r: BpReading) => r.sys >= 180 || r.dia >= 120;

/**
 * A severe number in any box, even on its own (Codex re-audit F09/B04).
 *
 * Either component is enough for the severe rule, so the urgent-symptom
 * question cannot wait for the other box to be filled; the missing one is
 * never read as zero either.
 */
function anySevereComponent(bp: BpFields): boolean {
  const over = (text: string, limit: number) => {
    const n = Number(text.trim());
    return text.trim() !== '' && Number.isFinite(n) && n >= limit;
  };
  return over(bp.s1, 180) || over(bp.s2, 180) || over(bp.d1, 120) || over(bp.d2, 120);
}

/** Rows with one box filled, when that number is severe on its own. */
function formPartials(bp: BpFields, stamp: string): BpPartialReading[] {
  const out: BpPartialReading[] = [];
  const rows = [[bp.s1, bp.d1, bp.at1], [bp.s2, bp.d2, bp.at2]] as const;
  for (const [s, d, at] of rows) {
    const sys = s.trim() ? Number(s) : undefined;
    const dia = d.trim() ? Number(d) : undefined;
    if (sys === undefined && dia === undefined) continue;
    // Two numbers are a reading, judged by the engine as typed, even when one
    // cannot be used (R5-06); a box that is not a number at all leaves the
    // other to count alone, as an empty one does.
    if (sys !== undefined && dia !== undefined && Number.isFinite(sys) && Number.isFinite(dia)) continue;
    const severeSys = sys !== undefined && Number.isFinite(sys) && sys >= 180 && sys <= 300;
    const severeDia = dia !== undefined && Number.isFinite(dia) && dia >= 120 && dia <= 200;
    if (severeSys) out.push({ sys, at: at ?? stamp });
    else if (severeDia) out.push({ dia, at: at ?? stamp });
  }
  return out;
}

const samePartial = (a: BpPartialReading, b: BpPartialReading) => a.sys === b.sys && a.dia === b.dia && a.at === b.at;

/**
 * The complete readings on the form, each with the row it is in. The row is
 * its identity: clearing reading 1 leaves reading 2 as reading 2, with its
 * own time, rather than moving it up and stamping it again (scan C2-06).
 */
function formReadings(bp: BpFields): { row: 0 | 1; reading: BpReading }[] {
  const out: { row: 0 | 1; reading: BpReading }[] = [];
  const rows = [[bp.s1, bp.d1], [bp.s2, bp.d2]] as const;
  rows.forEach(([s, d], row) => {
    if (!s.trim() || !d.trim()) return;
    const reading = { sys: Number(s), dia: Number(d) };
    if (Number.isFinite(reading.sys) && Number.isFinite(reading.dia)) out.push({ row: row as 0 | 1, reading });
  });
  return out;
}

function lowToday(record: DailyCheckIn | undefined): boolean {
  if (!record) return false;
  const entries: GlucoseEntry[] = [...(record.glucoseEarlier ?? []), ...[record.glucose, record.glucoseDisplay].filter((x): x is GlucoseEntry => !!x)];
  return entries.some(e => ('display' in e ? e.display === 'LO' : glucoseSanity(e.value, e.unit) !== 'implausible'
    && glucoseSanity(e.value, e.unit) !== 'suspectUnit' && toMgdl(e.value, e.unit) < 70));
}

function episodesToAsk(profile: UserProfile, previous: DailyCheckIn | undefined, day?: { date: string; recent: readonly DailyCheckIn[] }): EpisodeSummary[] {
  const recent = [...(day?.recent ?? [])];
  if (previous) return evaluateCheckIn(profile, previous, recent.filter(c => c.date < previous.date)).episodes ?? [];
  return day ? profileOnlyReadiness(profile, { date: day.date, recent }).episodes ?? [] : [];
}

export function visibleQuestions(
  profile: UserProfile,
  form: CheckInForm,
  previous?: DailyCheckIn | CheckInRecord,
  day?: { date: string; recent: readonly DailyCheckIn[] },
): Visible {
  const h = profile.health;
  const d = deriveHealth(h);
  const unknown = profile.needsHealthReview === true;
  const diabetic = d.diabetic || h.diabetes === 'prediabetes' || unknown;
  const set = new Set(form.emergency ?? []);
  // SGLT2 inhibitors are also prescribed for heart and kidney disease: ketoacidosis signs are asked whenever ketones matter.
  const emergency = EMERGENCY_ORDER.filter(f => set.has(f) || diabetic || (f === 'dka' && d.ketoneRisk) || !DIABETES_EMERGENCIES.includes(f));
  const footRisk = diabetic || h.peripheralNeuropathy !== 'no';
  const news = NEWS_ORDER.filter(n => form.news.includes(n)
    || ((diabetic || !DIABETES_NEWS.includes(n)) && (footRisk || !FOOT_NEWS.includes(n))));
  const glucose = diabetic;
  const mg = formMgdl(form);
  const high = form.glucoseDisplay === 'HI' || (mg !== undefined && mg >= 250);
  const hasKetones = form.bloodKetones.trim() !== '' || form.urineKetones !== null;
  const kind = form.urineKetones !== null ? 'urine' : form.bloodKetones.trim() ? 'blood' : h.ketoneTest === 'urine' ? 'urine' : 'blood';
  // Ketones are asked of anyone who can make them — an SGLT2 inhibitor is also
  // prescribed for the heart and kidneys — and never gated behind a glucose
  // reading they may not take (Codex re-audit F12).
  const ketones = d.ketoneRisk || high || hasKetones ? kind : null;
  const bp = h.bpMonitor;
  const savedBp = [...(previous?.bpReadings ?? (previous?.bp ? [previous.bp] : [])), ...(previous?.bpEarlier ?? [])];
  // A severe number saved without its other half is as severe (B07): its
  // symptoms are asked about until it is answered as a typo.
  const savedHalf = !!previous && (previous.bpPartial ?? [])
    .some(r => severePartial(r) && standingAnswer(form.resolutions, bpPartialId(r, previous.date))?.resolution !== 'mistake');
  return {
    // Evaluated here rather than read off the stored readiness: a record saved
    // by an older version has none, and yesterday's readings are asked about
    // too, before today has a record of its own (round 3 B01).
    episodes: episodesToAsk(profile, previous, day),
    emergency,
    news,
    glucose,
    glucoseTrend: glucose && (h.glucoseMonitor === 'cgm' || form.source === 'sensor'),
    rapidInsulin: glucose && d.hypoRisk && (h.insulin !== 'none' || h.diabetes === 'type1'),
    ketones,
    back: profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica'),
    sciatica: profile.pain.areas.includes('sciatica'),
    bp,
    bpSymptoms: bp && (anySevereComponent(form.bp) || savedBp.some(isSevereBp) || savedHalf),
    lowRecovered: glucose && lowToday(previous) && mg !== undefined && mg >= 70,
  };
}

// ─── Answers about serious readings (round 3 B01) ───────────────────────────

export type EpisodeChoice = 'open' | 'mistake' | 'assessed' | 'resolved';

/** What the form currently says about one kind's readings: an answer given here, else what was saved. */
export function episodeChoice(form: CheckInForm, e: EpisodeSummary): EpisodeChoice {
  const each = e.readings.map(r => {
    const latest = standingAnswer(form.resolutions, r.id);
    if (latest) return latest.resolution === 'reopened' ? 'open' : latest.resolution;
    return r.settled ?? 'open';
  });
  return each.every(x => x === each[0]) ? each[0] : 'open';
}

/**
 * Record what the person said about the readings the sheet listed for one
 * kind. The answer names exactly those readings, so a reading taken later is
 * a new incident. Changing the answer in the same sitting replaces it; taking
 * back an answer given before appends `reopened`, which counts as the latest.
 */
export function answerEpisode(
  form: CheckInForm, kind: EpisodeSummary['kind'], readings: string[], choice: EpisodeChoice, now: Date, openedAt: Date,
): CheckInForm {
  // Given in this sitting, by instant: an answer from another device can carry any offset (N-03).
  const same = (a: EpisodeAnswer) => a.kind === kind && Date.parse(a.at) >= openedAt.getTime() && a.readings.length === readings.length && a.readings.every(id => readings.includes(id));
  const kept = form.resolutions.filter(a => !same(a));
  const earlier = kept.some(a => a.readings.some(id => readings.includes(id)) && a.resolution !== 'reopened');
  const at = now.toISOString();
  if (choice === 'open') {
    return { ...form, resolutions: earlier ? [...kept, { kind, readings, resolution: 'reopened', at }] : kept };
  }
  return { ...form, resolutions: [...kept, { kind, readings, resolution: choice, at }] };
}

// ─── What blocks saving ─────────────────────────────────────────────────────

const plausibleBp = (r: BpReading) => r.sys >= 40 && r.sys <= 300 && r.dia >= 20 && r.dia <= 200;
/** One box holds a usable number that is severe on its own (180 or more on top, 120 or more below). */
const severeHalf = (s: string, d: string) => {
  const sys = s.trim() ? Number(s) : Number.NaN;
  const dia = d.trim() ? Number(d) : Number.NaN;
  return (Number.isFinite(sys) && sys >= 180 && sys <= 300) || (Number.isFinite(dia) && dia >= 120 && dia <= 200);
};

function sameGlucose(a: GlucoseReading | undefined, value: number, unit: GlucoseUnit, at: string | null, confirmed = false): boolean {
  return !!a && a.value === value && a.unit === unit && (a.measuredAt ?? null) === at && (a.unitConfirmed === true) === confirmed;
}

/** Why the check-in can't be saved yet, or null. An emergency answer is never blocked. */
export function submitBlocked(form: CheckInForm, ctx: { profile: UserProfile; previous?: CheckInRecord; now?: Date }): string | null {
  if (form.emergency?.length) return null;
  if (form.emergency === null) return 'Answer “Right now, any of these?” first.';
  const v = visibleQuestions(ctx.profile, form, ctx.previous);
  const text = form.glucose.trim();
  if (v.glucose && !form.glucoseDisplay && text && !submitsGlucose(formSanity(form))) {
    return 'Check the glucose reading first.';
  }
  if (v.glucose && form.glucoseAt && ctx.now && Date.parse(form.glucoseAt) > ctx.now.getTime() + 2 * 60_000) {
    return 'That reading time is later than now. Check the time.';
  }
  if (v.ketones === 'blood' && form.bloodKetones.trim()) {
    const k = Number(form.bloodKetones.trim());
    if (!Number.isFinite(k) || k < 0) return 'Check the ketone reading.';
  }
  if (v.bp) {
    for (const [s, d] of [[form.bp.s1, form.bp.d1], [form.bp.s2, form.bp.d2]] as const) {
      if (!s.trim() && !d.trim()) continue;
      // A usable severe number is evidence the gate must see, whatever the other
      // box holds (R5-06): it is saved as it is, and the reading is asked again there.
      if (severeHalf(s, d)) continue;
      if (!s.trim() || !d.trim()) return 'Enter both blood pressure numbers, or clear the reading.';
      const r = { sys: Number(s), dia: Number(d) };
      if (!Number.isFinite(r.sys) || !Number.isFinite(r.dia) || !plausibleBp(r)) return 'Check the blood pressure reading.';
    }
  }
  // After a treat-and-recheck, the old number again is not a re-check.
  const prev = ctx.previous;
  if (v.glucose && prev?.readiness?.recheckMinutes) {
    const same = !form.glucoseDisplay && (!text || sameGlucose(prev.glucose, Number(text), form.unit, form.glucoseAt));
    if (same) return 'Enter your new glucose reading to carry on.';
  }
  return null;
}

/** True when this change ticks an emergency item that was not ticked before: save it now. */
export function saveOnEmergency(prev: EmergencyFlag[] | null, next: EmergencyFlag[] | null): boolean {
  return !!next && next.some(f => !(prev ?? []).includes(f));
}

// ─── Building the check-in ──────────────────────────────────────────────────

const sameEntry = (a: GlucoseEntry, b: GlucoseEntry) => ('display' in a
  ? 'display' in b && a.display === b.display && a.measuredAt === b.measuredAt
  : !('display' in b) && a.value === b.value && a.unit === b.unit && a.measuredAt === b.measuredAt);

const sameKetone = (a: KetoneReading, b: KetoneReading) => a.kind === b.kind && a.measuredAt === b.measuredAt
  && (a.kind === 'blood' ? b.kind === 'blood' && a.value === b.value : b.kind === 'urine' && a.category === b.category && a.value === b.value);

const sameBp = (a: BpReading, b: BpReading) => a.sys === b.sys && a.dia === b.dia && a.at === b.at;

function appendUnique<T>(list: T[], items: T[], same: (a: T, b: T) => boolean): T[] {
  const out = [...list];
  for (const x of items) if (!out.some(y => same(x, y))) out.push(x);
  return out;
}

function glucoseFromForm(form: CheckInForm, profile: UserProfile, previous: DailyCheckIn | undefined, stamp: string, v: Visible) {
  const prev = previous?.glucose;
  const prevShown = previous?.glucoseDisplay;
  const at = form.glucoseAt;
  if (form.glucoseDisplay) {
    if (prevShown && prevShown.display === form.glucoseDisplay && (prevShown.measuredAt ?? null) === at) return { glucoseDisplay: prevShown };
    const source = form.source ?? defaultSource(profile);
    const reading: GlucoseDisplayReading = { display: form.glucoseDisplay, measuredAt: at ?? stamp, ...(source ? { source } : {}) };
    return { glucoseDisplay: reading };
  }
  const text = form.glucose.trim();
  if (!text) return {};
  const value = Number(text);
  const sanity = formSanity(form);
  if (!submitsGlucose(sanity)) return {};
  // The saved reading, resubmitted untouched.
  if (sameGlucose(prev, value, form.unit, at, form.unitConfirmed)) return { glucose: prev };
  // The same reading with its unit confirmed: one measurement, not a new one.
  if (prev && form.unitConfirmed && sameGlucose(prev, value, form.unit, at)) {
    return { glucose: { ...prev, unitConfirmed: true }, corrected: prev };
  }
  // "I meant mmol/L" on an ambiguous low: the same reading with its unit fixed.
  if (prev && prev.unit === 'mg/dL' && form.unit === 'mmol/L' && prev.value === value
    && glucoseSanity(prev.value, prev.unit) === 'ambiguousLow' && (prev.measuredAt ?? null) === at) {
    return { glucose: { ...prev, unit: 'mmol/L' as const }, corrected: prev };
  }
  const source = form.source ?? defaultSource(profile);
  const reading: GlucoseReading = {
    value, unit: form.unit, measuredAt: at ?? stamp,
    ...(form.unitConfirmed ? { unitConfirmed: true } : {}),
    ...(source ? { source } : {}),
    ...(v.glucoseTrend && form.trend ? { trend: form.trend } : {}),
    ...(v.rapidInsulin && form.rapid ? { rapidInsulinLast2h: true } : {}),
  };
  return { glucose: reading };
}

function ketonesFromForm(form: CheckInForm, kind: 'blood' | 'urine', previous: DailyCheckIn | undefined, stamp: string): KetoneReading | undefined {
  const prev = previous?.ketones;
  if (kind === 'blood') {
    const text = form.bloodKetones.trim();
    if (!text) return prev && prev.kind !== 'blood' ? prev : undefined;
    const value = Number(text);
    if (!Number.isFinite(value)) return prev && prev.kind !== 'blood' ? prev : undefined;
    return prev?.kind === 'blood' && prev.value === value ? prev : { kind: 'blood', value, measuredAt: stamp };
  }
  const category = form.urineKetones;
  if (!category) return prev && prev.kind !== 'urine' ? prev : undefined;
  if (prev?.kind === 'urine' && (prev.category ?? (prev.value !== undefined ? URINE_FROM_VALUE(prev.value) : undefined)) === category) return prev;
  return { kind: 'urine', category, measuredAt: stamp };
}

export function buildCheckIn(
  form: CheckInForm,
  ctx: { date: string; profile: UserProfile; now: Date; previous?: DailyCheckIn },
): DailyCheckIn {
  const { profile, previous, now } = ctx;
  const stamp = now.toISOString();
  const v = visibleQuestions(profile, form, previous);
  const emergency = form.emergency ?? previous?.emergency ?? [];
  const ces = emergency.includes('bladderBowel') || emergency.includes('saddle');
  const prevBack = previous?.back;

  // Back: asked, from what the person answered on the form; not asked,
  // exactly what was saved. An untouched slider or list is not an answer, so
  // it adds nothing: no stored 0 for a pain nobody gave (J03, J16).
  const f = form.back;
  const said = form.answered;
  const asked: NonNullable<DailyCheckIn['back']> | undefined = v.back
    ? {
      ...(said.pain ? { pain: f.pain } : {}),
      ...(v.sciatica
        ? { ...(said.legPain ? { legPain: f.legPain } : {}), ...(f.reach ? { reach: f.reach } : {}) }
        : {
          ...(prevBack?.legPain !== undefined ? { legPain: prevBack.legPain } : {}),
          ...(prevBack?.reach !== undefined ? { reach: prevBack.reach } : {}),
        }),
      ...(said.backFlags
        ? {
          newNeuro: f.newWeakness || f.newSensory,
          newWeakness: f.newWeakness,
          weaknessFast: f.newWeakness && f.weaknessFast,
          newSensory: f.newSensory && !f.newWeakness,
          feverish: f.feverish,
          suddenSevere: f.suddenSevere,
          worseFunction: f.worseFunction,
        }
        : {}),
      ...(ces ? { caudaEquinaFlag: true } : said.backFlags ? { caudaEquinaFlag: false } : {}),
      // Said during a session, not asked here: kept.
      ...(prevBack?.spreadToday ? { spreadToday: true } : {}),
    }
    : undefined;
  const back: DailyCheckIn['back'] = v.back
    ? (asked && Object.keys(asked).length ? asked : undefined)
    : prevBack ? { ...prevBack, ...(ces || prevBack.caudaEquinaFlag ? { caudaEquinaFlag: true } : {}) } : undefined;

  // Glucose: a replaced or cleared reading moves to the earlier list.
  let glucose = previous?.glucose;
  let glucoseDisplay = previous?.glucoseDisplay;
  let glucoseEarlier = previous?.glucoseEarlier ?? [];
  if (v.glucose) {
    const next = glucoseFromForm(form, profile, previous, stamp, v);
    glucose = next.glucose;
    glucoseDisplay = next.glucoseDisplay;
    const kept: GlucoseEntry[] = [glucose, glucoseDisplay].filter((x): x is GlucoseEntry => !!x);
    const replaced = [previous?.glucose, previous?.glucoseDisplay]
      .filter((x): x is GlucoseEntry => !!x && x !== next.corrected && !kept.some(n => sameEntry(n, x)));
    glucoseEarlier = appendUnique(glucoseEarlier, replaced, sameEntry);
  }

  // Ketones: the same, on the strip's own scale or the meter's.
  let ketones = previous?.ketones;
  let ketonesEarlier = previous?.ketonesEarlier ?? [];
  if (v.ketones) {
    ketones = ketonesFromForm(form, v.ketones, previous, stamp);
    const prevKetones = previous?.ketones;
    if (prevKetones && !(ketones && sameKetone(prevKetones, ketones))) ketonesEarlier = appendUnique(ketonesEarlier, [prevKetones], sameKetone);
  }

  // Blood pressure: every raw reading kept, the average only for older screens.
  let bpReadings = previous?.bpReadings;
  let bp = previous?.bp;
  let bpEarlier = previous?.bpEarlier ?? [];
  if (v.bp) {
    const prevReadings = previous?.bpReadings ?? (previous?.bp ? [previous.bp] : []);
    const typed = formReadings(form.bp);
    const ats = [form.bp.at1, form.bp.at2];
    bpReadings = typed.map(({ row, reading: r }) => {
      const same = prevReadings[row];
      if (same && same.sys === r.sys && same.dia === r.dia) return same;
      return { ...r, at: ats[row] ?? stamp };
    });
    const replaced = prevReadings.filter(r => !bpReadings!.some(n => sameBp(n, r)));
    bpEarlier = appendUnique(bpEarlier, replaced, sameBp);
    bp = bpReadings.length
      ? {
        sys: Math.round(bpReadings.reduce((a, r) => a + r.sys, 0) / bpReadings.length),
        dia: Math.round(bpReadings.reduce((a, r) => a + r.dia, 0) / bpReadings.length),
      }
      : undefined;
  }
  // A severe number with the other box empty is kept as it is (B07): it
  // counts on its own, and the missing half is never invented. It stays in
  // the record: the engine reads it as the complete reading that completes it
  // while that reading stands, and never matches it to another (N-04).
  const typedPartial = v.bp ? formPartials(form.bp, stamp) : [];
  const bpPartial = [...(previous?.bpPartial ?? []), ...typedPartial]
    .filter((r, i, all) => all.findIndex(x => samePartial(x, r)) === i);
  // A toggle left where it started is not an answer either.
  const bpSymptoms = v.bpSymptoms && said.bpSymptoms ? form.bpSymptoms : previous?.bpSymptoms;
  const lowRecovered = v.lowRecovered && said.lowRecovered ? form.lowRecovered : previous?.lowRecovered;
  // "Feeling like a low is coming" is timed when it is first said, so only a
  // reading taken after it can answer it (round 3 B06).
  const reportsLow = form.news.includes('lowSymptoms');
  const lowSymptomsAt = reportsLow && !previous?.news.includes('lowSymptoms') ? stamp : previous?.lowSymptomsAt;
  const resolutions = form.resolutions;

  return {
    date: ctx.date,
    urgentSymptoms: emergency.length > 0 || (form.emergency === null && previous?.urgentSymptoms === true),
    emergency,
    // The news list holds only what was ticked: an empty one reports nothing.
    news: [...form.news],
    ...(form.sleep ? { sleep: form.sleep } : previous?.sleep ? { sleep: previous.sleep } : {}),
    ...(form.energy ? { energy: form.energy } : previous?.energy ? { energy: previous.energy } : {}),
    ...(back ? { back } : {}),
    ...(glucose ? { glucose } : {}),
    ...(glucoseDisplay ? { glucoseDisplay } : {}),
    ...(glucoseEarlier.length ? { glucoseEarlier } : {}),
    ...(ketones ? { ketones } : {}),
    ...(ketonesEarlier.length ? { ketonesEarlier } : {}),
    ...(bp ? { bp } : {}),
    ...(bpReadings?.length ? { bpReadings } : {}),
    ...(bpEarlier.length ? { bpEarlier } : {}),
    ...(bpPartial.length ? { bpPartial } : {}),
    ...(bpSymptoms !== undefined ? { bpSymptoms } : {}),
    ...(lowRecovered !== undefined ? { lowRecovered } : {}),
    ...(resolutions.length ? { resolutions } : {}),
    ...(lowSymptomsAt ? { lowSymptomsAt } : {}),
    ...(previous?.provoked?.length ? { provoked: [...previous.provoked] } : {}),
  };
}

/**
 * The safety net under every save: any reading the day's saved check-in held
 * that the new one no longer holds moves to the new one's earlier lists,
 * whoever built it. So a low, a positive ketone result or a severe blood
 * pressure reading stays on the day's record whatever is resubmitted.
 * Idempotent, and it keeps the one correction the form allows: "I meant
 * mmol/L" on an ambiguous low is the same reading, not a second one.
 */
export function carryForward(saved: DailyCheckIn | undefined, next: DailyCheckIn): DailyCheckIn {
  if (!saved || saved.date !== next.date) return next;
  const nextGlucose: GlucoseEntry[] = [...(next.glucoseEarlier ?? []), ...[next.glucose, next.glucoseDisplay].filter((x): x is GlucoseEntry => !!x)];
  const corrected = (e: GlucoseEntry) => !('display' in e) && !!next.glucose && e.unit === 'mg/dL' && next.glucose.unit === 'mmol/L'
    && e.value === next.glucose.value && e.measuredAt === next.glucose.measuredAt && glucoseSanity(e.value, e.unit) === 'ambiguousLow';
  const savedGlucose: GlucoseEntry[] = [...(saved.glucoseEarlier ?? []), ...[saved.glucose, saved.glucoseDisplay].filter((x): x is GlucoseEntry => !!x)];
  const lostGlucose = savedGlucose.filter(e => !nextGlucose.some(n => sameEntry(n, e)) && !corrected(e));

  const nextKetones = [...(next.ketonesEarlier ?? []), ...(next.ketones ? [next.ketones] : [])];
  const savedKetones = [...(saved.ketonesEarlier ?? []), ...(saved.ketones ? [saved.ketones] : [])];
  const lostKetones = savedKetones.filter(k => !nextKetones.some(n => sameKetone(n, k)));

  const nextBp = [...(next.bpEarlier ?? []), ...(next.bpReadings ?? (next.bp ? [next.bp] : []))];
  const savedBp = [...(saved.bpEarlier ?? []), ...(saved.bpReadings ?? (saved.bp ? [saved.bp] : []))];
  const lostBp = savedBp.filter(r => !nextBp.some(n => sameBp(n, r)));

  const glucoseEarlier = appendUnique(next.glucoseEarlier ?? [], lostGlucose, sameEntry);
  const ketonesEarlier = appendUnique(next.ketonesEarlier ?? [], lostKetones, sameKetone);
  const bpEarlier = appendUnique(next.bpEarlier ?? [], lostBp, sameBp);
  // A partial severe number, a reported low and an exercise that made symptoms
  // worse are evidence too: answers built from an older copy of the day must
  // not drop them (round 3 B04).
  const bpPartial = appendUnique(next.bpPartial ?? [], saved.bpPartial ?? [], samePartial);
  const provoked = [...new Set([...(saved.provoked ?? []), ...(next.provoked ?? [])])];
  const lowSymptomsAt = next.lowSymptomsAt ?? saved.lowSymptomsAt;
  // A red flag or foot problem said earlier today is not released by a later
  // answer about now (R5-01): it stays as said, until its own release.
  const reported = flagsIn(next);
  const flagsEarlier = [...new Set([...(next.flagsEarlier ?? []), ...(saved.flagsEarlier ?? []), ...flagsIn(saved)])].filter(f => !reported.includes(f));
  // Nor is an answer that ends the day, such as fainting: it holds for the
  // rest of it, unless it is answered as ticked by mistake.
  const newsEarlier = [...new Set([...(next.newsEarlier ?? []), ...(saved.newsEarlier ?? []), ...saved.news.filter(endsTheDay)])].filter(n => !next.news.includes(n));
  // Either, ticked again after an answer released it, is a new report: that
  // answer no longer settles it, and it is asked about again by name.
  const reopened = reopenedByReport(saved, next);
  // What the device had stored is read with the record, never saved inside it (N-01).
  const { flagsEarlier: _flags, newsEarlier: _news, durable: _durable, ...rest } = next;
  void _flags;
  void _news;
  void _durable;
  return {
    ...rest,
    ...(reopened.length ? { resolutions: [...(next.resolutions ?? []), ...reopened] } : {}),
    ...(flagsEarlier.length ? { flagsEarlier } : {}),
    ...(newsEarlier.length ? { newsEarlier } : {}),
    ...(glucoseEarlier.length ? { glucoseEarlier } : {}),
    ...(ketonesEarlier.length ? { ketonesEarlier } : {}),
    ...(bpEarlier.length ? { bpEarlier } : {}),
    ...(bpPartial.length ? { bpPartial } : {}),
    ...(provoked.length ? { provoked } : {}),
    ...(lowSymptomsAt ? { lowSymptomsAt } : {}),
  };
}

/** Reasons that are answered by a new glucose reading, not by the old one again. */
const NEW_GLUCOSE_REASONS = ['low', 'belowStart', 'falling', 'tooSoon', 'recheckNoTime', 'noReading', 'readingInvalid', 'suspectUnit', 'meterHi'];

/**
 * When the sheet reopens for a re-check or a stale reading, the old number
 * is not left in the box to be resubmitted by mistake.
 */
export function needsNewGlucose(record: CheckInRecord, needsCheckIn: boolean, permissionReasons: string[], staleTexts: readonly string[]): boolean {
  if (!needsCheckIn) return false;
  const codes = record.readiness?.reasons?.map(r => r.code) ?? [];
  return codes.some(c => NEW_GLUCOSE_REASONS.includes(c)) || permissionReasons.some(r => staleTexts.some(t => r.startsWith(t)));
}
