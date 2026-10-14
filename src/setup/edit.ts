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
import type { ObservationInput } from '@/health/observation';
import { measurementsFrom, profileFrom, settingsFrom } from './assemble';
import { factsOf } from './facts';
import { StoreFailure } from '@/store/db';
import { mergeAnswersWithConflicts } from './merge';
import { REVIEW_ALSO, SAFETY_CHAPTERS, chapterOf, commitPage, pageDef, pageDone, pageInvalid, pathFor, rawInvalid, type Ctx } from './graph';
import { setupStateOf } from './state';

export interface ChapterEdit {
  /** The chapters the edit owns (`editChapters`). */
  chapters: readonly ChapterId[];
  /** Pages from other chapters it shows too: a health review's `REVIEW_ALSO`. What they set is the edit's own. */
  also?: readonly PageId[];
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
 * adds foot problems: "Has a doctor or nurse (clinician) told you to keep weight off a foot?"
 * holds walking (K-30), so it's asked in the same edit even where that page
 * was waiting for an upgrader's new questions (board D79). Taking foot
 * problems away while that limit stands asks it too: only it releases the
 * hold (H5-03).
 */
export function editChapters(asked: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers): ChapterId[] {
  const now = factsOf(a);
  const was = factsOf(opened);
  const bp = (f: typeof now) => f.bp || f.heart || f.kidney;
  const medicinesAgain = (now.diabetic && !was.diabetic) || (bp(now) && !bp(was));
  const feetAgain = (now.feet && !was.feet) || (was.feet && !now.feet && now.footLimit);
  return CHAPTER_IDS.filter(c => asked.includes(c) || (c === 'medicines' && medicinesAgain) || (c === 'backFeet' && feetAgain));
}

/**
 * The pages the editor shows, in setup's order: every page of its chapters
 * that applies, the `also` pages, and any other page this edit made
 * necessary. A page that was already unanswered when the editor opened, in a
 * chapter not opened, waits.
 */
export function editPath(chapters: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers, ctx: Ctx, also: readonly PageId[] = []): PageId[] {
  const waiting = new Set(pathFor(opened).filter(id => !pageDone(id, opened, ctx)));
  const path = pathFor(a).filter(id => id !== 'welcome.start' && id !== 'review'
    && (chapters.includes(chapterOf(id) as ChapterId) || also.includes(id) || (!pageDone(id, a, ctx) && !waiting.has(id))));
  // Your back and feet has no page without a pain or foot answer: the question that brings them is shown instead,
  // with the nerve history, a question of its own (H5-19).
  return path.length === 0 && chapters.includes('backFeet') ? ['health.conditions', 'backFeet.history'] : path;
}

/** What Me opens for a chapter (journey §16). */
export interface Opens {
  /** A health review is pending, and this chapter is one of its three. */
  reviewing: boolean;
  /** The chapters asked: a pending review's are the three safety chapters, since only all three answered clear it. */
  asked: readonly ChapterId[];
  /** Pages from other chapters a review needs too (`REVIEW_ALSO`, H5-11). */
  also: readonly PageId[];
}

export function editorOpens(chapter: ChapterId, profile: UserProfile | undefined): Opens {
  const reviewing = profile?.needsHealthReview === true && SAFETY_CHAPTERS.includes(chapter);
  return reviewing ? { reviewing, asked: SAFETY_CHAPTERS, also: REVIEW_ALSO } : { reviewing, asked: [chapter], also: [] };
}

/** Me's chapter editor as its answers stand (journey §16): what it shows, what Save would store, and what Save waits for. */
export interface EditorState {
  chapters: ChapterId[];
  also: readonly PageId[];
  pages: PageId[];
  /** What Save stores: each shown page as `commitPage` keeps it. */
  committed: SetupAnswers;
  /** Shown pages left unanswered. A preference page among them stays under Finish setting up. */
  left: PageId[];
  /** The pages Save waits for. */
  blocking: PageId[];
}

/** `raw`: numbers as typed (`PageProps.raw`). */
export function editorState(opens: Pick<Opens, 'asked' | 'also'>, a: SetupAnswers, opened: SetupAnswers, ctx: Ctx, raw: Readonly<Record<string, string>> = {}): EditorState {
  const chapters = editChapters(opens.asked, a, opened);
  const pages = editPath(chapters, a, opened, ctx, opens.also);
  const committed = pages.reduce((x, id) => commitPage(id, x), a);
  const left = pages.filter(id => !pageDone(id, committed, ctx));
  // A safety page left; a preference page holding an answer that can't be stored (H5-15); or one this edit changed
  // and left half answered, such as water on with no fluid answer, which would be stored off unsaid (K5-15). Any page
  // with a number typed that isn't an answer yet (H5R-15).
  const changed = (id: PageId) => pageDef(id).sets.some(k => !sameValue(committed[k], opened[k]));
  const holds = (id: PageId) => left.includes(id) && (!pageDef(id).skippable || pageInvalid(id, committed, ctx) || changed(id));
  return {
    chapters, also: opens.also, pages, committed, left,
    blocking: pages.filter(id => holds(id) || rawInvalid(id, committed, raw)),
  };
}

/** What Save stores, from the editor's state and the answers it opened with. */
export function editOf(state: EditorState, opened: SetupAnswers): ChapterEdit {
  return { chapters: state.chapters, also: state.also, opened, answers: state.committed, skipped: state.left };
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

/**
 * The dated readings an edit makes (§18.1): a body measure this edit
 * changed, from what it opened with, in About you. Never one another tab
 * changed since: an unchanged value is not a reading (H5-14).
 */
export function editMeasurements(edit: ChapterEdit, at: string): ObservationInput[] {
  if (!edit.chapters.includes('about')) return [];
  const { weightKg, heightCm, waistCm } = edit.opened;
  return measurementsFrom(edit.answers, { weightKg, heightCm, waistCm }, at);
}

/** Said when two copies changed the same safety answer and neither answer is the stricter (board D190). */
export const ANSWERS_CHANGED = 'Your answers changed in another window of FitStrong. Check them here, then Save again.';

/**
 * Setup's answers as they will be: this edit's changes onto them as they are
 * now, a safety answer both copies changed taking the stricter (`merge.ts`).
 * Refused, by throwing, where neither is stricter: the person decides.
 */
function mergedAnswers(data: Pick<AppData, 'profile' | 'settings'>, edit: ChapterEdit): SetupAnswers {
  const latest = setupStateOf(data.settings, data.profile).answers;
  if (!latest) return edit.answers;
  const merged = mergeAnswersWithConflicts(latest, edit.opened, edit.answers);
  if (merged.conflicts.length) throw new StoreFailure('conflict', ANSWERS_CHANGED);
  return merged.answers;
}

/**
 * The profile an edit stores onto the record as it is now: what the edit
 * changed, and nothing else (scan D-03), worked out from the answers as they
 * will be stored, so the answers and the profile never say different things
 * (H5R-02).
 */
export function editedProfile(data: Pick<AppData, 'profile' | 'settings'>, edit: ChapterEdit, today: string, ctx: Ctx): UserProfile {
  const base = data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true });
  const was = profileFrom(edit.opened, base, today, ctx, edit.chapters);
  const saved = profileFrom(mergedAnswers(data, edit), base, today, ctx, edit.chapters);
  // The review flags change as any answer does, only when this edit changed them: a save vouches for the answers it
  // showed, never for ones another copy saved meanwhile, such as diabetes added without its medicines (H-DATA, D-03).
  return withProfileChanges(base, profileChanges(was, saved));
}

export function editedRecord(data: AppData, edit: ChapterEdit, today: string, ctx: Ctx): AppData {
  const profile = editedProfile(data, edit, today, ctx);

  const setup = setupStateOf(data.settings, data.profile);
  const left = new Set(edit.skipped.map(chapterOf));
  const skipped = CHAPTER_IDS.filter(c => (edit.chapters.includes(c) ? left.has(c) : setup.skipped.includes(c)));
  // Only what this edit changed, onto setup's answers as they are now: another copy's answers and skipped pages stay (H5-13).
  const latest = setup.answers;
  const changed = mergedAnswers(data, edit);
  const skippedPages = [...((latest ?? edit.answers).skippedPages ?? []).filter(p => !edit.chapters.includes(chapterOf(p) as ChapterId)), ...edit.skipped];
  const joins = edit.chapters.includes('movement') && edit.answers.programme === 'join' && edit.answers.join !== undefined && !isEnrolled(data.settings, data.profile);
  const answers: SetupAnswers = { ...changed, skippedPages, ...(joins ? { programme: 'joined' as const } : {}) };
  // A page shown from another chapter (a review's "What would you most like to do?") saves what it sets there too:
  // only what changed is written, so the rest of that chapter stays as it is.
  const owns = [...new Set([...edit.chapters, ...(edit.also ?? []).map(id => chapterOf(id) as ChapterId)])];

  const next: AppData = {
    ...data,
    profile,
    settings: {
      ...data.settings,
      ...changedSettings(settingsFrom(edit.opened, data.settings, profile, today, owns), settingsFrom(edit.answers, data.settings, profile, today, owns), data.settings),
      setup: { ...setup, answers, skipped },
    },
  };
  return joins ? withJoinAnswers(next, edit.answers.join!) : next;
}
