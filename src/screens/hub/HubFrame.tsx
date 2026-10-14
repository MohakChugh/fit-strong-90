import { useContext, useId, type ReactNode } from 'react';
import { Link, useLocation, useViewTransitionState } from 'react-router-dom';
import type { Category } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { originOf, type Origin } from '@/components/hig/navigation';
import { FROM_HOME } from '@/screens/home/model';
import { UrgentContext } from '@/screens/home/urgent';
import { HUB_BACK, morphNamed, trendHref, washOf } from './frame';

/**
 * The frame every hub shares (journey §8.1).
 * - Back names the screen that opened it and returns there. With nothing to
 *   pop to it goes Home (the stack's `backTarget`, through `Screen`).
 * - The category's colour washes softly behind the bar. The wash is solid
 *   and never blurred, and it is the far end of the tile's morph (M3).
 * - The shell's safety surface comes first, through `Screen`'s
 *   `ScreenTopContext`, on every hub (B-02).
 */
export function HubFrame({ category, held = false, trailing, children }: {
  category: Category;
  /** The hub opens on a hold or a stop for its mode: nothing is named for a transition (motion rule 2). */
  held?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const location = useLocation();
  const urgent = useContext(UrgentContext) !== undefined;
  const transitioning = useViewTransitionState(category.hub);
  const fromHome = originOf(location.state)?.path === FROM_HOME.path;
  const name = morphNamed({ transitioning, fromHome, urgent, held }) ? 'hub-card-bg' : undefined;
  return (
    <Screen title={category.title} back={HUB_BACK} wash={{ background: washOf(category), ...(name ? { name } : {}) }} {...(trailing ? { trailing } : {})}>
      {children}
    </Screen>
  );
}

/** A region of a hub, named by its visible heading ("Right now", "Latest", "This week", "History"). */
export function HubSection({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h2 id={id} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:break-word]">
        {title}
      </h2>
      {children}
      {footer && <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{footer}</p>}
    </section>
  );
}

/** "See trends": the category's own trend (journey §8.2; interim until Plan 3), opened as a push from here. */
export function SeeTrends({ category, search, origin }: { category: Category; search?: string; origin: Origin }) {
  const to = trendHref(category, search);
  if (!to) return null;
  return (
    <Group>
      <Row as={Link} to={to} state={origin} viewTransition label="See trends" chevron />
    </Group>
  );
}
