import { Link, useViewTransitionState } from 'react-router-dom';
import {
  ActivityIcon, BookOpenIcon, BoneIcon, DropletIcon, DumbbellIcon, FlaskConicalIcon, FootprintsIcon, GlassWaterIcon, HeartPulseIcon,
  MoonIcon, PersonStandingIcon, RulerIcon, ScaleIcon, UtensilsIcon, type LucideIcon,
} from 'lucide-react';
import type { Category, CategoryId } from '@/categories';
import { skipNextTransition } from '@/design/motion';
import { cn } from '@/lib/utils';
import { FROM_HOME, tileHref } from './model';
import type { TileLine } from './tileLine';

const ICON: Record<CategoryId, LucideIcon> = {
  workout: DumbbellIcon,
  stretch: PersonStandingIcon,
  walk: FootprintsIcon,
  steps: ActivityIcon,
  food: UtensilsIcon,
  glucose: DropletIcon,
  bp: HeartPulseIcon,
  back: BoneIcon,
  weight: ScaleIcon,
  water: GlassWaterIcon,
  sleep: MoonIcon,
  waist: RulerIcon,
  labs: FlaskConicalIcon,
  learn: BookOpenIcon,
};

/** The live line's ink: words carry the tone too, never colour alone. */
const TONE: Record<TileLine['tone'], string> = {
  normal: 'text-muted-foreground',
  quiet: 'text-muted-foreground',
  caution: 'text-caution',
  stop: 'text-stop',
};

/**
 * One tile (journey §7.2, §20.2): solid, with the category's icon in a circle
 * of its colour, the title in body ink and the live line in its tone. At
 * least 120 px tall and as tall as its words, which wrap and are never cut.
 * Pressing scales an inner layer, so the hit area never shrinks (M2).
 *
 * The morph into the hub (M3, B-27): only the tapped tile names its plain
 * background layer `hub-card-bg`, for as long as the router's transition to
 * or from its hub runs; the text sits outside that layer and cross-fades.
 * Nothing is named while an urgent decision stands, or for a tile whose mode
 * the gate holds, and a tap that opens a hub on a hold skips the transition
 * (motion rule 2).
 */
export function Tile({ category, line, held, urgent, opensOnHold }: {
  category: Category;
  line: TileLine;
  /** The gate holds or stops this tile's mode as drawn. */
  held: boolean;
  urgent: boolean;
  /** Asked again at the tap: whether the hub would open on a hold or a stop. */
  opensOnHold: () => boolean;
}) {
  const transitioning = useViewTransitionState(category.hub);
  const named = transitioning && !held && !urgent;
  const Icon = ICON[category.id];
  const href = tileHref(category);
  return (
    <Link
      to={href}
      state={FROM_HOME}
      onClick={() => { if (urgent || opensOnHold()) skipNextTransition(); }}
      className="block h-full rounded-2xl"
    >
      <span className="press-feedback relative flex h-full min-h-[120px] flex-col gap-2 p-4">
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-grouped-card"
          style={named ? { viewTransitionName: 'hub-card-bg' } : undefined}
        />
        <span
          aria-hidden
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklab, var(${category.colour}) 16%, transparent)`, color: `var(${category.colour}-ink)` }}
        >
          <Icon className="size-6" strokeWidth={2.1} />
        </span>
        <span className="relative text-[length:var(--text-body)] font-semibold leading-snug text-foreground [overflow-wrap:break-word]">{category.title}</span>
        <span className={cn('relative text-[length:var(--text-subhead)] leading-snug [overflow-wrap:break-word]', TONE[line.tone])}>
          {line.text}
          {line.detail && <span className="block text-muted-foreground">{line.detail}</span>}
        </span>
      </span>
    </Link>
  );
}
