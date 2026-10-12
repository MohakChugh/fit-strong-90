import {
  ArmchairIcon, FootprintsIcon, GlassWaterIcon, HeartIcon, LeafIcon, MilkIcon, MoonIcon, SaladIcon, SunIcon,
  type LucideIcon,
} from 'lucide-react';
import type { TopicId } from '@/content';

/** One quiet glyph per topic, in the accent colour, to make the list scannable. */
export const TOPIC_ICON: Record<TopicId, LucideIcon> = {
  'food-diabetes': SaladIcon,
  'food-bp': HeartIcon,
  b12: MilkIcon,
  'vitamin-d': SunIcon,
  desk: ArmchairIcon,
  water: GlassWaterIcon,
  sleep: MoonIcon,
  back: FootprintsIcon,
  habits: LeafIcon,
};
