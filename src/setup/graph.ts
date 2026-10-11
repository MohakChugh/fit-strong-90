/**
 * Setup's pages: when each applies, what it sets, when it's answered, and
 * whether it may be skipped (journey §6.2; B-06 publishes this graph). The
 * conditions follow §6.3 as corrected on the board (D76). Counts and
 * reachability: setup.pages.test.ts. Fields: setup.fields.test.ts.
 */
import {
  CHAPTER_IDS, CONDITION_IDS, MEDICINE_CLASSES, PAGE_IDS, type ChapterId, type PageId, type SetupAnswers, type Tri,
} from '@/types/setup';
import { metforminYearProblem } from '@/components/profile/wizardSteps';
import { mealProblem, windowProblem } from '@/screens/you/habitOptions';
import { asksAdult, birthYearProblem } from './age';
import { factsOf, has, type Facts } from './facts';
import { heightProblem, waistProblem, weightProblem } from './units';

export interface Ctx { thisYear: number }

export interface PageDef {
  id: PageId;
  /** Shown only when this holds for the answers so far. */
  when: (a: SetupAnswers, f: Facts) => boolean;
  /** Its answers are complete: Next may store them and move on. */
  done: (a: SetupAnswers, f: Facts, ctx: Ctx) => boolean;
  /** The answers it sets; the crosswalk test reads these. */
  sets: readonly (keyof SetupAnswers)[];
  /** A preference page offers "Skip for now"; a safety page never does (§6.1). */
  skippable: boolean;
}

const always = () => true;
const inRange = (n: number | undefined, lo: number, hi: number) => n === undefined || (Number.isFinite(n) && n >= lo && n <= hi);
const okWindow = (w: { on: boolean; everyMinutes: number; from: string; to: string } | undefined) =>
  !w?.on || windowProblem(w.from, w.to, w.everyMinutes) === undefined;
const glucoseOk = (a: SetupAnswers) => {
  const mmol = (a.glucoseStartUnit ?? a.glucoseUnit) === 'mmol/L';
  return inRange(a.glucoseStartMin, mmol ? 3 : 54, mmol ? 17 : 300);
};

/** A checklist is one question (B-08): answered once a row is ticked, or "None of these" is (every row No). */
export function checklistDone<K extends string>(r: Partial<Record<K, Tri>> | undefined, ids: readonly K[]): boolean {
  return r !== undefined && (ids.some(id => has(r[id])) || ids.every(id => r[id] === 'no'));
}

const fill = <K extends string>(r: Partial<Record<K, Tri>>, ids: readonly K[]): Record<K, Tri> =>
  Object.fromEntries(ids.map(id => [id, r[id] ?? 'no'])) as Record<K, Tri>;

export const PAGES: readonly PageDef[] = [
  { id: 'welcome.start', when: always, done: always, sets: [], skippable: false },
  { id: 'about.name', when: always, sets: ['name', 'birthYear', 'adult'], skippable: true,
    done: (a, _f, ctx) => birthYearProblem(a.birthYear, ctx.thisYear) === null && (!asksAdult(a.birthYear, ctx.thisYear) || a.adult === true) },
  { id: 'about.figure', when: always, sets: ['figure'], skippable: true, done: a => a.figure !== undefined },
  { id: 'about.body', when: always, sets: ['metric', 'heightCm', 'weightKg', 'waistCm'], skippable: false,
    done: a => heightProblem(a.heightCm) === null && weightProblem(a.weightKg) === null && waistProblem(a.waistCm) === null },
  { id: 'health.conditions', when: always, sets: ['conditions'], skippable: false, done: a => checklistDone(a.conditions, CONDITION_IDS) },
  { id: 'health.diabetes', when: a => has(a.conditions?.diabetes), sets: ['diabetesType'], skippable: false, done: a => a.diabetesType !== undefined },
  { id: 'health.bp', when: (_a, f) => f.bp, sets: ['bpMedicine'], skippable: false, done: a => a.bpMedicine !== undefined },
  { id: 'health.fluid', when: (_a, f) => f.heart || f.kidney || f.other, sets: ['kidneyTreatment', 'fluidLimit'], skippable: false,
    done: (a, f) => a.fluidLimit !== undefined && (!f.kidney || a.kidneyTreatment !== undefined) },
  { id: 'health.eyes', when: (_a, f) => f.eyes, sets: ['eyeTreatment', 'eyeDisease'], skippable: false,
    done: a => a.eyeTreatment === 'yes' || (a.eyeTreatment === 'no' && a.eyeDisease !== undefined) },
  { id: 'health.feet', when: (_a, f) => f.feet, sets: ['feetNumb', 'footWound'], skippable: false,
    done: a => a.feetNumb !== undefined && a.footWound !== undefined },
  { id: 'health.limits', when: (_a, f) => f.heart || f.kidney || f.eyes || f.bp || f.pain || f.diabetic,
    sets: ['clearance', 'targets', 'bpStopSystolic', 'bpPermission', 'hba1cPercent'], skippable: false,
    done: (a, f) => a.clearance !== undefined && (!(f.bp || f.diabetic) || a.targets !== undefined)
      && inRange(a.bpStopSystolic, 90, 250) && inRange(a.hba1cPercent, 4, 15)
      && (a.bpPermission === undefined || (inRange(a.bpPermission.sys, 90, 250) && inRange(a.bpPermission.dia, 50, 150))) },
  { id: 'medicines.regular', when: always, sets: ['regular'], skippable: false, done: a => a.regular !== undefined },
  { id: 'medicines.which', when: (_a, f) => f.medicines, sets: ['classes', 'metforminSince'], skippable: false,
    done: (a, _f, ctx) => checklistDone(a.classes, MEDICINE_CLASSES) && metforminYearProblem(a.metforminSince ?? '', ctx.thisYear) === null },
  { id: 'medicines.lows', when: (a, f) => f.diabetic && (f.insulin || has(a.classes?.lowsTablet)),
    sets: ['insulinHow', 'lowsRisk', 'glucoseStartMin', 'glucoseStartUnit'], skippable: false,
    done: (a, f) => (!f.insulin || a.insulinHow !== undefined) && a.lowsRisk !== undefined && glucoseOk(a) },
  { id: 'medicines.ketones', when: (a, f) => f.diabetic || has(a.classes?.gliflozin), sets: ['priorDka', 'ketoneTest'], skippable: false,
    done: (a, f) => (!f.diabetic || a.priorDka !== undefined) && (!f.ketoneRisk || a.ketoneTest !== undefined) },
  { id: 'medicines.standing', when: (_a, f) => f.bpMeds || f.heart || f.diabetic || f.other, sets: ['dizzy'], skippable: false,
    done: a => a.dizzy !== undefined },
  { id: 'medicines.monitors', when: always, sets: ['glucoseMonitor', 'glucoseUnit', 'bpCuff'], skippable: false,
    done: a => a.glucoseMonitor !== undefined && a.bpCuff !== undefined && (a.glucoseMonitor === 'none' || a.glucoseUnit !== undefined) },
  { id: 'backFeet.where', when: (_a, f) => f.pain, sets: ['painAreas'], skippable: false, done: a => a.painAreas !== undefined },
  { id: 'backFeet.side', when: (_a, f) => f.pain && f.back, sets: ['sciaticaSide', 'worseWith', 'helps'], skippable: false,
    done: a => a.worseWith !== undefined && (!(a.painAreas ?? []).includes('sciatica') || a.sciaticaSide !== undefined) },
  { id: 'backFeet.history', when: (_a, f) => f.pain || f.feet, sets: ['neuroHistory', 'footRestriction'], skippable: false,
    done: (a, f) => (!f.pain || a.neuroHistory !== undefined) && (!f.feet || a.footRestriction !== undefined) },
  { id: 'movement.focus', when: always, sets: ['focus', 'active'], skippable: false, done: a => a.focus !== undefined && a.active !== undefined },
  { id: 'movement.goal', when: always, sets: ['weeklyGoal'], skippable: true, done: a => a.weeklyGoal !== undefined },
  { id: 'movement.programme', when: always, sets: ['programme', 'join'], skippable: false,
    done: a => a.programme === 'notNow' || a.programme === 'joined' || (a.programme === 'join' && a.join !== undefined) },
  // The chips' ids and the person's own words are one question: answered once either is, or "No food allergies" is (`allergies: []`).
  { id: 'food.pattern', when: always, sets: ['pattern', 'allergies', 'customAllergies'], skippable: true,
    done: a => a.pattern !== undefined && a.allergies !== undefined },
  // Estimates are stored only once "Has food or weight ever been hard for you?" is answered (K-22), and the answer is kept (board D82).
  { id: 'food.logging', when: always, sets: ['foodLevel', 'hardBefore'], skippable: true,
    done: a => a.foodLevel !== undefined && (a.foodLevel !== 'estimates' || a.hardBefore !== undefined) },
  { id: 'day.reminders', when: always, sets: ['water', 'sitting', 'mealWalk', 'mealFinish', 'quiet', 'delivery', 'fluidLimit'], skippable: true,
    done: a => okWindow(a.water) && okWindow(a.sitting) && (!a.water?.on || a.fluidLimit !== undefined) && (!a.mealWalk?.on || a.mealWalk.meals.length > 0) },
  { id: 'day.meals', when: (a, f) => a.mealWalk?.on === true && !f.footHeld, sets: ['mealFinish'], skippable: false,
    done: a => mealProblem(a.mealWalk?.meals ?? [], a.mealFinish ?? {}) === undefined },
  { id: 'day.voice', when: always, sets: ['voice'], skippable: false, done: always },
  { id: 'review', when: always, sets: [], skippable: false, done: always },
];

const BY_ID = new Map<string, PageDef>(PAGES.map(p => [p.id, p]));
export const isPageId = (x: unknown): x is PageId => typeof x === 'string' && BY_ID.has(x);
export const pageDef = (id: PageId): PageDef => BY_ID.get(id)!;
export const chapterOf = (id: PageId): ChapterId | 'review' => (id === 'review' ? 'review' : (id.split('.')[0] as ChapterId));

/** What each chapter is called (journey §6.2), on the capsule, the review cards, Me and Profile & health. */
export const CHAPTER_TITLE: Record<ChapterId, string> = {
  welcome: 'Welcome', about: 'About you', health: 'Your health', medicines: 'Your medicines',
  backFeet: 'Your back and feet', movement: 'Your movement', food: 'Your food', day: 'Your day and coach',
};

/** The chapters the engine's profile gaps depend on (§6.1). */
export const SAFETY_CHAPTERS: readonly ChapterId[] = ['health', 'medicines', 'backFeet'];

export function pathFor(a: SetupAnswers): PageId[] {
  const f = factsOf(a);
  return PAGES.filter(p => p.when(a, f)).map(p => p.id);
}

export function pageDone(id: PageId, a: SetupAnswers, ctx: Ctx): boolean {
  return pageDef(id).done(a, factsOf(a), ctx);
}

/** What a page stores: a checklist's unticked rows are No once it's answered (B-08). */
export function commitPage(id: PageId, a: SetupAnswers): SetupAnswers {
  if (id === 'health.conditions' && a.conditions && checklistDone(a.conditions, CONDITION_IDS)) return { ...a, conditions: fill(a.conditions, CONDITION_IDS) };
  if (id === 'medicines.which' && a.classes && checklistDone(a.classes, MEDICINE_CLASSES)) return { ...a, classes: fill(a.classes, MEDICINE_CLASSES) };
  return a;
}

/** The next page that applies after `from`, in setup's order; Review is last. */
export function nextPage(a: SetupAnswers, from: PageId): PageId {
  const f = factsOf(a);
  return PAGES.slice(PAGE_IDS.indexOf(from) + 1).find(p => p.when(a, f))?.id ?? 'review';
}

export function prevPage(a: SetupAnswers, from: PageId): PageId | undefined {
  const f = factsOf(a);
  return PAGES.slice(0, PAGE_IDS.indexOf(from)).reverse().find(p => p.when(a, f))?.id;
}

const skippedOf = (a: SetupAnswers) => new Set<PageId>(a.skippedPages ?? []);

/**
 * Next, from a chapter opened with Review's Edit: the rest of that chapter,
 * then any page the change made necessary, then Review again.
 */
export function nextFromReview(a: SetupAnswers, from: PageId, ctx: Ctx): PageId {
  const path = pathFor(a);
  const after = path.slice(path.indexOf(from) + 1);
  const skipped = skippedOf(a);
  return after.find(id => chapterOf(id) === chapterOf(from))
    ?? after.find(id => id !== 'review' && !skipped.has(id) && !pageDone(id, a, ctx))
    ?? 'review';
}

/** Where Edit opens a chapter. Your back and feet has no page without a pain or foot answer, so it opens the question that brings them. */
export function firstPageOf(chapter: ChapterId, a: SetupAnswers): PageId {
  return pathFor(a).find(id => chapterOf(id) === chapter) ?? 'health.conditions';
}

/** Pages on the path still to answer, apart from those skipped: Review lists them. */
export function missingPages(a: SetupAnswers, ctx: Ctx): PageId[] {
  const skipped = skippedOf(a);
  return pathFor(a).filter(id => id !== 'review' && !skipped.has(id) && !pageDone(id, a, ctx));
}

export function chapterComplete(chapter: ChapterId, a: SetupAnswers, ctx: Ctx): boolean {
  return pathFor(a).filter(id => chapterOf(id) === chapter).every(id => pageDone(id, a, ctx));
}

/** Chapters with a page skipped or left on the path: Me lists them under "Finish setting up" (§16). */
export function skippedChapters(a: SetupAnswers, ctx: Ctx): ChapterId[] {
  const path = pathFor(a);
  const skipped = skippedOf(a);
  return CHAPTER_IDS.filter(c => c !== 'welcome' && path.some(id => chapterOf(id) === c && (skipped.has(id) || !pageDone(id, a, ctx))));
}

const firstLeft = (a: SetupAnswers, ctx: Ctx, safetyOnly: boolean): PageId | undefined => {
  const skipped = skippedOf(a);
  return pathFor(a).find(id => id !== 'welcome.start' && id !== 'review' && !skipped.has(id) && !pageDone(id, a, ctx)
    && (!safetyOnly || !pageDef(id).skippable));
};

/**
 * Where setup carries on (§6.1 "resumes on the same page"): the stored page
 * while it still applies; otherwise the first page left to answer, as when a
 * draft comes from another build (Review Focus 5). With no page kept, the
 * first question.
 */
export function resumeAt(a: SetupAnswers, at: PageId | undefined, ctx: Ctx): PageId {
  if (at === undefined) return 'about.name';
  if (isPageId(at) && pathFor(a).includes(at)) return at;
  return firstLeft(a, ctx, false) ?? 'review';
}

/** A page opened directly: where to go instead, if it doesn't apply, or comes after a safety page not yet answered. */
export function guardFor(a: SetupAnswers, want: PageId, ctx: Ctx): PageId | undefined {
  const path = pathFor(a);
  const blocking = firstLeft(a, ctx, true);
  if (!path.includes(want)) return blocking ?? 'review';
  if (blocking !== undefined && path.indexOf(blocking) < path.indexOf(want)) return blocking;
  return undefined;
}

/** The glass capsule: "About you · 2 of 8", and how far along the path this page is (M22). */
export function capsuleOf(id: PageId, a: SetupAnswers): { label: string; fraction: number } {
  if (id === 'review') return { label: 'Review', fraction: 1 };
  const path = pathFor(a);
  const chapter = chapterOf(id) as ChapterId;
  const at = Math.max(0, path.indexOf(id));
  return { label: `${CHAPTER_TITLE[chapter]} · ${CHAPTER_IDS.indexOf(chapter) + 1} of 8`, fraction: (at + 1) / path.length };
}

export function hrefOf(id: PageId): string {
  if (id === 'welcome.start') return '/setup';
  if (id === 'review') return '/setup/review';
  const [chapter, page] = id.split('.');
  return `/setup/${chapter}/${page}`;
}

export function pageAt(chapter: string | undefined, page: string | undefined): PageId | undefined {
  const id = `${chapter}.${page}`;
  return isPageId(id) ? id : undefined;
}
