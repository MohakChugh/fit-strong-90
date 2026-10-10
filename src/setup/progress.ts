/**
 * Setup's progress, as Me's "Finish setting up" reads it (journey §6.6, §16).
 *
 * The seam Plan 5 fills. It builds the eight chapters, and makes
 * `setupProgress` read `settings.setup`: the chapters skipped, and the ones
 * new since this person set up, each opening its own page. It keeps the
 * signature and the row's fields. Until then the only open chapters are the
 * gaps v1 already knows, and each opens the v1 screen that holds its answers.
 */
import { REVIEW_LABEL, reviewNeeded } from '@/screens/you/summaries';
import type { StoreResult } from '@/store/db';
import { update } from '@/store/useStore';
import type { ChapterId, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';

export interface OpenChapter {
  chapter: ChapterId;
  /** The chapter's title: the row's first line. */
  label: string;
  /** The row's second line: why it's open. */
  detail: string;
  /** Where the row opens. */
  href: string;
  /**
   * - `gap`: a safety answer is missing, so movement waits (the engine's own hold).
   * - `skipped`: passed over in setup, or never answered.
   * - `new`: added since this person set up.
   */
  why: 'gap' | 'skipped' | 'new';
}

const TITLE: Record<ChapterId, string> = {
  welcome: 'Welcome', about: 'About you', health: 'Your health', medicines: 'Your medicines',
  backFeet: 'Your back and feet', movement: 'Your movement', food: 'Your food', day: 'Your day and coach',
};

/** Where each chapter's answers are kept until Plan 5 gives the chapters their pages. */
const HREF: Record<ChapterId, string> = {
  welcome: '/me/display', about: '/me/profile', health: '/me/profile', medicines: '/me/profile',
  backFeet: '/me/profile', movement: '/me/profile?chapter=movement', food: '/me/food', day: '/me/reminders',
};

const open = (chapter: ChapterId, why: OpenChapter['why'], detail: string): OpenChapter => ({ chapter, label: TITLE[chapter], detail, href: HREF[chapter], why });

/** The chapters left to answer, without those answered "Not now". */
export function setupProgress({ profile, settings }: { profile: UserProfile | undefined; settings: UserSettings }): OpenChapter[] {
  const review = reviewNeeded(profile);
  const found = !profile ? [open('health', 'gap', 'Answer the health questions before you move')]
    : review === 'health' ? [open('health', 'gap', REVIEW_LABEL.health)]
    // Without diabetes nothing is held on it (`sglt2Unknown`, engine/health.ts): asked, not required.
    : review === 'sglt2' ? [open('medicines', 'skipped', REVIEW_LABEL.sglt2)]
    : review ? [open('medicines', 'gap', REVIEW_LABEL[review])]
    : [];
  const declined = settings.setup?.declined ?? [];
  return found.filter(c => !declined.includes(c.chapter));
}

/** "Finish setting up · 2 short chapters" (journey §6.6). */
export function finishTitle(count: number): string {
  return `Finish setting up · ${count === 1 ? '1 short chapter' : `${count} short chapters`}`;
}

/** "Not now" on a Finish setting up row (journey §6.6, D65): the chapter waits in Profile & health, and the row goes. */
export function notNow(chapter: ChapterId): Promise<StoreResult> {
  return update(previous => {
    const declined = previous.settings.setup?.declined ?? [];
    if (declined.includes(chapter)) return previous;
    return { ...previous, settings: { ...previous.settings, setup: { ...previous.settings.setup, declined: [...declined, chapter] } } };
  });
}
