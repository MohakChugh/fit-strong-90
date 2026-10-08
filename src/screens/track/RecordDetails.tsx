/**
 * Record detail: one reading, blood-pressure reading, walk, session or
 * check-in, with where it came from and, where the store allows it, a way to
 * correct or delete it. Deleting asks once and says what it will change.
 */

import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { Stat } from '@/components/hig/Stat';
import { pairBloodPressure, type BpReading } from '@/health/aggregate';
import { bpReadingId, checkInDayOf, compareObservations, isBpKind, type Observation } from '@/health/observation';
import { walkRecords } from '@/walk/record';
import { getStrength, nameOf } from '@/data/catalog';
import { sessionSeconds } from '@/session/logging';
import { removeObservation, removeObservations, removeReading, update, useStore } from '@/store/useStore';
import { removeCheckInReading, type CheckInReading } from '@/components/checkin/pending';
import { BACK_LABEL, EMERGENCY_LABEL, NEWS_LABEL, URINE_LABEL } from '@/components/checkin/copy';
import type { CheckInRecord } from '@/types/checkin';
import type { WorkoutSession } from '@/types';
import type { UserProfile } from '@/types/profile';
import { REACH_LABELS, loadingOf } from './backLegSeries';
import { EditPressureSheet, EditReadingSheet } from './EditSheets';
import {
  formatClock, formatDayLong, formatDuration, formatObservation, formatValue, hasClockTime, inDisplayUnit, shownDecimals,
  isLabKind, kindTitle, localAt, sourceLabel, tagLabel, unitLabel, type DisplayPrefs,
} from './format';
import { displayPrefs } from './logKinds';
import type { Origin } from './MyDay';
import { glucoseFlag, pressureFlag } from './escalation';
import { CHECK_IN_TIME, countsForDay, deleteConsequence, editBlock, replacedBlock, rewritable } from './records';
import {
  BMI_FRAMEWORKS_NOTE, ageForTargets, bmiOf, clinicianOverrides, interpretB12, interpretBmi, interpretGlucose, interpretHba1c, interpretPressure,
  interpretVitaminD, minutesAfterMealStart, pressureReference, type Interpretation as Reading,
} from './targets';
import { exerciseLogs, sessionTitle, setLine, sourceLabel as sessionSource } from '@/screens/workout/summary';
import { checkInFor, formatPressure, recordPath, sessionStatus } from './timeline';
import { ConfirmSheet, Hint, Interpretation } from './ui';
import { formatNumber, type GlucoseUnit } from './units';
import { useOrigin } from './useOrigin';
import { useToday } from './useToday';

function usePrefs(): DisplayPrefs {
  const { settings, profile, observations } = useStore();
  return useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);
}

type Back = { to: string; label: string };

/** The screen for a record that is no longer on this device: an old link, or one just deleted elsewhere. */
function Gone({ title, back }: { title: string; back: Back }) {
  return (
    <Screen title={title} back={back}>
      <p className="px-1 text-[length:var(--text-body)] text-muted-foreground">This record is no longer on this device.</p>
    </Screen>
  );
}

/** A label that wraps: a Row truncates its label, which would cut an answer off mid-sentence. */
function Wrap({ children }: { children: string }) {
  return <span className="whitespace-normal">{children}</span>;
}

/** "Thursday, 8 October · 07:42", or the date alone when no time was recorded. */
function dateline(o: Observation, prefs: DisplayPrefs, current: string): string {
  const day = formatDayLong(o.day, current);
  return hasClockTime(o) ? `${day} · ${formatClock(o.at, prefs.hour12)}` : day;
}

function corrected(o: Observation, prefs: DisplayPrefs, current: string): string | undefined {
  if (!o.editedAt) return undefined;
  return `${formatDayLong(o.editedAt.slice(0, 10), current)} · ${formatClock(o.editedAt, prefs.hour12)}`;
}

/** Edit and Delete, as rows: the actions sit in the list like iOS's own. */
function Actions({ canEdit, editBlocked, onEdit, deleteLabel, onDelete }: {
  canEdit: boolean;
  editBlocked?: string;
  onEdit: () => void;
  deleteLabel: string;
  onDelete: () => void;
}) {
  return (
    <Group footer={editBlocked}>
      {canEdit && <Row label={<span className="text-tint">Correct this</span>} onClick={onEdit} />}
      <Row label={<span className="text-stop">{deleteLabel}</span>} onClick={onDelete} />
    </Group>
  );
}

// ============================================================================
// A reading or a day total
// ============================================================================

export function ReadingDetail() {
  const { id = '' } = useParams();
  const { observations, profile } = useStore();
  const prefs = usePrefs();
  const current = useToday();
  const location = useLocation();
  const { origin, back, leave } = useOrigin();
  const o = observations.find(x => x.id === id);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  if (!o) return <Gone title="Record" back={back} />;
  // A blood-pressure half is shown as the reading it belongs to, and a walk's
  // own measurement as the walk. A pain rating given after a walk is a reading
  // of its own, which says which walk it followed.
  if (isBpKind(o.kind)) return <PressureView readingId={bpReadingId(o.context) ?? o.id} />;
  const walkId = o.context?.startsWith('walk:') ? o.context.slice('walk:'.length) : undefined;
  if (walkId !== undefined && o.scope !== 'pointInTime') {
    return <Navigate to={recordPath({ type: 'walk', id: walkId })} replace state={origin} />;
  }
  const afterWalk = walkId !== undefined && walkRecords(observations).some(w => w.id === walkId) ? walkId : undefined;
  // A screen opened from here comes back here.
  const here: Origin = { path: location.pathname, label: kindTitle(o.kind) };

  const shown = inDisplayUnit(o, prefs);
  // Never rounded across a threshold the reading is judged against (J06).
  const value = formatNumber(shown.value, shownDecimals(shown.value, o.kind, shown.unit));
  const unit = unitLabel(shown.unit);
  const blocked = editBlock(o) ?? replacedBlock(o, observations);
  const reading = interpretation(o, prefs, profile);
  const isTotal = o.scope === 'dayTotal';
  const counts = countsForDay(o, observations);
  const earlier = isTotal ? observations.filter(x => x.kind === o.kind && x.day === o.day && x.scope === 'dayTotal' && x.id !== o.id).sort(compareObservations) : [];
  const enteredAs = o.unit !== shown.unit ? formatValue(o.value, o.kind, o.unit) : undefined;

  // A check-in's reading leaves the record every gate reads as well, in the
  // same write, so the next save of that day cannot bring it back (C2-01).
  const checkInDay = checkInDayOf(o);
  const inCheckIn: CheckInReading | undefined = !checkInDay ? undefined
    : o.kind === 'glucose' && o.unit ? { kind: 'glucose', ...(o.timeUnknown ? {} : { at: o.at }), value: o.value, unit: o.unit }
      : o.kind === 'backPain' || o.kind === 'legPain' ? { kind: o.kind, value: o.value }
        : undefined;
  const remove = async () => {
    if (inCheckIn && checkInDay && profile) {
      const result = await removeCheckInReading(inCheckIn, [o.id], { profile, update, date: checkInDay });
      if (!result.stored) return setError(`Not deleted: ${result.failure ?? 'the device did not keep it.'}`);
    } else {
      const result = await removeObservation(o.id);
      if (!result.ok) return setError(result.failure.message);
    }
    setConfirming(false);
    leave();
  };

  return (
    <Screen title={kindTitle(o.kind)} back={back}>
      <Stat value={value} unit={unit} label={isTotal ? `Day total, ${formatDayLong(o.day, current)}` : dateline(o, prefs, current)} size="reading" tone={reading?.tone === 'default' ? undefined : reading?.tone} />

      <Group>
        {!isTotal && <Row label="Time" value={isLabKind(o.kind) ? 'Date of test' : hasClockTime(o) ? formatClock(o.at, prefs.hour12) : 'Not recorded'} />}
        {o.tag !== undefined && <Row label="When" value={tagLabel(o.tag)} />}
        {o.mealStartedAt && (
          <Row label="Meal started" value={`${formatClock(o.mealStartedAt, prefs.hour12)}, ${minutesAfterMealStart(o.at, o.mealStartedAt)} min before`} />
        )}
        {o.scope === 'sessionObserved' && typeof o.coverageMs === 'number' && <Row label="Observed for" value={formatDuration(o.coverageMs / 1000)} />}
        <Row label="Source" value={sourceLabel(o)} />
        {enteredAs && <Row label="Entered as" value={enteredAs} numeric />}
        {isTotal && <Row label="Counts for the day" value={counts ? 'Yes, the latest' : 'No, replaced'} />}
        {corrected(o, prefs, current) && <Row label="Corrected" value={corrected(o, prefs, current)} />}
        {o.note && <Row label="Note" detail={o.note} />}
        {afterWalk && <Row as={Link} to={recordPath({ type: 'walk', id: afterWalk })} state={here} viewTransition label="The walk it followed" chevron />}
      </Group>

      {reading && (
        <Interpretation
          text={reading.text}
          tone={reading.tone}
          framework={reading.framework}
          extra={o.kind === 'weight' ? <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{BMI_FRAMEWORKS_NOTE}</p> : undefined}
        />
      )}

      {earlier.length > 0 && (
        <Group header="Other entries for this day" footer="The latest statement is the day’s total; earlier ones are kept, not added.">
          {earlier.map(x => (
            <Row
              key={x.id}
              as={Link}
              to={recordPath({ type: 'reading', id: x.id })}
              state={here}
              viewTransition
              label={formatObservation(x, prefs)}
              detail={`${formatClock(x.editedAt ?? x.at, prefs.hour12)} · ${sourceLabel(x)}`}
              chevron
            />
          ))}
        </Group>
      )}

      <Actions
        canEdit={blocked === undefined}
        editBlocked={blocked ?? (checkInDay && !isTotal ? CHECK_IN_TIME : undefined)}
        onEdit={() => setEditing(true)}
        deleteLabel={isTotal ? 'Delete this entry' : 'Delete this reading'}
        onDelete={() => { setError(undefined); setConfirming(true); }}
      />

      {blocked === undefined && <EditReadingSheet open={editing} onOpenChange={setEditing} observation={o} prefs={prefs} />}
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={isTotal ? 'Delete this entry?' : 'Delete this reading?'}
        detail={deleteConsequence(o, observations, prefs)}
        confirm="Delete"
        onConfirm={() => void remove()}
        error={error}
      />
    </Screen>
  );
}

/** The interpretive line for a reading, where a framework gives one. */
function interpretation(o: Observation, prefs: DisplayPrefs, profile: UserProfile | undefined): Reading | undefined {
  const shown = inDisplayUnit(o, prefs);
  const heightCm = profile?.heightCm;
  switch (o.kind) {
    case 'glucose':
      return interpretGlucose(shown.value, prefs.glucose, o.tag, { at: o.at, ...(o.mealStartedAt ? { mealStartedAt: o.mealStartedAt } : {}) });
    case 'weight': {
      const bmi = heightCm ? bmiOf(o.value, heightCm) : undefined;
      return bmi === undefined ? undefined : interpretBmi(bmi);
    }
    case 'hba1c':
      // The care team's goal, as the chart and the testing cadence use (F04).
      return interpretHba1c(shown.value, prefs.hba1c, clinicianOverrides(profile));
    case 'b12':
      return interpretB12(shown.value, prefs.b12);
    case 'vitaminD':
      return interpretVitaminD(shown.value, prefs.vitaminD);
    default:
      return undefined;
  }
}

// ============================================================================
// Blood pressure
// ============================================================================

export function PressureDetail() {
  const { id = '' } = useParams();
  return <PressureView readingId={id} />;
}

function PressureView({ readingId }: { readingId: string }) {
  const { observations, profile, checkIns, sessions } = useStore();
  const prefs = usePrefs();
  const current = useToday();
  const { back, leave } = useOrigin();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const reading: BpReading | undefined = useMemo(
    () => pairBloodPressure(observations.filter(o => isBpKind(o.kind) && (bpReadingId(o.context) ?? o.id) === readingId))[0],
    [observations, readingId],
  );

  if (!reading) return <Gone title="Blood pressure" back={back} />;
  const first = reading.halves[0];
  const severe = reading.systolic !== null && reading.diastolic !== null ? interpretPressure(reading.systolic, reading.diastolic) : undefined;
  const age = ageForTargets(profile?.birthYear, current);
  const ref = pressureReference(age, profile?.health.hypertension);
  const paired = bpReadingId(first.context) !== undefined;
  const lastEdit = reading.halves.filter(h => h.editedAt).sort((a, b) => (a.editedAt ?? '').localeCompare(b.editedAt ?? '')).at(-1);
  const value = formatPressure(reading).replace(' mmHg', '');
  // A check-in keeps every reading; only an older record kept just their
  // average, which was the reading it showed.
  const checkInDay = checkInDayOf(first);
  const record = checkInDay ? checkInFor(checkInDay, { checkIns, sessions }) : undefined;
  const isAverage = !!record?.bp && !record.bpReadings?.length && record.bp.sys === reading.systolic && record.bp.dia === reading.diastolic;
  const whole = rewritable(reading);

  const remove = async () => {
    // A check-in's reading leaves its record too, in the same write (C2-01).
    if (checkInDay && profile && reading.systolic !== null && reading.diastolic !== null) {
      const timed = !reading.halves.some(h => h.timeUnknown);
      const result = await removeCheckInReading(
        { kind: 'pressure', ...(timed ? { at: reading.at } : {}), sys: reading.systolic, dia: reading.diastolic },
        reading.halves.map(h => h.id),
        { profile, update, date: checkInDay },
      );
      if (!result.stored) return setError(`Not deleted: ${result.failure ?? 'the device did not keep it.'}`);
      setConfirming(false);
      return leave();
    }
    // Both halves go together: one alone would be a reading nobody can read.
    const result = paired ? await removeReading(readingId) : await removeObservation(first.id);
    if (!result.ok) return setError(result.failure.message);
    setConfirming(false);
    leave();
  };

  return (
    <Screen title="Blood pressure" back={back}>
      <Stat value={value} unit="mmHg" label={dateline(first, prefs, current)} size="reading" tone={severe ? 'stop' : undefined} />
      <Group>
        <Row label="Time" value={hasClockTime(first) ? formatClock(reading.at, prefs.hour12) : 'Not recorded'} />
        {reading.tag !== undefined && <Row label="When" value={tagLabel(reading.tag)} />}
        <Row label="Source" value={sourceLabel(first)} />
        {isAverage && <Row label="Recorded as" value="Average of the check-in’s readings" />}
        {/* Either half may be the one corrected; the reading says so either way. */}
        {lastEdit && <Row label="Corrected" value={corrected(lastEdit, prefs, current)} />}
        {reading.note && <Row label="Note" detail={reading.note} />}
      </Group>
      {severe && <Interpretation text={severe.text} tone={severe.tone} framework={severe.framework} />}
      <Interpretation text={`${ref.label}. ${ref.note}`} tone="default" framework={ref.framework} />
      <Actions
        canEdit={reading.source === 'manual'}
        editBlocked={reading.source !== 'manual'
          ? 'Measured and imported records are kept as they arrived.'
          : whole ? undefined : checkInDay ? 'Only the numbers can be corrected here: the time is your check-in’s.' : 'Only the numbers of this reading can be corrected.'}
        onEdit={() => setEditing(true)}
        deleteLabel="Delete this reading"
        onDelete={() => { setError(undefined); setConfirming(true); }}
      />
      {reading.source === 'manual' && <EditPressureSheet open={editing} onOpenChange={setEditing} reading={reading} />}
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this reading?"
        detail="Both numbers are removed from this device. This cannot be undone."
        confirm="Delete"
        onConfirm={() => void remove()}
        error={error}
      />
    </Screen>
  );
}

// ============================================================================
// A walk
// ============================================================================

export function WalkDetail() {
  const { id = '' } = useParams();
  const { observations } = useStore();
  const prefs = usePrefs();
  const current = useToday();
  const location = useLocation();
  const { back, leave } = useOrigin();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  // The whole walk, every segment and any time added for a gap (walk/record.ts).
  const walk = useMemo(() => walkRecords(observations).find(w => w.id === id), [observations, id]);

  if (!walk) return <Gone title="Walk" back={back} />;
  const measured = walk.observations.find(o => o.source === 'measured') ?? walk.observations[0];
  // No average pace here: the saved records say how far and how long, but not
  // for how much of that time GPS was measuring, so any pace worked out from
  // them could disagree with the one the walk showed (F16).
  // Pain given after the walk is the person's own reading, kept if the walk goes.
  const ratings = walk.observations.filter(o => o.scope === 'pointInTime').sort(compareObservations);
  // The walk's own measurements; a day total it reported belongs to the day.
  const doomed = walk.observations.filter(o => o.scope === 'sessionObserved');
  const here: Origin = { path: location.pathname, label: 'Walk' };

  const remove = async () => {
    // Every segment's time, movement, distance and steps in one write: all of
    // them, or none, so a failure leaves the whole walk and its retry (F10).
    const result = await removeObservations(doomed.map(o => o.id));
    if (!result.ok) return setError(`This walk was not deleted: ${result.failure.message}`);
    setConfirming(false);
    leave();
  };

  return (
    <Screen title="Walk" back={back}>
      <Stat
        value={walk.minutes > 0 ? formatNumber(walk.minutes) : 'Not measured'}
        unit={walk.minutes > 0 ? 'min' : ''}
        label={dateline(measured, prefs, current)}
        size="reading"
      />
      <Group>
        <Row label="Started" value={formatClock(walk.at, prefs.hour12)} />
        {walk.addedMinutes > 0 && <Row label="Added by you" value={`${formatNumber(walk.addedMinutes)} min`} detail="For time the app was away and could not record" />}
        <Row label="Distance" value={walk.distanceKm !== undefined ? formatObservation({ kind: 'walkDistance', value: walk.distanceKm, unit: 'km' }, prefs) : 'Not measured'} />
        {walk.steps !== undefined && <Row label="Steps" value={formatObservation({ kind: 'steps', value: walk.steps, unit: 'steps' }, prefs)} />}
        {walk.mealStartedAt && <Row label="Meal started" value={formatClock(walk.mealStartedAt, prefs.hour12)} />}
        <Row label="Source" value={sourceLabel(measured)} />
        {walk.note && <Row label="Note" detail={walk.note} />}
      </Group>
      {ratings.length > 0 && (
        <Group header="Pain afterwards">
          {ratings.map(o => (
            <Row key={o.id} as={Link} to={recordPath({ type: 'reading', id: o.id })} state={here} viewTransition label={kindTitle(o.kind)} value={formatObservation(o, prefs)} numeric chevron />
          ))}
        </Group>
      )}
      <Group footer="Walks are recorded by the app as you walk, so they are not corrected by hand.">
        <Row label={<span className="text-stop">Delete this walk</span>} onClick={() => { setError(undefined); setConfirming(true); }} />
      </Group>
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this walk?"
        detail={`Its time, distance and steps are removed from this device. This cannot be undone.${ratings.length > 0 ? ' Your pain ratings from after the walk are kept.' : ''}`}
        confirm="Delete"
        onConfirm={() => void remove()}
        error={error}
      />
    </Screen>
  );
}

// ============================================================================
// A session
// ============================================================================

const CHECK_WORD = { better: 'Better', same: 'Same', worse: 'Worse' } as const;

export function SessionDetail() {
  const { id = '' } = useParams();
  const { sessions, observations } = useStore();
  const prefs = usePrefs();
  const current = useToday();
  const { back } = useOrigin();
  const s = sessions.find(x => x.id === id);
  if (!s) return <Gone title="Session" back={back} />;

  const seconds = sessionSeconds(s);
  const local = s.startedAt ? localAt(s.startedAt) : undefined;
  const { hinge, squat } = loadingOf(s);
  const pain = observations.find(o => o.context === `session:${s.id}` && o.kind === 'backPain');
  const painAfter = pain?.value ?? s.painAfter;
  const checks = Object.entries(s.symptomChecks ?? {});

  return (
    <Screen title={sessionTitle(s)} back={back}>
      <Stat
        value={seconds !== undefined && seconds > 0 ? formatDuration(seconds).replace(/ (min|s|h)$/, '') : 'Not recorded'}
        unit={seconds !== undefined && seconds > 0 ? (formatDuration(seconds).match(/ (min|s|h)$/)?.[1] ?? '') : ''}
        label={local ? `${formatDayLong(s.date, current)} · ${formatClock(local, prefs.hour12)}` : formatDayLong(s.date, current)}
        size="reading"
      />
      <Group>
        <Row label="Status" value={sessionStatus(s)} />
        <Row label="Source" value={sessionSource(s)} />
        {(hinge !== null || squat !== null) && (
          <Row label="Spinal loading used" value={[hinge !== null && `Hinge ${hinge}`, squat !== null && `Squat ${squat}`].filter(Boolean).join(' · ')} />
        )}
        {painAfter !== undefined && <Row label="Pain afterwards" value={`${painAfter} of 10`} />}
      </Group>

      <ExerciseList session={s} useMetric={prefs.mass === 'kg'} />

      {checks.length > 0 && (
        <Group header="Symptom checks during the session">
          {checks.map(([exerciseId, answer]) => (
            <Row key={exerciseId} label={<Wrap>{nameOf(exerciseId)}</Wrap>} value={<span className={answer === 'worse' ? 'text-caution' : undefined}>{CHECK_WORD[answer]}</span>} />
          ))}
        </Group>
      )}
      {s.cardio && <Group><Row label="Cardio" value={`${s.cardio.minutes} min`} detail={nameOf(s.cardio.modality)} /></Group>}
      <Group>
        <Row as={Link} to={`/track/workout/${encodeURIComponent(s.id)}`} viewTransition label="Sets and weights" detail="In the Workout Log" chevron />
      </Group>
    </Screen>
  );
}

/**
 * Each exercise with its sets in the Workout Log's own words (`setLine`): a
 * guided hold says Done rather than its planner's count, a timed set says
 * seconds, and weights follow the person's units (F22).
 */
function ExerciseList({ session, useMetric }: { session: WorkoutSession; useMetric: boolean }) {
  const logs = exerciseLogs(session);
  const stretches = session.mobility ?? [];
  if (logs.length === 0 && stretches.length === 0) return null;
  return (
    <>
      {logs.length > 0 && (
        <Group header="Exercises">
          {logs.map(log => {
            const done = log.sets.filter(x => x.status === 'completed');
            const lines = done.map(set => setLine(set, { timed: log.timed, guided: session.guided === true, useMetric })).filter(line => line !== 'Done');
            const rung = getStrength(log.exerciseId)?.ladder;
            return (
              <Row
                key={log.exerciseId}
                label={<Wrap>{log.name}</Wrap>}
                detail={[
                  `${done.length} of ${log.sets.length} ${log.sets.length === 1 ? 'set' : 'sets'} done`,
                  lines.length > 0 && lines.join('; '),
                  rung && `${rung.track === 'hinge' ? 'Hinge' : 'Squat'} level ${rung.level}`,
                ].filter(Boolean).join(' · ')}
              />
            );
          })}
        </Group>
      )}
      {stretches.length > 0 && (
        <Group header="Mobility">
          <Row label={`${stretches.length} ${stretches.length === 1 ? 'movement' : 'movements'}`} value={formatDuration(stretches.reduce((t, m) => t + m.seconds, 0))} />
        </Group>
      )}
    </>
  );
}

// ============================================================================
// A check-in
// ============================================================================

const SLEEP = { lt5: 'Under 5 hours', '5to7': '5 to 7 hours', gt7: 'More than 7 hours' } as const;

const OUTCOME_WORD: Record<CheckInRecord['readiness']['outcome'], string> = {
  green: 'Go ahead as planned',
  amber: 'Go gently',
  recovery: 'A recovery session',
  red: 'Rest today',
  urgent: 'Get help now',
};

const yesNo = (v: boolean | undefined) => (v === undefined ? 'Not asked' : v ? 'Yes' : 'No');

export function CheckInDetail() {
  const { date = '' } = useParams();
  const { checkIns, sessions, observations } = useStore();
  const prefs = usePrefs();
  const current = useToday();
  const { back: nav } = useOrigin();
  const c = checkInFor(date, { checkIns, sessions });
  if (!c) return <Gone title="Check-in" back={nav} />;

  // Every reading lifted from it, rechecks included (`checkIn:D#1`, `bp:checkIn:D#1`).
  const lifted = observations.filter(o => checkInDayOf(o) === date);
  const liftedReadings = lifted.filter(o => !isBpKind(o.kind)).sort(compareObservations);
  const liftedPressure = pairBloodPressure(lifted.filter(o => isBpKind(o.kind)));
  // An older record kept only the average of its readings.
  const averaged = !c.bpReadings?.length && c.bp !== undefined;
  const display = c.glucoseDisplay;
  const here: Origin = { path: `/track/check-in/${date}`, label: 'Check-in' };
  const back = c.back;
  const ketones = c.ketones;
  const flags = (Object.keys(BACK_LABEL) as (keyof typeof BACK_LABEL)[]).filter(k => back?.[k] === true);

  return (
    <Screen title="Check-in" back={nav}>
      <Hint className="text-[length:var(--text-subhead)]">{formatDayLong(date, current)}. Your answers as you gave them; the readings below are the ones on your charts.</Hint>

      {(c.emergency?.length ?? 0) > 0 && (
        <Group header="Right now">
          {c.emergency!.map(f => <Row key={f} label={<Wrap>{EMERGENCY_LABEL[f]}</Wrap>} />)}
        </Group>
      )}

      {back && (
        <Group header="Back and legs">
          {back.pain !== undefined && <Row label="Back pain" value={`${back.pain} of 10`} />}
          {back.legPain !== undefined && <Row label="Leg pain" value={`${back.legPain} of 10`} />}
          {back.reach && <Row label="Symptoms reached" value={REACH_LABELS[back.reach]} />}
          {flags.map(k => <Row key={k} label={<Wrap>{BACK_LABEL[k]}</Wrap>} value="Yes" />)}
          {back.newWeakness === undefined && <Row label={<Wrap>New or worse numbness, tingling or weakness</Wrap>} value={yesNo(back.newNeuro)} />}
          {c.emergency === undefined && <Row label={<Wrap>Groin numbness or a bladder or bowel change</Wrap>} value={yesNo(back.caudaEquinaFlag)} />}
        </Group>
      )}

      <Group header="New today">
        {c.news.length > 0 ? c.news.map(n => <Row key={n} label={<Wrap>{NEWS_LABEL[n]}</Wrap>} />) : <Row label="None of these" />}
      </Group>

      {(liftedReadings.length > 0 || liftedPressure.length > 0 || ketones || display) && (
        <Group header="Readings" footer="Tap a reading to see it on its own, or to correct it.">
          {liftedReadings.map(o => (
            <Row
              key={o.id} as={Link} to={recordPath({ type: 'reading', id: o.id })} state={here} viewTransition
              label={kindTitle(o.kind)}
              detail={[hasClockTime(o) && formatClock(o.at, prefs.hour12), o.kind === 'glucose' && glucoseFlag(o.value, o.unit as GlucoseUnit)].filter(Boolean).join(' · ') || undefined}
              value={formatObservation(o, prefs)} numeric chevron
            />
          ))}
          {display && <Row label="Glucose" value={`Meter showed ${display.display}`} detail="Past what the meter can measure, so no number" />}
          {liftedPressure.map(r => (
            <Row
              key={r.id} as={Link} to={recordPath({ type: 'pressure', id: r.id })} state={here} viewTransition
              label="Blood pressure"
              detail={[averaged ? 'Average of the readings you took' : hasClockTime(r.halves[0]) && formatClock(r.at, prefs.hour12), pressureFlag(r.systolic, r.diastolic)].filter(Boolean).join(' · ') || undefined}
              value={formatPressure(r)} numeric chevron
            />
          ))}
          {ketones && (
            <Row
              label={ketones.kind === 'blood' ? 'Blood ketones' : 'Urine ketones'}
              value={ketones.kind === 'blood'
                ? `${formatNumber(ketones.value, 1)} mmol/L`
                : ketones.category ? URINE_LABEL[ketones.category] : 'Recorded'}
            />
          )}
        </Group>
      )}

      <Group header="Sleep and energy">
        <Row label="Sleep" value={c.sleep ? SLEEP[c.sleep] : 'Not answered'} />
        <Row label="Energy" value={c.energy !== undefined ? `${c.energy} of 5` : 'Not answered'} />
      </Group>

      <Group header="What the app suggested" footer="The suggestion made at the time, from these answers. General information, not medical advice.">
        <Row label={OUTCOME_WORD[c.readiness.outcome]} />
        {c.readiness.reasons.filter(r => r.outcome !== 'green').map(r => <Row key={r.code} label={<Wrap>{r.message}</Wrap>} />)}
      </Group>
    </Screen>
  );
}
