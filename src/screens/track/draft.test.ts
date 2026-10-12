import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, clearQuickLogDraft, draftSaved, keptDraft, loadQuickLogDraft, storeQuickLogDraft, type QuickLogDraft } from './draft';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('a Quick Log draft that was not saved (acceptance J17)', () => {
  const glucose: QuickLogDraft = { kind: 'glucose', id: 'g-1', raw: '111', unit: 'mg/dL', time: '2026-10-08T08:50', at: '2026-10-08T08:50:00.000+05:30', tag: 'fasting', refused: true };
  const pair: QuickLogDraft = {
    kind: 'bloodPressure', stem: 'reading-x', s1: '130', d1: '80', second: true, s2: '132', d2: '82',
    firstEntered: '2026-10-08T07:42:30.000+05:30', at: '2026-10-08T07:43:40.000+05:30', tag: 'morning',
  };

  it('comes back exactly as it was kept, until it is cleared', () => {
    const s = memory();
    expect(storeQuickLogDraft(s, glucose)).toBe(true);
    expect(loadQuickLogDraft(s)).toEqual(glucose);
    clearQuickLogDraft(s);
    expect(loadQuickLogDraft(s)).toBeUndefined();
  });

  it('keeps a blood-pressure pair with each reading’s own moment', () => {
    const s = memory();
    storeQuickLogDraft(s, pair);
    expect(loadQuickLogDraft(s)).toEqual(pair);
  });

  it('drops anything it cannot trust rather than guessing at it', () => {
    const s = memory();
    const bad = [
      '{"kind":"glucose","raw":"111"}',
      'not json',
      JSON.stringify({ ...glucose, unit: 'mmol' }),
      JSON.stringify({ ...glucose, time: '8:50' }),
      JSON.stringify({ ...glucose, at: 'yesterday' }),
      JSON.stringify({ ...glucose, tag: 'morning' }),
      JSON.stringify({ ...glucose, raw: '1'.repeat(40) }),
      JSON.stringify({ ...pair, second: 'yes' }),
      JSON.stringify({ ...glucose, refused: false }),
      JSON.stringify({ ...pair, tag: 'fasting' }),
      JSON.stringify({ ...glucose, kind: 'weight' }),
    ];
    for (const value of bad) {
      s.setItem(DRAFT_KEY, value);
      expect(loadQuickLogDraft(s), value).toBeUndefined();
    }
    expect(loadQuickLogDraft(undefined)).toBeUndefined();
  });

  it('brings back only the fields a form holds', () => {
    const s = memory();
    s.setItem(DRAFT_KEY, JSON.stringify({ ...glucose, extra: '<script>' }));
    expect(loadQuickLogDraft(s)).toEqual(glucose);
  });

  it('says so when the browser will not keep it', () => {
    const refusing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(storeQuickLogDraft(refusing, glucose)).toBe(false);
    expect(storeQuickLogDraft(undefined, glucose)).toBe(false);
  });

  it('knows a draft whose reading is stored already, by its fixed id', () => {
    expect(draftSaved(glucose, [{ id: 'g-1' }])).toBe(true);
    expect(draftSaved(glucose, [{ id: 'g-2' }])).toBe(false);
    expect(draftSaved(pair, [{ id: 'reading-x-a:bloodPressureSystolic' }])).toBe(true);
    expect(draftSaved(pair, [{ id: 'reading-xy-a:bloodPressureSystolic' }])).toBe(false);
  });
});

describe('the draft a form starts from', () => {
  const glucose: QuickLogDraft = { kind: 'glucose', id: 'g-1', raw: '111', unit: 'mg/dL' };

  it('is the kept one of its own kind', () => {
    const s = memory();
    storeQuickLogDraft(s, glucose);
    expect(keptDraft('glucose', [], s)).toEqual(glucose);
    expect(keptDraft('bloodPressure', [], s)).toBeUndefined();
    // A form of another kind leaves it where it is.
    expect(loadQuickLogDraft(s)).toEqual(glucose);
  });

  it('is nothing, and forgotten, once its reading is stored', () => {
    const s = memory();
    storeQuickLogDraft(s, glucose);
    expect(keptDraft('glucose', [{ id: 'g-1' }], s)).toBeUndefined();
    expect(s.m.has(DRAFT_KEY)).toBe(false);
  });
});
