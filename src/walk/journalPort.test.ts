import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntry } from './journal';

const stored = vi.hoisted(() => ({
  rows: [] as JournalEntry[], puts: [] as JournalEntry[], options: [] as unknown[], unreadable: false,
  /** While set, each write waits until `land` lets the oldest one finish. */
  holding: false, waiting: [] as (() => void)[],
}));
vi.mock('@/store/useStore', async () => {
  const { withJournalled: merged } = await import('./journal');
  return {
    // As the store writes a checkpoint: in its own transaction, keeping what the journal holds beside one made while
    // the route is read back, and answering with the entry it stored.
    putWalkJournal: async (e: JournalEntry, options?: { keepJournalled?: boolean }) => {
      stored.puts.push(e);
      stored.options.push(options);
      if (stored.holding) await new Promise<void>(resolve => { stored.waiting.push(resolve); });
      const before = stored.rows.find(r => r.id === e.id);
      const value = options?.keepJournalled && e.route ? { ...e, route: merged(before?.route, e.route)! } : e;
      stored.rows = [...stored.rows.filter(r => r.id !== e.id), value];
      return { ok: true, value };
    },
    readWalkJournals: async () => (stored.unreadable ? { ok: false, failure: new Error('unreadable') } : { ok: true, value: stored.rows }),
  };
});
const land = async () => { stored.waiting.shift()?.(); await new Promise(resolve => setTimeout(resolve, 0)); };

const { cachedJournal, forgetCachedRoutes, journalPort } = await import('./journalPort');
const { startWalk } = await import('./clock');
const { journalEntry } = await import('./journal');

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const LINE = { start: T, end: T + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902]] as [number, number][], ms: [0, 20_000] };
const entry = (id: string) => journalEntry(startWalk(id, { kind: 'walk', gps: true, steps: false, keepRoute: true }, T), T, [LINE]);

describe('the browser’s walk journal (journey §9.4, B-05)', () => {
  beforeEach(() => {
    for (const go of stored.waiting.splice(0)) go();
    stored.holding = false;
  });

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

  it('never lets a checkpoint made while the route is read back stand here for the whole route: only what the journal then holds does (H6F-08, board D211)', async () => {
    const port = journalPort();
    const later = { ...LINE, start: T + 60_000, end: T + 80_000 };
    // Walked before the reload, so in the journal and nowhere on this page.
    stored.rows = [entry('walk-gggg')];
    stored.holding = true;
    const writing = port.checkpoint({ ...entry('walk-gggg'), route: [later] }, { keepJournalled: true });
    // While it is written, this page holds nothing for it, so a read asks the journal.
    expect(cachedJournal('walk-gggg')).toBeUndefined();
    await land();
    await writing;
    stored.holding = false;
    // Written, the journal's answer, both lines, is what this page holds.
    expect(cachedJournal('walk-gggg')?.route).toEqual([LINE, later]);
    expect((await port.read('walk-gggg'))?.route).toEqual([LINE, later]);
  });

  it('brings back no route the page forgot while a merged answer was on its way (B-05, H6F-08)', async () => {
    const port = journalPort();
    const later = { ...LINE, start: T + 60_000, end: T + 80_000 };
    stored.rows = [entry('walk-iiii')];
    stored.holding = true;
    const writing = port.checkpoint({ ...entry('walk-iiii'), route: [later] }, { keepJournalled: true });
    // "Erase all routes" runs meanwhile.
    forgetCachedRoutes();
    await land();
    await writing;
    stored.holding = false;
    expect(cachedJournal('walk-iiii')?.route).toBeUndefined();
  });

  it('keeps the page’s own whole route over a merged answer that comes back after it (H6F-08, board D211)', async () => {
    const port = journalPort();
    const later = { ...LINE, start: T + 60_000, end: T + 80_000 };
    const last = { ...LINE, start: T + 120_000, end: T + 140_000 };
    stored.rows = [entry('walk-hhhh')];
    stored.holding = true;
    const reading = port.checkpoint({ ...entry('walk-hhhh'), route: [later] }, { keepJournalled: true });
    // The route is back: the page holds all of it, and checkpoints it whole before the first write has landed.
    const whole = port.checkpoint({ ...entry('walk-hhhh'), route: [LINE, later, last] });
    expect(cachedJournal('walk-hhhh')?.route).toEqual([LINE, later, last]);
    await land();
    await land();
    await Promise.all([reading, whole]);
    stored.holding = false;
    expect(cachedJournal('walk-hhhh')?.route).toEqual([LINE, later, last]);
  });
});
