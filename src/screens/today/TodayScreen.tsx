/**
 * Today: "What is useful now?" (codex-vision §2 and §4; board D5, D20, D25).
 *
 * One suggestion with its reason on screen, "Choose something else" in the
 * same place every time, a compact day, the plan row, at most one prompt, and
 * the status, with the plan offer after a status is over. Nothing else: no
 * statistics grid, no streak, no tip carousel, no tomorrow card. The decisions live in `@/health/recommend`, `./model`
 * and the shared start gate; this file lays them out.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { GlassWaterIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { YouButton } from '@/components/hig/AppShell';
import { Group, Row } from '@/components/hig/List';
import { Ring } from '@/components/hig/Ring';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { useGuided } from '@/hooks/useGuided';
import { useAppData } from '@/hooks/useLocalStorage';
import { profileGaps } from '@/engine/health';
import { checkedIn, type Mode } from '@/engine/permission';
import { HREF, freezeKey, isEnrolled, recommend, resumeHref, savedRun, smallHours, trainedOn, type RecommendInput, type Recommendation, type RecommendationAction } from '@/health/recommend';
import { STATUS_LABEL, periodOn, planOffer } from '@/health/status';
import { habitPrecautions } from '@/reminders/advice';
import { usePending } from '@/reminders/pending';
import { ReminderBanner } from '@/reminders/ReminderBanner';
import { waterBlock } from '@/reminders/water';
import { bankProgress, progressSettled } from '@/session/logging';
import { clearProgress, loadExpiredProgress, loadProgress, loadSetAside, minutesLeft, releaseSetAside, slotOf, type ProgressSlot, type SavedProgress } from '@/session/persistence';
import { prefersHour12 } from '@/screens/track/format';
import { addToDayTotal, getState, isSessionSaved, useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { useClock } from './clock';
import { ChooserSheet } from './ChooserSheet';
import { RecommendationCard } from './RecommendationCard';
import { MovePlanBack, StatusSheet } from './StatusSheet';
import {
  SHEET_KEYS,
  chooserRows,
  eyebrowOf,
  latestGlucose,
  latestPressure,
  pickPrompt,
  planRow,
  sheetFrom,
  showsGlucose,
  showsPressure,
  startLabelFor,
  statusDetail,
  todayPrefs,
  weekMovement,
  enteredNote,
  type ChooserRow,
  type Prompt,
  type Reading,
  type TodaySheet,
} from './model';

// Track's own goal editor, so the rule for a valid goal lives in one place.
// Loaded on first use: Today ships with the app and should stay small.
const GoalSheet = lazy(() => import('@/screens/track/GoalSheet').then(m => ({ default: m.GoalSheet })));

/** The device's clock preference does not change while the app is open. */
const HOUR12 = prefersHour12();

const SAFETY = new Set<Recommendation['kind']>(['emergency', 'seekHelp', 'recheck', 'hold']);

const MOVE_HREF: Record<Mode, string> = { guided: HREF.guided, stretch: HREF.stretch, walk: HREF.walk };

/** Rows that open another area's screen name Today as their opener, so Back returns here (scan S-10). */
const FROM_TODAY = { path: '/today', label: 'Today' };

/** The guided session and a stretch each keep their own saved run. */
const SLOTS: ProgressSlot[] = ['guided', 'stretch'];

/** A banked run keeps one id however often banking is attempted, so it is never recorded twice. */
const bankId = (saved: SavedProgress) => saved.sessionId ?? `${slotOf(saved.plan)}-${saved.plan.date}-${saved.savedAt}`;

interface Frozen {
  key: string;
  /**
   * Everything the choice is made from, as it stood when worked out: the
   * permissions are not among it, so the card always shows the gate's answer
   * as it is now (codex F32).
   */
  input: Omit<RecommendInput, 'permissions'>;
  /** The kind it was worked out as, so a later change of kind reads as a change. */
  kind: Recommendation['kind'];
  /** Worked out again while the screen was open, rather than on arrival. */
  changed: boolean;
}

export function TodayScreen() {
  const state = useStore();
  const [, update] = useAppData();
  const guided = useGuided();
  const { start, sheet: startSheet, permissionFor } = useStartMovement();
  const clock = useClock();
  const waiting = usePending();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { settings, profile, observations, sessions } = state;
  // Today's check-in as every screen must act on it: the stored one, or an
  // answer the device would not keep that is at least as restrictive.
  const checkIns = useMemo(() => {
    const effective = guided.checkIn;
    if (!effective || state.checkIns.includes(effective)) return state.checkIns;
    return [...state.checkIns.filter(c => c.date !== effective.date), effective];
  }, [state.checkIns, guided.checkIn]);
  const { now } = clock;
  const today = format(now, 'yyyy-MM-dd');

  // ---- The recommendation, frozen while the person reads it --------------
  // The choice is worked out on arrival, then again only on a new day, a
  // return to the app, a changed check-in or status, or an action here that
  // settles something (D20). The gate is asked on every render, which the
  // clock brings round each minute, so a stop or a reading gone stale shows
  // on the card at once, over the frozen choice (D30).
  const [settled, setSettled] = useState(0);
  const key = freezeKey({ now, checkIns, statusPeriods: settings.statusPeriods, startDate: settings.startDate, visit: clock.visit + settled });
  const permissions: RecommendInput['permissions'] = { guided: permissionFor('guided'), stretch: permissionFor('stretch'), walk: permissionFor('walk') };
  const work = (): Frozen => {
    const saved = SLOTS.map(slot => loadProgress(now.getTime(), slot)).filter((p): p is SavedProgress => p !== null);
    const input = { now, settings, profile, plan: guided.plan, sessions, checkIns, observations, saved };
    return { key, input, kind: recommend({ ...input, permissions }).kind, changed: false };
  };
  const [frozen, setFrozen] = useState(work);
  let current = frozen;
  if (frozen.key !== key) {
    current = { ...work(), changed: true };
    setFrozen(current);
  }
  const { saved } = current.input;
  const recommendation = recommend({ ...current.input, permissions });
  const revised = current.changed || recommendation.kind !== current.kind;

  // ---- Sheets ------------------------------------------------------------
  // A link can open one (`?checkin=1` from the session player), on arrival
  // or while Today is already open (codex F31): each request is read once,
  // as the address changes, and then taken out of it. After that a sheet is
  // ordinary state, so closing one or leaving Today never leaves an address
  // behind that would reopen it on Back.
  const [sheet, setSheet] = useState<TodaySheet | undefined>(() => sheetFrom(params));
  const [goalLoaded, setGoalLoaded] = useState(sheet?.kind === 'goal');
  const request = SHEET_KEYS.some(k => params.has(k)) ? params.toString() : '';
  const [handled, setHandled] = useState(request);
  if (request !== handled) {
    setHandled(request);
    const asked = sheetFrom(params);
    if (asked) {
      setSheet(asked);
      if (asked.kind === 'goal') setGoalLoaded(true);
    }
  }
  useEffect(() => {
    if (!SHEET_KEYS.some(k => params.has(k))) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const k of SHEET_KEYS) next.delete(k);
      return next;
    }, { replace: true });
  }, [params, setParams]);

  // "Update" on today's check-in: the same sheet, answers only (J03 step 4).
  const [updating, setUpdating] = useState(false);

  const open = (next: TodaySheet) => {
    if (next.kind === 'goal') setGoalLoaded(true);
    setSheet(next);
  };
  const closeSheet = (isOpen: boolean) => { if (!isOpen) setSheet(undefined); };

  // Progress too old to resume still holds real work: it goes to History
  // rather than waiting for the next guided session to find it.
  useEffect(() => {
    for (const slot of SLOTS) {
      const old = loadExpiredProgress(Date.now(), slot);
      if (!old) continue;
      // Let go only once History durably holds the work (J17 step 5).
      void update(prev => bankProgress(prev, old, bankId(old))).then(result => {
        if (result.ok && progressSettled(old, bankId(old), getState().sessions, isSessionSaved)) clearProgress(slot);
      });
    }
    // Runs the player kept aside because the device would not bank them (scan M-08).
    for (const kept of loadSetAside()) {
      void update(prev => bankProgress(prev, kept, bankId(kept))).then(result => {
        if (result.ok && progressSettled(kept, bankId(kept), getState().sessions, isSessionSaved)) releaseSetAside(kept);
      });
    }
  }, [update]);

  const recovery = guided.plan.kind === 'recovery';
  const act = (action: RecommendationAction) => {
    if (action.mode) {
      start(action.mode, action.to, startLabelFor(action.mode, action.to, recovery));
      return;
    }
    const requested = action.to.startsWith('/today?') ? sheetFrom(new URLSearchParams(action.to.slice(7))) : undefined;
    if (requested) open(requested);
    else navigate(action.to, { viewTransition: true });
  };

  const choose = (row: ChooserRow) => {
    setSheet(undefined);
    if (row.mode) start(row.mode, row.to, startLabelFor(row.mode, row.to, recovery));
    else navigate(row.to, { viewTransition: true });
  };

  // ---- Everything below the suggestion is live -----------------------------
  // The day's figures read the whole record, which is a lifetime of it, so
  // they are worked out when the record or the day changes, not on each tick.
  const { glucose, pressure, week } = useMemo(() => {
    const prefs = todayPrefs(profile, HOUR12);
    return {
      glucose: latestGlucose(observations, today, prefs),
      pressure: latestPressure(observations, today, prefs),
      week: weekMovement(today, observations, sessions),
    };
  }, [profile, observations, sessions, today]);
  const minutes = week.minutes;
  const byHand = enteredNote(week);
  const enrolled = isEnrolled(settings, profile);
  const trained = trainedOn(sessions, today);
  const period = periodOn(settings.statusPeriods, today);
  const status = period?.kind ?? 'normal';
  const goal = settings.weeklyMovementGoalMinutes;
  const gaps = profile ? profileGaps(profile) : undefined;
  const gap = gaps && (gaps.healthUnreviewed || gaps.medicinesUnknown) && recommendation.action.to !== HREF.profile ? gaps : undefined;
  const stopped = recommendation.kind === 'emergency' || recommendation.kind === 'seekHelp';
  const prompt = pickPrompt({
    now, day: today, status, profile, settings, observations, waiting,
    stopped,
    held: SAFETY.has(recommendation.kind) && !stopped,
    waterBlocked: waterBlock(profile, settings.habits) !== undefined,
  });
  const quiet = status !== 'normal' || SAFETY.has(recommendation.kind);
  // Not in the small hours either: "Rest well" is the one thing to say then.
  const earlierRun = quiet || smallHours(now) ? undefined : savedRun(saved, today, 'earlier');
  // Offered from the first visit after a status run ends until it is answered,
  // but never beside a stop or a check that comes first.
  const offer = quiet ? undefined : planOffer(settings.statusPeriods, settings.startDate, today);

  return (
    <Screen title="Today" subtitle={format(now, 'EEEE, d MMMM')} trailing={<YouButton />}>
      <div className="flex flex-col gap-3">
        <RecommendationCard
          recommendation={recommendation}
          eyebrow={eyebrowOf(recommendation)}
          revision={`${current.key}|${recommendation.kind}`}
          changed={revised}
          onAct={act}
        />
        <button
          type="button"
          onClick={() => open({ kind: 'choose' })}
          className="press-feedback flex min-h-12 w-full items-center justify-center rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-semibold text-tint"
        >
          Choose something else
        </button>
      </div>

      {offer && <MovePlanBack offer={offer} periods={settings.statusPeriods} startDate={settings.startDate} />}

      {earlierRun && (
        <EarlierSession
          saved={earlierRun}
          onFinish={() => {
            const mode: Mode = slotOf(earlierRun.plan) === 'stretch' ? 'stretch' : 'guided';
            const to = resumeHref(earlierRun);
            start(mode, to, startLabelFor(mode, to));
          }}
          onSave={async () => {
            const result = await update(prev => bankProgress(prev, earlierRun, bankId(earlierRun)));
            if (!result.ok) return result.failure.message;
            if (!progressSettled(earlierRun, bankId(earlierRun), getState().sessions, isSessionSaved)) return 'That did not save yet. Try again in a moment.';
            clearProgress(slotOf(earlierRun.plan));
            setSettled(n => n + 1);
            return undefined;
          }}
        />
      )}

      {gap && (
        <Group>
          <Row
            as={Link}
            to={HREF.profile}
            viewTransition
            label={gap.healthUnreviewed ? 'Finish your health profile' : 'Your diabetes medicines'}
            detail={gap.healthUnreviewed
              ? 'So sessions fit your back, glucose and blood pressure.'
              : 'Answer two questions about your medicines so sessions can start.'}
            chevron
          />
        </Group>
      )}

      <Group header="Your day">
        {/* Quiet, and only once today is checked in: a new symptom or reading
            can always be added, whatever the suggestion above says (J03 step 4). */}
        {checkedIn(guided.checkIn) && (
          <Row label="Today’s check-in" onClick={() => setUpdating(true)}
            accessory={<span className="shrink-0 text-[length:var(--text-body)] text-tint">Update</span>} />
        )}
        {goal !== undefined
          ? (
            <div className="px-4 py-3">
              <Ring value={minutes} goal={goal} label="Recorded movement this week" unit="minutes" size={64} />
              {byHand && <p className="pt-2 text-[length:var(--text-footnote)] text-muted-foreground">Includes {byHand === 'all added by hand' ? 'only minutes added by hand' : byHand}.</p>}
            </div>
          )
          : (
            <Row
              label="Set a weekly goal"
              detail={minutes > 0 ? [`${minutes} min of movement recorded this week`, byHand].filter(Boolean).join(' · ') : 'No movement recorded yet this week'}
              chevron
              onClick={() => open({ kind: 'goal' })}
            />
          )}
        {/* Each opens its history, where a reading can be added (as in Health):
            glucose on every reading, so the one on the row is always shown (scan J2-08). */}
        {showsGlucose(profile, glucose) && <Row as={Link} to="/track/metric/glucose?group=all" state={FROM_TODAY} viewTransition label="Glucose" detail={<ReadingLine reading={glucose} />} chevron />}
        {showsPressure(profile, pressure) && <Row as={Link} to="/track/metric/bloodPressure" state={FROM_TODAY} viewTransition label="Blood pressure" detail={<ReadingLine reading={pressure} />} chevron />}
        <Row as={Link} to={HREF.day} viewTransition label="View my day" chevron />
      </Group>

      {enrolled && profile && (
        <Group>
          <Row
            as={Link}
            to={HREF.plan}
            state={FROM_TODAY}
            viewTransition
            {...planRow({
              day: today, plan: guided.plan, sessions, profile, startDate: settings.startDate,
              statusPeriods: settings.statusPeriods, sessionShown: recommendation.kind === 'scheduled',
            })}
            chevron
          />
        </Group>
      )}

      {prompt?.kind === 'reminder'
        ? (
          // The reminder itself, staying put here: its banner elsewhere steps
          // out of view by itself, and either answer clears both.
          <ReminderBanner
            key={prompt.item.occurrence.id}
            variant="inline"
            item={prompt.item}
            {...(settings.habits?.water?.glassMl ? { glassMl: settings.habits.water.glassMl } : {})}
            precautions={habitPrecautions(prompt.item.occurrence.habit, profile, settings.habits)}
          />
        )
        : prompt && <PromptRow prompt={prompt} />}

      <Group>
        <Row
          label="Status"
          detail={[STATUS_LABEL[status], statusDetail(period, today)].filter(Boolean).join(' · ')}
          chevron
          onClick={() => open({ kind: 'status' })}
        />
      </Group>

      <ChooserSheet
        open={sheet?.kind === 'choose'}
        onOpenChange={closeSheet}
        rows={chooserRows({ recommendation, enrolled, plan: guided.plan, trained, stopped })}
        onChoose={choose}
      />
      <StatusSheet
        open={sheet?.kind === 'status'}
        onOpenChange={closeSheet}
        {...(sheet?.kind === 'status' && sheet.preset ? { preset: sheet.preset } : {})}
        today={today}
        periods={settings.statusPeriods}
        startDate={settings.startDate}
      />
      <CheckInSheet
        open={sheet?.kind === 'checkIn'}
        onOpenChange={closeSheet}
        profile={guided.profile}
        date={guided.date}
        {...(guided.checkIn ? { initial: guided.checkIn } : {})}
        recent={checkIns}
        onSave={guided.saveCheckIn}
        mode={sheet?.kind === 'checkIn' ? sheet.mode : 'guided'}
        startLabel={startLabelFor(sheet?.kind === 'checkIn' ? sheet.mode : 'guided', '', recovery)}
        // Someone not in the programme is offered Guided only as a way to
        // join it, so this sheet records their answers and starts nothing (D35).
        {...(sheet?.kind === 'checkIn' && sheet.mode === 'guided' && !enrolled ? {} : {
          onStart: () => {
            const mode = sheet?.kind === 'checkIn' ? sheet.mode : 'guided';
            setSheet(undefined);
            navigate(MOVE_HREF[mode], { viewTransition: true });
          },
        })}
      />
      <CheckInSheet
        open={updating}
        onOpenChange={isOpen => { if (!isOpen) setUpdating(false); }}
        profile={guided.profile}
        date={guided.date}
        {...(guided.checkIn ? { initial: guided.checkIn } : {})}
        recent={checkIns}
        onSave={guided.saveCheckIn}
      />
      {goalLoaded && (
        <Suspense fallback={null}>
          <GoalSheet open={sheet?.kind === 'goal'} onOpenChange={closeSheet} goal={goal} />
        </Suspense>
      )}
      {startSheet}
    </Screen>
  );
}

/**
 * Progress from an earlier day is offered beside today's suggestion, named by
 * its date, never in its place: it must not hide today's session or be taken
 * for it. Saving it keeps the work done in History.
 */
function EarlierSession({ saved, onFinish, onSave }: {
  saved: SavedProgress;
  onFinish: () => void;
  /** Resolves to an error message, or nothing once saved. */
  onSave: () => Promise<string | undefined>;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const button = 'press-feedback flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-[length:var(--text-body)] font-semibold disabled:opacity-50';
  return (
    <Group header="Unfinished" footer={error ?? 'Saving keeps what you did in your history, on the day you did it.'}>
      <Row label={`From ${format(new Date(`${saved.plan.date}T12:00:00`), 'EEEE')}`} detail={`${minutesLeft(saved)} min left · ${saved.plan.label}`} />
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {/* Both secondary: the one primary action on Today is the suggestion's. */}
        <button type="button" onClick={onFinish} disabled={busy} className={cn(button, 'bg-tint/10 text-tint')}>Finish it</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(await onSave());
            setBusy(false);
          }}
          className={cn(button, 'bg-tint/10 text-tint')}
        >
          Save as it is
        </button>
      </div>
    </Group>
  );
}

/**
 * A reading on the line under its name rather than beside it, so the name
 * stays whole at large text sizes, where a value on the right squeezes the
 * label out of the row.
 */
function ReadingLine({ reading }: { reading: Reading | undefined }) {
  if (!reading) return <>Not entered</>;
  return (
    <>
      <span className="numeric font-medium text-foreground">{reading.value}</span>
      {' · '}
      {reading.detail}
    </>
  );
}

/** The one prompt: a due check with its source, or the water habit the person chose. */
function PromptRow({ prompt }: { prompt: Exclude<Prompt, { kind: 'reminder' }> }) {
  const [error, setError] = useState<string>();
  if (prompt.kind === 'due') {
    const { item } = prompt;
    return (
      <Group footer={`${item.source} General information, not medical advice.`}>
        <Row as={Link} to={item.action.to} viewTransition label={item.title} detail={item.detail} chevron />
      </Group>
    );
  }
  const total = prompt.totalMl === undefined ? 'Not entered' : `${prompt.totalMl.toLocaleString()} ml${prompt.goalMl ? ` of ${prompt.goalMl.toLocaleString()} ml` : ''}`;
  // Not a Row: the button wraps under the words at large text sizes instead
  // of squeezing them out.
  return (
    <Group footer={error}>
      <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <GlassWaterIcon className="size-5 shrink-0 text-tint" aria-hidden />
        <p className="min-w-0 flex-1 basis-32">
          <span className="block text-[length:var(--text-body)] leading-snug">Water today</span>
          <span aria-live="polite" className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{total}</span>
        </p>
        <button
          type="button"
          onClick={async () => {
            const result = await addToDayTotal('water', prompt.glassMl);
            setError(result.ok ? undefined : result.failure.message);
          }}
          className="press-feedback min-h-11 shrink-0 rounded-full bg-tint/10 px-4 text-[length:var(--text-subhead)] font-semibold text-tint"
        >
          Add {prompt.glassMl} ml
        </button>
      </div>
    </Group>
  );
}
