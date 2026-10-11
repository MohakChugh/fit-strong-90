import { describe, expect, it } from 'vitest';
import { CHAPTER_IDS, PAGE_IDS, type PageId, type SetupAnswers } from '@/types/setup';
import { COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, JOIN, MINIMAL, NO_CLASSES, NO_CONDITIONS, UNSURE, withC } from './fixtures';
import {
  PAGES, capsuleOf, chapterComplete, commitPage, firstPageOf, guardFor, hrefOf, missingPages, nextFromReview, nextMove, nextPage, pageAt, pageDone, pathFor,
  prevPage, resumeAt, skipMove, skippedChapters,
} from './graph';

const CTX = { thisYear: 2026 };

describe('setup’s pages (journey §1.2, §6.2; B-06)', () => {
  it('has every page once, in setup’s order', () => {
    expect(PAGES.map(p => p.id)).toEqual([...PAGE_IDS]);
    expect(CHAPTER_IDS).toHaveLength(8);
  });

  it('the minimal path is 15 pages, within 20, Welcome and Review counted', () => {
    const path = pathFor(MINIMAL);
    expect(path).toEqual([
      'welcome.start', 'about.name', 'about.figure', 'about.body', 'health.conditions', 'medicines.regular', 'medicines.monitors',
      'movement.focus', 'movement.goal', 'movement.programme', 'food.pattern', 'food.logging', 'day.reminders', 'day.voice', 'review',
    ]);
    expect(path.length).toBeLessThanOrEqual(20);
  });

  it('the complex path is 26 pages, within 30; the Join flow is not among them (L-01)', () => {
    expect(pathFor(COMPLEX)).toHaveLength(26);
    expect(pathFor({ ...COMPLEX, programme: 'join', join: JOIN })).toHaveLength(26);
  });

  it('no answers make setup longer than 29 pages', () => {
    expect(pathFor(EVERYTHING)).toEqual([...PAGE_IDS]);
    expect(PAGE_IDS).toHaveLength(29);
  });

  it('every fixture is a whole run: nothing on its path is left to answer', () => {
    for (const a of [MINIMAL, COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, UNSURE]) expect(missingPages(a, CTX)).toEqual([]);
  });

  it('a checklist is one question: a row ticked answers it, and the rest are stored as No (B-08)', () => {
    const ticked: SetupAnswers = { conditions: { diabetes: 'unsure' } };
    expect(pageDone('health.conditions', ticked, CTX)).toBe(true);
    expect(commitPage('health.conditions', ticked).conditions).toEqual({ ...NO_CONDITIONS, diabetes: 'unsure' });
    expect(pageDone('health.conditions', { conditions: {} }, CTX)).toBe(false);
    expect(commitPage('health.conditions', { conditions: {} }).conditions).toEqual({});
    expect(pageDone('health.conditions', { conditions: { ...NO_CONDITIONS } }, CTX)).toBe(true);
  });

  it('a number not yet checked holds the page', () => {
    expect(pageDone('about.name', { birthYear: 19 }, CTX)).toBe(false);
    expect(pageDone('about.name', { birthYear: 2008 }, CTX)).toBe(false);
    expect(pageDone('about.name', { birthYear: 2008, adult: true }, CTX)).toBe(true);
    expect(pageDone('about.body', { weightKg: Number.NaN }, CTX)).toBe(false);
    expect(pageDone('medicines.which', { classes: { metformin: 'yes' }, metforminSince: '201' }, CTX)).toBe(false);
  });

  it('takes “Not sure” about eye treatment as an answer: it is read as recent treatment, so no severity is asked (K5-09)', () => {
    expect(pageDone('health.eyes', { eyeTreatment: 'unsure' }, CTX)).toBe(true);
    expect(pageDone('health.eyes', { eyeTreatment: 'no' }, CTX)).toBe(false);
  });

  it('checks the metformin year only while metformin is ticked, and drops an unfinished one when it isn’t (H5-27)', () => {
    const hidden: SetupAnswers = { classes: { insulin: 'yes', metformin: 'no' }, metforminSince: '201' };
    expect(pageDone('medicines.which', hidden, CTX)).toBe(true);
    expect(commitPage('medicines.which', hidden).metforminSince).toBeUndefined();
    expect(pageDone('medicines.which', { classes: { metformin: 'yes' }, metforminSince: '201' }, CTX)).toBe(false);
    expect(commitPage('medicines.which', { classes: { metformin: 'yes' }, metforminSince: '2019' }).metforminSince).toBe('2019');
  });

  it('accepts the usual meal times it shows, and stores them as shown (H5-26)', () => {
    const walks: SetupAnswers = { mealWalk: { on: true, meals: ['lunch', 'dinner'] } };
    const stored = commitPage('day.meals', walks);
    expect(stored.mealFinish).toEqual({ lunch: '13:30', dinner: '20:30' });
    expect(pageDone('day.meals', stored, CTX)).toBe(true);
    // A time the person set is kept.
    expect(commitPage('day.meals', { ...walks, mealFinish: { lunch: '12:45' } }).mealFinish).toEqual({ lunch: '12:45', dinner: '20:30' });
  });

  it('stores estimates only once the screening question is answered (K-22, board D82)', () => {
    expect(pageDone('food.logging', { foodLevel: 'estimates' }, CTX)).toBe(false);
    expect(pageDone('food.logging', { foodLevel: 'estimates', hardBefore: 'preferNot' }, CTX)).toBe(true);
    expect(pageDone('food.logging', { foodLevel: 'meals' }, CTX)).toBe(true);
  });
});

describe('every conditional page can be reached, and none is always on (B-06)', () => {
  const REACH: Record<PageId, SetupAnswers> = {
    'welcome.start': MINIMAL, 'about.name': MINIMAL, 'about.figure': MINIMAL, 'about.body': MINIMAL,
    'health.conditions': MINIMAL, 'health.diabetes': COMPLEX, 'health.bp': COMPLEX, 'health.fluid': EVERYTHING,
    'health.eyes': EVERYTHING, 'health.feet': FOOT_WOUND, 'health.limits': COMPLEX,
    'medicines.regular': MINIMAL, 'medicines.which': COMPLEX, 'medicines.lows': INSULIN_NO_DIABETES,
    'medicines.ketones': GLIFLOZIN_NO_DIABETES, 'medicines.standing': UNSURE, 'medicines.monitors': MINIMAL,
    'backFeet.where': COMPLEX, 'backFeet.side': COMPLEX, 'backFeet.history': FOOT_WOUND,
    'movement.focus': MINIMAL, 'movement.goal': MINIMAL, 'movement.programme': MINIMAL,
    'food.pattern': MINIMAL, 'food.logging': MINIMAL,
    'day.reminders': MINIMAL, 'day.meals': COMPLEX, 'day.voice': MINIMAL, 'review': MINIMAL,
  };
  for (const [id, a] of Object.entries(REACH) as [PageId, SetupAnswers][]) {
    it(`${id} is reached`, () => expect(pathFor(a)).toContain(id));
  }

  it('the pages that depend on an answer are exactly these', () => {
    expect(PAGE_IDS.filter(id => !pathFor(MINIMAL).includes(id))).toEqual([
      'health.diabetes', 'health.bp', 'health.fluid', 'health.eyes', 'health.feet', 'health.limits',
      'medicines.which', 'medicines.lows', 'medicines.ketones', 'medicines.standing',
      'backFeet.where', 'backFeet.side', 'backFeet.history', 'day.meals',
    ]);
  });

  it('asks the monitors whether or not a medicine is taken (B-06)', () => {
    expect(pathFor(MINIMAL)).toContain('medicines.monitors');
  });

  it('a diabetes medicine with "No" diabetes brings the insulin, ketone and limits pages (D78)', () => {
    expect(pathFor(INSULIN_NO_DIABETES)).toEqual(expect.arrayContaining(['health.limits', 'medicines.lows', 'medicines.ketones', 'medicines.standing']));
  });

  it('each answer brings the pages §6.3 lists for it (board D76)', () => {
    expect(pathFor(withC({ other: 'yes' }))).toContain('health.fluid');
    expect(pathFor(withC({ diabetes: 'yes' }, { diabetesType: 'type2', regular: 'yes', classes: { ...NO_CLASSES, lowsTablet: 'yes' } }))).toContain('medicines.lows');
    expect(pathFor({ ...MINIMAL, regular: 'unsure' })).toContain('medicines.which');
    expect(pathFor(withC({ bp: 'yes' }, { bpMedicine: 'unsure' }))).toContain('medicines.standing');
    expect(pathFor(withC({ feet: 'yes' }, { footWound: 'no', footRestriction: 'yes', mealWalk: { on: true, meals: ['lunch'] } }))).not.toContain('day.meals');
  });

  it('asks for limits or targets with high blood pressure or diabetes', () => {
    expect(pageDone('health.limits', withC({ bp: 'yes' }, { clearance: 'none' }), CTX)).toBe(false);
    expect(pageDone('health.limits', withC({ bp: 'yes' }, { clearance: 'none', targets: 'unsure' }), CTX)).toBe(true);
    expect(pageDone('health.limits', withC({ heart: 'yes' }, { clearance: 'none' }), CTX)).toBe(true);
  });

  it('keeps the nerve-history question while a history is kept, with no pain now (H5-19)', () => {
    expect(pathFor(withC({ pain: 'no' }, { neuroHistory: 'yes' }))).toContain('backFeet.history');
    expect(pathFor(withC({ pain: 'no' }, { neuroHistory: 'no' }))).not.toContain('backFeet.history');
  });

  it('a wound now takes the after-meal walks off (K-30)', () => {
    expect(pathFor({ ...FOOT_WOUND, mealWalk: { on: true, meals: ['lunch'] } })).not.toContain('day.meals');
  });
});

describe('moving through setup', () => {
  it('goes forward and back over pages that don’t apply', () => {
    expect(nextPage(MINIMAL, 'health.conditions')).toBe('medicines.regular');
    expect(prevPage(MINIMAL, 'medicines.regular')).toBe('health.conditions');
    expect(prevPage(MINIMAL, 'welcome.start')).toBeUndefined();
    expect(nextPage(MINIMAL, 'day.voice')).toBe('review');
  });

  it('plans Next from the page as it is now: a correction made after a refused store is what goes, and where it goes (H5-02)', () => {
    const refused: SetupAnswers = { conditions: { diabetes: 'unsure', bp: 'yes' } };
    expect(nextMove('health.conditions', refused, CTX, false)).toMatchObject({ to: 'health.diabetes', answers: { conditions: { diabetes: 'unsure' } } });
    const corrected: SetupAnswers = { conditions: { diabetes: 'no', bp: 'yes' } };
    expect(nextMove('health.conditions', corrected, CTX, false)).toMatchObject({ to: 'health.bp', answers: { conditions: { ...NO_CONDITIONS, bp: 'yes' } } });
    // Unanswered, there's nothing to store.
    expect(nextMove('health.conditions', { conditions: {} }, CTX, false)).toBeUndefined();
    // Answering a skipped page takes it off the list; skipping one keeps the answers as they were before it.
    expect(nextMove('movement.goal', { ...MINIMAL, skippedPages: ['movement.goal'] }, CTX, false)?.answers.skippedPages).toEqual([]);
    expect(skipMove('movement.goal', { ...MINIMAL, weeklyGoal: undefined }, CTX, false)).toMatchObject({ to: 'movement.programme', answers: { skippedPages: ['movement.goal'] } });
  });

  it('a page that stops applying still knows the page after it', () => {
    expect(nextPage(MINIMAL, 'day.meals')).toBe('day.voice');
  });

  it('from Review, Edit walks its own chapter, then any page the change made necessary, then back to Review', () => {
    expect(nextFromReview(COMPLEX, 'about.name', CTX)).toBe('about.figure');
    expect(nextFromReview(COMPLEX, 'about.body', CTX)).toBe('review');
    const feet: SetupAnswers = { ...COMPLEX, conditions: { ...COMPLEX.conditions, feet: 'yes' } };
    expect(nextFromReview(feet, 'health.bp', CTX)).toBe('health.feet');
    expect(nextFromReview(feet, 'health.limits', CTX)).toBe('backFeet.history');
  });

  it('opens a chapter at its first page; Your back and feet without pain at the question that brings it', () => {
    expect(firstPageOf('about', MINIMAL)).toBe('about.name');
    expect(firstPageOf('backFeet', MINIMAL)).toBe('health.conditions');
    expect(firstPageOf('backFeet', COMPLEX)).toBe('backFeet.where');
  });

  it('names the chapter and its place on the capsule', () => {
    expect(capsuleOf('about.name', MINIMAL).label).toBe('About you · 2 of 8');
    expect(capsuleOf('day.voice', MINIMAL).label).toBe('Your day and coach · 8 of 8');
    expect(capsuleOf('review', MINIMAL)).toEqual({ label: 'Review', fraction: 1 });
    expect(capsuleOf('health.conditions', MINIMAL).fraction).toBeCloseTo(5 / 15);
  });

  it('lives at /setup/:chapter/:page, with page 1 at /setup (§19.2)', () => {
    expect(hrefOf('welcome.start')).toBe('/setup');
    expect(hrefOf('health.conditions')).toBe('/setup/health/conditions');
    expect(hrefOf('review')).toBe('/setup/review');
    expect(pageAt('health', 'conditions')).toBe('health.conditions');
    expect(pageAt('health', 'nowhere')).toBeUndefined();
    expect(pageAt(undefined, undefined)).toBeUndefined();
  });

  it('puts a skipped preference page’s chapter under Finish setting up', () => {
    expect(skippedChapters(MINIMAL, CTX)).toEqual([]);
    expect(skippedChapters({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] }, CTX)).toEqual(['movement']);
    // Skipped is not missing: Review lists only what's left to answer.
    expect(missingPages({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] }, CTX)).toEqual([]);
    expect(chapterComplete('backFeet', MINIMAL, CTX)).toBe(true);
  });
});

describe('resuming, and pages opened directly (Review Focus 5)', () => {
  const partway: SetupAnswers = { figure: 'female', conditions: { ...NO_CONDITIONS } };

  it('carries on at the stored page while it still applies', () => {
    expect(resumeAt(partway, 'medicines.regular', CTX)).toBe('medicines.regular');
  });

  it('goes to the first page left when the stored page no longer applies, or this build has no such page', () => {
    expect(resumeAt(partway, 'health.diabetes', CTX)).toBe('medicines.regular');
    expect(resumeAt(partway, 'health.somewhere' as PageId, CTX)).toBe('medicines.regular');
  });

  it('starts at the first question when no page was kept', () => {
    expect(resumeAt({}, undefined, CTX)).toBe('about.name');
    expect(resumeAt(partway, undefined, CTX)).toBe('about.name');
  });

  it('sends a page opened past an unanswered safety page back to it', () => {
    expect(guardFor({}, 'medicines.regular', CTX)).toBe('health.conditions');
    expect(guardFor(partway, 'medicines.regular', CTX)).toBeUndefined();
  });

  it('lets a page opened past a skipped preference page stay', () => {
    expect(guardFor({ conditions: { ...NO_CONDITIONS } }, 'medicines.regular', CTX)).toBeUndefined();
  });

  it('sends a page that doesn’t apply to the first page left', () => {
    expect(guardFor(MINIMAL, 'health.diabetes', CTX)).toBe('review');
  });
});
