import { describe, expect, it } from 'vitest';
import { entryFor, summariseDay } from '@/health/aggregate';
import { newObservation, type Observation } from '@/health/observation';
import { routeRecord } from '@/walk/routeRecord';
import type { Records, RecordStore, StoredRecord } from './records';
import { emptySnapshot, prepare, type Change, type Snapshot } from './snapshot';
import { planImport, toTransferDoc } from './transfer';
import {
  NOT_RECENT, OWN_SCREEN, RECENT_CLOCK, RECENT_MS, canonical, expiryPlan, lineageIn, lineageKey, nextExpiry, planDeletion, planRestore,
  recentEntries, recentKey, recentWithoutRoutes, restorable, sessionEntry, staleKeys, withoutRecentCarrier, type DeleteRequest,
} from './recent';

const NOW = Date.parse('2026-10-08T09:00:00+05:30');
const AT = '2026-10-08T09:00:00.000+05:30';
const fresh = { stem: 'fresh1', walkId: 'mgh9zzzz-99999999' };
const apply = (base: Snapshot, change: Change) => prepare(base, change).next;
const holding = (observations: Observation[], records: Partial<Records> = {}) => apply(emptySnapshot(), {
  observations: { put: observations },
  records: Object.fromEntries(Object.entries(records).map(([store, rows]) => [store as RecordStore, { put: rows ?? [] }])),
});
const del = (base: Snapshot, request: DeleteRequest, entry = 'deleted-1', at = AT) => planDeletion(request, base, { entry, at });
const glucose = (id: string, value: number, at = '2026-10-08T08:00:00+05:30', context?: string) =>
  newObservation({ id, kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at, ...(context ? { context } : {}) });
const water = (id: string, value: number, at: string, editedAt?: string) =>
  ({ ...newObservation({ id, kind: 'water', value, scope: 'dayTotal', source: 'manual', at }), ...(editedAt ? { editedAt } : {}) });

const W = 'mgh3k2x1-1a2b3c4d';
const measured = (kind: 'walkDuration' | 'movementMinutes') =>
  newObservation({ id: `${W}:s0:${kind}`, kind, value: 20, scope: 'sessionObserved', source: 'measured', at: AT, coverageMs: 1_200_000, context: `walk:${W}` });
const walked = [measured('walkDuration'), measured('movementMinutes')];
const energy = newObservation({ id: `${W}:activeEnergy`, kind: 'activeEnergy', value: 85, scope: 'sessionObserved', source: 'measured', at: AT, coverageMs: 1_200_000, context: `walk:${W}` });
const pain = newObservation({ id: `${W}:backPain`, kind: 'backPain', value: 2, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:25:00+05:30', context: `walk:${W}` });
const route = routeRecord(W, AT, [{ start: NOW, end: NOW + 20_000, coords: [[12.97, 77.59], [12.971, 77.5905]], ms: [0, 20_000] }])! as unknown as StoredRecord;
const contexts = (s: Snapshot, kind: string) => s.observations.filter(o => o.kind === kind).map(o => o.context);

describe('a reading deleted, then restored (B-04, B-05, D110)', () => {
  it('goes at once, waits 7 days, and comes back under a fresh id, its deletion record kept', () => {
    const base = holding([glucose('g1', 62)]);
    const { change, entry } = del(base, { kind: 'reading', id: 'g1' });
    const gone = apply(base, change);
    expect(gone.observations).toEqual([]);
    expect(gone.settings?.deleted?.observations).toEqual(['g1']);
    expect(entry).toMatchObject({ kind: 'reading', of: 'g1', observations: [expect.objectContaining({ id: 'g1', value: 62 })] });
    expect(recentEntries(gone.content, NOW)).toEqual([entry]);
    const r = planRestore(entry.id, gone, fresh, NOW + 60_000);
    expect(r.restored).toEqual({ kind: 'reading', id: 'fresh1' });
    const back = apply(gone, r.change);
    expect(back.observations).toEqual([expect.objectContaining({ id: 'fresh1', value: 62, at: base.observations[0].at, restoredFrom: 'g1' })]);
    expect(back.settings?.deleted?.observations).toEqual(['g1']);
    expect(recentEntries(back.content, NOW)).toEqual([]);
  });

  it('comes back once, and not after 7 days, whoever asks (P8R-14)', () => {
    const base = holding([glucose('g1', 62)]);
    const { change, entry } = del(base, { kind: 'reading', id: 'g1' });
    const gone = apply(base, change);
    expect(restorable(gone.content, entry.id, NOW + RECENT_MS - 1)).toEqual(entry);
    expect(restorable(gone.content, entry.id, NOW + RECENT_MS)).toBeUndefined();
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    expect(() => planRestore(entry.id, back, fresh, NOW)).toThrow(NOT_RECENT);
    expect(() => planRestore(entry.id, gone, fresh, NOW + RECENT_MS)).toThrow(NOT_RECENT);
  });

  it('leaves a check-in’s own reading to its check-in, and a session to its own screen', () => {
    const base = holding([glucose('c1', 112, '2026-10-08T07:30:00+05:30', 'checkIn:2026-10-08')]);
    expect(() => del(base, { kind: 'reading', id: 'c1' })).toThrow(/belongs to a check-in/);
    const s = apply(emptySnapshot(), { content: { put: { [recentKey('deleted-9')]: sessionEntry({ id: 's1' } as never, { entry: 'deleted-9', at: AT }) } } });
    expect(() => planRestore('deleted-9', s, fresh, NOW)).toThrow(OWN_SCREEN);
  });
});

describe('a blood pressure reading, a walk and an own food, each with what belongs to it (D110)', () => {
  it('puts a reading’s two halves back together, under a new reading id', () => {
    const halves = (['bloodPressureSystolic', 'bloodPressureDiastolic'] as const).map((kind, i) =>
      newObservation({ id: `reading-r1:${kind}`, kind, value: [186, 98][i], scope: 'pointInTime', source: 'manual', at: AT, context: 'bp:reading-r1' }));
    const base = holding(halves);
    const { change, entry } = del(base, { kind: 'pressure', readingId: 'reading-r1' });
    const gone = apply(base, change);
    expect(gone.observations).toEqual([]);
    const r = planRestore(entry.id, gone, fresh, NOW);
    expect(r.restored).toEqual({ kind: 'pressure', id: 'reading-fresh1' });
    expect(apply(gone, r.change).observations.map(o => [o.id, o.context, o.value, o.restoredFrom]).sort()).toEqual([
      ['reading-fresh1:bloodPressureDiastolic', 'bp:reading-fresh1', 98, 'reading-r1:bloodPressureDiastolic'],
      ['reading-fresh1:bloodPressureSystolic', 'bp:reading-fresh1', 186, 'reading-r1:bloodPressureSystolic'],
    ]);
    // Asked for by one of its halves, it is the whole reading that goes.
    const half = del(base, { kind: 'reading', id: 'reading-r1:bloodPressureDiastolic' });
    expect(half.entry).toMatchObject({ kind: 'pressure', of: 'reading-r1' });
    expect(apply(base, half.change).observations).toEqual([]);
  });

  it('never brings back a route an "Erase all routes" erased, whatever its entry still holds (Plan 6’s rule, B-05)', () => {
    const base = holding([...walked], { routes: [route] });
    const { change, entry } = del(base, { kind: 'walk', walkId: W });
    // The entry still holding the route, and this walk's routes erased since, by its walk's id (board D176).
    const gone = apply(apply(base, change), { settings: { patch: { walk: { saveRoutes: true, map: 'off', erased: { generation: 1, walks: [W], before: NOW } } } as never } });
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    expect(back.records.routes).toEqual([]);
    expect(back.observations.filter(o => o.context === `walk:${fresh.walkId}`)).toHaveLength(2);
  });

  it('takes a walk with its pain, energy, route and journal as one entry, and restores all of it under a new walk id', () => {
    const base = holding([...walked, energy, pain], { routes: [route] });
    const { change, entry } = del(base, { kind: 'walk', walkId: W });
    expect(change.journal).toEqual({ remove: [W] });
    const gone = apply(base, change);
    expect(gone.observations).toEqual([]);
    expect(gone.records.routes).toEqual([]);
    expect(entry.observations?.map(o => o.id).sort()).toEqual([`${W}:activeEnergy`, `${W}:backPain`, `${W}:s0:movementMinutes`, `${W}:s0:walkDuration`]);
    expect(entry.records?.routes).toEqual([route]);
    const r = planRestore(entry.id, gone, fresh, NOW);
    expect(r.restored).toEqual({ kind: 'walk', id: fresh.walkId });
    const back = apply(gone, r.change);
    expect(back.observations.map(o => [o.id, o.context, o.restoredFrom]).sort()).toEqual([
      [`${fresh.walkId}:activeEnergy`, `walk:${fresh.walkId}`, `${W}:activeEnergy`],
      [`${fresh.walkId}:backPain`, `walk:${fresh.walkId}`, `${W}:backPain`],
      [`${fresh.walkId}:s0:movementMinutes`, `walk:${fresh.walkId}`, `${W}:s0:movementMinutes`],
      [`${fresh.walkId}:s0:walkDuration`, `walk:${fresh.walkId}`, `${W}:s0:walkDuration`],
    ]);
    // The route under the walk it belongs to now, saying where it came from; the original's deletion record kept (P8-08).
    expect(back.records.routes).toEqual([expect.objectContaining({ walkId: fresh.walkId, restoredFrom: W })]);
    expect(back.settings?.deleted?.records?.routes).toEqual([W]);
    expect(lineageIn(back.content)).toEqual({ [`walk:${W}`]: `walk:${fresh.walkId}` });
  });

  it('restores an own food under a fresh id, naming it again in the meals and usual meals that named it', () => {
    // Each item with its own snapshot of the food, as Plan 7's fix stores it (board D134).
    const custom = (customId: string) => ({ kind: 'custom', customId, count: 1, name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, basis: {}, version: AT });
    const food = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
    const meal = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [custom('food-1')], level: 'meals', loggedAt: AT, edits: [] };
    const usual = { id: 'usual-1', name: 'Snack', items: [custom('food-1')], savedAt: AT, updatedAt: AT };
    const base = holding([], { customFoods: [food], meals: [meal], savedMeals: [usual] });
    const older = toTransferDoc(base, AT);
    const { change, entry } = del(base, { kind: 'ownFood', id: 'food-1' });
    expect(Object.keys(entry.records ?? {})).toEqual(['customFoods']);
    const gone = apply(base, change);
    // A meal keeps its own copy of the food, so it stays as it was.
    expect(gone.records.meals).toEqual([meal]);
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    const named = (s: Snapshot, store: 'meals' | 'savedMeals') => (s.records[store][0].items as { customId: string }[])[0].customId;
    expect(back.records.customFoods).toEqual([expect.objectContaining({ id: 'food-fresh1', restoredFrom: 'food-1' })]);
    expect([named(back, 'meals'), named(back, 'savedMeals')]).toEqual(['food-fresh1', 'food-fresh1']);
    expect(lineageIn(back.content)).toEqual({ 'customFood:food-1': 'customFood:food-fresh1' });
    // An older backup's meal still names the old id: the merge reads it through this device's lineage (P8-09).
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const merged = apply(back, planImport(older, 'merge', back, { onConflict }).change);
      expect(merged.records.customFoods.map(f => f.id)).toEqual(['food-fresh1']);
      expect(named(merged, 'meals')).toBe('food-fresh1');
    }
  });
});

describe('a meal brought back twice names the meal it first was (Plan 7’s rule, board D147)', () => {
  it('every copy names the original, as Plan 7’s merge reads a record and its copies as one', () => {
    const meal = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], level: 'meals', loggedAt: AT, edits: [] };
    let s = holding([], { meals: [meal] });
    const first = del(s, { kind: 'meal', id: 'meal-1' }, 'deleted-a');
    s = apply(s, first.change);
    s = apply(s, planRestore('deleted-a', s, { ...fresh, stem: 'back1' }, NOW).change);
    expect(s.records.meals).toEqual([expect.objectContaining({ id: 'meal-back1', restoredFrom: 'meal-1' })]);
    const second = del(s, { kind: 'meal', id: 'meal-back1' }, 'deleted-b');
    s = apply(s, second.change);
    s = apply(s, planRestore('deleted-b', s, { ...fresh, stem: 'back2' }, NOW).change);
    expect(s.records.meals).toEqual([expect.objectContaining({ id: 'meal-back2', restoredFrom: 'meal-1' })]);
  });
});

describe('a merge after a restore (Review Focus 2, P8-08, P8-09, P8R-04)', () => {
  it('leaves one copy of a reading, from an older backup or a newer one', () => {
    const base = holding([glucose('g1', 62)]);
    const older = toTransferDoc(base);
    const { change, entry } = del(base, { kind: 'reading', id: 'g1' });
    const gone = apply(base, change);
    const newer = toTransferDoc(gone);
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      expect(apply(back, planImport(older, 'merge', back, { onConflict }).change).observations.map(o => o.id)).toEqual(['fresh1']);
      expect(apply(back, planImport(newer, 'merge', back, { onConflict }).change).observations.map(o => o.id)).toEqual(['fresh1']);
    }
  });

  it('keeps a restored walk, its route and its pain on it, against older, corrected, deletion-bearing and unrelated backups, either policy, after repeated cycles', () => {
    // The pain rating went and came back with its walk, so an older file's copy of it, corrected or not, is the deleted original: kept out by its deletion record.
    const base = holding([...walked, pain], { routes: [route] });
    const older = toTransferDoc(base, AT, { include: ['routes'] });
    // The same older backup, its pain rating corrected after everything here.
    const corrected = { ...older, observations: older.observations.map(o => (o.id === pain.id ? { ...o, value: 3, editedAt: '2026-10-09T09:00:00.000+05:30' } : o)) };
    let s = base;
    let walkId = W;
    let deletionBearing = older;
    for (const [i, next] of ['mgh9zzzz-99999991', 'mgh9zzzz-99999992'].entries()) {
      const d = del(s, { kind: 'walk', walkId }, `deleted-${i}`);
      s = apply(s, d.change);
      deletionBearing = toTransferDoc(s, AT, { include: ['routes'] });
      s = apply(s, planRestore(d.entry.id, s, { stem: `fresh${i}`, walkId: next }, NOW).change);
      walkId = next;
    }
    expect(canonical(lineageIn(s.content), `walk:${W}`)).toBe(`walk:${walkId}`);
    // A file that knows of some other deletion, and nothing of this walk's renaming (P8R-04).
    const unrelated = { ...toTransferDoc(emptySnapshot()), settings: { deleted: { observations: ['someone-else'] } } };
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const after = apply(s, planImport(unrelated, 'merge', s, { onConflict }).change);
      expect(lineageIn(after.content)).toEqual(lineageIn(s.content));
      for (const file of [older, corrected, deletionBearing]) {
        const merged = apply(after, planImport(file, 'merge', after, { onConflict }).change);
        expect(contexts(merged, 'backPain')).toEqual([`walk:${walkId}`]);
        expect(merged.observations.filter(o => o.scope === 'sessionObserved').map(o => o.context)).toEqual([`walk:${walkId}`, `walk:${walkId}`]);
        expect(merged.records.routes.map(r => r.walkId)).toEqual([walkId]);
      }
    }
    const kept = apply(s, planImport(corrected, 'merge', s, { onConflict: 'takeFile' }).change);
    expect(kept.observations.filter(o => o.kind === 'backPain')).toEqual([expect.objectContaining({ value: 2, context: `walk:${walkId}` })]);
  });
});

describe('a dependent deleted on its own, restored after its walk or before it (P8R-05)', () => {
  // Pain rated after the walk, deleted first; then the walk.
  const twoDeletes = () => {
    let s = holding([...walked, pain], { routes: [route] });
    const p = del(s, { kind: 'reading', id: pain.id }, 'deleted-pain');
    s = apply(s, p.change);
    const w = del(s, { kind: 'walk', walkId: W }, 'deleted-walk');
    s = apply(s, w.change);
    return { s, pain: p.entry.id, walk: w.entry.id };
  };

  it('restored after its walk, it names the walk that came back', () => {
    const { pain: p, walk: w, s: first } = twoDeletes();
    let s = first;
    s = apply(s, planRestore(w, s, fresh, NOW).change);
    s = apply(s, planRestore(p, s, { ...fresh, stem: 'pain-back' }, NOW).change);
    expect(contexts(s, 'backPain')).toEqual([`walk:${fresh.walkId}`]);
    // And it goes with that walk when it is deleted again, and comes back with it.
    const again = del(s, { kind: 'walk', walkId: fresh.walkId }, 'deleted-again');
    expect(again.entry.observations?.some(o => o.kind === 'backPain')).toBe(true);
    s = apply(apply(s, again.change), planRestore('deleted-again', apply(s, again.change), { stem: 'x', walkId: 'mgh9zzzz-99999993' }, NOW).change);
    expect(contexts(s, 'backPain')).toEqual(['walk:mgh9zzzz-99999993']);
  });

  it('restored while its walk is still deleted, it stands alone, and stays so when the walk comes back', () => {
    const { pain: p, walk: w, s: first } = twoDeletes();
    let s = first;
    s = apply(s, planRestore(p, s, { ...fresh, stem: 'pain-back' }, NOW).change);
    expect(contexts(s, 'backPain')).toEqual([undefined]);
    expect(s.observations.find(o => o.kind === 'backPain')).toMatchObject({ id: 'pain-back', restoredFrom: pain.id, value: 2 });
    s = apply(s, planRestore(w, s, fresh, NOW).change);
    expect(contexts(s, 'backPain')).toEqual([undefined]);
    expect(s.observations.filter(o => o.context === `walk:${fresh.walkId}`)).toHaveLength(2);
  });
});

describe('two day totals said at the same moment, and one Undo (Review Focus 2, P8-10)', () => {
  // A past day's taps share its stand-in time, so only the order they were said in tells them apart.
  const PAST = '2026-10-06T12:00:00.000+05:30';
  const total = (s: Snapshot) => entryFor(summariseDay('2026-10-06', s.observations), 'water')?.total;
  for (const edited of [undefined, '2026-10-07T08:00:00.000+05:30']) {
    for (const order of [['w2', 'w1'], ['w1', 'w2']] as const) {
      it(`keeps the day at what was said last, restoring ${order.join(' then ')}${edited ? ', both corrected at the same moment' : ''}`, () => {
        // Two commits, so two places in the order: 250 ml said first, 500 ml after it.
        let s = apply(emptySnapshot(), { observations: { put: [water('w1', 250, PAST, edited)] } });
        s = apply(s, { observations: { put: [water('w2', 500, PAST, edited)] } });
        expect(total(s)).toBe(500);
        const entries: Record<string, string> = {};
        for (const id of ['w2', 'w1']) {
          const d = del(s, { kind: 'reading', id }, `deleted-${id}`);
          s = apply(s, d.change);
          entries[id] = d.entry.id;
        }
        expect(total(s)).toBeUndefined();
        s = apply(s, planRestore(entries[order[0]], s, { ...fresh, stem: `back-${order[0]}` }, NOW).change);
        s = apply(s, planRestore(entries[order[1]], s, { ...fresh, stem: `back-${order[1]}` }, NOW).change);
        expect(total(s)).toBe(500);
        // And on a device that has neither, through a backup: the file keeps that order.
        const elsewhere = apply(emptySnapshot(), planImport(toTransferDoc(s), 'merge', emptySnapshot()).change);
        expect(total(elsewhere)).toBe(500);
      });
    }
  }

  for (const order of [['w2', 'w1'], ['w1', 'w2']] as const) {
    it(`keeps the day at what was said last for statements from before this release, restoring ${order.join(' then ')}`, () => {
      // No place of their own: only their commit order tells them apart, and a restore keeps it (keepSeq, D110).
      const unsaid = (o: Observation): Observation => { const { order: _o, ...rest } = o; void _o; return rest; };
      let s = apply(emptySnapshot(), { observations: { put: [unsaid(water('w1', 250, PAST))] } });
      s = apply(s, { observations: { put: [unsaid(water('w2', 500, PAST))] } });
      expect(total(s)).toBe(500);
      const entries: Record<string, string> = {};
      for (const id of ['w2', 'w1']) {
        const d = del(s, { kind: 'reading', id }, `deleted-${id}`);
        s = apply(s, d.change);
        entries[id] = d.entry.id;
      }
      s = apply(s, planRestore(entries[order[0]], s, { ...fresh, stem: `back-${order[0]}` }, NOW).change);
      s = apply(s, planRestore(entries[order[1]], s, { ...fresh, stem: `back-${order[1]}` }, NOW).change);
      expect(total(s)).toBe(500);
    });
  }

  it('on a device that already holds the later one, the earlier, restored elsewhere, stays the earlier, either policy (P8R-06)', () => {
    const w1 = water('w1', 250, PAST);
    const w2 = water('w2', 500, PAST);
    // Elsewhere: both said, then the earlier deleted and restored under a fresh id.
    let there = apply(apply(emptySnapshot(), { observations: { put: [w1] } }), { observations: { put: [w2] } });
    const d = del(there, { kind: 'reading', id: 'w1' }, 'deleted-w1');
    there = apply(there, d.change);
    there = apply(there, planRestore(d.entry.id, there, { ...fresh, stem: 'w1-back' }, NOW).change);
    // Here: only the later one, stored long before the file arrives, so the file's copy gets a later commit.
    const here = apply(emptySnapshot(40), { observations: { put: [w2] } });
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const merged = apply(here, planImport(toTransferDoc(there), 'merge', here, { onConflict }).change);
      expect(merged.observations.find(o => o.id === 'w1-back')!.seq!).toBeGreaterThan(merged.observations.find(o => o.id === 'w2')!.seq!);
      expect(total(merged)).toBe(500);
    }
  });
});

describe('how long (D109, P8-12, K8-01)', () => {
  it('keeps every deletion for its 7 days, however many', () => {
    let s = holding(Array.from({ length: 150 }, (_, i) => glucose(`g${i}`, 100 + i)));
    for (let i = 0; i < 150; i++) s = apply(s, del(s, { kind: 'reading', id: `g${i}` }, `deleted-${i}`, new Date(NOW + i * 1000).toISOString()).change);
    expect(recentEntries(s.content, NOW + 150_000)).toHaveLength(150);
    expect(expiryPlan(s.content, NOW + 150_000)).toBeUndefined();
    expect(nextExpiry(s.content)).toBe(NOW + RECENT_MS);
  });

  it('ends what is past 7 days, and anything unreadable, and moves its clock on with them', () => {
    const content = {
      [recentKey('old')]: { id: 'old', at: new Date(NOW - RECENT_MS).toISOString(), kind: 'reading', of: 'g' },
      [recentKey('new')]: { id: 'new', at: AT, kind: 'reading', of: 'g' },
      [recentKey('bad')]: { kind: 'something' },
      [lineageKey('walk:W')]: { to: 'walk:W2', at: AT },
    };
    expect(staleKeys(content, NOW).sort()).toEqual([recentKey('bad'), recentKey('old')]);
    expect(expiryPlan(content, NOW)).toEqual({ remove: [recentKey('old'), recentKey('bad')].sort(), put: { [RECENT_CLOCK]: { at: NOW } } });
    // An entry of a kind this build doesn't know can't be restored either.
    expect(staleKeys({ [recentKey('odd')]: { id: 'odd', at: AT, kind: 'something', of: 'g' } }, NOW)).toEqual([recentKey('odd')]);
  });

  it('never ends anything while the clock reads earlier than the last time it ran (K8-01)', () => {
    const content = {
      [recentKey('old')]: { id: 'old', at: new Date(NOW - RECENT_MS - 60_000).toISOString(), kind: 'reading', of: 'g' },
      [RECENT_CLOCK]: { at: NOW + 24 * 60 * 60 * 1000 },
    };
    expect(expiryPlan(content, NOW)).toBeUndefined();
    expect(expiryPlan(content, NOW + 24 * 60 * 60 * 1000)?.remove).toEqual([recentKey('old')]);
  });
});

describe('this device’s own rows never leave it (D109, P8-11, P8R-04)', () => {
  it('Recently deleted, the lineage and expiry’s clock are left out of a backup and never taken from one; Merge keeps all three, Replace all but the entries (P8S-08)', () => {
    const base = holding([glucose('g1', 62), glucose('g2', 70)]);
    let s = apply(base, del(base, { kind: 'reading', id: 'g1' }).change);
    s = apply(s, { content: { put: { [lineageKey('walk:W')]: { to: 'walk:W2', at: AT }, [RECENT_CLOCK]: { at: NOW } } } });
    const doc = toTransferDoc(s);
    expect(JSON.stringify(doc)).not.toMatch(/recent:|lineage:|recent-clock/);
    const planted = { ...doc, contentState: [...(doc.contentState ?? []),
      { key: recentKey('planted'), value: { id: 'planted', at: AT, kind: 'reading', of: 'x' } },
      { key: lineageKey('walk:W'), value: { to: 'walk:FROM-A-FILE', at: AT } },
    ] };
    const local = (snap: Snapshot) => Object.keys(snap.content).filter(k => /^(recent:|lineage:|recent-clock)/.test(k)).sort();
    const merged = apply(s, planImport(planted, 'merge', s).change);
    expect(local(merged)).toEqual([lineageKey('walk:W'), RECENT_CLOCK, recentKey('deleted-1')].sort());
    expect(lineageIn(merged.content)).toEqual({ 'walk:W': 'walk:W2' });
    const replaced = apply(s, planImport(planted, 'replace', s).change);
    expect(local(replaced)).toEqual([lineageKey('walk:W'), RECENT_CLOCK].sort());
    expect(lineageIn(replaced.content)).toEqual({ 'walk:W': 'walk:W2' });
  });

  it('keeps the lineage through a Replace from this device’s own backup, so an older file’s unknown pain rating still finds its walk (P8S-08)', () => {
    // An older file, from before the walk was deleted here, holding a pain rating this device never had.
    const unknown = newObservation({ id: 'pain-from-elsewhere', kind: 'backPain', value: 3, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:26:00+05:30', context: `walk:${W}` });
    const older = toTransferDoc(holding([...walked, unknown], { routes: [route] }), AT, { include: ['routes'] });
    const base = holding([...walked], { routes: [route] });
    let s = apply(base, del(base, { kind: 'walk', walkId: W }).change);
    s = apply(s, planRestore('deleted-1', s, fresh, NOW).change);
    // Backed up, and the device replaced from that backup.
    const replaced = apply(s, planImport(toTransferDoc(s, AT, { include: ['routes'] }), 'replace', s).change);
    expect(lineageIn(replaced.content)).toEqual({ [`walk:${W}`]: `walk:${fresh.walkId}` });
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const merged = apply(replaced, planImport(older, 'merge', replaced, { onConflict }).change);
      expect(merged.observations.find(o => o.id === 'pain-from-elsewhere')?.context).toBe(`walk:${fresh.walkId}`);
      expect(merged.observations.filter(o => o.scope === 'sessionObserved').map(o => o.context)).toEqual([`walk:${fresh.walkId}`, `walk:${fresh.walkId}`]);
    }
  });

  it('drops a `settings.deleted.recent` a file carries, on import and on export, and keeps every other deletion record', () => {
    const carrier = { observations: ['gone-1'], recent: [{ at: AT, store: 'routes', record: route }] };
    expect(withoutRecentCarrier({ deleted: carrier } as never)).toEqual({ deleted: { observations: ['gone-1'] } });
    const file = { ...toTransferDoc(emptySnapshot()), settings: { deleted: carrier } };
    const imported = apply(emptySnapshot(), planImport(file, 'replace', emptySnapshot()).change);
    expect(JSON.stringify(imported.settings)).not.toMatch(/12\.97|recent/);
    expect(imported.settings?.deleted?.observations).toEqual(['gone-1']);
    const leaked = { ...emptySnapshot(), settings: { deleted: carrier } } as unknown as Snapshot;
    expect(JSON.stringify(toTransferDoc(leaked))).not.toMatch(/12\.97|"recent"/);
  });
});

describe('"Erase all routes" reaches Recently deleted (B-05, D93, Review Focus 3)', () => {
  it('takes the route out of a deleted walk, which comes back without one', () => {
    const base = holding([...walked, pain], { routes: [route] });
    const s = apply(base, del(base, { kind: 'walk', walkId: W }).change);
    const erased = apply(s, { content: recentWithoutRoutes(s.content)! });
    expect(JSON.stringify(erased.content)).not.toMatch(/12\.97|77\.59/);
    expect(recentWithoutRoutes(erased.content)).toBeUndefined();
    const back = apply(erased, planRestore('deleted-1', erased, fresh, NOW).change);
    expect(back.records.routes).toEqual([]);
    expect(back.observations.filter(o => o.restoredFrom)).toHaveLength(3);
  });
});
