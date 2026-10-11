import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import {
  DISCLAIMER, idsShown, MEAL_INTRO, mealsFor, resolveGroups, SLOT_NOTES, SLOTS, unmatchedAvoid,
  type GuideContext, type ShownClaim,
} from '@/content';
import { FOOD_COPY } from '@/food/copy';
import type { FoodPreferences } from '@/types/profile';
import { FoodPicker } from './FoodPicker';
import { foodSummary, unmatchedNote } from './format';
import { mealDetail } from './mealText';
import { ClaimGroup, Lead, Reviewed, SourcesGroup } from './parts';
import { RoughCarbs } from '@/screens/food/RoughCarbs';
import { useGuide } from './useGuide';

/**
 * Meal ideas by meal slot, for what the person eats. The first visit asks
 * what that is. Until they answer, every pattern's meals show, without the
 * allergies setup is keeping; with no allergy answer at all, it asks about
 * allergies before showing any, since not known is never none (board D205).
 */
export default function MealIdeasScreen() {
  const { ctx, food, filter, canSaveFood } = useGuide();
  // Asked the first time Meal ideas opens, not before (codex-vision §2).
  const [picking, setPicking] = useState(() => food === undefined);
  // One pass over the screen, so a caution shown under the intro is not repeated under Snacks.
  const [intro, ...slotNotes] = resolveGroups([MEAL_INTRO, ...SLOTS.map(s => SLOT_NOTES[s.id] ?? [])], ctx);
  const shown = idsShown([intro, ...slotNotes]);

  return (
    <Screen title="Meal ideas" back={{ to: '/hub/food', label: 'Food' }}>
      <Lead>Familiar Indian meals to adapt, laid out with the plate method. Examples, not a diet to follow.</Lead>
      <RoughCarbs />

      <Group footer={unmatchedNote(unmatchedAvoid(food?.avoid, food?.pattern))}>
        <Row
          onClick={() => setPicking(true)}
          label="What you eat"
          detail={food ? foodSummary(food) : filter ? FOOD_COPY.notChosenAllergies : FOOD_COPY.notChosenYet}
          accessory={<span className="shrink-0 text-[length:var(--text-body)] text-tint">{food ? 'Change' : 'Choose'}</span>}
        />
        <Row
          as={Link}
          to="/hub/food/week"
          state={{ from: 'ideas' }}
          viewTransition
          icon={<CalendarDaysIcon aria-hidden />}
          label="Sample week"
          detail="Seven days you can adapt"
          chevron
        />
      </Group>

      <ClaimGroup header="How these meals are built" claims={intro} ctx={ctx} footer={DISCLAIMER} />

      {filter ? SLOTS.map((slot, i) => (
        <SlotGroup key={slot.id} slot={slot} food={filter} notes={slotNotes[i]} ctx={ctx} />
      )) : (
        <Group>
          <Row onClick={() => setPicking(true)} label={FOOD_COPY.allergiesFirst} detail={FOOD_COPY.allergiesFirstDetail} chevron />
        </Group>
      )}

      <SourcesGroup claimIds={shown} />
      <Reviewed claimIds={shown} />

      <FoodPicker open={picking} onOpenChange={setPicking} food={food} canSave={canSaveFood} />
    </Screen>
  );
}

function SlotGroup({ slot, food, notes, ctx }: {
  slot: (typeof SLOTS)[number];
  food: Partial<FoodPreferences>;
  notes: ShownClaim[];
  ctx: GuideContext;
}) {
  const meals = mealsFor(food, slot.id);
  return (
    <>
      <Group header={slot.title}>
        {meals.length === 0 ? (
          <Row label={FOOD_COPY.noIdeas} detail={FOOD_COPY.noIdeasDetail} />
        ) : (
          meals.map(m => (
            <Row
              key={m.id}
              as={Link}
              to={`/hub/food/ideas/${m.id}`}
              viewTransition
              label={m.name}
              detail={mealDetail(m, food?.pattern)}
              chevron
            />
          ))
        )}
      </Group>
      <ClaimGroup claims={notes} ctx={ctx} />
    </>
  );
}
