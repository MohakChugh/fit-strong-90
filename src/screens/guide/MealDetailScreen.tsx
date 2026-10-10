import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Group } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { componentsFor, DISCLAIMER, getMeal, idsShown, resolveGroups, SLOTS, suits } from '@/content';
import { REGION_LABEL } from './format';
import { componentDetail, measureClaimIds } from './mealText';
import { ClaimGroup, Lead, Reviewed, SourcesGroup } from './parts';
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
  const { ctx, food } = useGuide();
  const meal = getMeal(mealId);
  if (!meal) return <Navigate to="/guide/meals" replace />;

  const from = (state as { from?: string } | null)?.from;
  const back = from === 'search'
    ? { to: '/guide', label: 'Guide' }
    : from === 'week'
      ? { to: '/guide/meals/week', label: 'Sample week' }
      : { to: '/guide/meals', label: 'Meal ideas' };

  const pattern = food?.pattern;
  const parts = componentsFor(meal, pattern);
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
        {pattern && !suits(meal, pattern) ? ' · Outside the food choices you gave' : ''}
      </Lead>

      <Group header="On the plate" footer={DISCLAIMER}>
        {parts.map(c => (
          <div key={c.name} className="px-4 py-3">
            <p className="text-[length:var(--text-body)] leading-snug">{c.name}</p>
            <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{componentDetail(c)}</p>
          </div>
        ))}
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
