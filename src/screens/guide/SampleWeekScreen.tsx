import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { DISCLAIMER, idsShown, MEAL_INTRO, resolveGroups, sampleWeek, SLOTS, unmatchedAvoid } from '@/content';
import type { FoodPreferences } from '@/types/profile';
import { FoodPicker } from './FoodPicker';
import { foodSummary, unmatchedNote } from './format';
import { ClaimGroup, Lead, Reviewed, SourcesGroup } from './parts';
import { useGuide } from './useGuide';

/**
 * A sample week, assembled from the meal templates and nothing else. It is a
 * starting point to adapt; portions and targets stay with the care team.
 */
export default function SampleWeekScreen() {
  const { ctx, food, canSaveFood } = useGuide();
  const [picking, setPicking] = useState(false);
  const [intro] = resolveGroups([MEAL_INTRO], ctx);
  const shown = idsShown([intro]);

  return (
    <Screen title="Sample week" back={{ to: '/guide/meals', label: 'Meal ideas' }}>
      <Lead>A week you can adapt — swap any meal for one you prefer from Meal ideas.</Lead>

      <Group footer={unmatchedNote(unmatchedAvoid(food?.avoid, food?.pattern))}>
        <Row
          onClick={() => setPicking(true)}
          label="What you eat"
          detail={food ? foodSummary(food) : 'Choose to see a week that suits you'}
          accessory={<span className="shrink-0 text-[length:var(--text-body)] text-tint">{food ? 'Change' : 'Choose'}</span>}
        />
      </Group>

      {food && <Week food={food} />}

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
            to={`/guide/meals/${meal.id}`}
            state={{ from: 'week' }}
            viewTransition
            label={meal.name}
            detail={slot.title}
            chevron
          />
        ) : (
          <Row key={slot.id} label="No idea left" detail={`${slot.title} · every idea has a food you chose to leave out`} />
        );
      })}
    </Group>
  ));
}
