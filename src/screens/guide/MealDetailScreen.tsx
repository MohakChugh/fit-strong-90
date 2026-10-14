import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { componentsFor, DISCLAIMER, getMeal, idsShown, mealAllowed, mealTags, resolveGroups, SLOTS, veganSwaps } from '@/content';
import { allergenList, allergiesOf, allergyWarning } from '@/food/allergens';
import { FOOD_COPY } from '@/food/copy';
import { REGION_LABEL } from './format';
import { componentDetail, measureClaimIds } from './mealText';
import { ClaimGroup, Lead, NoAllergiesRow, Reviewed, SourcesGroup } from './parts';
import { RoughCarbs } from '@/screens/food/RoughCarbs';
import { useGuide } from './useGuide';

/** Where individual portions come from; on every meal, beside the meal. */
const OWN_PORTIONS = ['fd-personal-plan'];

/**
 * One meal: what goes on the plate and how much, where a source gives an
 * amount; swaps; salt and sugar; and the sources for all of it.
 */
export default function MealDetailScreen() {
  const { mealId = '' } = useParams();
  const { state } = useLocation();
  const { ctx, food, allergies, filter } = useGuide();
  const meal = getMeal(mealId);
  if (!meal) return <Navigate to="/hub/food/ideas" replace />;

  const from = (state as { from?: string } | null)?.from;
  const back = from === 'search'
    ? { to: '/hub/learn', label: 'Learn' }
    : from === 'week'
      ? { to: '/hub/food/week', label: 'Sample week' }
      : from === 'hub'
        ? { to: '/hub/food', label: 'Food' }
        : { to: '/hub/food/ideas', label: 'Meal ideas' };

  const pattern = food?.pattern;
  const parts = componentsFor(meal, pattern);
  const tags = mealTags(meal, pattern);
  // Why an idea is kept from this person's suggestions, in the allergy's own words (K7-14), with no food record from
  // the allergies setup is keeping; with no answer at all, that they're not known, which is never none (board D205).
  const warning = allergies ? allergyWarning(tags, allergiesOf(allergies)) : FOOD_COPY.allergiesFirst;
  // A vegan plate's recipes, as the map makes them (H7-20).
  const swapped = veganSwaps(meal, pattern).map(s => `${s.to} instead of ${s.from}`);
  // One pass over the screen: each claim and caution once, in reading order.
  const groups = resolveGroups(
    [meal.claimIds, measureClaimIds(meal, pattern, meal.claimIds), meal.swaps, [...meal.salt, ...meal.sugar], OWN_PORTIONS],
    ctx,
  );
  const [built, amounts, swaps, saltSugar, own] = groups;
  const slot = SLOTS.find(s => s.id === meal.slot)?.title ?? '';
  const where = meal.regions?.map(r => REGION_LABEL[r]).join(', ');
  const allClaims = idsShown(groups);

  return (
    <Screen title={meal.name} back={back}>
      <Lead>
        {slot}
        {where ? ` · ${where}` : ''}
        {filter && !mealAllowed(meal, filter) ? ' · Outside the food choices you gave' : ''}
      </Lead>
      <RoughCarbs />

      <Group header="On the plate" footer={DISCLAIMER}>
        {parts.map(c => (
          <div key={c.name} className="px-4 py-3">
            <p className="text-[length:var(--text-body)] leading-snug">{c.name}</p>
            <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{componentDetail(c)}</p>
          </div>
        ))}
      </Group>

      <Group header="Allergens in our recipes" footer={swapped.length > 0 ? `${FOOD_COPY.veganSwap(swapped.join(', '))} ${FOOD_COPY.recipeNote}` : FOOD_COPY.recipeNote}>
        {warning && <p className="px-4 pt-3 text-[length:var(--text-body)] leading-snug text-caution">{warning}</p>}
        {!allergies && <NoAllergiesRow />}
        <Row
          label={tags.contains.length > 0 ? FOOD_COPY.contains(allergenList(tags.contains)) : FOOD_COPY.noTaggedAllergens}
          {...(tags.mayContain.length > 0 ? { detail: FOOD_COPY.mayContain(allergenList(tags.mayContain)) } : {})}
        />
      </Group>

      <ClaimGroup header="How it’s built" claims={built} ctx={ctx} />
      <ClaimGroup header="About the amounts" claims={amounts} ctx={ctx} />
      <ClaimGroup header="Swaps" claims={swaps} ctx={ctx} />
      <ClaimGroup header="Salt and sugar" claims={saltSugar} ctx={ctx} />
      <ClaimGroup header="Your own portions" claims={own} ctx={ctx} />
      <SourcesGroup claimIds={allClaims} />
      <Reviewed claimIds={allClaims} />
    </Screen>
  );
}
