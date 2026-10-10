import { describe, expect, it } from 'vitest';
import type { Recommendation } from '@/health/recommend';
import { CATEGORIES } from '@/categories';
import type { DueItem } from '@/health/cadence';
import { dueWords, greeting, normalLine, readingLine, tileColumns, tileHref } from './model';

const at = (time: string) => new Date(`2026-10-08T${time}:00`);
const suggests = (over: Partial<Recommendation> & { mode?: Recommendation['action']['mode'] }): Recommendation => ({
  kind: 'preference', title: 'A morning stretch', detail: '', reason: '',
  action: { label: 'Stretch now', to: '/hub/stretch', ...(over.mode ? { mode: over.mode } : {}) }, ...over,
});
const plan = { label: 'Full Body B', totalSeconds: 45 * 60 };

describe('greeting (journey §7.1)', () => {
  it('follows the app’s parts of the day, the small hours being the evening before', () => {
    expect(greeting(at('04:00'))).toBe('Good morning');
    expect(greeting(at('11:59'))).toBe('Good morning');
    expect(greeting(at('12:00'))).toBe('Good afternoon');
    expect(greeting(at('17:00'))).toBe('Good evening');
    expect(greeting(at('02:00'))).toBe('Good evening');
  });
  it('adds the person’s name when there is one', () => {
    expect(greeting(at('18:30'), 'Asha')).toBe('Good evening, Asha');
    expect(greeting(at('18:30'), '  ')).toBe('Good evening');
    expect(greeting(at('18:30'))).toBe('Good evening');
  });
});

describe('tileColumns (journey §7.1, K-26, A-59)', () => {
  it('takes two columns at 375 px and wider with text at 130% or less', () => {
    expect(tileColumns({ width: 375, scale: 1 })).toBe(2);
    expect(tileColumns({ width: 428, scale: 20.8 / 16 })).toBe(2);
  });
  it('takes one column below 375 px, or above 130% text', () => {
    expect(tileColumns({ width: 374, scale: 1 })).toBe(1);
    expect(tileColumns({ width: 320, scale: 1 })).toBe(1);
    expect(tileColumns({ width: 428, scale: 1.31 })).toBe(1);
    expect(tileColumns({ width: 428, scale: 2 })).toBe(1);
  });
  it('flows into 3 columns from 1024 px and 4 from 1280 px on a desktop (journey §7.7)', () => {
    expect(tileColumns({ width: 1023, scale: 1 })).toBe(2);
    expect(tileColumns({ width: 1024, scale: 1 })).toBe(3);
    expect(tileColumns({ width: 1279, scale: 1.3 })).toBe(3);
    expect(tileColumns({ width: 1280, scale: 1 })).toBe(4);
    expect(tileColumns({ width: 1920, scale: 1 })).toBe(4);
  });
  it('keeps one column for large text at any width', () => {
    expect(tileColumns({ width: 1280, scale: 1.31 })).toBe(1);
    expect(tileColumns({ width: 1024, scale: 2 })).toBe(1);
  });
});

describe('dueWords: the caution dot with words (journey §7.2)', () => {
  const item = (kind: DueItem['kind']): DueItem => ({ kind, title: '', detail: '', source: '', action: { label: '', to: '' } });
  const normal = { status: 'normal' as const, stopped: false };
  it('marks the blood pressure tile on a check day, weekly or in the diagnostic week', () => {
    expect(dueWords('bp', { due: [item('bpCheckDay')], ...normal })).toBe('Check day');
    expect(dueWords('bp', { due: [item('hba1c'), item('bpWeek')], ...normal })).toBe('Check day');
  });
  it('marks nothing else: glucose has no recurring check without a clinician’s plan (cadence model)', () => {
    const due = [item('bpCheckDay'), item('hba1c'), item('b12'), item('hba1cFirst')];
    for (const id of ['glucose', 'labs', 'weight', 'walk'] as const) expect(dueWords(id, { due, ...normal })).toBeUndefined();
    expect(dueWords('bp', { due: [item('hba1c')], ...normal })).toBeUndefined();
    expect(dueWords('bp', { due: [], ...normal })).toBeUndefined();
  });
  it('asks nothing while Away or Unwell, or beside a stop, as the prompt row does (D25)', () => {
    const due = [item('bpCheckDay')];
    expect(dueWords('bp', { due, status: 'away', stopped: false })).toBeUndefined();
    expect(dueWords('bp', { due, status: 'unwell', stopped: false })).toBeUndefined();
    expect(dueWords('bp', { due, status: 'normal', stopped: true })).toBeUndefined();
    expect(dueWords('bp', { due, status: 'flare', stopped: false })).toBe('Check day');
  });
});

describe('normalLine', () => {
  it('reads like the Right now card when the card suggests the same mode', () => {
    expect(normalLine('stretch', { recommendation: suggests({ mode: 'stretch' }), enrolled: false, plan })).toBe('A morning stretch');
    expect(normalLine('walk', { recommendation: suggests({ kind: 'mealWalk', title: 'A walk after lunch', mode: 'walk' }), enrolled: false, plan })).toBe('A walk after lunch');
    expect(normalLine('guided', { recommendation: suggests({ kind: 'resume', title: 'Continue your session', mode: 'guided' }), enrolled: true, plan })).toBe('Continue your session');
  });
  it('is the programme’s session, with its minutes, for Workout', () => {
    expect(normalLine('guided', { recommendation: suggests({ kind: 'scheduled', title: 'Full Body B', mode: 'guided' }), enrolled: true, plan })).toBe('Full Body B · 45 min');
    expect(normalLine('guided', { recommendation: suggests({ mode: 'stretch' }), enrolled: true, plan })).toBe('Full Body B · 45 min');
    expect(normalLine('guided', { recommendation: suggests({ mode: 'stretch' }), enrolled: false, plan })).toBe('12-week programme · not joined');
  });
  it('is a plain line otherwise, and never a stop’s words', () => {
    const stop = suggests({ kind: 'emergency', title: 'Call emergency services now' });
    expect(normalLine('stretch', { recommendation: stop, enrolled: false, plan })).toBe('10 or 15 min');
    expect(normalLine('walk', { recommendation: stop, enrolled: false, plan })).toBe('Just a walk');
    expect(normalLine('walk', { recommendation: suggests({ mode: 'stretch' }), enrolled: false, plan })).toBe('Just a walk');
  });
});

describe('readingLine (journey §7.2)', () => {
  const glucose = { value: '142 mg/dL', detail: '7:40 am · Manual entry' };
  it('shows today’s reading with when and where it was taken (A-12)', () => {
    expect(readingLine('glucose', { glucose })).toEqual({ text: '142 mg/dL', detail: 'Today · 7:40 am · Manual entry', tone: 'normal' });
    expect(readingLine('bp', { pressure: { value: '132/84 mmHg', detail: 'From your check-in' } })).toEqual({ text: '132/84 mmHg', detail: 'Today · From your check-in', tone: 'normal' });
  });
  it('says plainly when there is none today, never a zero (D14)', () => {
    expect(readingLine('glucose', {}).text).toBe('Not entered today');
    expect(readingLine('bp', { glucose }).text).toBe('Not entered today');
  });
  it('has fixed lines for Food and Learn, and invites a reading elsewhere until Plan 2', () => {
    expect(readingLine('food', {}).text).toBe('Meal ideas for you');
    expect(readingLine('learn', {}).text).toBe('For you');
    for (const id of ['steps', 'back', 'weight', 'water', 'sleep', 'waist', 'labs'] as const) expect(readingLine(id, { glucose }).text).toBe('Add a reading');
  });
});

describe('tileHref', () => {
  it('opens each tile’s hub, and Glucose on every reading so the one on the tile is listed (scan J2-08)', () => {
    for (const c of CATEGORIES) expect(tileHref(c)).toBe(c.id === 'glucose' ? '/hub/glucose?group=all' : c.hub);
  });
});

