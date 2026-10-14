import { describe, expect, it } from 'vitest';
import type { Permission } from '@/engine/permission';
import { opensOnHold, startDecision } from './start';

const p = (over: Partial<Permission>): Permission => ({
  mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false, ...over,
});

describe('startDecision', () => {
  it('goes straight to the mode only when it is allowed and needs nothing new', () => {
    expect(startDecision(p({}))).toBe('go');
    expect(startDecision(p({ disposition: 'adjust', restrictions: ['No head-down positions.'] }))).toBe('go');
  });

  it('opens the check-in when one is needed, even if the answer would otherwise allow it', () => {
    expect(startDecision(p({ needsCheckIn: true }))).toBe('checkIn');
  });

  it.each(['emergency', 'today', 'hold'] as const)('opens the check-in to explain a %s refusal', disposition => {
    expect(startDecision(p({ allowed: false, disposition }))).toBe('checkIn');
  });
});

describe('opensOnHold: the mode’s screen opens on its refusal, so nothing animates into it (codex V1-05, motion rule 2)', () => {
  it('a stop, or a hold no check-in answers (a foot that needs protecting, a profile gap)', () => {
    expect(opensOnHold(p({ allowed: false, disposition: 'emergency' }))).toBe(true);
    expect(opensOnHold(p({ allowed: false, disposition: 'today' }))).toBe(true);
    expect(opensOnHold(p({ allowed: false, disposition: 'hold' }))).toBe(true);
  });
  it('not a screen that opens on its Start, even one that asks for the check-in first', () => {
    expect(opensOnHold(p({}))).toBe(false);
    expect(opensOnHold(p({ disposition: 'adjust', restrictions: ['No head-down positions.'] }))).toBe(false);
    expect(opensOnHold(p({ allowed: false, disposition: 'hold', needsCheckIn: true }))).toBe(false);
  });
});
