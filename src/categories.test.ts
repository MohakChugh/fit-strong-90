import { describe, expect, it } from 'vitest';
import { CATEGORIES, GROUPS, arrange, categoryById, defaultHome, isHomeLayout, type Category, type Shortcut } from './categories';
import type { HomeLayout } from '@/types';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { UserProfile } from '@/types/profile';
import type { UserSettings } from '@/types';

const settings = {} as UserSettings;
const withHealth = (health: Partial<UserProfile['health']>, extra: ProfileInput = {}): UserProfile =>
  createDefaultProfile({ ...extra, health });
const waterOn = { water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' } };

describe('category registry', () => {
  it('has each id once, in a known group, with a hub path and a title', () => {
    const ids = CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIES) {
      expect(GROUPS.map(g => g.id)).toContain(c.group);
      expect(c.hub).toBe(`/hub/${c.id}`);
      expect(c.title.length).toBeGreaterThan(0);
    }
  });
  it('gives movement modes only to Workout, Stretch and Walk', () => {
    expect(CATEGORIES.filter(c => c.mode).map(c => [c.id, c.mode])).toEqual([['workout', 'guided'], ['stretch', 'stretch'], ['walk', 'walk']]);
  });
  it('finds a category by id', () => {
    expect(categoryById('bp').title).toBe('Blood pressure');
  });
});

describe('defaultHome (journey §5.1)', () => {
  it('a person with no conditions: Move three, Food, then the fill-ins up to 9 total, never more than 5 per group', () => {
    const home = defaultHome({ profile: withHealth({}), settings, hasSteps: false });
    expect(home.order.move).toEqual(['workout', 'stretch', 'walk']);
    expect(home.order.eat).toEqual(['food']);
    expect(home.order.check).toEqual(['weight', 'sleep']);
    expect(home.order.learn).toEqual(['learn']);
    expect(home.hidden).toEqual([]);
  });
  it('diabetes, treated BP and back pain (P01-like): Glucose, Blood pressure and Back & leg in Check', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated' }, { pain: { areas: ['lowerBack', 'sciatica'] } });
    const home = defaultHome({ profile: p, settings, hasSteps: false });
    expect(home.order.check.slice(0, 3)).toEqual(['glucose', 'bp', 'back']);
  });
  it('an active foot wound leaves Walk off Home (it would only ever say "No walking for now")', () => {
    const home = defaultHome({ profile: withHealth({ footStatus: 'current_wound_or_active_charcot' }), settings, hasSteps: false });
    expect(home.order.move).toEqual(['workout', 'stretch']);
  });
  it('Steps appears once a step goal is set or steps were ever recorded', () => {
    expect(defaultHome({ profile: withHealth({}), settings: { dailyStepsGoal: 6000 } as UserSettings, hasSteps: false }).order.move).toContain('steps');
    expect(defaultHome({ profile: withHealth({}), settings, hasSteps: true }).order.move).toContain('steps');
  });
  it('Steps stays off too while walking is held for the feet, even with a step goal and steps recorded (L-09)', () => {
    const home = defaultHome({ profile: withHealth({ footStatus: 'current_wound_or_active_charcot' }), settings: { dailyStepsGoal: 6000 } as UserSettings, hasSteps: true });
    expect(home.order.move).toEqual(['workout', 'stretch']);
    expect(home.hidden).toEqual([]);
  });
  it('Water appears when the water habit is on', () => {
    const s = { habits: waterOn } as UserSettings;
    expect(defaultHome({ profile: withHealth({}), settings: s, hasSteps: false }).order.check).toContain('water');
  });
  it('Back & leg is for back pain or sciatica, not for any pain (A-38)', () => {
    const check = (areas: UserProfile['pain']['areas']) =>
      defaultHome({ profile: withHealth({}, { pain: { areas } }), settings, hasSteps: false }).order.check;
    expect(check(['sciatica'])).toContain('back');
    expect(check(['knee', 'shoulder'])).not.toContain('back');
  });
  it('never more than 9 tiles, and never more than 5 in a group', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated', bpMonitor: true }, { pain: { areas: ['lowerBack'] } });
    const s = { dailyStepsGoal: 5000, habits: waterOn } as UserSettings;
    const home = defaultHome({ profile: p, settings: s, hasSteps: true });
    const all = Object.values(home.order).flat();
    expect(all.length).toBeLessThanOrEqual(9);
    for (const g of Object.values(home.order)) expect(g.length).toBeLessThanOrEqual(5);
  });
  it('when the "when" rules alone give more than 9, Labs is dropped first and listed under Hidden; no fill-ins, so Learn is empty', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated' }, { pain: { areas: ['lowerBack'] } });
    const s = { dailyStepsGoal: 5000, habits: waterOn } as UserSettings;
    const home = defaultHome({ profile: p, settings: s, hasSteps: true });
    expect(home.order).toEqual({
      move: ['workout', 'stretch', 'walk', 'steps'],
      eat: ['food'],
      check: ['glucose', 'bp', 'back', 'water'],
      learn: [],
    });
    expect(home.hidden).toEqual(['labs']);
  });
  it('a fill-in never pushes a group past 5: a full Check skips Weight and Sleep, and Learn takes the ninth place', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated', footStatus: 'current_wound_or_active_charcot' }, { pain: { areas: ['lowerBack'] } });
    const home = defaultHome({ profile: p, settings: { habits: waterOn } as UserSettings, hasSteps: false });
    expect(home.order).toEqual({
      move: ['workout', 'stretch'],
      eat: ['food'],
      check: ['glucose', 'bp', 'back', 'water', 'labs'],
      learn: ['learn'],
    });
    expect(home.hidden).toEqual([]);
  });
});

describe('arrange: tiles into their groups (journey §5.1, B-08)', () => {
  it('sends a wanted tile the group cap refuses to Hidden, so Edit Home still offers it (kiro KV-23)', () => {
    const home = arrange(['glucose', 'bp', 'back', 'water', 'labs', 'waist']);
    expect(home.order.check).toEqual(['glucose', 'bp', 'back', 'water', 'labs']);
    expect(home.hidden).toEqual(['waist']);
    expect(isHomeLayout(home)).toBe(true);
  });
  it('sends a wanted tile past 9 to Hidden too, after the ones already dropped', () => {
    const home = arrange(['workout', 'stretch', 'walk', 'steps', 'food', 'glucose', 'bp', 'back', 'water', 'waist'], ['labs']);
    expect(Object.values(home.order).flat()).toHaveLength(9);
    expect(home.hidden).toEqual(['labs', 'waist']);
    expect(isHomeLayout(home)).toBe(true);
  });
  it('never sends a fill-in to Hidden: one that does not fit is simply not added', () => {
    const home = arrange(['glucose', 'bp', 'back', 'water', 'labs']);
    expect(home.order.check).toEqual(['glucose', 'bp', 'back', 'water', 'labs']);
    expect(home.order.learn).toEqual(['learn']);
    expect(home.hidden).toEqual([]);
  });
});

describe('categories and shortcuts (B-14)', () => {
  it('a category declares its trend at its own address, and Learn declares none (kiro KV-06)', () => {
    for (const c of CATEGORIES) expect(c.trend, c.id).toBe(c.id === 'learn' ? undefined : `/trends/${c.id}`);
    // Each trend is one category's.
    const trends = CATEGORIES.flatMap(c => (c.trend ? [c.trend] : []));
    expect(new Set(trends).size).toBe(trends.length);
  });
  it('Water belongs only to Check', () => {
    expect(CATEGORIES.filter(c => c.id === 'water').map(c => c.group)).toEqual(['check']);
  });
  it('a shortcut has only a target: no hub, trend or group, so it can never be pinned as a tile', () => {
    const shortcut: Shortcut = { id: 'log-workout', title: 'Log a workout', to: '/hub/workout/log' };
    // @ts-expect-error a shortcut is not a category
    const asCategory: Category = shortcut;
    expect(asCategory).toBe(shortcut);
    expect(Object.keys(shortcut).sort()).toEqual(['id', 'title', 'to']);
  });
});

describe('isHomeLayout: a stored or imported layout this build can draw', () => {
  const L: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['glucose', 'water', 'sleep'], learn: ['learn'] }, hidden: [] };
  it('accepts a layout the operations make', () => {
    expect(isHomeLayout(L)).toBe(true);
    expect(isHomeLayout({ ...L, order: { ...L.order, check: ['glucose', 'sleep'] }, hidden: ['water'] })).toBe(true);
    expect(isHomeLayout(defaultHome({ profile: withHealth({ diabetes: 'type2' }), settings, hasSteps: true }))).toBe(true);
  });
  it('refuses an unknown category, one in the wrong group, one twice, or a group over 5', () => {
    expect(isHomeLayout({ ...L, order: { ...L.order, check: ['glucose', 'mood'] } })).toBe(false);
    expect(isHomeLayout({ ...L, order: { ...L.order, eat: ['walk'] } })).toBe(false);
    expect(isHomeLayout({ ...L, order: { ...L.order, move: ['walk', 'walk'] } })).toBe(false);
    expect(isHomeLayout({ ...L, hidden: ['walk'] })).toBe(false);
    expect(isHomeLayout({ ...L, order: { ...L.order, check: ['glucose', 'bp', 'back', 'weight', 'water', 'sleep'] } })).toBe(false);
  });
  it('refuses anything that is not a layout', () => {
    for (const x of [null, 'home', [], { order: {} }, { order: L.order }, { ...L, hidden: 'none' }]) expect(isHomeLayout(x)).toBe(false);
  });
});
