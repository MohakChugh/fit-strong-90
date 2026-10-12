/**
 * Every collection a file can hold, through the preview and the merge a
 * restore really makes (B-26, P8-18): what "In this file" lists, what
 * "Records that differ" names, and what each choice keeps.
 */
import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import type { StoredRecord } from '@/store/records';
import { emptySnapshot, prepare, type Snapshot } from '@/store/snapshot';
import { planImport, previewImport, toTransferDoc } from '@/store/transfer';
import { routeRecord } from '@/walk/routeRecord';
import { conflictLines, previewLines } from './summaries';

const AT = '2026-10-01T09:00:00.000+05:30';
const W = 'mgh3k2x1-1a2b3c4d';
const readiness = { outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [] };
const quick = (name: string) => ({ kind: 'quick', size: 'normal', name });

/** One record in every collection, each saying `word`, all stated at the same moment. */
function saying(word: 'here' | 'file', lat: number): Snapshot {
  const route = routeRecord(W, AT, [{ start: 0, end: 20_000, coords: [[lat, 77.59], [lat + 0.001, 77.5905]], ms: [0, 20_000] }]) as unknown as StoredRecord;
  const here = word === 'here';
  return {
    ...emptySnapshot(),
    settings: { walk: { saveRoutes: true, map: 'off' } } as Snapshot['settings'],
    observations: [newObservation({ id: 'water-1', kind: 'water', value: here ? 500 : 750, scope: 'dayTotal', source: 'manual', at: AT })],
    sessions: [{ id: 's1', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: null, completedAt: null, notes: word, totalVolume: 0 }] as unknown as Snapshot['sessions'],
    checkIns: [{ date: '2026-10-01', urgentSymptoms: false, news: [], sleep: here ? 'gt7' : '5to7', energy: 4, readiness }] as unknown as Snapshot['checkIns'],
    bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: here ? 96 : 97, notes: '' }] as Snapshot['bodyMetrics'],
    personalRecords: [{ exerciseId: 'goblet-squat', weight: here ? 20 : 24, reps: 8, date: '2026-10-01', volume: here ? 160 : 192 }] as Snapshot['personalRecords'],
    focusOverrides: { '2026-10-02': here ? 'legs' : 'back' } as unknown as Snapshot['focusOverrides'],
    content: { 'guide:read:walking': { readAt: AT, word } },
    records: {
      routes: [route],
      meals: [{ id: 'meal-1', at: AT, day: '2026-10-01', meal: 'lunch', items: [quick(`${word} plate`)], level: 'meals', loggedAt: AT, edits: [] }],
      savedMeals: [{ id: 'usual-1', name: `${word} lunch`, items: [quick('Normal plate')], savedAt: AT, updatedAt: AT }],
      customFoods: [{ id: 'food-1', name: `${word} bhel`, per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT }],
    },
  };
}

const here = saying('here', 12.97);
const file = toTransferDoc(saying('file', 12.98), AT, { include: ['routes'] });
const COLLECTIONS = ['observations', 'sessions', 'checkIns', 'bodyMetrics', 'focusOverrides', 'contentState', 'routes', 'meals', 'savedMeals', 'customFoods'] as const;

describe('every collection in a restore’s preview, through the real preview (B-26, P8-18)', () => {
  it('lists what the file holds, workout swaps and Learn progress included', () => {
    const preview = previewImport(file);
    if (!preview.ok) throw new Error(preview.reason);
    const added = ['Sessions', 'Check-ins', 'Body measurements', 'Personal records', 'Workout swaps', 'Learn progress entries', 'Walk routes', 'Meals', 'Usual meals', 'Own foods'];
    expect(previewLines(preview).filter(l => added.includes(l.label))).toEqual(added.map(label => ({ label, count: 1 })));
  });

  it('counts one conflict in each collection that can differ, and none in personal records, which keep the heavier lift', () => {
    const preview = previewImport(file, here);
    if (!preview.ok) throw new Error(preview.reason);
    for (const c of COLLECTIONS) expect(preview.conflicts?.[c], c).toBe(1);
    expect(preview.conflicts?.personalRecords).toBe(0);
    expect(conflictLines(preview).map(l => l.label)).toEqual([
      'Readings', 'Sessions', 'Check-ins', 'Body measurements', 'Workout swaps', 'Learn progress entries', 'Walk routes', 'Meals', 'Usual meals', 'Own foods',
    ]);
  });

  it('keeps this device’s copy of each with keepDevice, and the file’s with takeFile', () => {
    const keep = prepare(here, planImport(file, 'merge', here, { onConflict: 'keepDevice' }).change).next;
    const take = prepare(here, planImport(file, 'merge', here, { onConflict: 'takeFile' }).change).next;
    const said = (s: Snapshot) => [
      s.observations.find(o => o.id === 'water-1')?.value,
      s.sessions[0]?.notes,
      (s.checkIns[0] as unknown as { sleep: string }).sleep,
      s.bodyMetrics[0]?.waist,
      (s.focusOverrides as Record<string, string>)['2026-10-02'],
      (s.content['guide:read:walking'] as { word: string }).word,
      (s.records.routes[0] as unknown as { segments: { coords: number[][] }[] }).segments[0].coords[0][0],
      (s.records.meals[0] as unknown as { items: { name: string }[] }).items[0].name,
      (s.records.savedMeals[0] as unknown as { name: string }).name,
      (s.records.customFoods[0] as unknown as { name: string }).name,
    ];
    expect(said(keep)).toEqual([500, 'here', 'gt7', 96, 'legs', 'here', 12.97, 'here plate', 'here lunch', 'here bhel']);
    expect(said(take)).toEqual([750, 'file', '5to7', 97, 'back', 'file', 12.98, 'file plate', 'file lunch', 'file bhel']);
    // A personal record keeps the heavier lift, whichever is chosen.
    expect([keep, take].map(s => s.personalRecords[0]?.weight)).toEqual([24, 24]);
  });
});
