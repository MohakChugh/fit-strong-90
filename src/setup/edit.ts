/**
 * Me → Profile & health, a chapter at a time (journey §16, board D79). The
 * edit shows its chapter's pages, and any page the change makes necessary;
 * it never asks an upgrader what v1 never asked unless that chapter is the
 * one opened. Saving takes only what the edit changed onto the record as it
 * is then, so another open copy's answers stay (scan D-03).
 */
import type { AppData, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { ChapterId, PageId, SetupAnswers } from '@/types/setup';
import { CHAPTER_IDS } from '@/types/setup';
import { profileChanges, withProfileChanges } from '@/components/profile/wizardSteps';
import { isEnrolled } from '@/health/recommend';
import { createDefaultProfile } from '@/profile/defaults';
import { withJoinAnswers } from '@/programme/join';
import { sameValue } from '@/store/transfer';
import { profileFrom, settingsFrom } from './assemble';
import { factsOf } from './facts';
import { SAFETY_CHAPTERS, chapterOf, commitPage, pageDef, pageDone, pathFor, type Ctx } from './graph';
import { setupStateOf } from './state';

export interface ChapterEdit {
  /** The chapters the edit owns (`editChapters`). */
  chapters: readonly ChapterId[];
  /** The answers the editor opened with (`answersToEdit`). */
  opened: SetupAnswers;
  /** The answers saved: every page shown, stored (`commitPage`). */
  answers: SetupAnswers;
  /** Preference pages shown and left unanswered: their chapters stay under Finish setting up. */
  skipped: readonly PageId[];
}

/**
 * The chapters an edit owns: those opened, Your medicines when the edit makes
 * its answers needed again (Review Focus 1), and Your back and feet when it
 * adds foot problems: "Has a clinician told you to keep weight off a foot?"
 * holds walking (K-30), so it's asked in the same edit even where that page
 * was waiting for an upgrader's new questions (board D79).
 */
export function editChapters(asked: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers): ChapterId[] {
  const now = factsOf(a);
  const was = factsOf(opened);
  const bp = (f: typeof now) => f.bp || f.heart || f.kidney;
  const medicinesAgain = (now.diabetic && !was.diabetic) || (bp(now) && !bp(was));
  const feetAgain = now.feet && !was.feet;
  return CHAPTER_IDS.filter(c => asked.includes(c) || (c === 'medicines' && medicinesAgain) || (c === 'backFeet' && feetAgain));
}

/**
 * The pages the editor shows, in setup's order: every page of its chapters
 * that applies, and any other page this edit made necessary. A page that was
 * already unanswered when the editor opened, in a chapter not opened, waits.
 */
export function editPath(chapters: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers, ctx: Ctx): PageId[] {
  const waiting = new Set(pathFor(opened).filter(id => !pageDone(id, opened, ctx)));
  const path = pathFor(a).filter(id => id !== 'welcome.start' && id !== 'review'
    && (chapters.includes(chapterOf(id) as ChapterId) || (!pageDone(id, a, ctx) && !waiting.has(id))));
  // Your back and feet has no page without a pain or foot answer: the question that brings them is shown instead.
  return path.length === 0 && chapters.includes('backFeet') ? ['health.conditions'] : path;
}

/** The chapters Me opens for one: while a health review is pending, the three safety chapters together, since only all three answered clear it. */
export function askedChapters(chapter: ChapterId, profile: UserProfile | undefined): readonly ChapterId[] {
  return profile?.needsHealthReview === true && SAFETY_CHAPTERS.includes(chapter) ? SAFETY_CHAPTERS : [chapter];
}

/** Me's chapter editor as its answers stand (journey §16): what it shows, what Save would store, and what Save waits for. */
export interface EditorState {
  chapters: ChapterId[];
  pages: PageId[];
  /** What Save stores: each shown page as `commitPage` keeps it. */
  committed: SetupAnswers;
  /** Shown pages left unanswered. A preference page among them stays under Finish setting up. */
  left: PageId[];
  /** The pages Save waits for. */
  blocking: PageId[];
}

export function editorState(asked: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers, ctx: Ctx): EditorState {
  const chapters = editChapters(asked, a, opened);
  const pages = editPath(chapters, a, opened, ctx);
  const committed = pages.reduce((x, id) => commitPage(id, x), a);
  const left = pages.filter(id => !pageDone(id, committed, ctx));
  return { chapters, pages, committed, left, blocking: left.filter(id => !pageDef(id).skippable) };
}

type Bag = Record<string, unknown>;

/**
 * The settings an edit changed, onto the settings as they are now: what its
 * answers set that the answers it opened with didn't (scan D-03). So another
 * copy's weight, goal or reminder stays. A reminder setting the edit took
 * away (quiet hours "None") goes; nothing else is ever unset.
 */
function changedSettings(opened: Partial<UserSettings>, saved: Partial<UserSettings>, current: UserSettings): Partial<UserSettings> {
  const out: Bag = {};
  const was = opened as Bag;
  for (const [key, value] of Object.entries(saved as Bag)) {
    if (key !== 'habits' && value !== undefined && !sameValue(value, was[key])) out[key] = value;
  }
  if (saved.habits) {
    const before = (opened.habits ?? {}) as Bag;
    const after = saved.habits as Bag;
    const habits: Bag = { ...current.habits };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (sameValue(after[key], before[key])) continue;
      if (after[key] === undefined) delete habits[key];
      else habits[key] = after[key];
    }
    out.habits = habits;
  }
  return out as Partial<UserSettings>;
}

export function editedRecord(data: AppData, edit: ChapterEdit, today: string, ctx: Ctx): AppData {
  const base = data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true });
  const was = profileFrom(edit.opened, base, today, ctx, edit.chapters);
  const saved = profileFrom(edit.answers, base, today, ctx, edit.chapters);
  // The review flags change as any answer does, only when this edit changed them: a save vouches for the answers it
  // showed, never for ones another copy saved meanwhile, such as diabetes added without its medicines (H-DATA, D-03).
  const profile = withProfileChanges(base, profileChanges(was, saved));

  const setup = setupStateOf(data.settings, data.profile);
  const left = new Set(edit.skipped.map(chapterOf));
  const skipped = CHAPTER_IDS.filter(c => (edit.chapters.includes(c) ? left.has(c) : setup.skipped.includes(c)));
  const skippedPages = [...(edit.answers.skippedPages ?? []).filter(p => !edit.chapters.includes(chapterOf(p) as ChapterId)), ...edit.skipped];
  const joins = edit.chapters.includes('movement') && edit.answers.programme === 'join' && edit.answers.join !== undefined && !isEnrolled(data.settings, data.profile);
  const answers: SetupAnswers = { ...edit.answers, skippedPages, ...(joins ? { programme: 'joined' as const } : {}) };

  const next: AppData = {
    ...data,
    profile,
    settings: {
      ...data.settings,
      ...changedSettings(settingsFrom(edit.opened, data.settings, profile, today, edit.chapters), settingsFrom(edit.answers, data.settings, profile, today, edit.chapters), data.settings),
      setup: { ...setup, answers, skipped },
    },
  };
  return joins ? withJoinAnswers(next, edit.answers.join!) : next;
}
