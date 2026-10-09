import { describe, expect, it } from 'vitest';
import { CATEGORIES, GROUPS, categoryById, defaultHome } from './categories';
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
