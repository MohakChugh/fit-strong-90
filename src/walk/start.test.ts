import { describe, expect, it } from 'vitest';
import type { Permission } from '@/engine/permission';
import type { WalkPlan } from './clock';
import { createStarter, type StartPorts } from './start';

const PLAN: WalkPlan = { kind: 'walk', gps: true, steps: true };
const ALLOWED: Permission = { mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], codes: [], needsCheckIn: false };
const STALE: Permission = { ...ALLOWED, allowed: false, disposition: 'hold', reasons: ['With insulin or a sulfonylurea, check your glucose within 30 minutes of starting.'], needsCheckIn: true };

function ports(over: Partial<StartPorts> = {}) {
  const calls: string[] = [];
  const started: WalkPlan[] = [];
  const p: StartPorts = {
    requestMotion: () => { calls.push('motion'); return Promise.resolve('granted'); },
    unlockAudio: () => { calls.push('audio'); return Promise.resolve(true); },
    gate: () => { calls.push('gate'); return ALLOWED; },
    go: plan => { calls.push('go'); started.push(plan); },
    ...over,
  };
  return { p, calls, started };
}

describe('the start sequence (B-01)', () => {
  it('asks for motion and unlocks audio before the tap’s handler returns, and does nothing else yet', () => {
    const calls: string[] = [];
    const { p } = ports({
      requestMotion: () => { calls.push('motion'); return new Promise(() => {}); },
      unlockAudio: () => { calls.push('audio'); return new Promise(() => {}); },
      gate: () => { calls.push('gate'); return ALLOWED; },
    });
    void createStarter(p).tap(PLAN, { voice: true });
    expect(calls).toEqual(['motion', 'audio']);
  });

  it('waits for both answers, then asks the gate, then starts once', async () => {
    const { p, calls, started } = ports();
    expect(await createStarter(p).tap(PLAN, { voice: true })).toEqual({ kind: 'started', plan: PLAN });
    expect(calls).toEqual(['motion', 'audio', 'gate', 'go']);
    expect(started).toEqual([PLAN]);
  });

  it('asks for nothing it doesn’t need: no motion without steps, no audio without the voice', async () => {
    const { p, calls } = ports();
    await createStarter(p).tap({ ...PLAN, steps: false }, { voice: false });
    expect(calls).toEqual(['gate', 'go']);
  });

  it('shows the gate’s new answer instead of starting, when it changed meanwhile (J§4.1, V-J19)', async () => {
    const { p, started } = ports({ gate: () => STALE });
    expect(await createStarter(p).tap(PLAN, { voice: false })).toEqual({ kind: 'refused', permission: STALE });
    expect(started).toEqual([]);
  });

  it('starts once however many times the button is tapped', async () => {
    const { p, started } = ports();
    const starter = createStarter(p);
    const first = starter.tap(PLAN, { voice: false });
    expect(await starter.tap(PLAN, { voice: false })).toEqual({ kind: 'busy' });
    await first;
    expect(await starter.tap(PLAN, { voice: false })).toEqual({ kind: 'busy' });
    expect(started).toHaveLength(1);
  });

  it('can be tried again after a refusal', async () => {
    let answer = STALE;
    const { p, started } = ports({ gate: () => answer });
    const starter = createStarter(p);
    await starter.tap(PLAN, { voice: false });
    answer = ALLOWED;
    expect((await starter.tap(PLAN, { voice: false })).kind).toBe('started');
    expect(started).toHaveLength(1);
  });

  it('walks without counting steps when motion is refused, and says so (§9.1)', async () => {
    const { p, started } = ports({ requestMotion: () => Promise.resolve('denied') });
    await createStarter(p).tap(PLAN, { voice: false });
    expect(started[0]).toMatchObject({ steps: false, stepsDenied: true });
  });

  it('still starts when the audio can’t be unlocked: cues are optional', async () => {
    const { p } = ports({ unlockAudio: () => Promise.reject(new Error('NotAllowedError')) });
    expect((await createStarter(p).tap(PLAN, { voice: true })).kind).toBe('started');
  });
});
