/**
 * The check-in sheet's own state machine, kept out of the component so every
 * transition the safety of the app depends on can be tested (Codex re-audit
 * F01, F04, F05; round 3 B02).
 *
 * The rules it exists to enforce:
 * 1. A measurement keeps its identity and its time across a save. Resubmitting
 *    an unchanged reading must never give it a new timestamp.
 * 2. Only records decide: the one the save produced, the one the app holds
 *    now (`incoming`, which can change while the sheet is open), and the
 *    answers just given, evaluated at once so a stop never waits for storage.
 *    The banner and the Start button follow the strictest of them.
 * 3. Saves complete in any order. Only the latest submission may change the
 *    form or the outcome, so an older reply can never replace a newer report.
 * 4. An answer the device would not store still counts, and says so.
 */

import type { CheckInRecord, DailyCheckIn, Mode } from '@/types/checkin';
import { DISPOSITION_ORDER } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { evaluateCheckIn } from '@/engine/readiness';
import { permission, PERMISSION_TEXT, type Permission } from '@/engine/permission';
import { timeOf } from '@/lib/time';
import { carryForward, emptyForm, formFromRecord, needsNewGlucose, type CheckInForm } from './form';

export interface SheetState {
  form: CheckInForm;
  /** The last record a save produced, or the day's record when the sheet opened. */
  record?: CheckInRecord;
  /** The latest answers submitted, evaluated here, until their save completes. */
  optimistic?: CheckInRecord;
  /** The latest save was refused by the device. */
  unsaved: boolean;
  view: 'form' | 'outcome';
  /** The reading that was cleared because it is too old to start on, for the hint. */
  lastReading?: string;
  /** The latest submission. A save that completes for an older one changes nothing. */
  seq: number;
  /** The form was changed after the latest submission. */
  edited: boolean;
}

export interface SaveOutcome {
  record: CheckInRecord;
  stored: boolean;
}

export interface SheetContext {
  profile: UserProfile;
  date: string;
  mode: Mode;
  now: Date;
  recent?: DailyCheckIn[];
}

const STALE = [PERMISSION_TEXT.stale, PERMISSION_TEXT.staleNoTime, PERMISSION_TEXT.future] as const;

const ask = (record: CheckInRecord | undefined, ctx: SheetContext) =>
  permission({ profile: ctx.profile, checkIn: record, now: ctx.now, ...(ctx.recent ? { recent: ctx.recent } : {}) }, ctx.mode);

/** What the sheet shows for `date` when it opens. */
export function openSheet(ctx: SheetContext, saved: CheckInRecord | undefined): SheetState {
  const record = saved?.date === ctx.date ? saved : undefined;
  const p = ask(record, ctx);
  const fresh = !!record && needsNewGlucose(record, p.needsCheckIn, p.reasons, STALE);
  const base = record ? formFromRecord(record, ctx.profile) : emptyForm(ctx.profile);
  const g = record?.glucose;
  return {
    form: fresh ? { ...base, glucose: '', glucoseAt: null, glucoseDisplay: null } : base,
    ...(record ? { record } : {}),
    unsaved: false,
    view: record && !p.needsCheckIn ? 'outcome' : 'form',
    ...(fresh && g ? { lastReading: `${g.value} ${g.unit}${g.measuredAt && timeOf(g.measuredAt) ? ` at ${timeOf(g.measuredAt)}` : ''}` } : {}),
    seq: 0,
    edited: false,
  };
}

/** The person changed something on the form. */
export function editForm(state: SheetState, change: (f: CheckInForm) => CheckInForm): SheetState {
  return { ...state, form: change(state.form), edited: true };
}

/**
 * Answers handed to the save, numbered `seq`. They are evaluated against the
 * sheet's own record straight away, so an emergency shows before storage
 * replies, and what they say counts towards the strictest record from now on.
 */
export function submitted(state: SheetState, answers: DailyCheckIn, ctx: SheetContext, seq: number): SheetState {
  const recent = (ctx.recent ?? []).filter(c => c.date < answers.date);
  const merged = carryForward(state.record, answers);
  return { ...state, optimistic: { ...merged, readiness: evaluateCheckIn(ctx.profile, merged, recent) }, seq, edited: false };
}

/**
 * The sheet after save `seq` completes.
 *
 * Only the latest submission counts: an older one finishing late leaves the
 * form and the outcome alone, so it can never clear a newer emergency answer.
 * The form is rebuilt from the record the save produced, which keeps a
 * measurement's identity — an unchanged reading carries its own time forward
 * instead of being stamped again — unless it was edited while the save was on
 * its way, when the edits stay and only the reading's time is carried over.
 */
export function afterSave(state: SheetState, outcome: SaveOutcome, ctx: SheetContext, seq: number): SheetState {
  if (seq !== state.seq) return state;
  const { optimistic: _done, ...rest } = state;
  void _done;
  return {
    ...rest,
    record: outcome.record,
    form: state.edited ? keepIdentity(state.form, outcome.record) : formFromRecord(outcome.record, ctx.profile),
    unsaved: !outcome.stored,
    view: 'outcome',
  };
}

/** An edited form keeps its edits; an untouched glucose number keeps the saved reading's time. */
function keepIdentity(form: CheckInForm, record: CheckInRecord): CheckInForm {
  const g = record.glucose;
  if (!g || form.glucoseAt || form.glucoseDisplay) return form;
  return form.glucose.trim() === String(g.value) && form.unit === g.unit && g.measuredAt ? { ...form, glucoseAt: g.measuredAt } : form;
}

const strictness = (p: Permission) => [p.allowed ? 0 : 1, DISPOSITION_ORDER.indexOf(p.disposition), p.needsCheckIn ? 1 : 0];
const stricter = (a: Permission, b: Permission) => {
  const x = strictness(a), y = strictness(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/**
 * What the banner and the Start button must obey: the strictest of the record
 * the app holds now, the sheet's last saved record and the answers just given.
 * A stop that arrives from anywhere shows at once; nothing can loosen it until
 * every one of them agrees.
 */
export function sheetGate(state: SheetState, ctx: SheetContext, incoming?: CheckInRecord): { permission: Permission; record: CheckInRecord } | undefined {
  const candidates = [incoming?.date === ctx.date ? incoming : undefined, state.record, state.optimistic]
    .filter((r): r is CheckInRecord => !!r);
  let best: { permission: Permission; record: CheckInRecord } | undefined;
  for (const record of candidates) {
    const p = ask(record, ctx);
    if (!best || stricter(p, best.permission)) best = { permission: p, record };
  }
  return best;
}

/** Back to the questions. */
export function changeAnswers(state: SheetState): SheetState {
  return { ...state, view: 'form' };
}

/** Clear the glucose boxes for a re-check. */
export function newReading(state: SheetState): SheetState {
  return { ...state, view: 'form', form: { ...state.form, glucose: '', glucoseAt: null, glucoseDisplay: null, lowRecovered: false } };
}
