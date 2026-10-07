import { describe, it, expect } from 'vitest';
import type { DayOfWeek } from '@/types';
import { weekFocus, slotsFor, WEEK, isHeavyFocus, mobilityDayType } from './templates';
import { getMeta } from '@/data/catalog';
import type { DayFocus } from '@/types/plan';

const focusFor = (days: DayOfWeek[]) => weekFocus({ trainingDays: days });

function heavyBackToBack(map: Record<DayOfWeek, DayFocus>): boolean {
  return WEEK.some((d, i) => isHeavyFocus(map[d]) && isHeavyFocus(map[WEEK[(i + 1) % 7]]));
}

describe('weekFocus', () => {
  it('maps the default Monday–Saturday week to Upper/Lower ×3', () => {
    expect(focusFor(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])).toEqual({
      monday: 'lowerA', tuesday: 'upperA', wednesday: 'lowerB', thursday: 'upperB',
      friday: 'lowerC', saturday: 'upperC', sunday: 'rest',
    });
  });

  it('uses Upper / Lower / Push / Pull / Legs for five days', () => {
    const m = focusFor(['monday', 'tuesday', 'thursday', 'friday', 'saturday']);
    expect([m.monday, m.tuesday, m.thursday, m.friday, m.saturday]).toEqual(['upper', 'lower', 'push', 'pull', 'legs']);
    expect(m.wednesday).toBe('rest');
  });

  it('uses Upper/Lower ×2 for four days and full body for three or fewer', () => {
    expect(Object.values(focusFor(['monday', 'tuesday', 'thursday', 'friday']))).toEqual(
      expect.arrayContaining(['upperA', 'lowerA', 'upperB', 'lowerC']),
    );
    expect(focusFor(['monday', 'wednesday', 'friday'])).toMatchObject({ monday: 'fullA', wednesday: 'fullB', friday: 'fullC' });
    expect(focusFor(['tuesday'])).toMatchObject({ tuesday: 'fullA' });
  });

  it('turns a seventh day into active recovery', () => {
    const m = focusFor(WEEK);
    expect(Object.values(m)).toContain('activeRecovery');
    expect(Object.values(m).filter(f => f === 'rest')).toHaveLength(0);
  });

  it('returns an all-rest week when no days are picked', () => {
    expect(Object.values(focusFor([]))).toEqual(Array(7).fill('rest'));
  });

  it.each([
    [['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']],
    [['monday', 'tuesday', 'thursday', 'friday', 'saturday', 'sunday']],
    [['monday', 'tuesday', 'wednesday', 'thursday']],
    [['monday', 'tuesday', 'thursday', 'friday', 'saturday']],
    [['saturday', 'sunday']],
  ] as DayOfWeek[][][])('avoids heavy spinal days back to back for %o (Review Focus #4)', (days) => {
    const m = focusFor(days);
    // Two picked days that are both heavy by template can be unavoidable (e.g. Sat+Sun full-body).
    const heavyCount = WEEK.filter(d => isHeavyFocus(m[d])).length;
    const lightCount = WEEK.filter(d => !isHeavyFocus(m[d]) && m[d] !== 'rest').length;
    if (lightCount > 0 || heavyCount < 2) expect(heavyBackToBack(m)).toBe(false);
  });
});

describe('slots', () => {
  const focuses: DayFocus[] = ['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC', 'upper', 'lower', 'push', 'pull', 'legs', 'fullA', 'fullB', 'fullC'];

  it('lists only existing catalogue ids as candidates', () => {
    const missing = focuses.flatMap(f => slotsFor(f).flatMap(s => s.candidates)).filter(id => !getMeta(id));
    expect(missing).toEqual([]);
  });

  it('never offers retired exercises or the loaded-flexion core moves', () => {
    const ids = new Set(focuses.flatMap(f => slotsFor(f).flatMap(s => s.candidates)));
    for (const id of ['russian-twist', 'cable-crunch', 'hanging-knee-raise', 'face-pulls-shoulder']) expect(ids.has(id)).toBe(false);
  });

  it('pairs slots two by two', () => {
    for (const f of focuses) {
      const pairs = new Map<string, number>();
      for (const s of slotsFor(f)) if (s.pair) pairs.set(s.pair, (pairs.get(s.pair) ?? 0) + 1);
      for (const [pair, n] of pairs) expect(n, `${f} ${pair}`).toBe(2);
    }
  });

  it('has a mobility template for every focus', () => {
    for (const f of [...focuses, 'rest', 'activeRecovery'] as DayFocus[]) expect(mobilityDayType(f)).toBeTruthy();
  });
});
