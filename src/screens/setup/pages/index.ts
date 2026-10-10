import type { PageId } from '@/types/setup';
import type { PageView } from '../controls';
import { AboutBody, AboutFigure, AboutName } from './about';

/** About you's views, by page (journey §6.2 ch. 2). */
export const ABOUT_VIEWS: Record<'about.name' | 'about.figure' | 'about.body', PageView> = {
  'about.name': AboutName,
  'about.figure': AboutFigure,
  'about.body': AboutBody,
} satisfies Partial<Record<PageId, PageView>>;
