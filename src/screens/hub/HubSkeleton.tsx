import { useLocation } from 'react-router-dom';
import { Screen } from '@/components/hig/Screen';
import { HUB_BACK, hubCategory, skeletonTitle, washOf } from './frame';

/**
 * A hub still loading (journey §8.4, A-71; M24). The bar, the title and Back
 * are there at once, so navigation stays usable, on the hub's own colour, so
 * a tile's first open in a session lands on a coloured frame. The wash takes
 * no transition name: the morph's far end is the hub's own (M3). Content-
 * shaped placeholders appear after 150 ms, still under Reduce motion, with a
 * shimmer of at most three cycles otherwise (B-29). A screen reader hears
 * "Loading" once, and the hub's own title takes the focus when it comes.
 */
export function HubSkeleton() {
  const { pathname } = useLocation();
  const category = hubCategory(pathname);
  return (
    <Screen title={skeletonTitle(pathname)} back={HUB_BACK} placeholder {...(category ? { wash: { background: washOf(category) } } : {})}>
      <div aria-busy="true" className="flex flex-col gap-4">
        <p role="status" className="sr-only">Loading</p>
        {[0, 1, 2].map(i => <div key={i} aria-hidden className="hub-skeleton h-28 rounded-2xl bg-grouped-card" />)}
      </div>
    </Screen>
  );
}
