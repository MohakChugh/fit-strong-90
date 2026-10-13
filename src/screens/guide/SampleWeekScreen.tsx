import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { DISCLAIMER, idsShown, MEAL_INTRO, resolveGroups, sampleWeek, SLOTS, unmatchedAvoid } from '@/content';
import { FOOD_COPY } from '@/food/copy';
import type { FoodPreferences } from '@/types/profile';
import { FoodPicker } from './FoodPicker';
import { foodSummary, unmatchedNote } from './format';
import { ClaimGroup, Lead, NoAllergiesRow, Reviewed, SourcesGroup } from './parts';
import { RoughCarbs } from '@/screens/food/RoughCarbs';
import { useGuide } from './useGuide';

/**
 * A sample week, assembled from the meal templates and nothing else. It is a
 * starting point to adapt; portions and targets stay with the care team.
 */
export default function SampleWeekScreen() {
  const { ctx, food, filter, canSaveFood } = useGuide();
  const { state } = useLocation();
  // Opened from the Food hub's Options, Back goes there; from Meal ideas, back to it.
  const back = (state as { from?: string } | null)?.from === 'hub' ? { to: '/hub/food', label: 'Food' } : { to: '/hub/food/ideas', label: 'Meal ideas' };
  const [picking, setPicking] = useState(false);
  const [intro] = resolveGroups([MEAL_INTRO], ctx);
  const shown = idsShown([intro]);

  return (
    <Screen title="Sample week" back={back}>
      <Lead>A week you can adapt — swap any meal for one you prefer from Meal ideas.</Lead>
      <RoughCarbs />

      <Group footer={unmatchedNote(unmatchedAvoid(food?.avoid, food?.pattern))}>
        <Row
          onClick={() => setPicking(true)}
          label="What you eat"
          detail={food ? foodSummary(food) : 'Choose to see a week that suits you'}
          accessory={<span className="shrink-0 text-[length:var(--text-body)] text-tint">{food ? 'Change' : 'Choose'}</span>}
        />
      </Group>

      {/* From the allergies as known, setup's where the food record has none; not known, asked first, as Meal ideas does
          (board D205; codex F-food-05). */}
      {food && (filter ? <Week food={{ ...food, ...filter }} /> : (
        <Group>
          <Row onClick={() => setPicking(true)} label={FOOD_COPY.allergiesFirst} detail={FOOD_COPY.allergiesFirstDetail} chevron />
          <NoAllergiesRow />
        </Group>
      ))}

      <ClaimGroup header="How these meals are built" claims={intro} ctx={ctx} footer={DISCLAIMER} />
      <SourcesGroup claimIds={shown} />
      <Reviewed claimIds={shown} />

      <FoodPicker open={picking} onOpenChange={setPicking} food={food} canSave={canSaveFood} />
    </Screen>
  );
}

function Week({ food }: { food: FoodPreferences }) {
  const week = useMemo(() => sampleWeek(food), [food]);
  return week.map(day => (
    <Group key={day.day} header={day.day}>
      {SLOTS.map(slot => {
        const meal = day.meals[slot.id];
        return meal ? (
          <Row
            key={slot.id}
            as={Link}
            to={`/hub/food/ideas/${meal.id}`}
            state={{ from: 'week' }}
            viewTransition
            label={meal.name}
            detail={slot.title}
            chevron
          />
        ) : (
          <Row key={slot.id} label="No idea left" detail={FOOD_COPY.noIdeaLeft(slot.title)} />
        );
      })}
    </Group>
  ));
}
