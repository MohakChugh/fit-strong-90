/**
 * Home (journey §7): the launch screen. The greeting and the status, then
 * the urgent surface when one stands (the shell's, first in every screen),
 * the one suggestion with its reason (D5, D20), at most one prompt, any
 * unfinished run and the plan offer, This week, and the person's tiles.
 * Nothing else: no statistics grid, no streak, no carousel, no modal on
 * launch.
 *
 * v1's Today, rearranged: every decision is still `@/health/recommend`'s, the
 * shared gate's and `@/screens/today/model`'s, with the same freeze, sheets
 * and saved-progress banking; this file lays them out.
 */

import { lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { GlassWaterIcon, InfoIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { CheckInSheet } from '@/components/checkin/CheckInSheet';
import { opensOnHold } from '@/components/checkin/start';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { categoryById, defaultHome, isHomeLayout, walkingHeldForFeet, type CategoryId } from '@/categories';
import { useGuided } from '@/hooks/useGuided';
import { useAppData } from '@/hooks/useLocalStorage';
import { checkedIn, type Mode } from '@/engine/permission';
import { dueItems } from '@/health/cadence';
import {
  HREF, freezeKey, isEnrolled, nextBoundary, recommend, resumeHref, savedRun, smallHours, trainedOn,
  type RecommendInput, type Recommendation, type RecommendationAction,
} from '@/health/recommend';
import { periodOn, planOffer } from '@/health/status';
import { habitPrecautions } from '@/reminders/advice';
import { offeredNow, usePending } from '@/reminders/pending';
import { ReminderBanner } from '@/reminders/ReminderBanner';
import { waterBlock } from '@/reminders/water';
import { bankProgress, progressSettled } from '@/session/logging';
import { clearProgress, loadExpiredProgress, loadSetAside, minutesLeft, releaseSetAside, slotOf, type SavedProgress } from '@/session/persistence';
import { prefersHour12 } from '@/screens/track/format';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { addToDayTotal, getState, isSessionSaved, useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { canLocate, canSenseMotion } from '@/walk/browser';
import { directWalkHref } from '@/walk/plan';
import { useClock, useWakeAt } from '@/screens/today/clock';
import { ChooserSheet } from '@/screens/today/ChooserSheet';
import { RecommendationCard } from '@/screens/today/RecommendationCard';
import { MovePlanBack, StatusSheet } from '@/screens/today/StatusSheet';
import {
  SHEET_KEYS,
  chooserRows,
  eyebrowOf,
  latestGlucose,
  latestPressure,
  pickPrompt,
  sheetFrom,
  startLabelFor,
  statusDetail,
  todayPrefs,
  weekMovement,
  enteredNote,
  type ChooserRow,
  type Prompt,
  type TodaySheet,
} from '@/screens/today/model';
import { EditTiles } from './EditHome';
import { useFirstLayout, useHomeEditor } from './editor';
import { FROM_HOME, dueWords, greeting, lastReadings, normalLine, readingLine } from './model';
import { RemindersCapsule } from './RemindersCapsule';
import { StatusButton } from './StatusButton';
import { TileGrid, type TileState } from './TileGrid';
import { TileMenu } from './TileMenu';
import { movementLine } from './tileLine';
import { RIGHT_NOW_ID, SLOTS, UrgentContext, recommendSources, withEffectiveToday } from './urgent';
import { WeekCard } from './WeekCard';
import { WalkRecoveryRow } from './WalkRecoveryRow';
import { movedDays, restDaysOf, stepsLine, stretchDays, weekDots } from './week';

// Track's own goal editor, so the rule for a valid goal lives in one place.
// Loaded on first use: Home ships with the app and should stay small.
const GoalSheet = lazy(() => import('@/screens/track/GoalSheet').then(m => ({ default: m.GoalSheet })));

/** The device's clock preference does not change while the app is open. */
const HOUR12 = prefersHour12();

const SAFETY = new Set<Recommendation['kind']>(['emergency', 'seekHelp', 'recheck', 'hold']);

const MOVE_HREF: Record<Mode, string> = { guided: HREF.guided, stretch: HREF.stretch, walk: HREF.walk };

/** Home's own sheets, which an action addresses by query (`HREF.status`, `HREF.choose`…). */
const SHEET_HREF = '/home?';

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

export function HomeScreen() {
  const state = useStore();
  const [, update] = useAppData();
  const guided = useGuided();
  const { start, sheet: startSheet, permissionFor } = useStartMovement();
  const clock = useClock();
  // The shell's urgent decision: while one stands nothing here moves or is named for a transition (motion rule 2).
  const urgent = useContext(UrgentContext);
  // A walk or a stand-up is not offered beside a safety decision; it waits (kiro KV-09).
  const waiting = offeredNow(usePending(), urgent !== undefined);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { settings, profile, observations, sessions } = state;
  // Today's check-in as every screen must act on it: the stored one, or an
  // answer the device would not keep that is at least as restrictive.
  const checkIns = useMemo(() => withEffectiveToday(state.checkIns, guided.checkIn), [state.checkIns, guided.checkIn]);
  const { now } = clock;
  const today = format(now, 'yyyy-MM-dd');

  // ---- The recommendation, frozen while the person reads it --------------
  // The choice is worked out on arrival, then again only on a new day, a
  // return to the app, a changed check-in or status, an action here that
  // settles something (D20), or a time boundary: a part of the day, a
  // reading going stale, a re-check falling due (L-07, B-20), when the clock
  // is read again on the dot. The gate is asked on every render, which the
  // clock brings round each minute, so a stop or a reading gone stale shows
  // on the card at once, over the frozen choice (D30).
  const [settled, setSettled] = useState(0);
  const boundary = nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(settings.habits ? { habits: settings.habits } : {}) });
  useWakeAt(boundary);
  const key = freezeKey({ now, checkIns, statusPeriods: settings.statusPeriods, startDate: settings.startDate, visit: clock.visit + settled, boundary });
  const permissions: RecommendInput['permissions'] = { guided: permissionFor('guided'), stretch: permissionFor('stretch'), walk: permissionFor('walk') };
  const work = (): Frozen => {
    const input = recommendSources({ now, state, plan: guided.plan, checkIns });
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
  // or while Home is already open (codex F31): each request is read once,
  // as the address changes, and then taken out of it. After that a sheet is
  // ordinary state, so closing one or leaving Home never leaves an address
  // behind that would reopen it on Back.
  const [sheet, setSheet] = useState<TodaySheet | undefined>(() => sheetFrom(params));
  // An address that has moved lands here (journey §19.3): said once, for as
  // long as Home is open, and then taken out of the address like a sheet's.
  const [moved, setMoved] = useState(() => params.has('moved'));
  if (params.has('moved') && !moved) setMoved(true);
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
    if (!SHEET_KEYS.some(k => params.has(k)) && !params.has('moved')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const k of SHEET_KEYS) next.delete(k);
      next.delete('moved');
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
  // The card's action runs directly (journey §7.4, K-32): a movement goes
  // through the shared start, which asks the gate at the tap and opens the
  // check-in first when one is due; there is no hub step in between.
  const act = (action: RecommendationAction) => {
    if (action.walk) {
      // Straight to the live walk (K-32), measuring what the person chose last
      // time. The motion sensor is asked in the tap that finally starts the
      // walk, which may be this one or the check-in's (B-01, useStartMovement).
      const remembered = settings.walkDefaults;
      const measure = { gps: (remembered?.gps ?? false) && canLocate(), steps: (remembered?.steps ?? false) && canSenseMotion() };
      start('walk', directWalkHref(action.walk, Date.now(), measure), 'Start walk');
      return;
    }
    if (action.mode) {
      start(action.mode, action.to, startLabelFor(action.mode, action.to, recovery));
      return;
    }
    const requested = action.to.startsWith(SHEET_HREF) ? sheetFrom(new URLSearchParams(action.to.slice(SHEET_HREF.length))) : undefined;
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
  const { glucose, pressure, last, week, stretched, moved: movedOn, steps } = useMemo(() => {
    const prefs = todayPrefs(profile, HOUR12);
    return {
      glucose: latestGlucose(observations, today, prefs),
      pressure: latestPressure(observations, today, prefs),
      week: weekMovement(today, observations, sessions),
      stretched: stretchDays(today, sessions),
      moved: movedDays(today, observations, sessions),
      steps: stepsLine(today, observations, HOUR12),
      last: lastReadings(observations, today, prefs),
    };
  }, [profile, observations, sessions, today]);
  const hasSteps = useMemo(() => observations.some(o => o.kind === 'steps'), [observations]);
  const enrolled = isEnrolled(settings, profile);
  const trained = trainedOn(sessions, today);
  const period = periodOn(settings.statusPeriods, today);
  const status = period?.kind ?? 'normal';
  // This week's goal: a change waits for Monday (B-16).
  const goal = weeklyGoalOn(settings, today);
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

  // ---- Tiles (journey §7.1, §7.2, §7.5) and Edit Home (§7.6) ----------------
  // The person's own layout once there is one, and one this build can draw;
  // until then the defaults from their answers (journey §5.1).
  const stored = settings.home !== undefined && isHomeLayout(settings.home) ? settings.home : undefined;
  const fallback = useMemo(() => defaultHome({ profile: guided.profile, settings, hasSteps }), [settings, guided.profile, hasSteps]);
  // The defaults are worked out once, at the end of setup or on the first v2
  // launch, and kept: after that a change to the answers never reshuffles the
  // tiles by itself; a newly relevant category is offered in Me (§5.1, Plan 4).
  // Without a stored profile there is nothing to work them out from yet.
  const first = useFirstLayout({ stored, fallback, ready: profile !== undefined, visit: clock.visit });
  // While a safety decision stands, nothing beside it moves (motion rule 2, M1).
  const still = SAFETY.has(recommendation.kind) || urgent !== undefined;
  const editor = useHomeEditor({ fallback: first, still, urgent: urgent !== undefined });
  // A change the device refused is drawn as the person made it, with Try again (codex V1-11).
  const layout = editor.draft ?? first;
  // What the cadence model says is due: the tiles' caution dots (§7.2).
  const due = dueItems({ now, ...(profile ? { profile } : {}), observations });
  const recheckAt = guided.checkIn?.readiness.recheckAt;
  // The gate as this render asked it, the same answer the card shows; a tap asks it again.
  const lineOf = (mode: Mode, permission = permissions[mode]) => movementLine({
    mode, permission, status, enrolled, normal: normalLine(mode, { recommendation, enrolled, plan: guided.plan }),
    ...(recheckAt ? { recheckAt } : {}), now, hour12: HOUR12,
  });
  // A hold or a stop on the tile's mode: its hub opens on it, so the tap skips the morph (motion rule 2).
  // Asked of the permission, the same answer the hub opens on, not of the line's tone (codex V1-05).
  const tile = (id: CategoryId): TileState => {
    const { mode } = categoryById(id);
    const dot = dueWords(id, { due, status, stopped });
    if (!mode) return { line: readingLine(id, { ...(glucose ? { glucose } : {}), ...(pressure ? { pressure } : {}), last }), held: false, ...(dot ? { due: dot } : {}) };
    return { line: lineOf(mode), held: opensOnHold(permissions[mode]), ...(dot ? { due: dot } : {}) };
  };
  const opensOnHoldNow = (id: CategoryId) => {
    const { mode } = categoryById(id);
    return mode !== undefined && opensOnHold(permissionFor(mode));
  };

  return (
    <Screen
      title={greeting(now, (profile as { name?: string } | undefined)?.name)}
      navTitle={FROM_HOME.label}
      subtitle={format(now, 'EEEE, d MMMM')}
      // "2 reminders" at the right, under the status, where it can wrap at any text size (kiro KV-08).
      below={(
        <div className="flex flex-wrap items-center justify-end gap-3">
          <StatusButton status={status} {...(period ? { detail: statusDetail(period, today) } : {})} onOpen={() => open({ kind: 'status' })} />
          <RemindersCapsule waiting={waiting} />
        </div>
      )}
    >
      {moved && (
        <Group>
          <Row role="status" icon={<InfoIcon />} label="That page has moved" />
        </Group>
      )}
      {/* "What to do" on the urgent surface brings this into view, focus with it. */}
      <div id={RIGHT_NOW_ID} tabIndex={-1} className="flex scroll-mt-16 flex-col gap-3 outline-none">
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
          Something else
        </button>
      </div>

      {/* A walk the app lost mid-way, offered to save (journey §9.4): under the
          Right now card, so an urgent surface always ranks above it (A-57). */}
      <WalkRecoveryRow />

      {/* Quiet, and only once today is checked in: a new symptom or reading
          can always be added, whatever the suggestion above says (J03 step 4). */}
      {checkedIn(guided.checkIn) && (
        <Group>
          <Row label="Today’s check-in" onClick={() => setUpdating(true)}
            accessory={<span className="shrink-0 text-[length:var(--text-body)] text-tint">Update</span>} />
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

      {offer && <MovePlanBack offer={offer} periods={settings.statusPeriods} startDate={settings.startDate} />}

      <WeekCard
        today={today}
        minutes={week.minutes}
        {...(enteredNote(week) ? { enteredNote: enteredNote(week) } : {})}
        {...(goal !== undefined ? { goal } : {})}
        stretched={stretched}
        {...(walkingHeldForFeet(guided.profile) ? {} : { steps })}
        dots={weekDots({ today, moved: movedOn, restDays: restDaysOf(enrolled, profile?.trainingDays), ...(settings.statusPeriods ? { statusPeriods: settings.statusPeriods } : {}) })}
        still={still}
        onSetGoal={() => open({ kind: 'goal' })}
      />

      {/* The tiles, or Edit Home in their place; reorders are drawn moving (M17). */}
      <div ref={editor.flipRef} className="flex flex-col gap-4">
        {(editor.failed ?? editor.error) && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
            <p className="min-w-0 flex-1 basis-48 text-[length:var(--text-subhead)] leading-snug text-stop">
              {editor.failed ? `That change wasn’t saved on this phone. ${editor.failed}` : editor.error}
            </p>
            {editor.failed && (
              <button type="button" onClick={editor.retry}
                className="press-feedback min-h-12 shrink-0 rounded-full bg-tint/10 px-4 text-[length:var(--text-body)] font-semibold text-tint">
                Try again
              </button>
            )}
          </div>
        )}
        {editor.editing
          ? <EditTiles layout={layout} editor={editor} />
          : <TileGrid layout={layout} tile={tile} urgent={urgent !== undefined} opensOnHold={opensOnHoldNow} onLongPress={editor.openMenu} />}
      </div>
      {/* "Water moved to position 2 of 5" (M17); a repeat is said again. */}
      <p role="status" className="sr-only">{editor.said.text}{editor.said.n % 2 ? '\u200b' : ''}</p>

      {!editor.editing && (
        <Group>
          <Row as={Link} to={HREF.day} state={FROM_HOME} viewTransition label="See today’s log" chevron />
          <Row label="Edit Home" onClick={() => editor.start()} data-edit-home-row />
        </Group>
      )}
      <TileMenu
        target={editor.menu}
        layout={layout}
        editing={editor.editing}
        onHide={id => editor.hide(id, 'menu')}
        onMove={(id, by) => editor.move(id, by, editor.editing ? 'more' : undefined)}
        onEdit={id => editor.start(id)}
        onClose={editor.closeMenu}
        onClosed={editor.menuClosed}
      />

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
          <GoalSheet open={sheet?.kind === 'goal'} onOpenChange={closeSheet} goal={settings.weeklyMovementGoalMinutes} />
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
  const button = 'press-feedback flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-[length:var(--text-body)] font-semibold disabled:opacity-50';
  return (
    <Group header="Unfinished" footer={error ?? 'Saving keeps what you did in your history, on the day you did it.'}>
      <Row label={`From ${format(new Date(`${saved.plan.date}T12:00:00`), 'EEEE')}`} detail={`${minutesLeft(saved)} min left · ${saved.plan.label}`} />
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {/* Both secondary: the one primary action on Home is the suggestion's. */}
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
          className="press-feedback min-h-12 shrink-0 rounded-full bg-tint/10 px-4 text-[length:var(--text-subhead)] font-semibold text-tint"
        >
          Add {prompt.glassMl} ml
        </button>
      </div>
    </Group>
  );
}
