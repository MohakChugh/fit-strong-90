import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from './format';
import { obs } from './fixtures';
import { countsForDay, deleteConsequence, editBlock, replacedBlock, rewritable } from './records';

describe('editBlock', () => {
  it('lets a person correct what they typed', () => {
    expect(editBlock(obs({ id: 'a' }))).toBeUndefined();
    expect(editBlock(obs({ id: 'w', kind: 'weight', unit: 'kg', value: 80 }))).toBeUndefined();
    expect(editBlock(obs({ id: 'c', context: 'checkIn:2026-10-08' }))).toBeUndefined();
  });

  it('keeps measured and imported records as they arrived', () => {
    expect(editBlock(obs({ id: 'm', source: 'measured' }))).toMatch(/kept as they arrived/);
    expect(editBlock(obs({ id: 'i', source: 'imported' }))).toMatch(/kept as they arrived/);
    expect(editBlock(obs({ id: 'k', kind: 'walkDistance', unit: 'km', scope: 'sessionObserved', coverageMs: 1, context: 'walk:w', source: 'manual' }))).toMatch(/walk/);
  });

  it('sends blood pressure to the reading, and lets a glucose with a timing be corrected (the store keeps it)', () => {
    expect(editBlock(obs({ id: 's', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 130 }))).toMatch(/reading itself/);
    expect(editBlock(obs({ id: 'g', tag: 'fasting' }))).toBeUndefined();
    expect(editBlock(obs({ id: 'g2', tag: 'afterMeal', mealStartedAt: '2026-10-08T06:00:00.000+05:30' }))).toBeUndefined();
  });

  it('lets a pain rating given after a walk be corrected, but not the walk’s own measurements', () => {
    expect(editBlock(obs({ id: 'p', kind: 'backPain', unit: '0-10', value: 3, context: 'walk:w' }))).toBeUndefined();
    expect(editBlock(obs({ id: 'gap', kind: 'walkDuration', unit: 'min', value: 3, scope: 'sessionObserved', coverageMs: 180_000, context: 'walk:w' }))).toMatch(/walk/);
  });
});

describe('rewritable', () => {
  const half = (reading: string, kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', id = `${reading}:${kind}`) =>
    obs({ id, kind, unit: 'mmHg', value: kind === 'bloodPressureSystolic' ? 130 : 85, context: `bp:${reading}` });

  it('is true for a reading putBloodPressure wrote, whatever its halves are called', () => {
    expect(rewritable({ id: 'reading-x', halves: [half('reading-x', 'bloodPressureSystolic'), half('reading-x', 'bloodPressureDiastolic')] })).toBe(true);
    // putBloodPressure keeps a corrected reading's older ids.
    expect(rewritable({ id: 'reading-x', halves: [half('reading-x', 'bloodPressureSystolic', 'old-1'), half('reading-x', 'bloodPressureDiastolic', 'old-2')] })).toBe(true);
  });

  it('is false for a check-in reading, a lone half, two of one half, or halves of different readings', () => {
    const day = 'checkIn:2026-10-01';
    expect(rewritable({ id: day, halves: [half(day, 'bloodPressureSystolic'), half(day, 'bloodPressureDiastolic')] })).toBe(false);
    expect(rewritable({ id: `${day}#1`, halves: [half(`${day}#1`, 'bloodPressureSystolic'), half(`${day}#1`, 'bloodPressureDiastolic')] })).toBe(false);
    expect(rewritable({ id: 'reading-x', halves: [half('reading-x', 'bloodPressureSystolic')] })).toBe(false);
    expect(rewritable({ id: 'reading-x', halves: [half('reading-x', 'bloodPressureSystolic'), half('reading-x', 'bloodPressureSystolic', 'dup')] })).toBe(false);
    expect(rewritable({ id: 'reading-x', halves: [half('reading-x', 'bloodPressureSystolic'), half('older', 'bloodPressureDiastolic')] })).toBe(false);
  });
});

describe('deleteConsequence', () => {
  const water = (id: string, value: number, at: string) => obs({ id, kind: 'water', unit: 'ml', scope: 'dayTotal', value, at });

  it('says the earlier total comes back when the latest is deleted', () => {
    const all = [water('a', 250, '2026-10-08T08:00:00.000+05:30'), water('b', 500, '2026-10-08T10:00:00.000+05:30')];
    expect(deleteConsequence(all[1], all, DEFAULT_PREFS)).toBe('The day’s water goes back to 250 ml, the entry before this one.');
  });

  it('says the day will be not entered when it was the only one', () => {
    const one = water('a', 250, '2026-10-08T08:00:00.000+05:30');
    expect(deleteConsequence(one, [one], DEFAULT_PREFS)).toMatch(/water as not entered/);
  });

  it('is plain for a reading', () => {
    const r = obs({ id: 'g' });
    expect(deleteConsequence(r, [r], DEFAULT_PREFS)).toMatch(/cannot be undone/);
  });
});

describe('replaced day-total entries', () => {
  const water = (id: string, value: number, at: string) => obs({ id, kind: 'water', unit: 'ml', scope: 'dayTotal', value, at });
  const all = [water('a', 250, '2026-10-08T08:00:00.000+05:30'), water('b', 1500, '2026-10-08T21:00:00.000+05:30')];

  it('knows which entry the day shows', () => {
    expect(countsForDay(all[1], all)).toBe(true);
    expect(countsForDay(all[0], all)).toBe(false);
    expect(countsForDay(obs({ id: 'g' }), all)).toBe(false);
  });

  it('will not correct an entry a later one replaced, since the correction would become the total', () => {
    expect(replacedBlock(all[0], all)).toMatch(/Correct the latest entry/);
    expect(replacedBlock(all[1], all)).toBeUndefined();
    expect(replacedBlock(obs({ id: 'g' }), all)).toBeUndefined();
  });

  it('says the total stays when a replaced entry is deleted', () => {
    expect(deleteConsequence(all[0], all, DEFAULT_PREFS)).toBe('The day’s water stays at 1,500 ml: a later entry already replaced this one.');
  });
});
