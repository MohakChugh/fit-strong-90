import { describe, expect, it } from 'vitest';
import { OBSERVATION_KINDS } from '@/health/observation';
import { METRICS } from '@/screens/track/metrics';
import { redirectFor } from './redirects';

describe('v1 → v2 redirects (journey §19.3)', () => {
  const cases: [string, string, string][] = [
    ['/today', '?checkin=walk', '/home?checkin=walk'],
    ['/move', '', '/hub/workout'],
    ['/move/stretch', '?area=back&minutes=10', '/hub/stretch?area=back&minutes=10'],
    ['/move/plan', '', '/hub/workout/plan'],
    ['/move/exercises', '', '/hub/workout/exercises'],
    ['/move/exercises/goblet-squat', '', '/hub/workout/exercises/goblet-squat'],
    ['/walk', '?meal=dinner', '/hub/walk?meal=dinner'],
    ['/track', '?day=2026-10-07', '/day/2026-10-07'],
    ['/track', '', '/day/today'],
    ['/track', '?view=trends', '/trends'],
    ['/track', '?add=glucose', '/day/today?add=glucose'],
    ['/track/metric/glucose', '?group=all', '/hub/glucose?group=all'],
    ['/track/metric/bloodPressure', '', '/hub/bp'],
    // Labs keeps its kind (B-14).
    ['/track/metric/hba1c', '', '/hub/labs?metric=hba1c'],
    ['/track/metric/b12', '?period=year', '/hub/labs?metric=b12&period=year'],
    ['/track/metric/vitaminD', '', '/hub/labs?metric=vitaminD'],
    ['/track/metric/vitd', '', '/hub/labs?metric=vitaminD'],
    ['/track/metric/steps', '', '/hub/steps'],
    // Movement is counted in Trends (L-17).
    ['/track/metric/movement', '', '/trends'],
    ['/track/metric/pain', '', '/hub/back'],
    ['/track/back', '', '/hub/back'],
    ['/track/workout', '', '/hub/workout/log'],
    ['/guide', '', '/hub/learn'],
    ['/guide/topic/sugar-checks', '', '/hub/learn/topic/sugar-checks'],
    ['/guide/card/plate', '', '/hub/learn/card/plate'],
    ['/guide/sources', '', '/hub/learn/sources'],
    ['/guide/meals', '', '/hub/food/ideas'],
    ['/guide/meals/week', '', '/hub/food/week'],
    ['/guide/meals/poha', '', '/hub/food/ideas/poha'],
    ['/you', '', '/me'],
    ['/you/appearance', '', '/me/display'],
    ['/you/habits', '', '/me/reminders'],
    ['/you/focus', '', '/me/profile?chapter=movement'],
    // Set up already (the only time these redirects run): Home, with the query, in one hop (codex V1-10).
    ['/welcome/health', '', '/home'],
    ['/welcome', '?goal=1', '/home?goal=1'],
    ['/dashboard', '?checkin=1', '/home?checkin=1'],
    ['/settings', '', '/me'],
    ['/workout', '', '/hub/workout/log'],
  ];
  for (const [path, search, to] of cases) it(`${path}${search} → ${to}`, () => expect(redirectFor(path, search)).toBe(to));

  it('keeps record details and tasks where they are', () => {
    for (const p of ['/track/reading/abc', '/track/pressure/x', '/track/walk/w1', '/track/session/s1', '/track/check-in/2026-10-08', '/track/workout/s1', '/session', '/walk/live', '/walk/summary', '/home', '/hub/walk', '/day/2026-10-08', '/trends', '/browse', '/me'])
      expect(redirectFor(p, '')).toBeUndefined();
  });

  it('sends an unknown address to Home with a notice (Review Focus 2)', () => {
    expect(redirectFor('/nowhere/at/all', '')).toBe('/home?moved=1');
    // A metric kind v1 never had is unknown too, not some other metric's hub (kiro KV-21).
    expect(redirectFor('/track/metric/nonsense', '')).toBe('/home?moved=1');
  });

  it('keeps the query on the way to Home, as every redirect does, beside the notice (codex W-06, K-17)', () => {
    expect(redirectFor('/track/metric/nonsense', '?choose=1')).toBe('/home?moved=1&choose=1');
    expect(redirectFor('/track/metric/constructor', '?period=week')).toBe('/home?moved=1&period=week');
    expect(redirectFor('/nowhere/at/all', '?checkin=walk')).toBe('/home?moved=1&checkin=walk');
    // The notice is Home's own: an address can't take it away.
    expect(redirectFor('/track/metric/nonsense', '?moved=0')).toBe('/home?moved=1');
  });

  it('sends v1’s setup addresses to setup while nothing is set up yet', () => {
    expect(redirectFor('/welcome', '?goal=1', { onboarded: false })).toBe('/setup?goal=1');
    expect(redirectFor('/welcome/keep', '', { onboarded: false })).toBe('/setup');
    expect(redirectFor('/onboarding', '', { onboarded: false })).toBe('/setup');
  });

  it('keeps the query on every redirect, beside a query of its own (K-17)', () => {
    // Quick Log opens the Workout Log on a past day this way.
    expect(redirectFor('/track/workout', '?date=2026-10-05')).toBe('/hub/workout/log?date=2026-10-05');
    expect(redirectFor('/workout', '?date=2026-10-05')).toBe('/hub/workout/log?date=2026-10-05');
    expect(redirectFor('/move/plan', '?from=today')).toBe('/hub/workout/plan?from=today');
    expect(redirectFor('/guide', '?q=dal')).toBe('/hub/learn?q=dal');
    expect(redirectFor('/you/focus', '?from=today')).toBe('/me/profile?chapter=movement&from=today');
    expect(redirectFor('/history', '?day=2026-10-01&add=steps')).toBe('/day/2026-10-01?add=steps');
    expect(redirectFor('/', '')).toBe('/home');
  });

  it('sends v1’s legacy list through its v1 target to that target’s v2 place, in one hop', () => {
    for (const [from, to] of [
      ['/plan', '/hub/workout/plan'], ['/library', '/hub/workout/exercises'], ['/progress', '/day/today'],
      ['/history', '/day/today'], ['/profile', '/me/profile'], ['/onboarding', '/home'],
    ]) expect(redirectFor(from, ''), from).toBe(to);
  });

  it('sends every v1 metric, and every stored kind a metric address may name, to its own place', () => {
    const to: Record<string, string> = {
      glucose: '/hub/glucose',
      bloodPressure: '/hub/bp', bloodPressureSystolic: '/hub/bp', bloodPressureDiastolic: '/hub/bp',
      backLeg: '/hub/back', backPain: '/hub/back', legPain: '/hub/back',
      weight: '/hub/weight', waist: '/hub/waist', water: '/hub/water', steps: '/hub/steps', sleep: '/hub/sleep',
      hba1c: '/hub/labs?metric=hba1c', b12: '/hub/labs?metric=b12', vitaminD: '/hub/labs?metric=vitaminD',
      walking: '/trends/walk', walkDuration: '/trends/walk', walkDistance: '/trends/walk', activeEnergy: '/trends/walk',
      movementMinutes: '/trends', mood: '/trends/mood',
    };
    // A kind added to v1 without a place here fails this, rather than landing on the fallback.
    expect([...new Set<string>([...Object.keys(METRICS), ...OBSERVATION_KINDS])].sort()).toEqual(Object.keys(to).sort());
    for (const [kind, place] of Object.entries(to)) expect(redirectFor(`/track/metric/${kind}`, ''), kind).toBe(place);
  });

  it('covers every route v1 declared (inventory from src/screens/*/routes.tsx)', () => {
    const files = import.meta.glob<string>('./screens/*/routes.tsx', { query: '?raw', import: 'default', eager: true });
    const bases: Record<string, string> = { today: '/today', move: '/move', walk: '/walk', track: '/track', guide: '/guide', you: '/you', welcome: '/welcome', workout: '/track/workout' };
    const read: string[] = [];
    for (const [file, source] of Object.entries(files)) {
      const area = file.split('/')[2];
      const base = bases[area];
      if (!base) continue;   // v2 areas (home, day, browse) aren't v1
      read.push(area);
      const paths = [...source.matchAll(/path="([^"*]+)"/g)].map(m => m[1]);
      for (const p of paths) {
        // A metric address needs a real kind: an unknown one is unknown (every kind is checked above).
        const full = `${base}/${p.replace(':kind', 'glucose').replace(/:[a-zA-Z]+/g, 'x')}`;
        const target = redirectFor(full, '');
        // Either kept as is (a record or task), or sent to a real v2 address, never to the unknown fallback.
        expect(target === undefined || !target.startsWith('/home?moved'), `${full} → ${target}`).toBe(true);
      }
    }
    // Every v1 area was read, so the inventory can't pass by finding nothing.
    expect(read.sort()).toEqual(Object.keys(bases).sort());
  });
});
