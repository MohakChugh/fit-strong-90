import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FootprintsIcon, TriangleAlertIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { useGuided } from '@/hooks/useGuided';
import { profileGaps } from '@/engine/health';
import { PERMISSION_TEXT } from '@/engine/permission';
import { setSettings, useStore } from '@/store/useStore';
import type { Meal } from '@/types/habits';
import type { WalkKind } from '@/walk/clock';
import { canLocate, canSenseMotion, requestLocation, requestMotion } from '@/walk/browser';
import { peekWalk } from '@/walk/persist';
import { timeOfDay } from '@/walk/format';
import { cn } from '@/lib/utils';
import {
  AFTER_MEAL_TARGET,
  choiceChanged,
  liveHref,
  MEAL_LABEL,
  MEAL_STARTED_AGO,
  MEALS,
  mealFromSearch,
  mealStartedLabel,
  newWalkId,
  setupPlan,
  TARGETS,
} from '@/walk/plan';
import { ChoiceRow, PrimaryButton, SecondaryButton, SelectRow, SwitchRow } from './parts';

const NO_TARGET = 0;

const LOCATION_NOTE = {
  denied: 'Location is off for this app, so the walk will be timed only. To measure distance, allow location for this app in your device’s settings.',
  unsupported: 'This browser cannot share your location, so the walk will be timed only.',
} as const;

const MOTION_NOTE = {
  denied: 'Motion access is off, so steps cannot be counted. You can allow Motion & Orientation Access in your iPhone’s Settings.',
  unsupported: 'This device has no motion sensor the app can read.',
} as const;

/**
 * Walk setup (codex-vision §4, Movement Setup): what kind of walk, an
 * optional target, what to measure, and one Start. The start goes through
 * the shared check-in gate; nothing here decides whether walking is safe.
 */
export function WalkSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const asked = mealFromSearch(params);
  const { start, sheet, permissionFor } = useStartMovement();
  const { profile } = useGuided();
  const { settings } = useStore();
  const remembered = settings.walkDefaults;

  // Read once: a walk that is already going or waiting to be saved comes first.
  const [pending] = useState(() => peekWalk());

  const [kind, setKind] = useState<WalkKind>(asked ? 'afterMeal' : 'walk');
  // Asked, never assumed from the clock (J10): only a meal another screen
  // asked about, which the person chose there, comes already chosen.
  const [meal, setMeal] = useState<Meal | undefined>(asked);
  const [mealAgo, setMealAgo] = useState(0);
  const [target, setTarget] = useState(asked ? AFTER_MEAL_TARGET : NO_TARGET);
  const [targetChosen, setTargetChosen] = useState(false);

  // The last choice, where this device can measure at all. Permission is
  // still asked only from a tap: the switches here, or Start.
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
    // Asked straight from the tap: iOS refuses motion access without one.
    const asking = requestMotion();
    setStepsBusy(true);
    const answer = await asking;
    setStepsBusy(false);
    setSteps(answer === 'granted');
    setStepsNote(answer === 'granted' ? undefined : MOTION_NOTE[answer]);
  };

  const beginWalk = () => {
    // A remembered "Count steps" still needs this launch's motion permission
    // on an iPhone, and only a tap can ask for it: Start is that tap.
    if (steps) void requestMotion();
    const now = Date.now();
    const plan = setupPlan({ kind, meal, mealAgo, ...(target !== NO_TARGET ? { targetMinutes: target } : {}), gps, steps }, now);
    if (!plan) return;
    start('walk', liveHref(newWalkId(now), plan), 'Start walk');
  };

  const needsMeal = kind === 'afterMeal' && !meal;
  const back = { to: '/move', label: 'Move' };

  if (pending) {
    const going = pending.state === 'inProgress';
    return (
      <Screen title="Walk" back={back}>
        <Group footer={going ? 'Nothing is recorded while the walk screen is closed. Return to carry on.' : 'Nothing is in your record until you save it.'}>
          <Row
            icon={<FootprintsIcon />}
            label={going ? 'A walk is in progress' : 'A walk is waiting to be saved'}
            detail={`Started ${timeOfDay(pending.startedAt)}`}
          />
        </Group>
        <PrimaryButton onClick={() => navigate(pending.href, { viewTransition: true })}>
          {going ? 'Return to walk' : 'Review and save'}
        </PrimaryButton>
      </Screen>
    );
  }

  const walk = permissionFor('walk');
  // A refusal a new check-in cannot fix on its own: a foot that needs
  // protecting, a hold, an emergency. Checking in comes first otherwise.
  if (!walk.allowed && !walk.needsCheckIn) {
    const emergency = walk.disposition === 'emergency';
    const stretch = permissionFor('stretch');
    const stretchInstead = !emergency && stretch.allowed && !stretch.needsCheckIn;
    // Missing health answers are fixed in the profile, not by checking in again.
    const gaps = profileGaps(profile);
    const fixProfile = gaps.healthUnreviewed || gaps.medicinesUnknown;
    return (
      <Screen title="Walk" back={back}>
        <Group footer="General information, not medical advice.">
          <div className="flex gap-3 px-4 py-3" role="status">
            <TriangleAlertIcon className={cn('mt-0.5 size-5 shrink-0', emergency ? 'text-stop' : 'text-caution')} aria-hidden />
            <div className="flex min-w-0 flex-col gap-2 text-[length:var(--text-body)] leading-snug">
              {/* The engine's emergency reasons already say how to call for help. */}
              <p className={cn('font-semibold', emergency && 'text-stop')}>{emergency ? PERMISSION_TEXT.emergencyTitle : 'No walk today'}</p>
              {walk.reasons.map(r => <p key={r}>{r}</p>)}
              {walk.release && <p className="text-muted-foreground">{walk.release}</p>}
            </div>
          </div>
        </Group>
        {stretchInstead && (
          <PrimaryButton onClick={() => navigate('/move/stretch', { viewTransition: true })}>Stretch instead</PrimaryButton>
        )}
        {fixProfile ? (
          <SecondaryButton onClick={() => navigate('/you/profile', { viewTransition: true })}>Open your health profile</SecondaryButton>
        ) : (
          <SecondaryButton onClick={beginWalk}>Review today’s check-in</SecondaryButton>
        )}
        {sheet}
      </Screen>
    );
  }

  return (
    <Screen title="Walk" back={back}>
      <Group header="What kind of walk">
        <div role="radiogroup" aria-label="What kind of walk" className="[&>*+*]:border-t [&>*+*]:border-separator">
          <ChoiceRow label="Just a walk" selected={kind === 'walk'} onSelect={() => chooseKind('walk')} />
          <ChoiceRow label="After a meal" detail="A short walk soon after eating" selected={kind === 'afterMeal'} onSelect={() => chooseKind('afterMeal')} />
        </div>
      </Group>

      {kind === 'afterMeal' && (
        <Group
          header="The meal"
          footer="In a study of people with type 2 diabetes, walking for 10 minutes after each main meal lowered glucose after the evening meal more than one 30-minute walk a day at the same total (Reynolds, Diabetologia 2016). Research, not a promise. General information, not medical advice."
        >
          <SelectRow id="walk-meal" label="Meal" value={meal} placeholder="Choose a meal" options={MEALS.map(m => ({ value: m, label: MEAL_LABEL[m] }))} onChange={setMeal} />
          <SelectRow
            id="walk-meal-started"
            label="Started"
            value={mealAgo}
            options={MEAL_STARTED_AGO.map(m => ({ value: m, label: mealStartedLabel(m) }))}
            onChange={setMealAgo}
          />
        </Group>
      )}

      <Group>
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
        header="Measure"
        footer={<>
          A walk is recorded only while this screen is open and your phone is unlocked. If you lock the phone or switch apps, recording pauses until you come back.
          {rememberNote && <span role="status" className="mt-1 block text-stop">{rememberNote}</span>}
        </>}
      >
        <SwitchRow
          label="Measure distance and pace"
          detail={gpsBusy ? 'Asking for your location…' : gpsNote ?? 'Uses GPS. Your route is never stored.'}
          checked={gps}
          busy={gpsBusy}
          onToggle={() => void toggleGps()}
        />
        <SwitchRow
          label="Count steps"
          detail={stepsBusy ? 'Asking for motion access…' : stepsNote ?? 'Uses the motion sensor, with the phone in your hand or pocket.'}
          checked={steps}
          busy={stepsBusy}
          onToggle={() => void toggleSteps()}
        />
      </Group>

      {walk.allowed && walk.restrictions.length > 0 && (
        <Group header="For today" footer="General information, not medical advice.">
          <ul className="flex list-disc flex-col gap-1.5 py-3 pl-9 pr-4 text-[length:var(--text-body)] leading-snug">
            {walk.restrictions.map(r => <li key={r}>{r}</li>)}
          </ul>
        </Group>
      )}

      {needsMeal && <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">Choose the meal to start.</p>}
      <PrimaryButton onClick={beginWalk} disabled={needsMeal}>
        <FootprintsIcon className="size-5" aria-hidden />
        Start walk
      </PrimaryButton>
      {sheet}
    </Screen>
  );
}
