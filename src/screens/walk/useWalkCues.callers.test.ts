/**
 * The live walk's cues through their hook (journey §9.2, A-72, B-01): said
 * once at their minute while recording, stopped by a pause, a hold, mute or
 * leaving, and never repeated by a screen reopened past them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@/test/host';
import { startWalk, pauseWalk } from '@/walk/clock';
import type { LiveSnapshot } from '@/walk/live';

const voice = vi.hoisted(() => ({ say: vi.fn(), cancel: vi.fn() }));
vi.mock('@/walk/voice', () => ({ walkVoice: () => ({ say: voice.say, cancel: voice.cancel }) }));

const { useWalkCues } = await import('./useWalkCues');

const MIN = 60_000;
const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const running = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T);
const at = (observedMs: number, over: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  walk: running, now: T + observedMs, observedMs, gps: { state: 'off' }, distanceM: 0, distanceMeasured: false, steps: 0,
  stepsState: 'off', wake: 'held', notice: null, blocked: null, draftKept: true, route: [], journalFull: false, ...over,
});

function Cues({ snapshot, muted }: { snapshot: LiveSnapshot | null; muted: boolean }) {
  useWalkCues(snapshot, muted);
  return null;
}

beforeEach(() => {
  voice.say.mockReset().mockResolvedValue('ended');
  voice.cancel.mockReset();
});

describe('the cues on the live walk', () => {
  it('says each cue once, at its minute, while recording', () => {
    const h = render(createElement(Cues, { snapshot: at(9 * MIN), muted: false }));
    expect(voice.say).not.toHaveBeenCalled();
    h.update(createElement(Cues, { snapshot: at(10 * MIN), muted: false }));
    h.update(createElement(Cues, { snapshot: at(10 * MIN + 1000), muted: false }));
    expect(voice.say.mock.calls).toEqual([['Ten minutes of walking.']]);
    h.update(createElement(Cues, { snapshot: at(20 * MIN), muted: false }));
    expect(voice.say.mock.calls.at(-1)).toEqual(['Twenty minutes of walking.']);
    h.unmount();
  });

  it('stops whatever is playing on a pause, a hold, mute and leaving, and says nothing then', () => {
    const h = render(createElement(Cues, { snapshot: at(5 * MIN), muted: false }));
    h.update(createElement(Cues, { snapshot: at(10 * MIN, { walk: pauseWalk(running, T + 10 * MIN) }), muted: false }));
    expect(voice.cancel).toHaveBeenCalledTimes(1);
    h.update(createElement(Cues, { snapshot: at(10 * MIN + 1000, { blocked: 'live' }), muted: false }));
    expect(voice.cancel).toHaveBeenCalledTimes(2);
    h.update(createElement(Cues, { snapshot: at(10 * MIN + 2000), muted: true }));
    expect(voice.cancel).toHaveBeenCalledTimes(3);
    expect(voice.say).not.toHaveBeenCalled();
    h.unmount();
    expect(voice.cancel).toHaveBeenCalledTimes(4);
  });

  it('repeats none a reopened screen is already past', () => {
    const h = render(createElement(Cues, { snapshot: at(10 * MIN + 30_000), muted: false }));
    h.update(createElement(Cues, { snapshot: at(10 * MIN + 31_000), muted: false }));
    expect(voice.say).not.toHaveBeenCalled();
    h.update(createElement(Cues, { snapshot: at(20 * MIN), muted: false }));
    expect(voice.say.mock.calls).toEqual([['Twenty minutes of walking.']]);
    h.unmount();
  });
});
