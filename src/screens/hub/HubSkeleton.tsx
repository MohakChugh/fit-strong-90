import { useLocation } from 'react-router-dom';
import { Screen } from '@/components/hig/Screen';
import { HUB_BACK, skeletonTitle } from './frame';

/**
 * A hub still loading (journey §8.4, A-71; M24). The bar, the title and Back
 * are there at once, so navigation stays usable. Content-shaped placeholders
 * appear after 150 ms, still under Reduce motion, with a shimmer of at most
 * three cycles otherwise (B-29). A screen reader hears "Loading" once, and
 * the hub's own title takes the focus when it comes.
 */
export function HubSkeleton() {
  const { pathname } = useLocation();
  return (
    <Screen title={skeletonTitle(pathname)} back={HUB_BACK} placeholder>
      <div aria-busy="true" className="flex flex-col gap-4">
        <p role="status" className="sr-only">Loading</p>
        {[0, 1, 2].map(i => <div key={i} aria-hidden className="hub-skeleton h-28 rounded-2xl bg-grouped-card" />)}
      </div>
    </Screen>
  );
}
