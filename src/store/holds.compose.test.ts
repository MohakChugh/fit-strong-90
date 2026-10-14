/**
 * How the store's guard puts the engine's answers together (board D119, K8-08):
 * any one mode allowed to do more, or the day's answer less strict tomorrow
 * alone, is enough to refuse. The engine is stood in for here, so one of its
 * answers can differ at a time; `holds.callers.test.ts` asks the real one.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Permission, PermissionInput } from '@/engine/permission';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';

const looser = vi.hoisted(() => ({ mode: false, tomorrow: false }));
const TODAY = '2026-10-08';

vi.mock('@/engine/permission', async importOriginal => {
  const actual = await importOriginal<typeof import('@/engine/permission')>();
  const side = (input: PermissionInput) => (input.profile as UserProfile & { side?: string }).side;
  const held: Readiness = {
    outcome: 'red', modifiers: [], back: 'green', nerveFlag: false, actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
    reasons: [{ code: 'bpSevereUnconfirmed', message: '', outcome: 'red', disposition: 'hold' }],
  };
  return {
    ...actual,
    permission: (input: PermissionInput, mode: Permission['mode']): Permission => ({
      mode, allowed: side(input) === 'after' && looser.mode, disposition: side(input) === 'after' && looser.mode ? 'reassure' : 'hold',
      reasons: [], restrictions: [], codes: [], needsCheckIn: false,
    }),
    readinessFor: (input: PermissionInput): Readiness => {
      const tomorrow = input.now.toISOString().slice(0, 10) !== TODAY;
      return side(input) === 'after' && looser.tomorrow && tomorrow ? { ...held, outcome: 'green', reasons: [] } : held;
    },
  };
});

const { holdLifted } = await import('./holds');

const reading = { sys: 186, dia: 98, at: `${TODAY}T08:59:00.000+05:30` };
const day = (bpReadings: CheckInRecord['bpReadings']): CheckInRecord => ({ date: TODAY, urgentSymptoms: false, news: [], ...(bpReadings ? { bpReadings } : {}) } as unknown as CheckInRecord);
const profile = (side: 'before' | 'after') => ({ side }) as unknown as UserProfile;
const before = { profile: profile('before'), checkIns: [day([reading])] };
const after = { profile: profile('after'), checkIns: [day(undefined)] };
const now = new Date(`${TODAY}T09:00:00.000+05:30`);

describe('each of the engine’s answers is enough on its own (D119, K8-08)', () => {
  it('with every answer as strict after, a reading taken away lifts nothing', () => {
    looser.mode = false;
    looser.tomorrow = false;
    expect(holdLifted(before, after, now)).toBeUndefined();
  });

  it('one mode allowed to do more, the day’s answer the same', () => {
    looser.mode = true;
    looser.tomorrow = false;
    expect(holdLifted(before, after, now)?.held).toHaveLength(1);
  });

  it('tomorrow’s answer less strict, today’s the same', () => {
    looser.mode = false;
    looser.tomorrow = true;
    expect(holdLifted(before, after, now)?.held).toHaveLength(1);
  });
});
