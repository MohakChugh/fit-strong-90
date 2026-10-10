import { describe, expect, it } from 'vitest';
import { afterMealSuggestion, choiceChanged, directWalkHref, isWalkId, liveHref, mealFromSearch, mealMinutesAgo, mealStartedLabel, MEAL_STARTED_AGO, newWalkId, originOf, setupPlan, walkFirst, walkFromSearch, walkPlanOf } from './plan';
import type { WalkPlan } from './clock';

const NOW = Date.UTC(2026, 9, 8, 13, 0, 0);
const search = (href: string) => new URLSearchParams(href.slice(href.indexOf('?')));

describe('the live screen address', () => {
  it('carries an after-meal walk across intact', () => {
    const plan: WalkPlan = { kind: 'afterMeal', meal: { which: 'dinner', startedAt: NOW - 20 * 60_000 }, targetMinutes: 10, gps: true, steps: false };
    const href = liveHref('mgh3k2x1-1a2b3c4d', plan);
    expect(href.startsWith('/walk/live?')).toBe(true);
    expect(walkFromSearch(search(href), NOW)).toEqual({ id: 'mgh3k2x1-1a2b3c4d', plan });
  });

  it('carries a plain walk with nothing switched on', () => {
    const plan: WalkPlan = { kind: 'walk', gps: false, steps: false };
    expect(walkFromSearch(search(liveHref('abcd-1234', plan)), NOW)).toEqual({ id: 'abcd-1234', plan });
  });

  it('starts nothing without a well-formed id', () => {
    expect(walkFromSearch(new URLSearchParams('gps=1'), NOW)).toBeUndefined();
    expect(walkFromSearch(new URLSearchParams('id=<script>'), NOW)).toBeUndefined();
  });

  it('drops a meal time that makes no sense, rather than guessing one', () => {
    const at = (mealAt: number | string) => walkFromSearch(new URLSearchParams(`id=abcd-1234&meal=lunch&mealAt=${mealAt}`), NOW)!.plan;
    expect(at('soon')).toEqual({ kind: 'walk', gps: false, steps: false });
    expect(at(NOW - 7 * 3600_000).kind).toBe('walk');
    expect(at(NOW + 3600_000).kind).toBe('walk');
    // A minute or two of clock skew is tolerated, and clamped to now.
    expect(at(NOW + 60_000)).toEqual({ kind: 'afterMeal', meal: { which: 'lunch', startedAt: NOW }, gps: false, steps: false });
    expect(walkFromSearch(new URLSearchParams(`id=abcd-1234&meal=supper&mealAt=${NOW}`), NOW)!.plan.kind).toBe('walk');
  });

  it('drops a target that is not a sensible whole number of minutes', () => {
    for (const target of ['0', '-5', '7.5', '600', 'ten', '']) {
      expect(walkFromSearch(new URLSearchParams(`id=abcd-1234&target=${target}`), NOW)!.plan.targetMinutes).toBeUndefined();
    }
    expect(walkFromSearch(new URLSearchParams('id=abcd-1234&target=15'), NOW)!.plan.targetMinutes).toBe(15);
  });
});

describe('meals', () => {
  it('needs the meal chosen before an after-meal walk can start: none is assumed from the time (J10)', () => {
    const choice = { kind: 'afterMeal' as const, mealAgo: 20, targetMinutes: 10, gps: false, steps: false };
    expect(setupPlan({ ...choice, meal: undefined }, NOW)).toBeUndefined();
    expect(setupPlan({ ...choice, meal: 'breakfast' }, NOW)).toEqual({
      kind: 'afterMeal', meal: { which: 'breakfast', startedAt: NOW - 20 * 60_000 }, targetMinutes: 10, gps: false, steps: false,
    });
  });

  it('builds a plain walk without a meal, and without a target unless one was set', () => {
    expect(setupPlan({ kind: 'walk', meal: 'dinner', mealAgo: 30, gps: true, steps: true }, NOW)).toEqual({ kind: 'walk', gps: true, steps: true });
  });

  it('reads a meal another screen asked for', () => {
    expect(mealFromSearch(new URLSearchParams('meal=dinner'))).toBe('dinner');
    expect(mealFromSearch(new URLSearchParams('meal=feast'))).toBeUndefined();
  });

  it('says when the meal started in words', () => {
    expect(MEAL_STARTED_AGO.map(mealStartedLabel)).toEqual([
      'Just now', '10 minutes ago', '20 minutes ago', '30 minutes ago', '45 minutes ago', '1 hour ago', '1½ hours ago', '2 hours ago',
    ]);
  });
});

describe('walk ids', () => {
  it('are well formed and do not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newWalkId(NOW)));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isWalkId(id)).toBe(true);
  });
});

describe('remembered measuring choices', () => {
  it('remembers only a real change', () => {
    expect(choiceChanged(undefined, { gps: false, steps: false })).toBe(false);
    expect(choiceChanged(undefined, { gps: true, steps: false })).toBe(true);
    expect(choiceChanged({ gps: true, steps: true }, { gps: true, steps: true })).toBe(false);
    expect(choiceChanged({ gps: true, steps: true }, { gps: true, steps: false })).toBe(true);
    expect(choiceChanged({ gps: false, steps: true }, { gps: true, steps: true })).toBe(true);
  });
});

describe('directWalkHref: a walk started from Home’s card (journey §7.4, K-32, codex V1-07)', () => {
  const NOW2 = Date.parse('2026-10-08T13:40:00+05:30');
  const MEAL = Date.parse('2026-10-08T13:30:00+05:30');
  it('after the meal the person stated, measuring what they chose last time', () => {
    const href = directWalkHref({ meal: 'lunch', mealStartedAt: MEAL }, NOW2, { gps: false, steps: true });
    const walk = walkFromSearch(new URL(href, 'https://app.test').searchParams, NOW2);
    expect(new URL(href, 'https://app.test').pathname).toBe('/walk/live');
    // B-09: the time the person said they had the meal, never "started" (Plan 6 Task 8).
    expect(walk?.plan).toEqual({ kind: 'afterMeal', meal: { which: 'lunch', startedAt: MEAL, basis: 'had' }, gps: false, steps: true });
    expect(isWalkId(walk?.id)).toBe(true);
  });
  it('"Just a walk", with nothing measured unless chosen', () => {
    const href = directWalkHref({}, NOW2, { gps: false, steps: false });
    expect(walkFromSearch(new URL(href, 'https://app.test').searchParams, NOW2)?.plan).toEqual({ kind: 'walk', gps: false, steps: false });
  });
});

describe('afterMealSuggestion: what B-09’s button says, and the meal time it records', () => {
  const at = (h: number, m: number, d = 8) => new Date(2026, 9, d, h, m).getTime();

  it('the usual finish time, once it has passed and within two hours', () => {
    expect(afterMealSuggestion({ meal: 'lunch', finish: '13:10', now: at(13, 40), hour12: true }))
      .toEqual({ at: at(13, 10), title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' });
  });

  it('now, while the usual time is still to come (Review Focus 5)', () => {
    expect(afterMealSuggestion({ meal: 'lunch', finish: '13:10', now: at(12, 50), hour12: true }).at).toBe(at(12, 50));
  });

  it('now, when the usual time was more than two hours ago', () => {
    expect(afterMealSuggestion({ meal: 'lunch', finish: '13:10', now: at(19, 0), hour12: true }).label).toBe('I had lunch at 7:00 pm: walk now');
  });

  it('last night’s dinner just after midnight, never a time still to come (Review Focus 5)', () => {
    const s = afterMealSuggestion({ meal: 'dinner', finish: '22:30', now: at(0, 20, 9), hour12: true });
    expect(s.at).toBe(at(22, 30, 8));
    expect(s.label).toBe('I had dinner at 10:30 pm: walk now');
  });

  it('now, with no usual time or one that isn’t a time, on a 24-hour clock too', () => {
    expect(afterMealSuggestion({ meal: 'breakfast', now: at(8, 40), hour12: false }).label).toBe('I had breakfast at 08:40: walk now');
    expect(afterMealSuggestion({ meal: 'breakfast', finish: '8.30', now: at(8, 40), hour12: false }).at).toBe(at(8, 40));
  });

  it('whole minutes since the meal, never negative', () => {
    expect(mealMinutesAgo(at(13, 10), at(13, 40))).toBe(30);
    expect(mealMinutesAgo(at(13, 41), at(13, 40))).toBe(0);
  });
});

describe('walkFirst: a walk asked for from Home while another is still on this device (codex W-04)', () => {
  const at = (h: number, m: number, d = 8) => new Date(2026, 9, d, h, m).getTime();
  const NOW3 = at(13, 40);

  it('with none, the new walk starts as asked', () => {
    expect(walkFirst(null, { meal: 'lunch' }, NOW3, true)).toBeUndefined();
  });

  it('a finished walk not saved yet is reviewed and saved first, at its own summary, and only then the walk after the meal', () => {
    expect(walkFirst({ state: 'unsaved', startedAt: at(12, 40), href: '/walk/summary' }, { meal: 'lunch' }, NOW3, true)).toEqual({
      title: 'Your last walk isn’t saved',
      detail: 'The walk you started at 12:40 pm has finished, and isn’t saved yet. Save it, or discard it, then start your walk after lunch.',
      action: { label: 'Review and save your last walk', to: '/walk/summary' },
    });
  });

  it('an unfinished walk is carried on first, on its own live screen', () => {
    expect(walkFirst({ state: 'inProgress', startedAt: at(12, 40), href: '/walk/live' }, { meal: 'dinner' }, NOW3, true)).toEqual({
      title: 'A walk is still going',
      detail: 'The walk you started at 12:40 pm hasn’t been finished. Carry on with it, and finish it, before you start your walk after dinner.',
      action: { label: 'Carry on your walk', to: '/walk/live' },
    });
  });

  it('"Just a walk" is a new walk; a walk from another day is named by its day, on the device’s clock', () => {
    const first = walkFirst({ state: 'unsaved', startedAt: at(18, 5, 6), href: '/walk/summary' }, {}, NOW3, false);
    expect(first?.detail).toBe('The walk you started on Tuesday at 18:05 has finished, and isn’t saved yet. Save it, or discard it, then start a new walk.');
  });
});

describe('keeping the route (§9.1)', () => {
  it('travels in the live walk’s address, and only with GPS', () => {
    const href = liveHref('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute: true });
    expect(href).toContain('route=1');
    const back = walkFromSearch(new URLSearchParams(href.split('?')[1]), Date.now());
    expect(back?.plan.keepRoute).toBe(true);
    expect(walkFromSearch(new URLSearchParams('id=mgh3k2x1-1a2b3c4d&route=1'), Date.now())?.plan.keepRoute).toBeUndefined();
    expect(liveHref('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false })).not.toContain('route=');
  });
});

describe('the plan in the address (B-01, B-09, M12)', () => {
  it('carries a refused motion, the origin and an after-meal time the person stated', () => {
    const plan = { kind: 'afterMeal' as const, meal: { which: 'lunch' as const, startedAt: Date.now() - 600_000, basis: 'had' as const }, gps: false, steps: false, stepsDenied: true, from: '/hub/walk' as const };
    const back = walkPlanOf(liveHref('mgh3k2x1-1a2b3c4d', plan));
    expect(back).toMatchObject({ stepsDenied: true, steps: false, from: '/hub/walk', meal: { which: 'lunch', basis: 'had' } });
    const home = walkPlanOf(liveHref('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: true, from: '/home' }));
    expect(home).toMatchObject({ steps: true, from: '/home' });
    expect(home?.stepsDenied).toBeUndefined();
  });

  it('finds a plan only in a live walk’s address', () => {
    expect(walkPlanOf('/hub/walk?meal=lunch')).toBeUndefined();
    expect(walkPlanOf('/hub/walk?id=mgh3k2x1-1a2b3c4d&gps=1')).toBeUndefined();
    expect(originOf('/hub/walk')).toBe('/hub/walk');
    expect(originOf('/hub/stretch')).toBe('/home');
    expect(originOf('/home')).toBe('/home');
    expect(originOf('/browse')).toBe('/home');
  });

  it('reads no origin or basis it does not know', () => {
    const p = walkPlanOf('/walk/live?id=mgh3k2x1-1a2b3c4d&from=elsewhere&meal=lunch&mealAt=' + (Date.now() - 60_000) + '&mealBasis=ate');
    expect(p?.from).toBeUndefined();
    expect(p?.meal?.basis).toBeUndefined();
  });
});

describe('B-09’s walk: a meal time the person stated', () => {
  it('marks a meal time the person stated as "had" (B-09), and a "Started" choice as the start', () => {
    const now = Date.now();
    expect(setupPlan({ kind: 'afterMeal', meal: 'lunch', mealAgo: 30, mealBasis: 'had', gps: false, steps: false }, now)?.meal).toEqual({ which: 'lunch', startedAt: now - 1_800_000, basis: 'had' });
    expect(setupPlan({ kind: 'afterMeal', meal: 'lunch', mealAgo: 20, gps: false, steps: false }, now)?.meal).toEqual({ which: 'lunch', startedAt: now - 1_200_000 });
  });

  it('marks Home’s after-meal walk as "had at" (B-09)', () => {
    expect(walkPlanOf(directWalkHref({ meal: 'lunch', mealStartedAt: Date.now() - 1_800_000 }, Date.now(), { gps: false, steps: false }))?.meal?.basis).toBe('had');
  });
});
