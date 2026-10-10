import { Link, useViewTransitionState } from 'react-router-dom';
import {
  ActivityIcon, BookOpenIcon, BoneIcon, DropletIcon, DumbbellIcon, FlaskConicalIcon, FootprintsIcon, GlassWaterIcon, HeartPulseIcon,
  MoonIcon, PersonStandingIcon, RulerIcon, ScaleIcon, UtensilsIcon, type LucideIcon,
} from 'lucide-react';
import type { Category, CategoryId } from '@/categories';
import { markMorph, skipNextTransition } from '@/design/motion';
import { cn } from '@/lib/utils';
import { useLongPress } from './editor';
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

/** A category's icon in a circle of its colour, the glyph in its ink (journey §20.3); words beside it carry the meaning. */
export function TileIcon({ category }: { category: Pick<Category, 'id' | 'colour'> }) {
  const Icon = ICON[category.id];
  return (
    <span
      aria-hidden
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full"
      style={{ background: `color-mix(in oklab, var(${category.colour}) 16%, transparent)`, color: `var(${category.colour}-ink)` }}
    >
      <Icon className="size-6" strokeWidth={2.1} />
    </span>
  );
}

/**
 * One tile (journey §7.2, §20.2): solid, with the category's icon in a circle
 * of its colour, the title in body ink, the live line in its tone, and a
 * caution dot with words when something is due today ("Check day"). At
 * least 120 px tall and as tall as its words, which wrap and are never cut.
 * Pressing scales an inner layer, so the hit area never shrinks (M2).
 * Pressing and holding opens its menu (M18), with no link preview over it.
 *
 * The morph into the hub (M3, B-27): only the tapped tile names its plain
 * background layer `hub-card-bg`, for as long as the router's transition to
 * or from its hub runs; the text sits outside that layer and cross-fades.
 * Nothing is named while an urgent decision stands, or for a tile whose mode
 * the gate holds, and a tap that opens a hub on a hold skips the transition
 * (motion rule 2).
 */
export function Tile({ category, line, due, held, urgent, opensOnHold, onLongPress }: {
  category: Category;
  line: TileLine;
  /** The caution dot's words, when something is due today. */
  due?: string;
  /** The gate holds or stops this tile's mode as drawn. */
  held: boolean;
  urgent: boolean;
  /** Asked again at the tap: whether the hub would open on a hold or a stop. */
  opensOnHold: () => boolean;
  /** Pressing and holding: the tile's menu, anchored to it. */
  onLongPress?: (anchor: HTMLElement) => void;
}) {
  const transitioning = useViewTransitionState(category.hub);
  const named = transitioning && !held && !urgent;
  const press = useLongPress(onLongPress);
  const href = tileHref(category);
  return (
    <Link
      to={href}
      state={FROM_HOME}
      {...press.handlers}
      onClick={e => {
        if (press.consumed()) {
          e.preventDefault();
          return;
        }
        if (urgent || opensOnHold()) skipNextTransition();
        else markMorph();
      }}
      className="block h-full select-none rounded-2xl [-webkit-touch-callout:none]"
    >
      <span className="press-feedback relative flex h-full min-h-[120px] flex-col gap-2 p-4">
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-grouped-card"
          style={named ? { viewTransitionName: 'hub-card-bg' } : undefined}
        />
        <TileIcon category={category} />
        <span className="relative text-[length:var(--text-body)] font-semibold leading-snug text-foreground [overflow-wrap:break-word]">{category.title}</span>
        <span className={cn('relative text-[length:var(--text-subhead)] leading-snug [overflow-wrap:break-word]', TONE[line.tone])}>
          {line.text}
          {line.detail && <span className="block text-muted-foreground">{line.detail}</span>}
        </span>
        {due && (
          <span className="relative flex items-center gap-1.5 text-[length:var(--text-subhead)] font-semibold leading-snug text-caution">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-caution" />
            {due}
          </span>
        )}
      </span>
    </Link>
  );
}
