import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import {
  DISCLAIMER, idsShown, MEAL_INTRO, mealsFor, resolveGroups, SLOT_NOTES, SLOTS, unmatchedAvoid,
  type GuideContext, type ShownClaim,
} from '@/content';
import type { FoodPreferences } from '@/types/profile';
import { FoodPicker } from './FoodPicker';
import { foodSummary, unmatchedNote } from './format';
import { mealDetail } from './mealText';
import { ClaimGroup, Lead, Reviewed, SourcesGroup } from './parts';
import { useGuide } from './useGuide';

/**
 * Meal ideas by meal slot, for what the person eats. The first visit asks
 * what that is; until they answer, every meal shows.
 */
export default function MealIdeasScreen() {
  const { ctx, food, canSaveFood } = useGuide();
  // Asked the first time Meal ideas opens, not before (codex-vision §2).
  const [picking, setPicking] = useState(() => food === undefined);
  // One pass over the screen, so a caution shown under the intro is not repeated under Snacks.
  const [intro, ...slotNotes] = resolveGroups([MEAL_INTRO, ...SLOTS.map(s => SLOT_NOTES[s.id] ?? [])], ctx);
  const shown = idsShown([intro, ...slotNotes]);

  return (
    <Screen title="Meal ideas" back={{ to: '/guide', label: 'Guide' }}>
      <Lead>Familiar Indian meals to adapt, laid out with the plate method. Examples, not a diet to follow.</Lead>

      <Group footer={unmatchedNote(unmatchedAvoid(food?.avoid, food?.pattern))}>
        <Row
          onClick={() => setPicking(true)}
          label="What you eat"
          detail={food ? foodSummary(food) : 'Not chosen yet — every meal is shown'}
          accessory={<span className="shrink-0 text-[length:var(--text-body)] text-tint">{food ? 'Change' : 'Choose'}</span>}
        />
        <Row
          as={Link}
          to="/guide/meals/week"
          viewTransition
          icon={<CalendarDaysIcon aria-hidden />}
          label="Sample week"
          detail="Seven days you can adapt"
          chevron
        />
      </Group>

      <ClaimGroup header="How these meals are built" claims={intro} ctx={ctx} footer={DISCLAIMER} />

      {SLOTS.map((slot, i) => (
        <SlotGroup key={slot.id} slot={slot} food={food} notes={slotNotes[i]} ctx={ctx} />
      ))}

      <SourcesGroup claimIds={shown} />
      <Reviewed claimIds={shown} />

      <FoodPicker open={picking} onOpenChange={setPicking} food={food} canSave={canSaveFood} />
    </Screen>
  );
}

function SlotGroup({ slot, food, notes, ctx }: {
  slot: (typeof SLOTS)[number];
  food?: FoodPreferences;
  notes: ShownClaim[];
  ctx: GuideContext;
}) {
  const meals = mealsFor(food, slot.id);
  return (
    <>
      <Group header={slot.title}>
        {meals.length === 0 ? (
          <Row label="Nothing left" detail="Every idea here has a food you chose to leave out." />
        ) : (
          meals.map(m => (
            <Row
              key={m.id}
              as={Link}
              to={`/guide/meals/${m.id}`}
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
