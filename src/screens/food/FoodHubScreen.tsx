/**
 * The Food hub (journey §11.2): Right now, with three ideas for the meal the
 * time suggests and, with logging on, "Log what you ate" and up to three usual
 * meals; Today; Options (5, B-08); This week; and how estimates work. "Log a
 * meal" opens over it at `#/hub/food/log`, so closing the sheet never reloads
 * the hub, and an Undo raised as it closes stays.
 */
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { backTarget, markBack, useNavStack } from '@/components/hig/navigation';
import { FOOD_DATA_NOTES, mealsFor, resolveGroups } from '@/content';
import { FOOD_COPY } from '@/food/copy';
import { dayLine, mealsOn, weekFood } from '@/food/days';
import { totalsOf } from '@/food/estimate';
import { careTeamLine, mealRowDetail, SLOT_LABEL, totalsLines } from '@/food/format';
import { foodLevel, numbersView } from '@/food/level';
import { logHref, logRequest } from '@/food/links';
import { mealsIn, savedMealsIn } from '@/food/records';
import { slotAt } from '@/food/tray';
import { usualFor } from '@/food/usual';
import { prefersHour12 } from '@/lib/time';
import { mealDetail } from '@/screens/guide/mealText';
import { ClaimGroup } from '@/screens/guide/parts';
import { useGuide } from '@/screens/guide/useGuide';
import { HubFrame, HubSection } from '@/screens/hub/HubFrame';
import { useClock } from '@/screens/today/clock';
import { formatDayRelative } from '@/screens/track/format';
import { useToday } from '@/screens/track/useToday';
import { useStore } from '@/store/useStore';
import { LevelSheet } from './LevelSheet';
import { LogMealSheet } from './LogMealSheet';
import { useFoodUndoScope } from './undo';

/** Where an idea and the sample week go back to. */
const FROM_HUB = { from: 'hub' };

export default function FoodHubScreen() {
  const { profile, records } = useStore();
  const { ctx } = useGuide();
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const stack = useNavStack();
  const today = useToday();
  const { now } = useClock();
  const hour12 = prefersHour12();
  const [choosing, setChoosing] = useState(false);
  // "Log a meal" with logging off asks the level first, and that sheet owns the flow until its choice is
  // stored: the profile shown changes the moment it's chosen, before it's written (H7-18).
  const [askingLevel, setAskingLevel] = useState(false);
  useFoodUndoScope('/hub/food');

  const food = profile?.food;
  const level = foodLevel(food);
  const numbers = numbersView(profile);
  const meals = mealsIn(records);
  const slot = slotAt(now.getHours() * 60 + now.getMinutes());
  const ideas = mealsFor(food, slot).slice(0, 3);
  const usual = level === 'ideas' ? [] : usualFor(slot, today, meals, savedMealsIn(records));
  const todays = mealsOn(meals, today);
  const todayLines = totalsLines(totalsOf(todays.flatMap(m => m.items)), numbers);
  const target = careTeamLine(food?.careTeamTargets, numbers);
  const [notes] = resolveGroups([FOOD_DATA_NOTES], ctx);

  const closeLog = () => {
    const to = backTarget(stack, { to: '/hub/food', label: 'Food' }, state);
    markBack();
    if (to.pop) navigate(-1);
    else navigate(to.to, { replace: true, ...(to.state ? { state: to.state } : {}) });
  };

  if (pathname !== '/hub/food' && pathname !== '/hub/food/log') return <Navigate to="/hub/food" replace />;
  const logging = pathname === '/hub/food/log';
  const asking = logging && !logRequest(search).edit && (level === 'ideas' || askingLevel);
  if (asking !== askingLevel) setAskingLevel(asking);
  // Meals logged before logging was turned off stay readable here (A-22).
  const history = level !== 'ideas' || meals.length > 0;
  const request = logRequest(search);

  return (
    <HubFrame category={categoryById('food')}>
      <HubSection title={FOOD_COPY.rightNow}>
        <Group header={FOOD_COPY.ideasFor(SLOT_LABEL[slot])}>
          {!food ? (
            <Row as={Link} to="/hub/food/ideas" viewTransition label={FOOD_COPY.chooseFood} detail={FOOD_COPY.chooseFoodDetail} chevron />
          ) : ideas.length === 0 ? (
            <Row label={FOOD_COPY.noIdeas} detail={FOOD_COPY.noIdeasDetail} />
          ) : (
            ideas.map(m => <Row key={m.id} as={Link} to={`/hub/food/ideas/${m.id}`} state={FROM_HUB} viewTransition label={m.name} detail={mealDetail(m, food.pattern)} chevron />)
          )}
        </Group>
        {level === 'ideas' ? (
          <Group>
            <Row onClick={() => setChoosing(true)} label={FOOD_COPY.startLogging} detail={FOOD_COPY.startLoggingDetail} chevron />
          </Group>
        ) : (
          <Group>
            <Row as={Link} to={logHref({ meal: slot })} label={FOOD_COPY.logWhatYouAte} chevron />
            {usual.map(u => <Row key={u.key} as={Link} to={logHref({ usual: u.key })} label={u.label} detail={u.detail} chevron />)}
          </Group>
        )}
      </HubSection>

      {history && (
        <HubSection title={FOOD_COPY.today}>
          <Group footer={[target && `${target}.`, numbers.show && numbers.ranges ? FOOD_COPY.roughCarbs : undefined].filter(Boolean).join(' ') || undefined}>
            {todays.length === 0
              ? <Row label={FOOD_COPY.nothingToday} />
              : todays.map(m => <Row key={m.id} as={Link} to={logHref({ edit: m.id })} label={SLOT_LABEL[m.meal]} detail={mealRowDetail(m, numbers, hour12)} chevron />)}
            {/* What has no estimate is said on its own, with a total or without one (A-17, H7-14). */}
            {todayLines.estimate
              ? <Row label={todayLines.estimate} {...(todayLines.missing ? { detail: todayLines.missing } : {})} />
              : todayLines.missing && <Row label={todayLines.missing} />}
          </Group>
        </HubSection>
      )}

      <HubSection title={FOOD_COPY.options}>
        <Group>
          {level !== 'ideas' && (
            <>
              <Row as={Link} to={logHref()} label={FOOD_COPY.optionLog} chevron />
              <Row as={Link} to="/hub/food/usual" viewTransition label={FOOD_COPY.optionUsual} chevron />
              <Row as={Link} to={logHref({ quick: true })} label={FOOD_COPY.optionQuick} chevron />
            </>
          )}
          <Row as={Link} to="/hub/food/ideas" viewTransition label={FOOD_COPY.optionIdeas} chevron />
          <Row as={Link} to="/hub/food/week" state={FROM_HUB} viewTransition label={FOOD_COPY.optionWeek} chevron />
        </Group>
      </HubSection>

      {history && (
        <HubSection title={FOOD_COPY.thisWeek}>
          <Group>
            {weekFood(meals, today, numbers).filter(d => d.day <= today).map(d => (
              <Row key={d.day} label={formatDayRelative(d.day, today)} detail={d.meals > 0 ? dayLine(d) : FOOD_COPY.notLogged} />
            ))}
          </Group>
        </HubSection>
      )}

      {numbers.show && <ClaimGroup header={FOOD_COPY.howEstimates} claims={notes} ctx={ctx} />}
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{FOOD_COPY.attribution} {FOOD_COPY.privacy}</p>

      {/* A new meal waits for logging to be on; a logged meal stays editable and deletable whatever the level (A-22). */}
      {logging && (asking
        ? <LevelSheet open onOpenChange={next => { if (!next) closeLog(); }} onDone={chosen => { setAskingLevel(false); if (chosen === 'ideas') closeLog(); }} />
        : <LogMealSheet key={search} request={request} onClose={closeLog} />)}
      <LevelSheet open={choosing} onOpenChange={setChoosing} />
    </HubFrame>
  );
}
