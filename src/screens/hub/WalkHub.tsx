import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FootprintsIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { mealWalkNow } from '@/health/recommend';
import { timeOf } from '@/lib/time';
import { displayPrefs } from '@/screens/track/logKinds';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { weekMovement } from '@/screens/today/model';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { ChoiceRow, PrimaryButton, SelectRow, SwitchRow } from '@/screens/walk/parts';
import { setSettings } from '@/store/useStore';
import type { Meal } from '@/types/habits';
import type { WalkKind } from '@/walk/clock';
import { canLocate, canSenseMotion, requestLocation, requestMotion } from '@/walk/browser';
import { routeNote, walkSettings } from '@/walk/consent';
import { timeOfDay } from '@/walk/format';
import { peekWalk } from '@/walk/persist';
import {
  AFTER_MEAL_TARGET, MEAL_LABEL, MEAL_STARTED_AGO, MEALS, TARGETS, afterMealSuggestion, choiceChanged, liveHref, mealFromSearch,
  mealMinutesAgo, mealStartedLabel, newWalkId, setupPlan,
} from '@/walk/plan';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubGate, useHubOrigin } from './hooks';
import { MovementCard } from './MovementCard';
import { actionTarget, movementCard, runAction, type HubActionKind } from './movement';
import { goalLine, modeWeek, movementHistory } from './week';
import { WeekStrip } from './WeekStrip';

const NO_TARGET = 0;
/** The "Started" choice, which "Different time" brings into view. */
const STARTED_ID = 'walk-meal-started';
/** The "Started" choice that is the meal's usual time, while it is the meal in view. */
const USUAL = -1;

const LOCATION_NOTE = {
  denied: 'Walk without location: this walk is timed only, with steps if you count them. To measure distance, allow location for this app in your device’s settings.',
  unsupported: 'This browser cannot share your location, so the walk will be timed only.',
} as const;

const MOTION_NOTE = {
  denied: 'Motion access is off, so steps cannot be counted. You can allow Motion & Orientation Access in your iPhone’s Settings.',
  unsupported: 'This device has no motion sensor the app can read.',
} as const;

/**
 * The Walk hub (journey §8.3).
 * - Right now is "Start walk", with the kind chosen by context: "Just a walk",
 *   or, with a meal in view, B-09's button stating when it was had ("I had
 *   lunch at 1:10 pm: walk now"), with "Different time" and "Just a walk".
 *   While the gate refuses it says why, as the tile and Home do (§7.5).
 * - Options: the kind of walk, After a meal (which meal, and when it started),
 *   Walk with a target, and How walks are measured.
 * - A walk under way, or waiting to be saved, comes first.
 * Every start goes through the shared gate (`useStartMovement`); nothing here
 * decides whether walking is safe.
 */
export default function WalkHub() {
  const category = categoryById('walk');
  const g = useHubGate('walk');
  const { state, now, today, status, hour12 } = g;
  const navigate = useNavigate();
  const origin = useHubOrigin(category.title);
  const [params] = useSearchParams();
  const remembered = state.settings.walkDefaults;
  const [statusOpen, setStatusOpen] = useState(false);
  // Read once: a walk under way, or waiting to be saved, comes first.
  const [pending] = useState(() => peekWalk());
  // A meal in view (B-09): one another screen asked about (`?meal=`), or the
  // after-meal walk due now (D26). Read on arrival, at the hub's clock. `usual`
  // when the suggested time is the meal's usual end rather than now.
  const [context] = useState(() => {
    const meal = mealFromSearch(params) ?? mealWalkNow(state.settings.habits, now);
    if (!meal) return undefined;
    const finish = state.settings.habits?.mealWalk?.finish?.[meal];
    const said = afterMealSuggestion({ meal, ...(finish ? { finish } : {}), now: now.getTime(), hour12 });
    return { meal, at: said.at, usual: said.at !== now.getTime() };
  });
  const [kind, setKind] = useState<WalkKind>(context ? 'afterMeal' : 'walk');
  // Asked, never assumed from the clock (J10): only a meal in view comes already chosen.
  const [meal, setMeal] = useState<Meal | undefined>(context?.meal);
  // The meal's time: its usual end while that is the choice, otherwise minutes before now ("Just now" by default).
  const [mealAt, setMealAt] = useState<number | undefined>(context?.usual ? context.at : undefined);
  const [mealAgo, setMealAgo] = useState(0);
  // B-09's suggested time is when the person had the meal; a "Started" choice is when it started.
  const [startChosen, setStartChosen] = useState(false);
  const [target, setTarget] = useState(context ? AFTER_MEAL_TARGET : NO_TARGET);
  const [targetChosen, setTargetChosen] = useState(false);

  // The last choice, where this device can measure at all. Permission is
  // still asked only from a tap: the switches here, or a start.
  const [gps, setGps] = useState(() => (remembered?.gps ?? false) && canLocate());
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsNote, setGpsNote] = useState<string>();
  const [steps, setSteps] = useState(() => (remembered?.steps ?? false) && canSenseMotion());
  const [stepsBusy, setStepsBusy] = useState(false);
  const [stepsNote, setStepsNote] = useState<string>();
  const [rememberNote, setRememberNote] = useState<string>();

  // Remember the choice for next time whenever it differs from what is
  // stored. Read from both switches at once, so two quick toggles cannot
  // overwrite each other with a stale half.
  useEffect(() => {
    if (!choiceChanged(remembered, { gps, steps })) return;
    void setSettings({ walkDefaults: { gps, steps } }).then(saved => {
      setRememberNote(saved.ok ? undefined : `This choice could not be kept for next time. ${saved.failure.message}`);
    });
  }, [gps, steps, remembered]);

  const chooseKind = (next: WalkKind) => {
    setKind(next);
    // Suggest the study's 10 minutes after a meal, unless a target was picked.
    if (!targetChosen) setTarget(next === 'afterMeal' ? AFTER_MEAL_TARGET : NO_TARGET);
  };

  const toggleGps = async () => {
    if (gps) {
      setGps(false);
      return;
    }
    setGpsBusy(true);
    const answer = await requestLocation();
    setGpsBusy(false);
    setGps(answer === 'granted');
    setGpsNote(answer === 'granted' ? undefined : LOCATION_NOTE[answer]);
  };

  const toggleSteps = async () => {
    if (steps) {
      setSteps(false);
      return;
    }
    // The step card comes before the system's question (K-29): until it has been
    // seen, the switch only records the choice, and the card and the question
    // come at Start, in that order.
    if (!walkSettings(state.settings).stepCardSeen) {
      setSteps(true);
      setStepsNote(undefined);
      return;
    }
    // Asked straight from the tap: iOS refuses motion access without one.
    const asking = requestMotion();
    setStepsBusy(true);
    const answer = await asking;
    setStepsBusy(false);
    setSteps(answer === 'granted');
    setStepsNote(answer === 'granted' ? undefined : MOTION_NOTE[answer]);
  };

  // A meal's usual time belongs to that meal: choosing another meal falls back to "Started", and back again restores it.
  const chooseMeal = (next: Meal) => {
    setMeal(next);
    setMealAt(context?.usual && next === context.meal ? context.at : undefined);
    setStartChosen(false);
  };
  /** The time in use is B-09's suggestion for the meal in view, so the plan says when the meal was had. */
  const hadAt = !!context && meal === context.meal && !startChosen;
  const usual = context?.usual && meal === context.meal ? context.at : undefined;

  const at = mealAt ?? now.getTime() - mealAgo * 60_000;
  const afterMeal = kind === 'afterMeal' && meal ? { title: `A walk after ${meal}`, label: `I had ${meal} at ${timeOf(at, hour12)}: walk now` } : undefined;
  const card = movementCard({
    mode: 'walk', permission: g.permission, gate: g.gate, status, line: g.line, title: 'Just a walk',
    ...(afterMeal ? { detail: 'About 10 minutes, starting soon after you finish eating.', afterMeal } : {}),
    ...(g.recommendation.action.mode === 'walk' && g.recommendation.reason ? { reason: g.recommendation.reason } : {}),
    ...(kind === 'afterMeal' && !meal ? { waiting: 'Choose the meal to start.' } : {}),
    gaps: g.gaps, stretchOpen: g.stretchOpen,
  });
  // A live walk's address for what is chosen now, built at the tap so its id and its meal time are fresh.
  // "Just a walk" from the after-meal card keeps a target only if the person chose one, as switching kinds does.
  const hrefFor = (which: WalkKind, tapAt: number) => {
    const minutes = which === kind || targetChosen ? target : NO_TARGET;
    const plan = setupPlan({
      kind: which, meal: which === 'afterMeal' ? meal : undefined,
      mealAgo: mealAt !== undefined ? mealMinutesAgo(mealAt, tapAt) : mealAgo,
      ...(which === 'afterMeal' && hadAt ? { mealBasis: 'had' as const } : {}),
      ...(minutes !== NO_TARGET ? { targetMinutes: minutes } : {}), gps, steps,
    }, tapAt);
    return plan ? liveHref(newWalkId(tapAt), plan) : undefined;
  };
  const showTime = () => {
    // "Different time": the meal and its time, in the options, with the focus on when it started.
    flushSync(() => {
      setKind('afterMeal');
      if (context && !meal) setMeal(context.meal);
    });
    document.getElementById(STARTED_ID)?.focus();
  };
  const act = (k: HubActionKind) => {
    // No motion request here: B-01 asks in the tap that finally starts the walk,
    // which may be the check-in's or a first-walk question's (useStartMovement).
    const tapAt = Date.now();
    const plain = hrefFor('walk', tapAt)!;
    runAction(actionTarget(k, { mode: 'walk', href: hrefFor(kind, tapAt) ?? plain, plainHref: plain, startLabel: 'Start walk' }), {
      start: g.start,
      go: to => navigate(to, { viewTransition: true, state: origin }),
      status: () => setStatusOpen(true),
      local: showTime,
    });
  };
  const offering = card.state === 'go' || card.state === 'checkIn' || card.state === 'paused';
  const prefs = displayPrefs(state.settings, state.profile, state.observations);
  const startedOptions = [
    ...(usual !== undefined ? [{ value: USUAL, label: `${timeOf(usual, hour12)} (your usual time)` }] : []),
    ...MEAL_STARTED_AGO.map(m => ({ value: m, label: mealStartedLabel(m) })),
  ];

  if (pending) {
    const going = pending.state === 'inProgress';
    return (
      <HubFrame category={category}>
        <HubSection title="Right now">
          <Group footer={going ? 'Nothing is recorded while the walk screen is closed. Return to carry on.' : 'Nothing is in your record until you save it.'}>
            <Row icon={<FootprintsIcon />} label={going ? 'A walk is in progress' : 'A walk is waiting to be saved'} detail={`Started ${timeOfDay(pending.startedAt)}`} />
          </Group>
          <PrimaryButton className="mt-3 min-h-[60px]" onClick={() => navigate(pending.href, { viewTransition: true })}>{going ? 'Return to walk' : 'Review and save'}</PrimaryButton>
        </HubSection>
      </HubFrame>
    );
  }

  return (
    <HubFrame category={category} held={card.state === 'held' || card.state === 'stopped' || card.state === 'gap'}>
      <MovementCard card={card} onAction={act} />
      {offering && (
        <HubSection title="Options">
          <div className="flex flex-col gap-4">
            <Group header="What kind of walk">
              <div role="radiogroup" aria-label="What kind of walk" className="[&>*+*]:border-t [&>*+*]:border-separator">
                <ChoiceRow label="Just a walk" selected={kind === 'walk'} onSelect={() => chooseKind('walk')} />
                <ChoiceRow label="After a meal" detail="A short walk soon after eating" selected={kind === 'afterMeal'} onSelect={() => chooseKind('afterMeal')} />
              </div>
            </Group>
            {kind === 'afterMeal' && (
              <Group
                header="After a meal"
                footer="In a study of people with type 2 diabetes, walking for 10 minutes after each main meal lowered glucose after the evening meal more than one 30-minute walk a day at the same total (Reynolds, Diabetologia 2016). Research, not a promise. General information, not medical advice."
              >
                <SelectRow id="walk-meal" label="Meal" value={meal} placeholder="Choose a meal" options={MEALS.map(m => ({ value: m, label: MEAL_LABEL[m] }))} onChange={chooseMeal} />
                <SelectRow
                  id={STARTED_ID}
                  label="Started"
                  value={mealAt !== undefined ? USUAL : mealAgo}
                  options={startedOptions}
                  onChange={v => {
                    if (v === USUAL) {
                      setMealAt(usual);
                      setStartChosen(false);
                    } else {
                      setMealAgo(v);
                      setMealAt(undefined);
                      setStartChosen(true);
                    }
                  }}
                />
              </Group>
            )}
            <Group header="Walk with a target">
              <SelectRow
                id="walk-target"
                label="Target"
                detail={kind === 'afterMeal' ? '10 minutes is suggested after a meal' : 'Optional'}
                value={target}
                options={[{ value: NO_TARGET, label: 'No target' }, ...TARGETS.map(t => ({ value: t, label: `${t} min` }))]}
                onChange={t => {
                  setTarget(t);
                  setTargetChosen(true);
                }}
              />
            </Group>
            <Group
              header="How walks are measured"
              footer={<>
                A walk is recorded only while this screen is open and your phone is unlocked. If you lock the phone or switch apps, recording pauses until you come back.
                {rememberNote && <span role="status" className="mt-1 block text-stop">{rememberNote}</span>}
              </>}
            >
              <SwitchRow label="Measure distance and pace" detail={gpsBusy ? 'Asking for your location…' : gpsNote ?? routeNote(walkSettings(state.settings))} checked={gps} busy={gpsBusy} onToggle={() => void toggleGps()} />
              <SwitchRow label="Count steps" detail={stepsBusy ? 'Asking for motion access…' : stepsNote ?? 'Uses the motion sensor, with the phone in your hand or pocket.'} checked={steps} busy={stepsBusy} onToggle={() => void toggleSteps()} />
            </Group>
          </div>
        </HubSection>
      )}
      <WeekStrip
        days={modeWeek({ mode: 'walk', today, sessions: state.sessions, observations: state.observations, ...(state.settings.statusPeriods ? { statusPeriods: state.settings.statusPeriods } : {}) })}
        goal={goalLine(weekMovement(today, state.observations, state.sessions).minutes, weeklyGoalOn(state.settings, today))}
      />
      <HistoryList rows={movementHistory('walk', state.sessions, state.observations, prefs, today)} origin={origin} empty="No walks yet. Each one shows here, with its time." />
      <SeeTrends category={category} origin={origin} />
      {g.sheet}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} today={today} periods={state.settings.statusPeriods} startDate={state.settings.startDate} />
    </HubFrame>
  );
}
