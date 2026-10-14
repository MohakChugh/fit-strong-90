/**
 * Setup's progress, as Me's "Finish setting up" reads it (journey §6.6, §16).
 * Plan 4 built this seam (D65), and Plan 5 fills it from `settings.setup`
 * (board D79): the safety gaps the engine holds on, the chapters skipped, and
 * the ones new since this person set up in v1. Each row opens the chapter's
 * own pages; while setup is unfinished, setup itself (L-20).
 */
import { REVIEW_LABEL, reviewNeeded } from '@/screens/you/summaries';
import type { StoreResult } from '@/store/db';
import { update } from '@/store/useStore';
import type { ChapterId, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type PageId, type SetupAnswers } from '@/types/setup';
import { CHAPTER_TITLE, SAFETY_CHAPTERS, chapterOf, missingPages, type Ctx } from './graph';
import { prefillAnswers } from './prefill';
import { setupStateOf } from './state';

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

/** Where Me opens a chapter: its own pages in Profile & health, and Welcome's Display row at Display (§19.2). */
export function chapterHref(chapter: ChapterId): string {
  return chapter === 'welcome' ? '/me/display' : `/me/profile?chapter=${chapter}`;
}

/** The questions a v1 record was never asked, by chapter (§6.6). */
const NEW_SINCE_V1: Partial<Record<ChapterId, string>> = {
  about: 'What to call you', medicines: 'Insulin and ketones', food: 'Logging what you eat', day: 'Your usual meal times',
};

/** What a page that may be left asks, for its row. */
const PAGE_TOPIC: Partial<Record<PageId, string>> = {
  'about.name': 'What to call you', 'about.figure': 'Body for the exercise demos', 'movement.goal': 'Your weekly goal',
  'food.pattern': 'What you eat', 'food.allergies': 'Food allergies', 'food.logging': 'Logging what you eat', 'day.water': 'Water reminders', 'day.sitting': 'Sitting breaks',
  'day.walks': 'After-meal walks', 'day.meals': 'Your usual meal times', 'day.quiet': 'Quiet hours',
};

const open = (chapter: ChapterId, why: OpenChapter['why'], detail: string, href = chapterHref(chapter)): OpenChapter =>
  ({ chapter, label: CHAPTER_TITLE[chapter], detail, href, why });

/** A safety chapter with questions still to answer, and how many (§6.1). */
export interface SafetyLeft { chapter: ChapterId; count: number }

/**
 * While setup is unfinished, the safety chapter movement waits for: the first
 * in setup's order with a page left, and how many of its pages are (§6.1,
 * "Answer 2 questions about your back"; K5-07). `undefined` once every safety
 * question is answered.
 */
export function safetyLeft(a: SetupAnswers, ctx: Ctx): SafetyLeft | undefined {
  const left = missingPages(a, ctx).filter(id => SAFETY_CHAPTERS.some(c => c === chapterOf(id)));
  if (left.length === 0) return undefined;
  const chapter = chapterOf(left[0]) as ChapterId;
  return { chapter, count: left.filter(id => chapterOf(id) === chapter).length };
}

/** "Answer 2 questions about your back and feet". */
export const askAbout = ({ chapter, count }: SafetyLeft): string =>
  `Answer ${count === 1 ? '1 question' : `${count} questions`} about ${CHAPTER_TITLE[chapter].toLowerCase()}`;

/**
 * The chapters left to answer, safety gaps first. A chapter answered "Not
 * now" is left out, unless movement waits for it: a safety gap stays until
 * it's answered, even where an earlier build stored "Not now" for it, so the
 * one place that finishes it never goes while Home says "Finish setting up"
 * (KH-08, board D80).
 */
export function setupProgress(
  { profile, settings, answers: session }: {
    profile: UserProfile | undefined;
    settings: UserSettings;
    /** Setup's answers when this session holds them, without saving (`useSetupAnswers`); else the draft's. */
    answers?: SetupAnswers;
  },
  ctx: Ctx = { thisYear: new Date().getFullYear() },
): OpenChapter[] {
  const setup = setupStateOf(settings, profile);
  const declined = setup.declined ?? [];
  const keep = (rows: OpenChapter[]) => rows.filter(c => c.why === 'gap' || !declined.includes(c.chapter));
  // Unfinished: setup carries on where it stopped (L-20, board D80), naming the safety chapter it still asks (K5-07).
  if (setup.stage !== 'done' || !profile) {
    const left = safetyLeft(session ?? setup.draft?.answers ?? prefillAnswers(settings, profile), ctx);
    return keep([left ? open(left.chapter, 'gap', `${askAbout(left)} before you move`, '/setup') : open('health', 'gap', 'Answer the health questions before you move', '/setup')]);
  }
  const review = reviewNeeded(profile);
  const gaps = review === 'health' ? [open('health', 'gap', REVIEW_LABEL.health)]
    // Without diabetes nothing is held on it (`sglt2Unknown`, engine/health.ts): asked, not required.
    : review === 'sglt2' ? [open('medicines', 'skipped', REVIEW_LABEL.sglt2)]
    : review ? [open('medicines', 'gap', REVIEW_LABEL[review])]
    : [];
  const answers = setup.answers;
  const left = CHAPTER_IDS.filter(c => setup.skipped.includes(c) && !gaps.some(g => g.chapter === c)).map(c => {
    if (!answers) return open(c, 'new', NEW_SINCE_V1[c] ?? 'A few questions');
    const pages = [...(answers.skippedPages ?? []), ...missingPages(answers, ctx)].filter(id => chapterOf(id) === c);
    const topics = [...new Set(pages.map(id => PAGE_TOPIC[id]).filter((t): t is string => t !== undefined))];
    return open(c, 'skipped', topics.join(', ') || 'A few questions');
  });
  // Allergies are hard filters (§11.5): unanswered, a backup's unreadable list included, Your food stays open (H5-18).
  const allergies = profile.food?.allergies === undefined && !left.some(r => r.chapter === 'food') ? [open('food', 'skipped', 'Food allergies')] : [];
  return keep([...gaps, ...left, ...allergies]);
}

/** "Finish setting up · 2 short chapters" (journey §6.6). */
export function finishTitle(count: number): string {
  return `Finish setting up · ${count === 1 ? '1 short chapter' : `${count} short chapters`}`;
}

/** The line under the rows: what movement waits for, which has no "Not now", and what "Not now" does for the rest (KH-08). */
export function finishFooter(rows: readonly OpenChapter[]): string {
  const gaps = rows.filter(r => r.why === 'gap').map(r => r.label);
  if (gaps.length === 0) return 'Not now keeps a chapter for later, in Profile & health.';
  const waits = `Movement waits for ${gaps.join(' and ')}.`;
  return gaps.length === rows.length ? waits : `${waits} Not now keeps the others for later, in Profile & health.`;
}

/** "Not now" on a Finish setting up row (journey §6.6, D65): the chapter waits in Profile & health, and the row goes. */
export function notNow(chapter: ChapterId): Promise<StoreResult> {
  return update(previous => {
    const declined = previous.settings.setup?.declined ?? [];
    if (declined.includes(chapter)) return previous;
    return { ...previous, settings: { ...previous.settings, setup: { ...previous.settings.setup, declined: [...declined, chapter] } } };
  });
}
