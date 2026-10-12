import { describe, expect, it } from 'vitest';
import type { Permission } from '@/engine/permission';
import { startDecision } from './start';

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
