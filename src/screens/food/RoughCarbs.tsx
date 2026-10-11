import { FOOD_COPY } from '@/food/copy';
import { numbersView } from '@/food/level';
import { Hint } from '@/screens/track/ui';
import { useStore } from '@/store/useStore';

/**
 * "Carb figures are rough estimates. Follow your care team's plan." on every
 * food screen while carbs show as ranges, with insulin, a sulfonylurea or a
 * meglitinide (journey §11.4, K-22, K7-13). Nothing while no figures show.
 */
export function RoughCarbs() {
  const { profile } = useStore();
  const numbers = numbersView(profile);
  return numbers.show && numbers.ranges ? <Hint>{FOOD_COPY.roughCarbs}</Hint> : null;
}
