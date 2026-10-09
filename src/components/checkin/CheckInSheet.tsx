/**
 * The check-in (spec §3.2; clinical-tracking-protocols.md, Safety contract).
 *
 * Fast on an ordinary day: "Right now, any of these?" with "None of these"
 * first, then only the readings this profile needs, back and leg questions
 * only for a back profile, then sleep and how you feel.
 *
 * An emergency answer is saved and shown the moment it is ticked, before any
 * reading is typed and whatever the glucose box holds. The Start button
 * appears only when `permission` allows this mode now, never from a colour.
 * Decisions live in `form.ts` and the engine; this file wires them up.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DailyCheckIn, EmergencyFlag, EpisodeKind, EpisodeResolution, GlucoseTrend, NewsItem, SymptomReach, UrineKetoneCategory } from '@/types/checkin';
import type { CheckInRecord } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { permission, type Mode } from '@/engine/permission';
import { recordedLows, TREAT } from '@/engine/readiness';
import { Sheet } from '@/components/hig/Sheet';
import { Group, Row } from '@/components/hig/List';
import { cn } from '@/lib/utils';
import { CannotSwallow, OutcomeBanner } from './OutcomeBanner';
import { CheckRow, NumberBox, PainScale, Segmented, Toggle, Wrap } from './parts';
import { BACK_LABEL, EMERGENCY_LABEL, LOW_NEWS, NEWS_LABEL, URINE_LABEL, defaultStartLabel } from './copy';
import { WORSENING } from './stop';
import {
  answerEpisode, buildCheckIn, episodeChoice, formSanity, saveOnEmergency, submitBlocked, visibleQuestions,
  type Answerable, type BackAnswers, type CheckInForm, type EpisodeChoice,
} from './form';
import {
  afterSave, editForm, newReading as newReadingState, openSheet, sheetGate, submitted, type SaveOutcome, type SheetContext, type SheetState,
} from './sheetState';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  date: string;
  initial?: CheckInRecord;
  /** Saves the answers and reports the merged record and whether the device kept it. */
  onSave: (c: DailyCheckIn) => Promise<SaveOutcome>;
  /**
   * Where Start goes once the answers allow the mode. Without it the sheet
   * only records answers: updating today's check-in, or a mode this person
   * cannot start from here (the programme session before joining, D35).
   */
  onStart?: () => void;
  /** What the start button says, e.g. "Start stretch". Defaults to the mode's own wording. */
  startLabel?: string;
  /** Which movement the Start button begins; permission is asked for this mode. */
  mode?: Mode;
  /** Earlier check-ins, for the two-days-running and spread rules. */
  recent?: DailyCheckIn[];
}

export function CheckInSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title="Check-in" detent="large">
      {/* Mounted per opening, so the form always starts from the latest saved answers. */}
      {props.open && <CheckInBody {...props} />}
    </Sheet>
  );
}

const BACK_FLAGS = Object.keys(BACK_LABEL) as (keyof typeof BACK_LABEL)[];

/** A clock for the re-check countdown; it ticks only while the sheet is open. */
function useNow(): [Date, (d: Date) => void] {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return [now, setNow];
}

const hhmm = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const primary = 'press-feedback min-h-[3.25rem] w-full rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint';

/**
 * The protocol's minute between readings, counted from when the first was
 * entered, worded as Track's Quick Log words it. The count is for the eye; a
 * screen reader is told once, when the minute is up.
 */
function BpRepeatWait({ since }: { since: string }) {
  const leftNow = () => Math.max(0, Math.ceil((Date.parse(since) + 60_000 - Date.now()) / 1000));
  const [left, setLeft] = useState(leftNow);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft(Math.max(0, Math.ceil((Date.parse(since) + 60_000 - Date.now()) / 1000))), 1000);
    return () => clearTimeout(timer);
  }, [left, since]);
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <p className="text-[length:var(--text-body)] font-medium leading-snug">Sit quietly. Take the second reading in a minute.</p>
      <p aria-hidden className="numeric text-[length:var(--text-subhead)] text-muted-foreground">{left > 0 ? `Ready in ${left} s` : 'Ready now'}</p>
      <p aria-live="polite" className="sr-only">{left > 0 ? '' : 'A minute has passed: you can take the second reading now.'}</p>
    </div>
  );
}

/** An answer the device would not keep still counts; it just is not durable. */
function UnsavedNotice() {
  return (
    <p role="status" className="rounded-xl bg-caution/15 px-4 py-3 text-[length:var(--text-subhead)] leading-snug">
      This device could not save these answers, so they may be lost if you close the app. They still count for now. Free up
      some space and check in again.
    </p>
  );
}

/** Ketones as the test itself reads them: a blood number, or the strip's own mark. */
function KetoneRows({ kind, form, update }: { kind: 'blood' | 'urine'; form: CheckInForm; update: (patch: Partial<CheckInForm>) => void }) {
  if (kind === 'blood') {
    return (
      <Row label="Ketones, blood" detail="mmol/L"
        value={<NumberBox label="Blood ketones, mmol/L" value={form.bloodKetones} onChange={bloodKetones => update({ bloodKetones })} placeholder="Reading" className="w-24" />} />
    );
  }
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <span className="text-[length:var(--text-body)]">Ketones, urine strip</span>
      <Segmented<UrineKetoneCategory> small label="Urine ketone strip" value={form.urineKetones} onChange={urineKetones => update({ urineKetones })}
        options={(Object.keys(URINE_LABEL) as UrineKetoneCategory[]).map(c => ({ value: c, label: URINE_LABEL[c] }))} />
    </div>
  );
}

const EPISODE_HEADER: Record<EpisodeKind, string> = {
  extremeGlucose: 'That very high glucose reading from earlier',
  severeLow: 'That severe low from earlier',
  severeBp: 'That very high blood pressure reading from earlier',
  ketones: 'That ketone reading from earlier',
  redFlag: 'What you reported earlier',
  foot: 'Your foot, as you reported it earlier',
  news: 'What you said earlier today',
};

/**
 * The answers one item takes, the open one first (scan X2-02, X2-03, X2-10).
 * A reading can be a typing mistake or checked by a clinician; one more than
 * a day old can also have been dealt with at the time. A symptom can have
 * been checked, or have gone; a foot problem can have healed or been cleared.
 */
function episodeAnswers(kind: EpisodeKind, old: boolean, accepts?: EpisodeResolution[]): { choice: EpisodeChoice; label: string }[] {
  // Only the answers that settle it are offered: a red flag or a hot, swollen
  // foot needs a clinician; a sore may also heal (R5-01).
  if (kind === 'redFlag' || kind === 'foot') {
    const settles = accepts ?? ['assessed', 'mistake'];
    const said: Record<EpisodeResolution, string> = {
      assessed: kind === 'foot' ? 'A clinician has cleared it' : 'A clinician has checked it',
      resolved: 'It has healed',
      mistake: 'I ticked it by mistake',
    };
    const open = kind === 'redFlag' ? 'Not checked yet' : settles.includes('resolved') ? 'Not healed yet' : 'Not cleared yet';
    return [{ choice: 'open', label: open }, ...settles.map(choice => ({ choice, label: said[choice] }))];
  }
  // An answer that ends the day happened, or was ticked by mistake: nothing else releases it.
  if (kind === 'news') return [{ choice: 'open', label: 'It happened' }, { choice: 'mistake', label: 'I ticked it by mistake' }];
  return [
    { choice: 'open', label: 'Not settled yet' },
    ...(old ? [{ choice: 'resolved' as const, label: 'It was dealt with at the time' }] : []),
    { choice: 'mistake', label: 'I typed it wrongly' },
    { choice: 'assessed', label: 'A clinician has checked me since' },
  ];
}

const EPISODE_NOTE: Record<EpisodeKind, string> = {
  extremeGlucose: 'A later, lower reading does not settle it on its own.',
  severeLow: 'A later, higher reading does not settle it on its own.',
  severeBp: 'A later, lower reading does not settle it on its own.',
  ketones: 'A later, lower reading does not settle it on its own.',
  redFlag: 'It stays until a clinician has checked it, even once it has gone.',
  foot: 'No walking until a clinician has cleared it, or a sore has healed.',
  news: 'It ends exercise for the rest of today, even once it has passed.',
};

export function CheckInBody({ profile, date, initial, onSave, onStart, startLabel, mode = 'guided', recent }: Props) {
  const [now, setNow] = useNow();
  const ctx: SheetContext = useMemo(() => ({ profile, date, mode, now, ...(recent ? { recent } : {}) }), [profile, date, mode, now, recent]);
  // Every transition goes through `sheetState`, which is where the rules about
  // measurement identity, merged records, save order and unsaved answers live.
  const [sheet, setSheet] = useState<SheetState>(() => openSheet({ profile, date, mode, now: new Date(), ...(recent ? { recent } : {}) }, initial));
  const [openedAt] = useState(() => new Date());
  const seq = useRef(0);
  const { form, record, view } = sheet;
  const setForm = (next: CheckInForm | ((f: CheckInForm) => CheckInForm)) =>
    setSheet(s => editForm(s, f => (typeof next === 'function' ? next(f) : next)));
  const setView = (v: 'form' | 'outcome') => setSheet(s => ({ ...s, view: v }));
  const [timeSet, setTimeSet] = useState(false);
  // Once answered "None of these", the list folds to that one answer so the day's questions come next.
  const [listOpen, setListOpen] = useState(false);
  const [askDisplay, setAskDisplay] = useState(sheet.form.glucoseDisplay !== null);
  // An answer, and above all an emergency, is shown where the eye is, not left scrolled out of view.
  const top = useRef<HTMLDivElement>(null);

  // The strictest of what the app holds now, the last save and the answers
  // just given: a stop from anywhere shows at once (round 3 B02).
  const gate = sheetGate(sheet, ctx, initial);
  const result = gate?.permission;
  // Before any answer, a mode the profile alone rules out (a foot that needs
  // protecting rules out walking), or what an earlier day still asks of today,
  // is said at once: no answer here can change it.
  const before = gate ? undefined : permission({ profile, now, ...(recent ? { recent } : {}) }, mode);
  const settled = before && !before.allowed && !before.needsCheckIn ? before : undefined;
  const v = visibleQuestions(profile, form, gate?.record ?? record, { date, recent: recent ?? [] });
  // The lows the app already holds count whatever is answered; the question says which (scan J2-01).
  const heldLows = recordedLows(gate?.record ?? recent?.find(r => r.date === date) ?? { date, urgentSymptoms: false, news: [] }, recent ?? [], now);
  // Ticking an emergency folds the rest of the form away; one arriving from
  // elsewhere (another screen, yesterday's unanswered reading) shows its banner
  // but leaves the questions open, since one of them may be what settles it.
  const emergencyNow = (form.emergency?.length ?? 0) > 0;
  const emergencyBanner = emergencyNow || result?.disposition === 'emergency';
  const emergencyShown = view === 'outcome' || emergencyBanner;
  useEffect(() => {
    if (emergencyShown) top.current?.scrollIntoView({ block: 'start' });
  }, [emergencyShown, view]);
  // Asked of the clock as it is now: a reading timed as it was typed is never "later than now" (X2-15).
  const blocked = submitBlocked(form, { profile, ...(record ? { previous: record } : {}), now: new Date() });
  const sanity = useMemo(
    () => (form.glucose.trim() && !form.glucoseDisplay ? formSanity(form) : 'ok'),
    [form],
  );
  const severeBp = [[form.bp.s1, form.bp.d1], [form.bp.s2, form.bp.d2]].some(([s, d]) => Number(s) >= 180 || Number(d) >= 120);

  const save = async (f: CheckInForm, show?: 'outcome') => {
    const n = ++seq.current;
    const at = new Date();
    const answers = buildCheckIn(f, { date, profile, now: at, ...(record ? { previous: record } : {}) });
    typedAt.current = null;
    setNow(at);
    // Counted the moment they are given, before storage replies (B02).
    setSheet(s => ({ ...submitted(s, answers, { ...ctx, now: at }, n), ...(show ? { view: show } : {}) }));
    // The record the save produced decides from here: it holds whatever the
    // day already had, which these answers may not (F04). An older save that
    // finishes after a newer one changes nothing.
    const outcome = await onSave(answers);
    setSheet(s => afterSave(s, outcome, { ...ctx, now: at }, n));
  };
  const update = (patch: Partial<CheckInForm>) => setForm(f => ({ ...f, ...patch }));

  const setEmergency = (next: EmergencyFlag[]) => {
    const f = { ...form, emergency: next };
    setForm(f);
    // Saved the moment it is ticked: nothing else on the sheet may hold it back.
    if (saveOnEmergency(form.emergency, next)) void save(f);
  };
  const toggleEmergency = (flag: EmergencyFlag) => {
    const list = form.emergency ?? [];
    setEmergency(list.includes(flag) ? list.filter(x => x !== flag) : [...list, flag]);
  };
  // A new number is a new reading: it is timed now unless a time was chosen.
  // A reading is timed when it was taken, as Track times one (scan X2-15):
  // the moment its first digit is typed in this sitting, not the moment the
  // sheet is saved. Correcting the number as it is typed keeps that time;
  // clearing the box, or a save, starts the next reading afresh.
  const typedAt = useRef<string | null>(null);
  const takenNow = () => (typedAt.current ??= new Date().toISOString());
  const setGlucose = (text: string) => {
    if (!text.trim()) typedAt.current = null;
    update({ glucose: text, glucoseDisplay: null, unitConfirmed: false, ...(timeSet ? {} : { glucoseAt: text.trim() ? takenNow() : null }) });
  };
  const setGlucoseTime = (hm: string) => {
    if (!hm) { setTimeSet(false); update({ glucoseAt: null }); return; }
    const [h, m] = hm.split(':').map(Number);
    const [y, mo, d] = date.split('-').map(Number);
    setTimeSet(true);
    update({ glucoseAt: new Date(y, mo - 1, d, h, m).toISOString() });
  };
  const setBp = (key: 's1' | 'd1' | 's2' | 'd2', value: string) => {
    const at = key.endsWith('1') ? 'at1' : 'at2';
    setForm(f => ({ ...f, bp: { ...f.bp, [key]: value.replace(/[^\d]/g, ''), [at]: new Date().toISOString() } }));
  };
  /** A change that is also an answer: what was touched is saved, and only that (J03, J16). */
  const answer = (key: Answerable) => setForm(f => (f.answered[key] ? f : { ...f, answered: { ...f.answered, [key]: true } }));
  const setBack = (patch: Partial<BackAnswers>) => setForm(f => ({ ...f, back: { ...f.back, ...patch } }));
  const setPain = (key: 'pain' | 'legPain', value: number) => {
    setBack({ [key]: value });
    answer(key);
  };
  const toggleBack = (k: (typeof BACK_FLAGS)[number]) => {
    setBack({ [k]: !form.back[k], ...(k === 'newWeakness' && form.back.newWeakness ? { weaknessFast: false } : {}) });
    answer('backFlags');
  };
  const noBack = () => {
    setBack({ newWeakness: false, weaknessFast: false, newSensory: false, feverish: false, suddenSevere: false, worseFunction: false });
    answer('backFlags');
  };
  const toggleNews = (item: NewsItem) => {
    setForm(f => {
      if (f.news.includes(item)) return { ...f, news: f.news.filter(n => n !== item) };
      const others = LOW_NEWS.includes(item) ? f.news.filter(n => !LOW_NEWS.includes(n)) : f.news;
      return { ...f, news: [...others, item] };
    });
    answer('news');
  };
  // "None of these" clears only what is on screen; an answer the profile no longer asks stays saved.
  const noNews = () => {
    setForm(f => ({ ...f, news: f.news.filter(n => !v.news.includes(n)) }));
    answer('news');
  };
  const setBpSymptoms = (bpSymptoms: boolean) => {
    const f = { ...form, bpSymptoms, answered: { ...form.answered, bpSymptoms: true as const } };
    setForm(f);
    // A severe reading with symptoms is an emergency: saved and shown now.
    if (bpSymptoms) void save(f);
  };

  const submit = () => {
    if (blocked) return;
    void save(form, 'outcome');
  };
  const start = () => {
    // Asked again at the tap: a reading can go stale, or a stop arrive, while the sheet is open.
    const at = new Date();
    setNow(at);
    const p = sheetGate(sheet, { ...ctx, now: at }, initial)?.permission;
    if (p?.allowed && !p.needsCheckIn) onStart?.();
  };
  const newReading = () => {
    setTimeSet(false);
    typedAt.current = null;
    setSheet(s => newReadingState(s));
  };

  if (view === 'outcome' && result && gate) {
    return (
      <>
        <div ref={top} className="scroll-mt-4" />
        <OutcomeBanner permission={result} readiness={gate.record.readiness} now={now} />
        {sheet.unsaved && <UnsavedNotice />}
        <div className="flex flex-col gap-2">
          {result.allowed && !result.needsCheckIn && onStart && (
            <button type="button" onClick={start} className={primary}>
              {startLabel ?? defaultStartLabel(mode, gate.record.readiness.outcome === 'recovery')}
            </button>
          )}
          {result.needsCheckIn && <button type="button" onClick={newReading} className={primary}>Enter a new reading</button>}
          <button type="button" onClick={() => setView('form')} className="press-feedback min-h-11 rounded-xl px-4 text-[length:var(--text-body)] text-tint">
            Change answers
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div ref={top} className="scroll-mt-4" />
      {emergencyBanner && result && <OutcomeBanner permission={result} readiness={gate?.record.readiness} now={now} />}
      {emergencyBanner && sheet.unsaved && <UnsavedNotice />}
      {settled && !emergencyNow && <OutcomeBanner permission={settled} now={now} />}

      <Group header="Right now, any of these?" footer="Any one of these needs help now, whatever your readings say.">
        <CheckRow prominent label="None of these" checked={form.emergency?.length === 0} onToggle={() => { setEmergency([]); setListOpen(false); }} />
        {form.emergency?.length === 0 && !listOpen
          ? <Row as="button" type="button" onClick={() => setListOpen(true)} label={<span className="text-tint">Show the list again</span>} />
          : v.emergency.map(f => (
            <CheckRow key={f} tone="stop" label={EMERGENCY_LABEL[f]} checked={!!form.emergency?.includes(f)} onToggle={() => toggleEmergency(f)} />
          ))}
      </Group>

      {form.emergency !== null && !emergencyNow && (
        <>
          {/* Each listed reading, red flag or foot problem is answered for
              itself, by name: a typing mistake about one never settles
              another, a reading taken later is a new incident, and an
              answer can be taken back (B01, scan X2-07). */}
          {v.episodes.flatMap(e => e.readings.map(r => {
            const choice = episodeChoice(form, { kind: e.kind, readings: [r] });
            return (
              <Group key={r.id} header={`${EPISODE_HEADER[e.kind]}: ${r.label}`} footer={EPISODE_NOTE[e.kind]}>
                {episodeAnswers(e.kind, r.old === true, r.accepts).map(({ choice: answer, label }) => (
                  <CheckRow key={answer} prominent={answer === 'open'} label={label} checked={choice === answer}
                    onToggle={() => setForm(f => answerEpisode(f, e.kind, [r.id], answer, new Date(), openedAt))} />
                ))}
              </Group>
            );
          }))}
          {v.glucose && (
            <Group header="Glucose" footer={sheet.lastReading ? `Last reading: ${sheet.lastReading}. Enter a new one.` : 'Timed now, unless you set the time.'}>
              <Row
                label="Glucose"
                value={
                  <span className="flex items-center gap-1">
                    <NumberBox label="Glucose reading" value={form.glucose} onChange={setGlucose} placeholder="Reading"
                      className="w-24" invalid={sanity === 'implausible' || sanity === 'suspectUnit'} />
                    <button type="button" onClick={() => update({ unit: form.unit === 'mg/dL' ? 'mmol/L' : 'mg/dL', unitConfirmed: false })}
                      aria-label={`Unit: ${form.unit}. Tap to change.`} className="min-h-11 min-w-[4.25rem] rounded-lg px-1 text-[length:var(--text-subhead)] text-tint">
                      {form.unit}
                    </button>
                  </span>
                }
              />
              {sanity === 'ambiguousLow' && (
                <div role="alert" className="flex flex-col gap-2 px-4 py-3 text-[length:var(--text-subhead)]">
                  <p className="font-semibold text-stop">{TREAT}</p>
                  <CannotSwallow />
                  <button type="button" onClick={() => update({ unit: 'mmol/L' })} className="min-h-11 self-start rounded-lg bg-muted px-3 text-tint">
                    I meant {form.glucose} mmol/L
                  </button>
                </div>
              )}
              {sanity === 'suspectUnit' && (
                <div role="alert" className="flex flex-col gap-2 px-4 py-3 text-[length:var(--text-subhead)]">
                  <p>That looks like mg/dL rather than mmol/L. Which does your meter show?</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => update({ unit: 'mg/dL', unitConfirmed: false })} className="min-h-11 rounded-lg bg-muted px-3 text-tint">
                      {form.glucose} mg/dL
                    </button>
                    {/* A confirmed high mmol/L reading reaches the same rule as its mg/dL equal. */}
                    <button type="button" onClick={() => update({ unitConfirmed: true })} className="min-h-11 rounded-lg bg-muted px-3 text-tint">
                      {form.glucose} mmol/L, really
                    </button>
                  </div>
                </div>
              )}
              {sanity === 'implausible' && (
                <p role="alert" className="px-4 py-3 text-[length:var(--text-subhead)] text-stop">That reading can’t be used. Measure again and enter the number shown.</p>
              )}
              <Row
                label={<Wrap>Time measured</Wrap>}
                value={<input type="time" aria-label="Time measured" value={hhmm(form.glucoseAt)} onChange={e => setGlucoseTime(e.target.value)}
                  className="numeric h-11 rounded-lg bg-muted px-2 text-[length:var(--text-body)] outline-none focus-visible:ring-2 focus-visible:ring-tint/60" />}
              />
              {v.glucoseTrend && (
                <div className="flex flex-col gap-2 px-4 py-3">
                  <span className="text-[length:var(--text-body)]">Sensor arrow</span>
                  <Segmented<GlucoseTrend> small label="Sensor arrow" value={form.trend} onChange={trend => update({ trend })}
                    options={[{ value: 'rising', label: 'Rising' }, { value: 'flat', label: 'Steady' }, { value: 'slowFall', label: 'Falling slowly' }, { value: 'fastFall', label: 'Falling fast' }]} />
                </div>
              )}
              {v.rapidInsulin && (
                <Row label={<Wrap>Rapid-acting insulin in the last 2 hours</Wrap>}
                  accessory={<Toggle label="Rapid-acting insulin in the last 2 hours" checked={form.rapid} onChange={rapid => update({ rapid })} />} />
              )}
              {askDisplay ? (
                <div className="flex flex-col gap-2 px-4 py-3">
                  <span className="text-[length:var(--text-body)]">What the meter shows</span>
                  <Segmented<'none' | 'HI' | 'LO'> label="What the meter shows" value={form.glucoseDisplay ?? 'none'}
                    onChange={x => update(x === 'none' ? { glucoseDisplay: null } : { glucoseDisplay: x, glucose: '', ...(timeSet ? {} : { glucoseAt: takenNow() }) })}
                    options={[{ value: 'none', label: 'A number' }, { value: 'HI', label: 'HI' }, { value: 'LO', label: 'LO' }]} />
                </div>
              ) : (
                <Row as="button" type="button" onClick={() => setAskDisplay(true)} label={<span className="text-tint">Meter shows HI or LO?</span>} />
              )}
              {v.ketones && <KetoneRows kind={v.ketones} form={form} update={update} />}
              {v.lowRecovered && (
                <Row label={<Wrap>Symptoms gone, and your care plan allows exercise after a treated low</Wrap>}
                  accessory={<Toggle label="Symptoms gone, and your care plan allows exercise after a treated low" checked={form.lowRecovered} onChange={lowRecovered => update({ lowRecovered, answered: { ...form.answered, lowRecovered: true } })} />} />
              )}
            </Group>
          )}

          {/* Ketones matter to anyone who can make them, so they are asked even
              where there is no glucose question to put them under (F12). */}
          {!v.glucose && v.ketones && (
            <Group header="Ketones" footer="An SGLT2 inhibitor can cause ketoacidosis even when glucose is normal.">
              <KetoneRows kind={v.ketones} form={form} update={update} />
            </Group>
          )}

          {v.bp && (
            <Group header="Blood pressure" footer="Sit quietly for 5 minutes first, then two readings a minute apart. Each reading counts on its own.">
              {(['1', '2'] as const).map(n => (
                <Row key={n} label={`Reading ${n}`} value={
                  <span className="flex items-center gap-1.5">
                    <NumberBox label={`Reading ${n}, top number`} value={form.bp[`s${n}`]} onChange={x => setBp(`s${n}`, x)} className="w-[4.5rem]" />
                    <span aria-hidden className="text-muted-foreground">/</span>
                    <NumberBox label={`Reading ${n}, bottom number`} value={form.bp[`d${n}`]} onChange={x => setBp(`d${n}`, x)} className="w-[4.5rem]" />
                  </span>
                } />
              ))}
              {severeBp && (
                <p role="alert" className="px-4 py-3 text-[length:var(--text-subhead)] font-semibold text-stop">That is very high. Sit quietly for 5 minutes and measure again.</p>
              )}
              {/* Each reading keeps the time it was entered; the minute between
                  them is guided, never invented (NICE NG136 1.2.7, Today F23).
                  A severe first reading does not wait for it. */}
              {form.bp.s1.trim() && form.bp.d1.trim() && !form.bp.s2.trim() && !form.bp.d2.trim() && form.bp.at1 && !severeBp && (
                <BpRepeatWait since={form.bp.at1} />
              )}
              {v.bpSymptoms && (
                <Row label={<Wrap>With it: chest or back pain, breathlessness, confusion, weakness, numbness, a change in vision or trouble speaking</Wrap>}
                  accessory={<Toggle label="Symptoms with the high reading" checked={form.bpSymptoms} onChange={setBpSymptoms} />} />
              )}
            </Group>
          )}

          {v.back && (
            <>
              <Group header="Back and legs">
                <PainScale id="back-pain" label="Back pain now" value={form.back.pain} answered={!!form.answered.pain} onChange={pain => setPain('pain', pain)} />
                {v.sciatica && <PainScale id="leg-pain" label="Leg pain now" value={form.back.legPain} answered={!!form.answered.legPain} onChange={legPain => setPain('legPain', legPain)} />}
                {v.sciatica && (
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <span className="text-[length:var(--text-body)]">How far down symptoms reach</span>
                    <Segmented<SymptomReach> small label="How far down symptoms reach" value={form.back.reach} onChange={reach => setBack({ reach })}
                      options={[{ value: 'back', label: 'Back' }, { value: 'buttock', label: 'Buttock' }, { value: 'thigh', label: 'Thigh' }, { value: 'belowKnee', label: 'Below knee' }, { value: 'foot', label: 'Foot' }]} />
                  </div>
                )}
              </Group>
              <Group header="Since your last check-in, any of these?">
                <CheckRow prominent label="None of these" checked={!!form.answered.backFlags && !BACK_FLAGS.some(k => form.back[k])} onToggle={noBack} />
                {BACK_FLAGS.map(k => <CheckRow key={k} label={BACK_LABEL[k]} checked={form.back[k]} onToggle={() => toggleBack(k)} />)}
                {form.back.newWeakness && (
                  <CheckRow tone="stop" label={WORSENING} checked={form.back.weaknessFast} onToggle={() => setBack({ weaknessFast: !form.back.weaknessFast })} />
                )}
              </Group>
            </>
          )}

          <Group header="Anything else today?">
            <CheckRow prominent label="None of these" checked={!!form.answered.news && !form.news.some(n => v.news.includes(n))} onToggle={noNews} />
            {v.news.filter(n => !LOW_NEWS.includes(n)).map(n => <CheckRow key={n} label={NEWS_LABEL[n]} checked={form.news.includes(n)} onToggle={() => toggleNews(n)} />)}
            {LOW_NEWS.some(n => v.news.includes(n)) && (
              <div className="flex flex-col gap-2 px-4 py-3">
                <span className="text-[length:var(--text-body)]">Lows in the last 24 hours</span>
                <Segmented<'none' | NewsItem> small label="Lows in the last 24 hours" value={LOW_NEWS.find(n => form.news.includes(n)) ?? (form.answered.lows ? 'none' : null)}
                  onChange={x => { setForm(f => ({ ...f, news: [...f.news.filter(n => !LOW_NEWS.includes(n)), ...(x === 'none' ? [] : [x])] })); answer('lows'); }}
                  options={[{ value: 'none', label: 'None' }, { value: 'lowOne', label: 'One' }, { value: 'lowTwoPlus', label: 'Two or more' }, { value: 'lowSevere', label: 'Needed help' }]} />
                {heldLows.length > 0 && (
                  <p className="text-[length:var(--text-footnote)] text-muted-foreground">{`Recorded in the app: ${heldLows.join(', ')}.`}</p>
                )}
              </div>
            )}
          </Group>

          <Group header="Sleep and how you feel">
            <div className="flex flex-col gap-2 px-4 py-3">
              <span className="text-[length:var(--text-body)]">Sleep last night</span>
              <Segmented<NonNullable<DailyCheckIn['sleep']>> label="Sleep last night" value={form.sleep} onChange={sleep => update({ sleep })}
                options={[{ value: 'lt5', label: 'Under 5 h' }, { value: '5to7', label: '5 to 7 h' }, { value: 'gt7', label: 'Over 7 h' }]} />
            </div>
            <div className="flex flex-col gap-2 px-4 py-3">
              <span className="text-[length:var(--text-body)]">Energy</span>
              <Segmented<'1' | '2' | '3' | '4' | '5'> small label="Energy" value={form.energy === null ? null : String(form.energy) as '1' | '2' | '3' | '4' | '5'}
                onChange={e => update({ energy: Number(e) as NonNullable<DailyCheckIn['energy']> })}
                options={(['1', '2', '3', '4', '5'] as const).map(e => ({ value: e, label: ['', 'Very low', 'Low', 'OK', 'Good', 'Great'][Number(e)] }))} />
            </div>
          </Group>

          <div className="flex flex-col gap-2">
            {blocked && <p className="px-1 text-[length:var(--text-subhead)] font-medium" aria-live="polite">{blocked}</p>}
            <button type="button" onClick={submit} disabled={!!blocked} className={cn(primary, blocked && 'opacity-40')}>
              See today’s plan
            </button>
            <p className="px-1 text-[length:var(--text-footnote)] text-muted-foreground">
              General information, not medical advice. Stop and get help for chest pain, severe breathlessness, faintness or new weakness.
            </p>
          </div>
        </>
      )}

      {form.emergency === null && (
        <p className="px-1 text-[length:var(--text-footnote)] text-muted-foreground">General information, not medical advice.</p>
      )}
    </>
  );
}
