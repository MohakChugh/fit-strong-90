import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { createDefaultProfile } from '@/profile/defaults';
import type { ChapterId, UserSettings } from '@/types';
import { CHAPTER_IDS, type SetupAnswers } from '@/types/setup';
import { COMPLEX, MINIMAL } from './fixtures';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { askAbout, chapterHref, finishFooter, finishTitle, notNow, safetyLeft, setupProgress } = await import('./progress');

const ctx = { thisYear: 2026 };
/** Set up in v1: done, with no setup state written yet. */
const v1 = { onboardingComplete: true } as UserSettings;
const finished = (answers: SetupAnswers, skipped: ChapterId[] = []) =>
  ({ onboardingComplete: true, setup: { stage: 'done', skipped, answers, completedAt: '2026-10-08T09:00:00.000+05:30' } }) as UserSettings;
/** Every answer given, the questions new since v1 included. */
const answered = createDefaultProfile({ weightKg: 70, name: 'Asha', food: { pattern: 'vegetarian', avoid: [], level: 'ideas', allergies: [] }, health: { medicinesReviewed: true } });
const rows = (profile: Parameters<typeof setupProgress>[0]['profile'], s: UserSettings) =>
  setupProgress({ profile, settings: s }, ctx).map(c => [c.chapter, c.detail, c.why]);

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB() });
});

describe('setupProgress, from setup’s state (journey §6.6, §16; board D79)', () => {
  it('has nothing open once setup is finished with every chapter answered', () => {
    expect(setupProgress({ profile: answered, settings: finished(MINIMAL) }, ctx)).toEqual([]);
  });

  it('names each of Your day’s pages skipped (K5-12)', () => {
    const skipped = { ...MINIMAL, skippedPages: ['day.water', 'day.sitting', 'day.walks', 'day.quiet'] as SetupAnswers['skippedPages'] };
    expect(rows(answered, finished(skipped, ['day']))).toEqual([['day', 'Water reminders, Sitting breaks, After-meal walks, Quiet hours', 'skipped']]);
  });

  it('names allergies left unanswered on their own page, from setup’s answers (K5-08)', () => {
    const { allergies: _a, ...noAllergies } = MINIMAL;
    void _a;
    expect(rows({ ...answered, food: { pattern: 'vegetarian', avoid: [], level: 'ideas' } }, finished(noAllergies, ['food']))).toEqual([['food', 'Food allergies', 'skipped']]);
  });

  it('keeps Your food open while allergies are unanswered, a backup’s unreadable list included (H5-18)', () => {
    const noFood = { ...answered, food: undefined };
    expect(rows(noFood, finished(MINIMAL))).toEqual([['food', 'Food allergies', 'skipped']]);
    const unanswered = { ...answered, food: { pattern: 'vegetarian' as const, avoid: [], level: 'ideas' as const } };
    expect(rows(unanswered, finished(MINIMAL))).toEqual([['food', 'Food allergies', 'skipped']]);
  });

  it('while setup is unfinished, its one row carries on setting up (L-20)', () => {
    expect(setupProgress({ profile: undefined, settings: {} as UserSettings }, ctx)).toEqual([
      { chapter: 'health', label: 'Your health', detail: 'Answer 1 question about your health before you move', href: '/setup', why: 'gap' },
    ]);
    expect(rows(undefined, { onboardingComplete: true, setup: { stage: 'lookAround', skipped: [] as ChapterId[] } } as UserSettings))
      .toEqual([['health', 'Answer 1 question about your health before you move', 'gap']]);
    // A v1 Welcome left part-way has a profile, and setup still carries on (K-57).
    expect(setupProgress({ profile: answered, settings: { onboardingComplete: false } as UserSettings }, ctx).map(c => c.href)).toEqual(['/setup']);
  });

  it('names the safety chapter setup still asks, with how many of its questions are left (§6.1; K5-07)', () => {
    const { sciaticaSide: _s, worseWith: _w, neuroHistory: _n, ...noBack } = COMPLEX;
    void [_s, _w, _n];
    expect(safetyLeft(noBack, ctx)).toEqual({ chapter: 'backFeet', count: 2 });
    expect(askAbout({ chapter: 'backFeet', count: 2 })).toBe('Answer 2 questions about your back and feet');
    expect(askAbout({ chapter: 'medicines', count: 1 })).toBe('Answer 1 question about your medicines');
    const lookAround = { onboardingComplete: true, setup: { stage: 'lookAround', skipped: [], draft: { at: 'movement.focus', answers: noBack } } } as unknown as UserSettings;
    expect(rows(undefined, lookAround)).toEqual([['backFeet', 'Answer 2 questions about your back and feet before you move', 'gap']]);
    // This session's answers, without saving, count over the draft's.
    expect(setupProgress({ profile: undefined, settings: {} as UserSettings, answers: noBack }, ctx).map(c => c.chapter)).toEqual(['backFeet']);
    // Every safety question answered: nothing to name.
    expect(safetyLeft(COMPLEX, ctx)).toBeUndefined();
  });

  it('lists an upgrader’s new chapters as new, after any safety gap (§6.6)', () => {
    const p = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true }, needsHealthReview: true });
    expect(rows(p, v1)).toEqual([
      ['health', 'Your health answers need a review', 'gap'],
      ['about', 'What to call you', 'new'],
      ['food', 'Logging what you eat', 'new'],
    ]);
  });

  it('opens Your medicines when diabetes medicines were never answered: movement waits on it', () => {
    const p = { ...answered, health: { ...answered.health, diabetes: 'type2' as const, medicinesReviewed: false } };
    expect(rows(p, v1)).toEqual([['medicines', 'Medicines: not yet reviewed', 'gap']]);
  });

  it('opens Your medicines for the SGLT2 question nobody answered, as skipped: nothing is held on it', () => {
    const p = { ...answered, health: { ...answered.health, medicinesReviewed: undefined } };
    expect(rows(p, v1)).toEqual([['medicines', 'One medicine question to answer', 'skipped']]);
  });

  it('names a skipped preference page by what it asks, and opens the chapter’s own pages', () => {
    const s = finished({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] }, ['movement']);
    expect(setupProgress({ profile: answered, settings: s }, ctx)).toEqual([
      { chapter: 'movement', label: 'Your movement', detail: 'Your weekly goal', href: '/me/profile?chapter=movement', why: 'skipped' },
    ]);
  });

  it('leaves out a chapter answered “Not now”, but never a safety gap (KH-08, board D80)', () => {
    const p = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
    expect(rows(p, { onboardingComplete: true, setup: { declined: ['about'] } } as UserSettings)).toEqual([['food', 'Logging what you eat', 'new']]);
    // Movement waits for a gap, so its row stays, even where an earlier build stored "Not now" for it.
    expect(rows(undefined, { setup: { declined: ['health'] } } as UserSettings)).toEqual([['health', 'Answer 1 question about your health before you move', 'gap']]);
    const review = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true }, needsHealthReview: true });
    expect(rows(review, { onboardingComplete: true, setup: { declined: ['health', 'about', 'food'] } } as UserSettings))
      .toEqual([['health', 'Your health answers need a review', 'gap']]);
  });

  it('says under the rows what waits for them, and what Not now does (KH-08)', () => {
    const gap = { chapter: 'health', label: 'Your health', detail: '', href: '', why: 'gap' } as const;
    const other = { chapter: 'about', label: 'About you', detail: '', href: '', why: 'new' } as const;
    expect(finishFooter([other])).toBe('Not now keeps a chapter for later, in Profile & health.');
    expect(finishFooter([gap])).toBe('Movement waits for Your health.');
    expect(finishFooter([gap, other])).toBe('Movement waits for Your health. Not now keeps the others for later, in Profile & health.');
  });

  it('counts the chapters in the group’s title (journey §6.6)', () => {
    expect(finishTitle(1)).toBe('Finish setting up · 1 short chapter');
    expect(finishTitle(2)).toBe('Finish setting up · 2 short chapters');
  });

  it('opens each chapter at its own pages, and Welcome at Display (§19.2)', () => {
    expect(CHAPTER_IDS.map(chapterHref)).toEqual([
      '/me/display', '/me/profile?chapter=about', '/me/profile?chapter=health', '/me/profile?chapter=medicines',
      '/me/profile?chapter=backFeet', '/me/profile?chapter=movement', '/me/profile?chapter=food', '/me/profile?chapter=day',
    ]);
  });
});

describe('notNow (journey §6.6)', () => {
  it('keeps each chapter once, and a setting written at the same moment survives', async () => {
    await Promise.all([notNow('health'), store.setSettings({ theme: 'dark' }), notNow('health'), notNow('food')]);
    expect((await store.reload()).ok).toBe(true);
    const s = store.getState().settings;
    expect(s.setup?.declined).toEqual(['health', 'food']);
    expect(s.theme).toBe('dark');
  });
});
