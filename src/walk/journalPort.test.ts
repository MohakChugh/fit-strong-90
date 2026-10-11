import { describe, expect, it, vi } from 'vitest';
import type { JournalEntry } from './journal';

const stored = vi.hoisted(() => ({ rows: [] as JournalEntry[], puts: [] as JournalEntry[], options: [] as unknown[], unreadable: false }));
vi.mock('@/store/useStore', () => ({
  putWalkJournal: async (e: JournalEntry, options?: unknown) => { stored.puts.push(e); stored.options.push(options); return { ok: true, value: undefined }; },
  readWalkJournals: async () => (stored.unreadable ? { ok: false, failure: new Error('unreadable') } : { ok: true, value: stored.rows }),
}));

const { cachedJournal, forgetCachedRoutes, journalPort } = await import('./journalPort');
const { startWalk } = await import('./clock');
const { journalEntry } = await import('./journal');

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const LINE = { start: T, end: T + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902]] as [number, number][], ms: [0, 20_000] };
const entry = (id: string) => journalEntry(startWalk(id, { kind: 'walk', gps: true, steps: false, keepRoute: true }, T), T, [LINE]);

describe('the browser’s walk journal (journey §9.4, B-05)', () => {
  it('stores each checkpoint and keeps this page’s latest, which a read finds first', async () => {
    const port = journalPort();
    await port.checkpoint(entry('walk-aaaa'));
    expect(stored.puts.map(e => e.id)).toEqual(['walk-aaaa']);
    expect(cachedJournal('walk-aaaa')?.route).toHaveLength(1);
    stored.rows = [entry('walk-bbbb')];
    expect((await port.read('walk-aaaa'))?.id).toBe('walk-aaaa');
    expect((await port.read('walk-bbbb'))?.id).toBe('walk-bbbb');
    expect(await port.read('walk-cccc')).toBeUndefined();
  });

  it('forgets every route this page holds, keeping the walks', async () => {
    await journalPort().checkpoint(entry('walk-dddd'));
    forgetCachedRoutes();
    expect(cachedJournal('walk-dddd')).toBeDefined();
    expect(cachedJournal('walk-dddd')?.route).toBeUndefined();
    expect(cachedJournal('walk-aaaa')?.route).toBeUndefined();
  });

  it('says a journal it can’t read can’t be read, never that it holds nothing (H6-06)', async () => {
    stored.unreadable = true;
    await expect(journalPort().read('walk-eeee')).rejects.toThrow('unreadable');
    stored.unreadable = false;
    expect(await journalPort().read('walk-eeee')).toBeUndefined();
  });

  it('asks the store to keep what the journal holds beside a checkpoint made while the route is read back, and keeps both here (H6R-10)', async () => {
    const port = journalPort();
    const later = { ...LINE, start: T + 60_000, end: T + 80_000 };
    await port.checkpoint(entry('walk-ffff'));
    await port.checkpoint({ ...entry('walk-ffff'), route: [later] }, { keepJournalled: true });
    expect(stored.options.at(-1)).toEqual({ keepJournalled: true });
    expect(cachedJournal('walk-ffff')?.route).toEqual([LINE, later]);
    await port.checkpoint({ ...entry('walk-ffff'), route: [later] });
    expect(cachedJournal('walk-ffff')?.route).toEqual([later]);
  });
});
