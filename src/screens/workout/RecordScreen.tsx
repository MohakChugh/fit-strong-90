import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import type { WorkoutSession, WorkoutSet } from '@/types';
import { formatWeight, TOTAL_WEEKS, todayString } from '@/lib/utils';
import { nameOf } from '@/data/catalog';
import { update, useStore } from '@/store/useStore';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { asItStands, newBests, withActiveMinutes, withEditedSet, withoutWorkout, withWorkout, type NewBest } from './records';
import { resumable } from './resume';
import {
  bodyweightExercise, dayText, durationText, exerciseLogs, sessionTitle, setLine, sourceLabel, STATUS_LABEL, timeText, totals,
} from './summary';
import { Notice, primary, secondary } from './parts';
import { ActiveTimeSheet, DeleteSheet, EditSetSheet } from './sheets';

const ANSWER_LABEL = { better: 'Better', same: 'Same', worse: 'Worse' } as const;

function bestText(b: NewBest, useMetric: boolean): string {
  const amount = (weight: number, reps: number) => `${formatWeight(weight, useMetric)} × ${reps}`;
  return `${amount(b.weight, b.reps)}, up from ${amount(b.previous.weight, b.previous.reps)}`;
}

/** One past workout: what was done, where the numbers came from, and the means to correct or delete it. */
export default function RecordScreen() {
  const { id = '' } = useParams();
  const saved = (useLocation().state as { saved?: boolean } | null)?.saved === true;
  const navigate = useNavigate();
  const { sessions, personalRecords, settings } = useStore();
  const [openedAt] = useState(() => Date.now());
  const [gone, setGone] = useState(false);
  const session = sessions.find(s => s.id === id);
  const today = todayString();

  if (gone) return <Screen title="Workout" back={{ to: '/track', label: 'Track' }}>{null}</Screen>;
  if (!session) {
    return (
      <Screen title="Workout" back={{ to: '/track', label: 'Track' }}>
        <p className="px-1 text-[length:var(--text-body)] text-muted-foreground">This workout is not on this device.</p>
        <Link to="/track" viewTransition className={secondary}>Back to Track</Link>
      </Screen>
    );
  }
  return (
    <Record session={session} sessions={sessions} records={personalRecords} useMetric={settings.useMetric} today={today}
      saved={saved} continuable={resumable(sessions, today, openedAt)?.id === session.id}
      onDeleted={() => { setGone(true); navigate('/track', { replace: true, viewTransition: true }); }}
      onDone={() => navigate('/track', { viewTransition: true })} />
  );
}

function Record({ session, sessions, records, useMetric, today, saved, continuable, onDeleted, onDone }: {
  session: WorkoutSession;
  sessions: WorkoutSession[];
  records: Parameters<typeof newBests>[2];
  useMetric: boolean;
  today: string;
  saved: boolean;
  /** An unfinished workout the Workout Log would pick back up. */
  continuable: boolean;
  onDeleted: () => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [timing, setTiming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const t = totals(session);
  const logs = exerciseLogs(session);
  const bests = newBests(session, sessions, records);
  const unfinished = session.status === 'in_progress';
  const guided = session.guided === true;

  const run = async (change: Parameters<typeof update>[0]) => {
    const result = await update(change);
    setFailure(result.ok ? null : result.failure.message);
    return result.ok;
  };

  const editingSet = editing ? session.sets.find(s => s.id === editing) : undefined;
  const editingLog = editingSet ? logs.find(l => l.exerciseId === editingSet.exerciseId) : undefined;
  const setRow = (s: WorkoutSet, n: number, timed: boolean) => {
    const line = setLine(s, { timed, guided, useMetric });
    // What a set recorded goes on the detail line, where it wraps at large text; "Not done" fits beside the label.
    const shown = s.status === 'completed'
      ? { detail: <span className="numeric">{line}</span>, accessory: <CheckIcon className="size-5 shrink-0 text-tint" aria-label="Done" /> }
      : { value: line };
    // An unfinished workout is changed where it is being logged, not here.
    return unfinished
      ? <Row key={s.id} label={`Set ${n}`} {...shown} />
      : <Row key={s.id} onClick={() => { setFailure(null); setEditing(s.id); }} label={`Set ${n}`} {...shown} />;
  };

  return (
    <Screen title={sessionTitle(session)} back={{ to: '/track', label: 'Track' }}>
      <p className="-mt-4 px-1 text-[length:var(--text-subhead)] text-muted-foreground">
        {dayText(session.date, today)}{session.startedAt ? ` · ${timeText(session.startedAt)}` : ''} · Week {session.week} of {TOTAL_WEEKS}
      </p>
      {saved && !unfinished && <p role="status" className="px-1 text-[length:var(--text-body)] font-medium">Saved on this device.</p>}

      {unfinished && (
        <Notice tone="caution" title="This workout was not finished">
          {continuable ? (
            <>
              <p>It is still going. Pick it up in the Workout Log, where its sets can be changed.</p>
              <Link to="/track/workout" viewTransition className={`${primary} mt-2`}>Continue this workout</Link>
            </>
          ) : (
            <>
              <p>Save it as it stands: the sets done count, the rest are recorded as not done. Or add the sets you did first.</p>
              <button type="button" className={`${primary} mt-2`} onClick={() => void run(prev => withWorkout(prev, asItStands(session)))}>
                Save as it stands
              </button>
              <Link to={`/track/workout?date=${session.date}`} viewTransition className={secondary}>Add the sets you did</Link>
            </>
          )}
        </Notice>
      )}
      {failure && !editing && !deleting && !timing && <Notice tone="stop" role="alert" title="That did not save"><p>{failure}</p></Notice>}

      <Group>
        <Row label="Status" value={unfinished && !continuable ? 'Not finished' : STATUS_LABEL[session.status]} />
        <Row label="Sets done" value={`${t.done} of ${t.total}`} numeric />
        {guided ? (
          t.activeSeconds !== undefined && <Row label="Time" value={durationText(t.activeSeconds)} />
        ) : (
          // Only the person's own minutes are active time; the clock span is shown apart from it (F20).
          <Row label="Active time" value={t.activeSeconds !== undefined ? durationText(t.activeSeconds) : 'Not entered'}
            detail={t.activeSeconds !== undefined ? 'Entered by you' : undefined}
            {...(unfinished ? {} : { onClick: () => { setFailure(null); setTiming(true); }, chevron: true })} />
        )}
        {t.span && <Row label="Logged" value={`${timeText(t.span.from)} – ${timeText(t.span.to)}`} numeric />}
        {t.volumeKg > 0 && <Row label="Total lifted" value={formatWeight(t.volumeKg, useMetric)} numeric />}
        <Row label="Source" value={sourceLabel(session)} />
      </Group>

      {bests.length > 0 && (
        <Group header="New best sets">
          {bests.map(b => <Row key={b.exerciseId} label={nameOf(b.exerciseId)} detail={bestText(b, useMetric)} />)}
        </Group>
      )}

      {logs.map(log => {
        const answer = session.symptomChecks?.[log.exerciseId];
        const note = session.exerciseNotes?.[log.exerciseId];
        return (
          <Group key={log.exerciseId} header={log.name} footer={note || undefined}>
            {log.sets.map((s, i) => setRow(s, i + 1, log.timed))}
            {answer && <Row label="Back or leg afterwards" value={ANSWER_LABEL[answer]} />}
          </Group>
        );
      })}

      {(session.mobility?.length || session.cardio || session.painAfter !== undefined) && (
        <Group header="Also in this session">
          {!!session.mobility?.length && (
            <Row label="Stretches and mobility" value={`${session.mobility.length} · ${durationText(session.mobility.reduce((n, m) => n + m.seconds, 0))}`} />
          )}
          {session.cardio && <Row label="Cardio" detail={nameOf(session.cardio.modality)} value={`${session.cardio.minutes} min`} numeric />}
          {session.painAfter !== undefined && <Row label="Pain afterwards" detail="Back or leg, as you rated it" value={`${session.painAfter} of 10`} numeric />}
        </Group>
      )}
      {(['warmup', 'cooldown'] as const).map(part => {
        const done = session[part]?.filter(w => w.completed) ?? [];
        return done.length > 0 && (
          <Group key={part} header={part === 'warmup' ? 'Warm-up' : 'Cool-down'}>
            <p className="px-4 py-3 text-[length:var(--text-body)]">{done.map(w => nameOf(w.exerciseId)).join(', ')}</p>
          </Group>
        );
      })}
      {session.notes && (
        <Group header="Notes">
          <p className="whitespace-pre-wrap px-4 py-3 text-[length:var(--text-body)]">{session.notes}</p>
        </Group>
      )}

      {saved && !unfinished && <button type="button" className={primary} onClick={onDone}>Done</button>}

      <Group>
        <Row onClick={() => { setFailure(null); setDeleting(true); }}
          label={<span className="text-stop">Delete workout</span>} />
      </Group>

      <EditSetSheet open={editingSet !== undefined} onOpenChange={o => { if (!o) setEditing(null); }}
        title={editingSet && editingLog ? `Set ${editingLog.sets.indexOf(editingSet) + 1} · ${editingLog.name}` : 'Set'}
        set={editingSet} timed={editingLog?.timed ?? false} guided={guided} perSide={false}
        showWeight={editingSet ? editingSet.weight !== null || !bodyweightExercise(editingSet.exerciseId) : true}
        useMetric={useMetric} failure={failure}
        onSave={async values => {
          if (editing && await run(prev => withEditedSet(prev, session.id, editing, { reps: values.reps, weightKg: values.weightKg, done: true }))) setEditing(null);
        }}
        onNotDone={async () => {
          if (editing && await run(prev => withEditedSet(prev, session.id, editing, { done: false }))) setEditing(null);
        }} />
      {timing && (
        <ActiveTimeSheet open onOpenChange={setTiming} failure={failure}
          minutes={t.activeSeconds !== undefined ? Math.round(t.activeSeconds / 60) : null}
          onSave={async minutes => { if (await run(prev => withActiveMinutes(prev, session.id, minutes))) setTiming(false); }} />
      )}
      <DeleteSheet open={deleting} onOpenChange={setDeleting} failure={failure}
        onDelete={async () => { if (await run(prev => withoutWorkout(prev, session.id))) onDeleted(); }} />
    </Screen>
  );
}
