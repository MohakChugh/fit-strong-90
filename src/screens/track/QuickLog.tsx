/**
 * Quick Log: record one fact in seconds. A short list of what can be logged,
 * then one screen per kind with a big number field, the unit, the time and
 * the context that changes what the number means. Save is the only primary
 * action. If the number is in the safety contract's emergency or same-day
 * range, the guidance appears straight after saving and stays until read.
 */

import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, DumbbellIcon } from 'lucide-react';
import { Sheet } from '@/components/hig/Sheet';
import { Group, Row } from '@/components/hig/List';
import { entryFor, summariseDay } from '@/health/aggregate';
import { atOnDay, bpContext, nowAt, type ObservationInput, type ObservationTag } from '@/health/observation';
import {
  addObservation, addObservations, addToDayTotal, editObservation, useStore,
} from '@/store/useStore';
import { glucoseEscalation, meterEscalation, mostUrgent, pressureEscalation, type Escalation } from './escalation';
import { Guidance, type Shown } from './Guidance';
import { formatClock, formatDayShort, formatObservation, formatValue, kindTitle, type DisplayPrefs } from './format';
import { checkPressure, checkValue, meterDisplay, parseNumber, unitQuestion } from './plausible';
import {
  GLUCOSE_WHEN, GLUCOSE_WHEN_HINT, LAB_OPTIONS, LOG_OPTIONS, PRESSURE_WHEN, dayTotalWrite, defaultGlucoseUnit,
  glassMl, logOrder, mealStart, repeatTimes, resolveDay, resolveTime, type AddRequest, type LabKind, type LogKind,
} from './logKinds';
import { NOT_ADVICE } from './targets';
import { DayRow, TimeRow } from './WhenRows';
import { saveWithGuidance } from './saving';
import { clearQuickLogDraft, draftStorage, keptDraft, storeQuickLogDraft, type QuickLogDraft } from './draft';
import { ChoiceChips, EmergencySigns, ErrorText, Hint, NumberField, PrimaryButton, Segmented, UnitSwitch } from './ui';
import { toCanonical, type GlucoseUnit } from './units';
import { useToday } from './useToday';

export interface SavedResult {
  /** The day the record landed on, so My Day can show it arriving. */
  day: string;
  ids: string[];
  /** "Glucose 112 mg/dL", for the confirmation and for a screen reader. */
  summary: string;
  figure: string;
  unit: string;
  /** Set when guidance is already showing for this reading: the sheet stays open on it. */
  escalation?: Escalation;
}

type Step =
  | { view: 'choose' }
  | { view: 'form'; kind: LogKind; lab?: LabKind; fromList: boolean }
  /** `key` is new for each guidance shown, so its answers and save status start afresh. */
  | { view: 'guidance'; shown: Shown; key: number };

function startStep(initial: AddRequest | undefined): Step {
  return initial ? { view: 'form', kind: initial.kind, ...(initial.lab ? { lab: initial.lab } : {}), fromList: false } : { view: 'choose' };
}

export function QuickLog({ open, onOpenChange, initial, onSaved, prefs, day }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open straight onto one form, as `?add=` does. */
  initial?: AddRequest;
  onSaved: (result: SavedResult) => void;
  prefs: DisplayPrefs;
  /** The day being looked at. A past day's workout is logged for that day. */
  day?: string;
}) {
  const { profile } = useStore();
  const navigate = useNavigate();
  const current = useToday();
  const field = useRef<HTMLInputElement>(null);
  const pastDay = day !== undefined && day < current ? day : undefined;
  const [step, setStep] = useState<Step>(() => startStep(initial));
  // Each opening starts afresh, and so does a new `?add=` while open (a link
  // followed with the sheet up). Reset while rendering, not in an effect, so
  // the first frame is already the right step.
  const asked = initial ? `${initial.kind}:${initial.lab ?? ''}` : '';
  const [was, setWas] = useState({ open, asked });
  if (open !== was.open || asked !== was.asked) {
    setWas({ open, asked });
    if (open) setStep(startStep(initial));
  }

  // A reading with guidance is already showing it (shown before the write
  // settled, F01), and the guidance updates its own save status. Anything else
  // closes the sheet once it is saved.
  const saved = (result: SavedResult) => {
    onSaved(result);
    if (!result.escalation) onOpenChange(false);
  };

  // Closing a glucose or blood-pressure form, or the guidance after one, is
  // leaving the reading: its kept draft goes too. A reload is not a close.
  const keeps = step.view === 'guidance' || (step.view === 'form' && (step.kind === 'glucose' || step.kind === 'bloodPressure'));
  const close = (next: boolean) => {
    if (!next && keeps) clearQuickLogDraft(draftStorage());
    onOpenChange(next);
  };

  const title = step.view === 'choose'
    ? 'Add'
    : step.view === 'guidance'
      ? 'What to do'
      : step.kind === 'lab' ? 'Lab result' : LOG_OPTIONS[step.kind].title;

  return (
    <Sheet open={open} onOpenChange={close} title={title} detent="large">
      {step.view === 'choose' && (
        <>
          <Group>
            {logOrder(profile).map(kind => (
              <Row
                key={kind}
                as="button"
                type="button"
                label={LOG_OPTIONS[kind].title}
                detail={LOG_OPTIONS[kind].detail}
                chevron
                onClick={() => {
                  // Render the form inside the tap and focus its field, so iOS
                  // opens the number pad at once instead of waiting for a second tap.
                  flushSync(() => setStep({ view: 'form', kind, fromList: true }));
                  field.current?.focus();
                }}
              />
            ))}
          </Group>
          <Group>
            <Row
              as="button"
              type="button"
              icon={<DumbbellIcon aria-hidden />}
              label="Workout"
              detail={pastDay ? `Log sets for ${formatDayShort(pastDay, current)}` : 'Log sets without coaching'}
              chevron
              // Only a navigation: closing the sheet first would also rewrite
              // My Day's address, and that second navigation could win the race
              // and bring the person straight back. Leaving My Day closes it.
              onClick={() => navigate(pastDay ? `/track/workout?date=${pastDay}` : '/track/workout', { viewTransition: true })}
            />
          </Group>
        </>
      )}

      {step.view === 'form' && (
        <>
          {step.fromList && (
            <button
              type="button"
              onClick={() => {
                if (keeps) clearQuickLogDraft(draftStorage());
                setStep({ view: 'choose' });
              }}
              className="press-feedback -my-2 -ml-1 flex min-h-11 items-center gap-0.5 self-start pr-2 text-[length:var(--text-body)] text-tint"
            >
              <ChevronLeftIcon className="size-5" strokeWidth={2.2} aria-hidden />
              All types
            </button>
          )}
          <LogForm kind={step.kind} lab={step.lab} fieldRef={field} onSaved={saved} onGuidance={shown => setStep({ view: 'guidance', shown, key: Date.now() })} prefs={prefs} />
        </>
      )}

      {step.view === 'guidance' && <Guidance key={step.key} shown={step.shown} onDone={() => close(false)} />}
    </Sheet>
  );
}

interface FormProps {
  fieldRef: Ref<HTMLInputElement>;
  onSaved: (result: SavedResult) => void;
  /** Show guidance now: for a meter's HI or LO, with nothing saved; for a dangerous reading, while its write settles. */
  onGuidance: (shown: Shown) => void;
  prefs: DisplayPrefs;
}

function LogForm({ kind, lab, ...props }: FormProps & { kind: LogKind; lab?: LabKind }) {
  switch (kind) {
    case 'glucose': return <GlucoseForm {...props} />;
    case 'bloodPressure': return <PressureForm {...props} />;
    case 'backLeg': return <PainForm {...props} />;
    case 'weight': return <MeasureForm {...props} kind="weight" />;
    case 'waist': return <MeasureForm {...props} kind="waist" />;
    case 'water': return <WaterForm {...props} />;
    case 'steps': return <TotalForm {...props} kind="steps" />;
    case 'sleep': return <TotalForm {...props} kind="sleep" />;
    case 'lab': return <LabForm {...props} initial={lab ?? 'hba1c'} />;
  }
}

/** Shared by every form: the error under the fields, and Save. */
function SaveBar({ error, busy, onSave, label = 'Save', errorId }: {
  error?: string;
  busy: boolean;
  onSave: () => void;
  label?: string;
  errorId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      <PrimaryButton onClick={onSave} disabled={busy}>{busy ? 'Saving…' : label}</PrimaryButton>
    </div>
  );
}

// ============================================================================
// Glucose
// ============================================================================

type MeterShows = 'number' | 'HI' | 'LO';

function GlucoseForm({ fieldRef, onSaved, onGuidance, prefs }: FormProps) {
  const { profile, observations } = useStore();
  const errorId = useId();
  // A reading typed and not saved — the page reloaded, or the device refused
  // the save — comes back as it was, under the same id (J17).
  const [kept] = useState(() => keptDraft('glucose', observations));
  const [id] = useState(() => kept?.id ?? readingStem('glucose'));
  const [raw, setRaw] = useState(kept?.raw ?? '');
  const [unit, setUnit] = useState<GlucoseUnit>(() => kept?.unit ?? defaultGlucoseUnit(profile));
  const [tag, setTag] = useState<ObservationTag | undefined>(kept?.tag);
  const [meal, setMeal] = useState(kept?.meal ?? '');
  const [time, setTime] = useState<string | undefined>(kept?.time);
  // When Save was first tapped: what the time stands for while left at Now.
  const [savedAt, setSavedAt] = useState<string | undefined>(kept?.at);
  const [refused, setRefused] = useState(kept?.refused === true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [askDisplay, setAskDisplay] = useState(false);
  const [shows, setShows] = useState<MeterShows>('number');

  // HI or LO, chosen below or typed as letters on a keyboard that has them.
  const display = shows !== 'number' ? shows : meterDisplay(raw);
  const typed = parseNumber(raw);
  const question = typed !== undefined ? unitQuestion('glucose', typed, unit) : undefined;
  const hint = tag ? GLUCOSE_WHEN_HINT[tag] : undefined;

  const draft: QuickLogDraft | undefined = raw.trim() !== '' || tag !== undefined || meal !== '' || time !== undefined
    ? {
      kind: 'glucose', id, raw, unit,
      ...(tag ? { tag } : {}), ...(meal ? { meal } : {}), ...(time !== undefined ? { time } : {}),
      ...(savedAt ? { at: savedAt } : {}), ...(refused ? { refused: true as const } : {}),
    }
    : undefined;
  useKeptDraft(draft);

  const save = async () => {
    if (display) {
      // Nothing is saved: no number is invented for a meter's HI or LO (H-DATA).
      return onGuidance({ figure: display, unit: '', label: 'Not saved: HI and LO are not numbers', escalation: meterEscalation(display, unit, profile) });
    }
    const checked = checkValue('glucose', raw, unit);
    if (!checked.ok) return setError(checked.message);
    const moment = savedAt ?? nowAt();
    const when = time !== undefined ? resolveTime(time) : { ok: true as const, at: moment };
    if (!when.ok) return setError(when.message);
    let mealStartedAt: string | undefined;
    if (tag === 'afterMeal' && meal !== '') {
      mealStartedAt = mealStart(when.at, meal);
      if (!mealStartedAt) return setError('Check the time the meal started.');
    }
    // Judged before anything is written, so a failed write can never hide
    // what a dangerous reading needs (F01). A reading given its own time may
    // be an earlier episode, so the guidance asks before "treat it now" (F03).
    // A reading kept from an earlier Save is not "just now" any more, so it is asked about too.
    const escalation = glucoseEscalation(checked.value, unit, profile);
    const ask = time !== undefined || savedAt !== undefined;
    const shown = formatValue(checked.value, 'glucose', unit);
    const figure = shown.replace(` ${unit}`, '');
    const input: ObservationInput = {
      id, kind: 'glucose', value: checked.value, unit, scope: 'pointInTime', source: 'manual', at: when.at,
      ...(tag ? { tag } : {}),
      ...(mealStartedAt ? { mealStartedAt } : {}),
    };
    const attempt = async (): Promise<string | undefined> => {
      const result = await addObservation(input);
      if (!result.ok) {
        keepRefused(draft, moment, setRefused);
        return result.failure.message;
      }
      clearQuickLogDraft(draftStorage());
      onSaved({ day: result.value.day, ids: [result.value.id], summary: `Glucose ${shown}`, figure, unit, ...(escalation ? { escalation } : {}) });
      return undefined;
    };
    setSavedAt(moment);
    setError(undefined);
    setBusy(true);
    const failure = await saveWithGuidance({
      escalation,
      write: attempt,
      show: pending => escalation && onGuidance({ figure, unit, escalation, ask, pending, retry: attempt }),
    });
    setBusy(false);
    if (failure !== undefined && !escalation) setError(failure);
  };

  return (
    <>
      {kept && <KeptNote />}
      {shows === 'number' && (
        <div className="flex flex-col">
          <NumberField
            ref={fieldRef}
            label="Reading"
            value={raw}
            onChange={v => { setRaw(v); setError(undefined); }}
            placeholder={unit === 'mg/dL' ? '112' : '6.2'}
            invalid={!!error}
            describedBy={error ? errorId : undefined}
            unit={unit}
            switcher={<UnitSwitch label="Glucose unit" units={['mg/dL', 'mmol/L'] as const} value={unit} onChange={u => { setUnit(u); setError(undefined); }} />}
          />
          {/* Mounted while empty, so the question is announced as it appears. */}
          <div role="status" aria-live="polite">
            {question && (
              <div className="mt-2 flex flex-col items-start gap-2">
                <Hint className="text-[length:var(--text-subhead)]">{question.text}</Hint>
                <button
                  type="button"
                  onClick={() => { setUnit(question.to); setError(undefined); }}
                  className="press-feedback min-h-11 rounded-lg bg-grouped-card px-3 text-[length:var(--text-subhead)] font-medium text-tint"
                >
                  {question.to === 'mmol/L' ? `I meant ${raw.trim()} mmol/L` : `Use mg/dL`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {askDisplay ? (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">What the meter shows</span>
          <Segmented<MeterShows>
            label="What the meter shows"
            options={[{ id: 'number', label: 'A number' }, { id: 'HI', label: 'HI' }, { id: 'LO', label: 'LO' }]}
            value={shows}
            onChange={v => { setShows(v); setError(undefined); }}
          />
          {shows !== 'number' && <Hint>A meter shows {shows} when the glucose is past what it can measure. Nothing is saved, because there is no number; you will see what to do.</Hint>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAskDisplay(true)}
          className="press-feedback -my-1 min-h-11 self-start px-1 text-[length:var(--text-body)] font-medium text-tint"
        >
          Meter shows HI or LO?
        </button>
      )}
      {!display && (
        <>
          <div className="flex flex-col gap-2">
            <ChoiceChips legend="When" options={GLUCOSE_WHEN.map(w => ({ id: w.tag, label: w.label }))} value={tag} onChange={setTag} />
            {hint && <Hint>{hint}</Hint>}
          </div>
          {tag === 'afterMeal' && <MealStartField value={meal} onChange={setMeal} />}
          <TimeRow value={time} onChange={setTime} {...(savedAt ? { captured: { at: savedAt, label: formatClock(savedAt, prefs.hour12) } } : {})} />
        </>
      )}
      <SaveBar error={error} busy={busy} onSave={save} errorId={errorId} label={display ? 'Show what to do' : 'Save'} />
    </>
  );
}

function MealStartField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <Group footer="Optional. The time you started eating, so the reading’s timing is known.">
      <div className="flex min-h-[3.25rem] items-center gap-3 px-4 py-1.5">
        <label htmlFor={id} className="flex-1 text-[length:var(--text-body)]">Meal started at</label>
        <input
          id={id}
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="numeric min-h-11 rounded-lg bg-grouped-bg px-2 text-right text-[length:var(--text-body)] text-foreground"
        />
      </div>
    </Group>
  );
}

// ============================================================================
// Blood pressure
// ============================================================================

/**
 * An id made when the form opens, so saving the same reading again — after a
 * refused save, or a reload — can never store it twice. For blood pressure,
 * one stem for readings saved together, so equal times still sort in the
 * order they were taken.
 */
function readingStem(prefix = 'reading'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Keep what the form holds, from the first thing typed, so a reload brings it
 * back (J17). Emptied again, the form's draft is forgotten; Save and closing
 * the sheet forget it too.
 */
function useKeptDraft(draft: QuickLogDraft | undefined) {
  const wrote = useRef(false);
  const json = draft ? JSON.stringify(draft) : undefined;
  useEffect(() => {
    const storage = draftStorage();
    if (json !== undefined) {
      wrote.current = storeQuickLogDraft(storage, JSON.parse(json) as QuickLogDraft) || wrote.current;
    } else if (wrote.current) {
      wrote.current = false;
      clearQuickLogDraft(storage);
    }
  }, [json]);
}

/**
 * A save the device refused: the draft is marked so a reload opens it again
 * (J17). Written at once, not only by the form's effect, because the form may
 * already be gone behind its guidance.
 */
function keepRefused(draft: QuickLogDraft | undefined, at: string, setRefused: (refused: true) => void) {
  setRefused(true);
  if (draft) storeQuickLogDraft(draftStorage(), { ...draft, at: draft.at ?? at, refused: true });
}

/** Said at the top of a form that came back with a reading that was never saved. */
function KeptNote() {
  return (
    <p className="rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
      This reading is not saved yet. Check it and tap Save, or close to discard it.
    </p>
  );
}

/** A reading's two halves, shaped as `putBloodPressure` writes them, for saving with another in one write. */
function pressureHalves(readingId: string, r: { systolic: number; diastolic: number }, at: string, tag: 'morning' | 'evening' | undefined): ObservationInput[] {
  const shared = { scope: 'pointInTime' as const, source: 'manual' as const, at, context: bpContext(readingId), ...(tag ? { tag } : {}) };
  return [
    { ...shared, id: `${readingId}:bloodPressureSystolic`, kind: 'bloodPressureSystolic', value: r.systolic },
    { ...shared, id: `${readingId}:bloodPressureDiastolic`, kind: 'bloodPressureDiastolic', value: r.diastolic },
  ];
}

function PressureFields({ legend, systolic, diastolic, onSystolic, onDiastolic, fieldRef, invalid }: {
  legend: string;
  systolic: string;
  diastolic: string;
  onSystolic: (v: string) => void;
  onDiastolic: (v: string) => void;
  fieldRef?: Ref<HTMLInputElement>;
  invalid: boolean;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 px-1 text-[length:var(--text-subhead)] font-medium">{legend}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
        <NumberField ref={fieldRef} label="Top (systolic)" mode="numeric" value={systolic} onChange={onSystolic} placeholder="138" invalid={invalid} />
        <NumberField label="Bottom (diastolic)" mode="numeric" value={diastolic} onChange={onDiastolic} placeholder="86" invalid={invalid} />
      </div>
    </fieldset>
  );
}

/**
 * The protocol's minute between readings (NICE NG136 1.2.7), counted from when
 * the first was entered (F23). The count is for the eye; a screen reader is
 * told once, when the minute is up.
 */
function RepeatWait({ since }: { since: string }) {
  const [left, setLeft] = useState(60);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft(Math.max(0, Math.ceil((Date.parse(since) + 60_000 - Date.now()) / 1000))), 1000);
    return () => clearTimeout(timer);
  }, [left, since]);
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-grouped-card px-4 py-3">
      <p className="text-[length:var(--text-body)] font-medium leading-snug">Sit quietly. Take the second reading in a minute.</p>
      <p aria-hidden className="numeric text-[length:var(--text-subhead)] text-muted-foreground">{left > 0 ? `Ready in ${left} s` : 'Ready now'}</p>
      <p aria-live="polite" className="sr-only">{left > 0 ? '' : 'A minute has passed: you can take the second reading now.'}</p>
    </div>
  );
}

function PressureForm({ fieldRef, onSaved, onGuidance, prefs }: FormProps) {
  const { observations, profile } = useStore();
  const errorId = useId();
  // A pair typed and not saved comes back as it was, under the same ids (J17).
  const [kept] = useState(() => keptDraft('bloodPressure', observations));
  const [stem] = useState(() => kept?.stem ?? readingStem());
  const [s1, setS1] = useState(kept?.s1 ?? '');
  const [d1, setD1] = useState(kept?.d1 ?? '');
  const [second, setSecond] = useState(kept?.second === true);
  const [s2, setS2] = useState(kept?.s2 ?? '');
  const [d2, setD2] = useState(kept?.d2 ?? '');
  const [tag, setTag] = useState<'morning' | 'evening' | undefined>(kept?.tag);
  const [time, setTime] = useState<string | undefined>(kept?.time);
  // The moment the first reading was entered — when the person moved on to the
  // second — so the two are never both stamped with the Save moment (F23).
  const [firstEntered, setFirstEntered] = useState<string | undefined>(kept?.firstEntered);
  // The repeat keeps the time it was taken: never the first's plus a fabricated interval (F14).
  const [time2, setTime2] = useState<string | undefined>(kept?.time2);
  // When Save was first tapped: what a time left at Now stands for from then on.
  const [savedAt, setSavedAt] = useState<string | undefined>(kept?.at);
  const [refused, setRefused] = useState(kept?.refused === true);
  const [error, setError] = useState<{ which: 1 | 2; message: string }>();
  const [busy, setBusy] = useState(false);

  const draft: QuickLogDraft | undefined = [s1, d1, s2, d2].some(v => v.trim() !== '') || second || tag !== undefined || time !== undefined
    ? {
      kind: 'bloodPressure', stem, s1, d1,
      ...(second ? { second: true as const, s2, d2 } : {}),
      ...(tag ? { tag } : {}),
      ...(time !== undefined ? { time } : {}),
      ...(time2 !== undefined ? { time2 } : {}),
      ...(firstEntered ? { firstEntered } : {}),
      ...(savedAt ? { at: savedAt } : {}),
      ...(refused ? { refused: true as const } : {}),
    }
    : undefined;
  useKeptDraft(draft);

  const addSecond = () => {
    if (time === undefined) setFirstEntered(nowAt());
    setSecond(true);
  };

  const save = async () => {
    const one = checkPressure(s1, d1);
    if (!one.ok) return setError({ which: 1, message: second ? `First reading: ${one.message}` : one.message });
    const wantsTwo = second && (s2.trim() !== '' || d2.trim() !== '');
    const two = wantsTwo ? checkPressure(s2, d2) : undefined;
    if (two && !two.ok) return setError({ which: 2, message: `Second reading: ${two.message}` });
    // Each reading's own time: typed, or — left at Now — when it was entered
    // (F23), and once Save has been tapped, that moment, however late the retry.
    const moment = savedAt ?? nowAt();
    const times = repeatTimes({
      ...(time !== undefined ? { first: time } : {}),
      firstEntered: firstEntered ?? moment,
      ...(two?.ok && time2 !== undefined ? { second: time2 } : {}),
      secondEntered: moment,
    });
    if (!times.ok) return setError({ which: times.which, message: times.which === 2 ? `Second reading: ${times.message}` : times.message });
    const firstAt = times.first;

    // Both readings are judged before anything is written (F01): the guidance
    // is about the more urgent one, whichever it is, saved or not.
    const e1 = pressureEscalation(one.systolic, one.diastolic, profile);
    const e2 = two?.ok ? pressureEscalation(two.systolic, two.diastolic, profile) : undefined;
    const escalation = mostUrgent([e1, e2]);
    const aboutSecond = escalation !== undefined && escalation === e2 && escalation !== e1 && two?.ok === true;
    const about = aboutSecond && two?.ok ? two : one;
    const ask = (aboutSecond ? time2 : time) !== undefined || savedAt !== undefined;
    const figure = `${about.systolic}/${about.diastolic}`;
    // One write for both readings: both are saved, or neither is.
    const inputs = [
      ...pressureHalves(`${stem}-a`, one, firstAt, tag),
      ...(two?.ok ? pressureHalves(`${stem}-b`, two, times.second, tag) : []),
    ];
    const summary = two?.ok
      ? `Blood pressure ${one.systolic}/${one.diastolic} and ${two.systolic}/${two.diastolic} mmHg`
      : `Blood pressure ${one.systolic}/${one.diastolic} mmHg`;
    const attempt = async (): Promise<string | undefined> => {
      const result = await addObservations(inputs);
      if (!result.ok) {
        keepRefused(draft, moment, setRefused);
        return result.failure.message;
      }
      clearQuickLogDraft(draftStorage());
      onSaved({ day: firstAt.slice(0, 10), ids: result.value.map(o => o.id), summary, figure, unit: 'mmHg', ...(escalation ? { escalation } : {}) });
      return undefined;
    };
    setSavedAt(moment);
    setError(undefined);
    setBusy(true);
    const failure = await saveWithGuidance({
      escalation,
      write: attempt,
      show: pending => escalation && onGuidance({
        figure, unit: 'mmHg', escalation, ask, pending, retry: attempt,
        ...(two?.ok ? { note: 'Both readings are saved together, or neither is.' } : {}),
      }),
    });
    setBusy(false);
    if (failure !== undefined && !escalation) setError({ which: 1, message: failure });
  };

  const firstMoment = firstEntered ?? savedAt;
  return (
    <>
      {kept && <KeptNote />}
      <Hint className="text-[length:var(--text-subhead)]">Home protocol: sit quietly for 5 minutes, then take two readings a minute apart.</Hint>
      <PressureFields
        legend={second ? 'First reading' : 'Reading'}
        systolic={s1} diastolic={d1}
        onSystolic={v => { setS1(v); setError(undefined); }}
        onDiastolic={v => { setD1(v); setError(undefined); }}
        fieldRef={fieldRef}
        invalid={error?.which === 1}
      />
      <TimeRow
        value={time}
        onChange={setTime}
        label={second ? 'First reading’s time' : 'Time'}
        {...(firstMoment ? { captured: { at: firstMoment, label: formatClock(firstMoment, prefs.hour12) } } : {})}
      />
      {second ? (
        <>
          {firstEntered && time === undefined && <RepeatWait since={firstEntered} />}
          <PressureFields
            legend="Second reading"
            systolic={s2} diastolic={d2}
            onSystolic={v => { setS2(v); setError(undefined); }}
            onDiastolic={v => { setD2(v); setError(undefined); }}
            invalid={error?.which === 2}
          />
          <TimeRow
            value={time2}
            onChange={setTime2}
            label="Second reading’s time"
            footer="Each reading keeps the time it was taken. Left at Now, the second is timed when you tap Save."
            {...(savedAt ? { captured: { at: savedAt, label: formatClock(savedAt, prefs.hour12) } } : {})}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={addSecond}
          className="press-feedback -my-1 min-h-11 self-start px-1 text-[length:var(--text-body)] font-medium text-tint"
        >
          Add a second reading
        </button>
      )}
      <ChoiceChips legend="When" options={PRESSURE_WHEN.map(w => ({ id: w.tag, label: w.label }))} value={tag} onChange={setTag} />
      <SaveBar error={error?.message} busy={busy} onSave={save} errorId={errorId} />
    </>
  );
}

// ============================================================================
// Back and leg pain
// ============================================================================

function PainForm({ fieldRef, onSaved }: FormProps) {
  const errorId = useId();
  const [back, setBack] = useState('');
  const [leg, setLeg] = useState('');
  const [time, setTime] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState<{ at: string; id: string; value: number }>();

  const save = async () => {
    const wantsBack = !first && back.trim() !== '';
    const wantsLeg = leg.trim() !== '';
    if (!first && !wantsBack && !wantsLeg) return setError('Enter back pain, leg pain, or both, from 0 to 10.');
    const b = wantsBack ? checkValue('backPain', back, '0-10') : undefined;
    if (b && !b.ok) return setError(`Back pain: ${b.message.charAt(0).toLowerCase()}${b.message.slice(1)}`);
    const l = wantsLeg ? checkValue('legPain', leg, '0-10') : undefined;
    if (l && !l.ok) return setError(`Leg pain: ${l.message.charAt(0).toLowerCase()}${l.message.slice(1)}`);
    const when = first ? { ok: true as const, at: first.at } : resolveTime(time);
    if (!when.ok) return setError(when.message);
    setError(undefined);
    setBusy(true);

    const ids: string[] = first ? [first.id] : [];
    const parts: string[] = first ? [`back ${first.value}`] : [];
    if (b?.ok) {
      const result = await addObservation({ kind: 'backPain', value: b.value, scope: 'pointInTime', source: 'manual', at: when.at });
      if (!result.ok) {
        setBusy(false);
        return setError(result.failure.message);
      }
      ids.push(result.value.id);
      parts.push(`back ${b.value}`);
      setFirst({ at: when.at, id: result.value.id, value: b.value });
    }
    if (l?.ok) {
      const result = await addObservation({ kind: 'legPain', value: l.value, scope: 'pointInTime', source: 'manual', at: when.at });
      if (!result.ok) {
        setBusy(false);
        return setError(ids.length > 0 ? `Back pain is saved. Leg pain is not: ${result.failure.message}` : result.failure.message);
      }
      ids.push(result.value.id);
      parts.push(`leg ${l.value}`);
    }
    setBusy(false);
    onSaved({
      day: when.at.slice(0, 10), ids, summary: `Pain ${parts.join(', ')} out of 10`,
      figure: parts.map(p => p.split(' ')[1]).join(' · '), unit: 'of 10',
    });
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
        {first ? (
          <p role="status" className="flex flex-col justify-center rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
            Back pain saved: <span className="numeric text-[length:var(--text-title-2)] font-semibold">{first.value}</span>
          </p>
        ) : (
          <NumberField ref={fieldRef} label="Back pain" mode="numeric" value={back} onChange={v => { setBack(v); setError(undefined); }} placeholder="0–10" invalid={!!error} />
        )}
        <NumberField label="Leg pain" mode="numeric" value={leg} onChange={v => { setLeg(v); setError(undefined); }} placeholder="0–10" invalid={!!error} />
      </div>
      <Hint className="text-[length:var(--text-subhead)]">0 is no pain and 10 the worst you can imagine. Fill in either or both.</Hint>
      <TimeRow value={time} onChange={setTime} />
      <RedFlags />
      <SaveBar error={error} busy={busy} onSave={save} errorId={errorId} />
    </>
  );
}

/**
 * The emergency signs a pain number can never cancel (contract E-CES,
 * E-BILATERAL). Said wherever back pain is logged, in body size.
 */
function RedFlags() {
  return (
    <div className="rounded-xl bg-grouped-card px-4 py-3">
      <p className="text-[length:var(--text-subhead)] leading-snug">
        <span className="font-semibold text-stop">Get emergency care now</span> for any of these:
      </p>
      <EmergencySigns className="mt-1 text-[length:var(--text-subhead)] leading-snug" />
      <p className="mt-1 text-[length:var(--text-footnote)] text-muted-foreground">NICE NG127 and the safety contract. {NOT_ADVICE}</p>
    </div>
  );
}

// ============================================================================
// Weight and waist
// ============================================================================

const MEASURE: Record<'weight' | 'waist', { label: string; units: readonly ['kg', 'lb'] | readonly ['cm', 'in']; hint: string; placeholder: [string, string] }> = {
  weight: {
    label: 'Weight', units: ['kg', 'lb'], placeholder: ['82.4', '181.6'],
    hint: 'Same scale, same time of day, ideally in the morning before breakfast.',
  },
  waist: {
    label: 'Waist', units: ['cm', 'in'], placeholder: ['94', '37'],
    hint: 'On bare skin, midway between your lowest rib and the top of your hip bone, at the end of a normal breath out.',
  },
};

function MeasureForm({ kind, fieldRef, onSaved, prefs }: FormProps & { kind: 'weight' | 'waist' }) {
  const spec = MEASURE[kind];
  const errorId = useId();
  const [raw, setRaw] = useState('');
  const [unit, setUnit] = useState<string>(kind === 'weight' ? prefs.mass : prefs.length);
  const [time, setTime] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const checked = checkValue(kind, raw, unit);
    if (!checked.ok) return setError(checked.message);
    const when = resolveTime(time);
    if (!when.ok) return setError(when.message);
    setError(undefined);
    setBusy(true);
    // Stored in kilograms and centimetres, the kinds' only units; pounds and
    // inches are a way of reading them.
    const result = await addObservation({ kind, value: toCanonical(kind, checked.value, unit), scope: 'pointInTime', source: 'manual', at: when.at });
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    const shown = formatValue(checked.value, kind, unit);
    onSaved({ day: result.value.day, ids: [result.value.id], summary: `${spec.label} ${shown}`, figure: shown.replace(` ${unit}`, ''), unit });
  };

  return (
    <>
      <NumberField
        ref={fieldRef}
        label={spec.label}
        value={raw}
        onChange={v => { setRaw(v); setError(undefined); }}
        placeholder={unit === spec.units[0] ? spec.placeholder[0] : spec.placeholder[1]}
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit={unit}
        switcher={<UnitSwitch label={`${spec.label} unit`} units={spec.units} value={unit} onChange={setUnit} />}
      />
      <Hint className="text-[length:var(--text-subhead)]">{spec.hint}</Hint>
      <TimeRow value={time} onChange={setTime} />
      <SaveBar error={error} busy={busy} onSave={save} errorId={errorId} />
    </>
  );
}

// ============================================================================
// Day totals: water, steps, sleep
// ============================================================================

function WaterForm({ fieldRef, onSaved, prefs }: FormProps) {
  const { observations, settings } = useStore();
  const current = useToday();
  const errorId = useId();
  const glass = glassMl(settings);
  const [raw, setRaw] = useState(String(glass));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const total = entryFor(summariseDay(current, observations), 'water', 'dayTotal');
  const typed = parseNumber(raw);

  const save = async () => {
    const checked = checkValue('water', raw, 'ml');
    if (!checked.ok) return setError(checked.message);
    setError(undefined);
    setBusy(true);
    // Reads today's total and writes a larger one, inside the store's queue,
    // so two quick taps add twice rather than racing.
    const result = await addToDayTotal('water', checked.value);
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    const shown = formatObservation(result.value, prefs);
    onSaved({ day: result.value.day, ids: [result.value.id], summary: `Water ${shown} today`, figure: shown.replace(' ml', ''), unit: 'ml today' });
  };

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)]">
        {total && total.total !== null
          ? <>So far today: <span className="numeric font-semibold">{formatObservation({ kind: 'water', value: total.total, unit: 'ml' }, prefs)}</span></>
          : 'Nothing entered for today yet.'}
      </p>
      <NumberField
        ref={fieldRef}
        label="Amount to add"
        mode="numeric"
        value={raw}
        onChange={v => { setRaw(v); setError(undefined); }}
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit="ml"
      />
      <Hint className="text-[length:var(--text-subhead)]">
        {glass === 250 && !settings.habits?.water?.glassMl ? 'A glass here is 250 ml. ' : `Your glass is ${glass} ml. `}
        Each amount adds to today’s total.
      </Hint>
      <SaveBar
        error={error}
        busy={busy}
        onSave={save}
        errorId={errorId}
        label={typed !== undefined && Number.isInteger(typed) && typed > 0 ? `Add ${typed} ml` : 'Add'}
      />
    </>
  );
}

const TOTAL: Record<'steps' | 'sleep', { label: string; unit: string; mode: 'numeric' | 'decimal'; placeholder: string; day: string; hint: string }> = {
  steps: {
    label: 'Steps for the day', unit: 'steps', mode: 'numeric', placeholder: '6500', day: 'Day',
    hint: 'The total from your phone’s Health app or a step counter. A new total for a day replaces the one before.',
  },
  sleep: {
    label: 'Hours slept', unit: 'h', mode: 'decimal', placeholder: '7.5', day: 'Woke up on',
    hint: 'Your best estimate, such as 7.5 for seven and a half hours. A new figure for a night replaces the one before.',
  },
};

function TotalForm({ kind, fieldRef, onSaved, prefs }: FormProps & { kind: 'steps' | 'sleep' }) {
  const spec = TOTAL[kind];
  const { observations } = useStore();
  const current = useToday();
  const errorId = useId();
  const [raw, setRaw] = useState('');
  const [day, setDay] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const shownDay = day ?? current;
  const existing = entryFor(summariseDay(shownDay, observations), kind, 'dayTotal');

  const save = async () => {
    const checked = checkValue(kind, raw, spec.unit);
    if (!checked.ok) return setError(checked.message);
    const target = resolveDay(day, current);
    if (!target.ok) return setError(target.message);
    setError(undefined);
    setBusy(true);
    const write = dayTotalWrite(kind, target.day, observations, current);
    const result = write.action === 'edit'
      ? await editObservation(write.id, { value: checked.value })
      : await addObservation({ kind, value: checked.value, scope: 'dayTotal', source: 'manual', at: write.at });
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    const shown = formatObservation(result.value, prefs);
    onSaved({
      day: result.value.day, ids: [result.value.id], summary: `${kindTitle(kind)} ${shown}`,
      figure: shown.replace(` ${spec.unit === 'h' ? 'h' : 'steps'}`, ''), unit: spec.unit,
    });
  };

  return (
    <>
      {existing && existing.total !== null && (
        <p className="px-1 text-[length:var(--text-body)]">
          Currently <span className="numeric font-semibold">{formatObservation({ kind, value: existing.total, unit: spec.unit }, prefs)}</span>
        </p>
      )}
      <NumberField
        ref={fieldRef}
        label={spec.label}
        mode={spec.mode}
        value={raw}
        onChange={v => { setRaw(v); setError(undefined); }}
        placeholder={spec.placeholder}
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit={spec.unit}
      />
      <Hint className="text-[length:var(--text-subhead)]">{spec.hint}</Hint>
      <DayRow value={day} onChange={setDay} label={spec.day} />
      <SaveBar error={error} busy={busy} onSave={save} errorId={errorId} />
    </>
  );
}

// ============================================================================
// Lab results
// ============================================================================

const LAB: Record<LabKind, { units: readonly [string, string]; hint: string; placeholder: [string, string] }> = {
  hba1c: { units: ['%', 'mmol/mol'], placeholder: ['7.2', '55'], hint: 'As written on your report, in % or mmol/mol.' },
  b12: { units: ['pg/mL', 'pmol/L'], placeholder: ['320', '236'], hint: 'Total vitamin B12, as on your report. pg/mL and ng/L are the same number.' },
  vitaminD: { units: ['ng/mL', 'nmol/L'], placeholder: ['24', '60'], hint: '25-hydroxyvitamin D, often written 25(OH)D on the report.' },
};

function LabForm({ initial, fieldRef, onSaved, prefs }: FormProps & { initial: LabKind }) {
  const current = useToday();
  const errorId = useId();
  const [lab, setLab] = useState<LabKind>(initial);
  const [raw, setRaw] = useState('');
  const [unit, setUnit] = useState<string>(prefs[initial]);
  const [day, setDay] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const spec = LAB[lab];

  const choose = (next: LabKind) => {
    setLab(next);
    setUnit(prefs[next]);
    setRaw('');
    setError(undefined);
  };

  const save = async () => {
    const checked = checkValue(lab, raw, unit);
    if (!checked.ok) return setError(checked.message);
    const target = resolveDay(day, current);
    if (!target.ok) return setError(target.message);
    setError(undefined);
    setBusy(true);
    // A lab result is dated, not timed: midday keeps it on its day everywhere.
    const result = await addObservation({ kind: lab, value: checked.value, unit, scope: 'pointInTime', source: 'manual', at: atOnDay(target.day) });
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    const shown = formatValue(checked.value, lab, unit);
    onSaved({ day: result.value.day, ids: [result.value.id], summary: `${kindTitle(lab)} ${shown}`, figure: shown.replace(unit === '%' ? '%' : ` ${unit}`, ''), unit });
  };

  return (
    <>
      <Segmented label="Which result" options={LAB_OPTIONS.map(o => ({ id: o.kind, label: o.title }))} value={lab} onChange={choose} />
      <NumberField
        ref={fieldRef}
        label={kindTitle(lab)}
        value={raw}
        onChange={v => { setRaw(v); setError(undefined); }}
        placeholder={unit === spec.units[0] ? spec.placeholder[0] : spec.placeholder[1]}
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        unit={unit}
        switcher={<UnitSwitch label={`${kindTitle(lab)} unit`} units={spec.units} value={unit} onChange={setUnit} />}
      />
      <Hint className="text-[length:var(--text-subhead)]">{spec.hint}</Hint>
      <DayRow value={day} onChange={setDay} label="Date of test" />
      <SaveBar error={error} busy={busy} onSave={save} errorId={errorId} />
    </>
  );
}

// ============================================================================
// After saving: the safety contract's guidance
// ============================================================================
