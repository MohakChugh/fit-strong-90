/**
 * Correcting a stored record. The store keeps the moment observed and marks
 * when the correction was made (`editedAt`), so a corrected day total becomes
 * the current statement, and a corrected reading says it was corrected.
 */

import { useId, useState } from 'react';
import { Sheet } from '@/components/hig/Sheet';
import type { BpReading } from '@/health/aggregate';
import { atOnDay, checkInDayOf, type Observation, type ObservationTag } from '@/health/observation';
import { correctCheckInGlucose, correctCheckInPain, correctCheckInPressure, type CorrectionResult } from '@/components/checkin/pending';
import { editObservation, putBloodPressure, update, useStore, type ObservationPatch } from '@/store/useStore';
import { glucoseEscalation, pressureEscalation } from './escalation';
import { displayUnitOf, formatValue, hasClockTime, isLabKind, unitLabel, type DisplayPrefs } from './format';
import { Guidance, type Shown } from './Guidance';
import { GLUCOSE_WHEN, PRESSURE_WHEN, resolveDay, resolveEditedTime, toLocalInput } from './logKinds';
import { checkPressure, checkValue } from './plausible';
import { CHECK_IN_TIME, rewritable } from './records';
import { CORRECT_WORDS, saveWithGuidance } from './saving';
import { ChoiceChips, ErrorText, Hint, NumberField, PrimaryButton, UnitSwitch } from './ui';
import { DayRow, TimeRow } from './WhenRows';
import { convert, decimalsFor, roundTo, toCanonical, type GlucoseUnit } from './units';
import { useToday } from './useToday';


/** Units a kind may be edited in: its stored units, plus pounds and inches for reading weight and waist. */
function editUnits(kind: Observation['kind']): readonly string[] {
  switch (kind) {
    case 'glucose': return ['mg/dL', 'mmol/L'];
    case 'weight': return ['kg', 'lb'];
    case 'waist': return ['cm', 'in'];
    case 'hba1c': return ['%', 'mmol/mol'];
    case 'b12': return ['pg/mL', 'pmol/L'];
    case 'vitaminD': return ['ng/mL', 'nmol/L'];
    default: return [];
  }
}

export function EditReadingSheet({ open, onOpenChange, observation, prefs }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  observation: Observation;
  prefs: DisplayPrefs;
}) {
  const [shown, setShown] = useState<Shown>();
  const close = (next: boolean) => {
    if (!next) setShown(undefined);
    onOpenChange(next);
  };
  return (
    <Sheet open={open} onOpenChange={close} title={shown ? 'What to do' : 'Correct this record'} detent="large">
      {open && (shown
        ? <Guidance shown={shown} onDone={() => close(false)} />
        : <EditReadingForm observation={observation} prefs={prefs} onDone={() => close(false)} onGuidance={setShown} />)}
    </Sheet>
  );
}

/**
 * A correction that puts a reading in the safety contract's range gets the
 * same guidance a new reading does, shown before the correction is saved and
 * whatever becomes of the save (F01), and asked about first: a corrected
 * reading may be from just now or long ago, and only the person knows which
 * — and whether it has been settled since (F03, R03). No time limit decides it.
 */
interface CorrectionProps {
  /** Closes the sheet once a correction with nothing more to say is saved. */
  onDone: () => void;
  /** Shows the guidance, with the correction's write already started. */
  onGuidance: (shown: Shown) => void;
}

function EditReadingForm({ observation: o, prefs, onDone, onGuidance }: { observation: Observation; prefs: DisplayPrefs } & CorrectionProps) {
  const errorId = useId();
  const current = useToday();
  const { profile } = useStore();
  // A check-in's reading is corrected where every gate reads it too (C2-01).
  const checkInDay = checkInDayOf(o);
  const units = editUnits(o.kind);
  const startUnit = units.length > 0 ? displayUnitOf(o.kind, prefs, o.unit) : o.unit;
  const [unit, setUnit] = useState(startUnit);
  const shownIn = (u: string) => String(roundTo(convert(o.kind, o.value, o.unit, u), decimalsFor(o.kind, u) + 1));
  const [raw, setRaw] = useState(() => shownIn(startUnit));
  // Until the number is typed over, it is the stored one: a unit switch then
  // converts it, and saving keeps the stored figure exactly. Once typed, the
  // number is the person's, and the switch says which unit it is in.
  const [typed, setTyped] = useState(false);
  // A check-in's reading keeps its time: the check-in finds its readings by
  // the time they were taken, so a moved one would be recorded twice (C2-01).
  const timed = o.scope === 'pointInTime' && hasClockTime(o) && checkInDay === undefined;
  const dated = isLabKind(o.kind);
  // The reading's own wall time; an edit is read in the same offset (F13).
  const [time, setTime] = useState<string | undefined>(() => (timed ? toLocalInput(o.at) : undefined));
  const [timeTouched, setTimeTouched] = useState(false);
  const [day, setDay] = useState<string | undefined>(() => (dated ? o.day : undefined));
  const [tag, setTag] = useState<ObservationTag | undefined>(o.tag);
  const [note, setNote] = useState(o.note ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const noteId = useId();

  const switchUnit = (next: string) => {
    if (!typed) setRaw(shownIn(next));
    setUnit(next);
    setError(undefined);
  };

  const save = async () => {
    const checked = checkValue(o.kind, raw, unit);
    if (!checked.ok) return setError(checked.message);
    let at: string | undefined;
    // An untouched time is not rewritten at all: it stays exactly as saved.
    if (timed && timeTouched && time !== undefined) {
      const when = resolveEditedTime(time, o.at);
      if (!when.ok) return setError(when.message);
      if (Date.parse(when.at) !== Date.parse(o.at)) at = when.at;
    } else if (dated) {
      const target = resolveDay(day, current);
      if (!target.ok) return setError(target.message);
      if (target.day !== o.day) at = atOnDay(target.day);
    }
    // Pounds and inches are a way of reading kilograms and centimetres, the
    // only units those kinds are stored in.
    const display = unit === 'lb' || unit === 'in';
    const value = !typed ? o.value : display ? toCanonical(o.kind, checked.value, unit) : checked.value;
    const storedUnit = !typed || display ? o.unit : unit;
    // Only what changed: an untouched number stays exactly as stored.
    const patch: ObservationPatch = {};
    if (typed) {
      patch.value = value;
      patch.unit = storedUnit;
    }
    if (at !== undefined) patch.at = at;
    if (note.trim() !== (o.note ?? '')) patch.note = note.trim() === '' ? null : note.trim();
    if (o.kind === 'glucose' && tag !== o.tag) {
      patch.tag = tag ?? null;
      // A meal start belongs to an after-meal reading only.
      if (tag !== 'afterMeal' && o.mealStartedAt !== undefined) patch.mealStartedAt = null;
    }
    if (Object.keys(patch).length === 0) return onDone();
    // Judged on the corrected figure, before the write (F01): only a changed
    // number can bring new guidance.
    const escalation = o.kind === 'glucose' && typed ? glucoseEscalation(value, storedUnit as GlucoseUnit, profile) : undefined;
    const write = async (): Promise<string | undefined> => {
      let own = patch;
      const renumbered = patch.value !== undefined && (patch.value !== o.value || patch.unit !== o.unit);
      if (checkInDay && profile && renumbered) {
        const result = await correctInCheckIn(o, value, storedUnit, { profile, update, date: checkInDay });
        if (result?.matched) {
          if (!result.stored) return result.failure;
          // The number went with the record; what is left is the reading's own.
          const { value: _value, unit: _unit, ...rest } = patch;
          void _value; void _unit;
          own = rest;
        }
      }
      if (Object.keys(own).length === 0) return undefined;
      const result = await editObservation(o.id, own);
      return result.ok ? undefined : result.failure.message;
    };
    setError(undefined);
    setBusy(true);
    const failure = await saveWithGuidance({
      escalation,
      write,
      show: pending => escalation && onGuidance({
        figure: formatValue(value, 'glucose', storedUnit).replace(` ${storedUnit}`, ''), unit: storedUnit, escalation,
        ask: true, pending, retry: write, words: CORRECT_WORDS,
      }),
    });
    setBusy(false);
    if (escalation) return;
    if (failure !== undefined) return setError(failure);
    onDone();
  };

  return (
    <>
      <NumberField
        label="Value"
        mode={Number.isInteger(o.value) && decimalsFor(o.kind, unit) === 0 ? 'numeric' : 'decimal'}
        value={raw}
        onChange={v => { setRaw(v); setTyped(true); setError(undefined); }}
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit={unitLabel(unit)}
        switcher={units.length > 0 ? <UnitSwitch label="Unit" units={units} value={unit} onChange={switchUnit} /> : undefined}
      />
      {o.kind === 'glucose' && (
        <ChoiceChips legend="When" options={GLUCOSE_WHEN.map(w => ({ id: w.tag, label: w.label }))} value={tag} onChange={setTag} />
      )}
      {/* Clearing a field in a correction keeps the original time rather than
          turning it into "now". */}
      {timed && <TimeRow value={time} onChange={v => { if (v !== undefined) { setTime(v); setTimeTouched(true); } }} />}
      {checkInDay && o.scope === 'pointInTime' && <Hint>{CHECK_IN_TIME}</Hint>}
      {dated && <DayRow value={day} onChange={v => v !== undefined && setDay(v)} label="Date of test" />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">Note (optional)</label>
        <textarea
          id={noteId}
          value={note}
          maxLength={500}
          rows={2}
          onChange={e => setNote(e.target.value)}
          className="min-h-11 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-body)] outline-none ring-1 ring-transparent focus:ring-tint"
        />
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</PrimaryButton>
    </>
  );
}

/**
 * A check-in's glucose or pain score corrected in the record and its reading
 * together, or undefined for a reading the check-in never holds.
 */
function correctInCheckIn(
  o: Observation,
  value: number,
  unit: string | undefined,
  deps: Parameters<typeof correctCheckInGlucose>[1],
): Promise<CorrectionResult> | undefined {
  if (o.kind === 'glucose' && o.unit && (unit === 'mg/dL' || unit === 'mmol/L')) {
    return correctCheckInGlucose({ ...(o.timeUnknown ? {} : { at: o.at }), was: { value: o.value, unit: o.unit }, to: { value, unit } }, deps);
  }
  if (o.kind === 'backPain' || o.kind === 'legPain') return correctCheckInPain({ kind: o.kind, was: o.value, to: value }, deps);
  return undefined;
}

export function EditPressureSheet({ open, onOpenChange, reading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reading: BpReading;
}) {
  const [shown, setShown] = useState<Shown>();
  const close = (next: boolean) => {
    if (!next) setShown(undefined);
    onOpenChange(next);
  };
  return (
    <Sheet open={open} onOpenChange={close} title={shown ? 'What to do' : 'Correct this reading'} detent="large">
      {open && (shown
        ? <Guidance shown={shown} onDone={() => close(false)} />
        : <EditPressureForm reading={reading} onDone={() => close(false)} onGuidance={setShown} />)}
    </Sheet>
  );
}

function EditPressureForm({ reading: r, onDone, onGuidance }: { reading: BpReading } & CorrectionProps) {
  const errorId = useId();
  const { profile } = useStore();
  const whole = rewritable(r);
  const systolicHalf = r.halves.find(h => h.kind === 'bloodPressureSystolic');
  const diastolicHalf = r.halves.find(h => h.kind === 'bloodPressureDiastolic');
  const [s, setS] = useState(r.systolic !== null ? String(r.systolic) : '');
  const [d, setD] = useState(r.diastolic !== null ? String(r.diastolic) : '');
  const [tag, setTag] = useState<'morning' | 'evening' | undefined>(r.tag === 'morning' || r.tag === 'evening' ? r.tag : undefined);
  const [time, setTime] = useState<string | undefined>(() => (hasClockTime(r.halves[0]) ? toLocalInput(r.at) : undefined));
  const [timeTouched, setTimeTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(undefined);
    // Both numbers, when the reading has both; a missing half is never invented.
    let sys: number | null = r.systolic;
    let dia: number | null = r.diastolic;
    if (systolicHalf && diastolicHalf) {
      const checked = checkPressure(s, d);
      if (!checked.ok) return setError(checked.message);
      sys = checked.systolic;
      dia = checked.diastolic;
    } else if (systolicHalf) {
      const checked = checkValue('bloodPressureSystolic', s, 'mmHg');
      if (!checked.ok) return setError(`Top number: ${checked.message}`);
      sys = checked.value;
    } else if (diastolicHalf) {
      const checked = checkValue('bloodPressureDiastolic', d, 'mmHg');
      if (!checked.ok) return setError(`Bottom number: ${checked.message}`);
      dia = checked.value;
    }
    // An untouched time stays exactly as saved; an edited one is read in the
    // reading's own offset (F13). A check-in's reading keeps its time and timing.
    let at: string | undefined;
    if (whole && timeTouched && time !== undefined) {
      const when = resolveEditedTime(time, r.at);
      if (!when.ok) return setError(when.message);
      at = when.at;
    }
    const startTag = r.tag === 'morning' || r.tag === 'evening' ? r.tag : undefined;
    // Unchanged, set, or cleared: `null` clears it (T3-04).
    const tagPatch = whole && tag !== startTag ? { tag: tag ?? null } : {};
    const changed = sys !== r.systolic || dia !== r.diastolic;
    if (!changed && at === undefined && !('tag' in tagPatch)) return onDone();
    const checkInDay = checkInDayOf(r.halves[0]);
    const write = async (): Promise<string | undefined> => {
      // A check-in's reading is corrected where every movement gate reads it
      // too — the check-in record — with its readings, in one write (T3-01).
      if (checkInDay && profile && changed && sys !== null && dia !== null && r.systolic !== null && r.diastolic !== null) {
        const timed = !r.halves.some(h => h.timeUnknown);
        const result = await correctCheckInPressure(
          { ...(timed ? { at: r.at } : {}), was: { sys: r.systolic, dia: r.diastolic }, to: { sys, dia } },
          { profile, update, date: checkInDay },
        );
        // Not in the record (taken out since): only the readings are corrected.
        if (result.matched) return result.stored ? undefined : result.failure;
      }
      // Both numbers in one write, the reading's halves, context and metadata kept.
      if (sys !== null && dia !== null) {
        const result = await putBloodPressure({
          readingId: r.id, systolic: sys, diastolic: dia,
          ...(at !== undefined ? { at } : {}),
          ...tagPatch,
        });
        return result.ok ? undefined : result.failure.message;
      }
      const half = systolicHalf ?? diastolicHalf;
      if (!half) return undefined;
      const result = await editObservation(half.id, { value: (half === systolicHalf ? sys : dia) as number });
      return result.ok ? undefined : result.failure.message;
    };
    // Judged on the corrected numbers, before the write (F01). Either number alone is enough.
    const escalation = changed ? pressureEscalation(sys ?? 0, dia ?? 0, profile) : undefined;
    setBusy(true);
    const failure = await saveWithGuidance({
      escalation,
      write,
      show: pending => escalation && onGuidance({
        figure: `${sys ?? '–'}/${dia ?? '–'}`, unit: 'mmHg', escalation, ask: true, pending, retry: write, words: CORRECT_WORDS,
      }),
    });
    setBusy(false);
    if (escalation) return;
    if (failure !== undefined) return setError(failure);
    onDone();
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
        {systolicHalf || whole
          ? <NumberField label="Top (systolic)" mode="numeric" value={s} onChange={v => { setS(v); setError(undefined); }} invalid={!!error} describedBy={error ? errorId : undefined} />
          : <p className="self-end rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] text-muted-foreground">Top number not entered</p>}
        {diastolicHalf || whole
          ? <NumberField label="Bottom (diastolic)" mode="numeric" value={d} onChange={v => { setD(v); setError(undefined); }} invalid={!!error} describedBy={error ? errorId : undefined} />
          : <p className="self-end rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] text-muted-foreground">Bottom number not entered</p>}
      </div>
      {whole && (
        <>
          <ChoiceChips legend="When" options={PRESSURE_WHEN.map(w => ({ id: w.tag, label: w.label }))} value={tag} onChange={setTag} />
          <TimeRow value={time} onChange={v => { if (v !== undefined) { setTime(v); setTimeTouched(true); } }} />
        </>
      )}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</PrimaryButton>
    </>
  );
}
