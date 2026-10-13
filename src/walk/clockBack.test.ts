/**
 * F-walk-01 (B-19): a walk that crossed a change of the phone's clock set
 * back is still a walk after a reload. Driven through the live controller
 * (`createLiveWalk`), which records it; a second controller over the same
 * tab's draft and journal, as a reload makes one, reads it back through the
 * same validators the app uses (`loadWalk`, `parseJournalEntry`).
 */

import { describe, expect, it } from 'vitest';
import type { JournalEntry } from './journal';
import { createLiveWalk, type LivePorts } from './live';
import { parseJournalEntry } from './journal';
import { observedMs } from './clock';

const MIN = 60_000;
const T0 = new Date(2026, 9, 9, 19, 0).getTime();

/** A device: its wall clock, which the test sets back, its monotonic one, which never goes back, the tab's draft and the journal. */
function device() {
  const clocks = { wall: T0, mono: 1_000_000 };
  const kept = new Map<string, string>();
  const journal = new Map<string, unknown>();
  const ports = (): LivePorts => ({
    mayRun: () => true,
    now: () => clocks.wall,
    monotonic: () => clocks.mono,
    later: () => () => {},
    clockChanged: () => Promise.resolve(),
    storage: { getItem: k => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v), removeItem: k => void kept.delete(k) },
    visibility: { visible: () => true, subscribe: () => () => {} },
    journal: {
      checkpoint: async (e: JournalEntry) => { journal.set(e.id, JSON.parse(JSON.stringify(e))); return { ok: true as const, value: undefined }; },
      read: async id => parseJournalEntry(journal.get(id)) ?? undefined,
    },
  });
  /** Both clocks move on together: time passing. */
  const pass = (ms: number) => { clocks.wall += ms; clocks.mono += ms; };
  /** The wall clock alone set back: the person changing the phone's time. */
  const setBack = (ms: number) => { clocks.wall -= ms; };
  return { clocks, kept, journal, ports, pass, setBack };
}

const ID = 'mgh3k2x1-4b4b4b4b';

describe('F-walk-01: a walk across a change of the clock set back, read back after a reload', () => {
  it('set back 20 minutes while paused, then resumed: the draft and the journal both read back, with the time walked', async () => {
    const d = device();
    const live = createLiveWalk(d.ports());
    expect(live.attach({ id: ID, plan: { kind: 'walk', gps: false, steps: false } })).toBe('created');
    d.pass(10 * MIN);
    live.pause();
    d.setBack(20 * MIN);
    d.pass(1 * MIN);
    live.resume();
    d.pass(5 * MIN);
    live.pause();
    expect(observedMs(live.getSnapshot()!.walk, d.clocks.wall)).toBe(15 * MIN);
    live.detach();

    // Reloaded: the tab's draft, as a new page reads it.
    const again = createLiveWalk(d.ports());
    expect(again.attach()).toBe('resumed');
    expect(observedMs(again.getSnapshot()!.walk, d.clocks.wall)).toBe(15 * MIN);
    again.detach();
    // And the journal, as Home's recovery reads it.
    const entry = parseJournalEntry(d.journal.get(ID));
    expect(entry?.walk.segments).toHaveLength(2);
  });

  it('set back while walking: the walk splits at the change, and reads back whole', () => {
    const d = device();
    const live = createLiveWalk(d.ports());
    live.attach({ id: ID, plan: { kind: 'walk', gps: false, steps: false } });
    d.pass(10 * MIN);
    live.reconsider();
    d.setBack(20 * MIN);
    d.pass(2_000);
    // The next second's tick sees the clocks disagree.
    live.pause();
    expect(live.getSnapshot()!.walk.segments.map(s => s.endedBy)).toEqual(['clockChange', 'paused']);
    live.detach();
    const again = createLiveWalk(d.ports());
    expect(again.attach()).toBe('resumed');
    expect(again.getSnapshot()!.walk.segments).toHaveLength(2);
  });

  it('set back while away from the walk screen, then back: a new segment, and it reads back', () => {
    const d = device();
    let visible = true;
    let onChange: (v: boolean) => void = () => {};
    const ports = { ...d.ports(), visibility: { visible: () => visible, subscribe: (fn: (v: boolean) => void) => { onChange = fn; return () => {}; } } };
    const live = createLiveWalk(ports);
    live.attach({ id: ID, plan: { kind: 'walk', gps: false, steps: false } });
    d.pass(10 * MIN);
    visible = false;
    onChange(false);
    d.setBack(20 * MIN);
    d.pass(1 * MIN);
    visible = true;
    onChange(true);
    d.pass(3 * MIN);
    live.pause();
    live.detach();
    const again = createLiveWalk(d.ports());
    expect(again.attach()).toBe('resumed');
    expect(again.getSnapshot()!.walk.segments.length).toBeGreaterThanOrEqual(2);
  });
});

describe('F-walk-01: what the validator takes', () => {
  it('an earlier start only on a segment marked as after the clock was set back, and the mark only as true', async () => {
    const { parseWalk } = await import('./persist');
    const { pauseWalk, resumeWalk, startWalk } = await import('./clock');
    const walk = resumeWalk(pauseWalk(startWalk(ID, { kind: 'walk', gps: false, steps: false }, T0), T0 + 10 * MIN), T0 - 9 * MIN);
    expect(walk.segments[1].afterClockChange).toBe(true);
    expect(parseWalk(JSON.parse(JSON.stringify(walk)))).not.toBeNull();
    const { afterClockChange: _mark, ...unmarked } = walk.segments[1];
    void _mark;
    expect(parseWalk({ ...walk, segments: [walk.segments[0], unmarked] })).toBeNull();
    expect(parseWalk({ ...walk, segments: [walk.segments[0], { ...walk.segments[1], afterClockChange: 'yes' }] })).toBeNull();
    // Resumed with the clock where it was: nothing to mark, and a mark that isn't one is never read.
    const plain = resumeWalk(pauseWalk(startWalk(ID, { kind: 'walk', gps: false, steps: false }, T0), T0 + MIN), T0 + 2 * MIN);
    expect(plain.segments[1].afterClockChange).toBeUndefined();
    expect(parseWalk({ ...plain, segments: [plain.segments[0], { ...plain.segments[1], afterClockChange: 'yes' }] })).toBeNull();
  });
});
