import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import type { Permission, PermissionInput } from '@/engine/permission';
import { toDateString } from '@/lib/utils';
import { resetPendingCheckInsForTests, saveCheckInRecord } from '@/components/checkin/pending';
import { allowsMovement, clinicalGate, deviceClinical, walkInput, walkRefusal, watchClinical } from './gate';
import type { WalkIntent } from './live';

/** The store's own change notifications, so a test can fire them. */
const storeListeners = vi.hoisted(() => new Set<() => void>());
vi.mock('@/store/useStore', async importOriginal => ({
  ...(await importOriginal<typeof import('@/store/useStore')>()),
  subscribe: (listener: () => void) => {
    storeListeners.add(listener);
    return () => void storeListeners.delete(listener);
  },
}));

const NOW = new Date('2026-10-08T19:40:00+05:30');
const TODAY = toDateString(NOW);
const minutesBefore = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [],
};

function checkIn(over: Partial<CheckInRecord> = {}): CheckInRecord {
  return { date: TODAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, readiness, ...over };
}

const ordinary = createDefaultProfile({
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
  health: { diabetes: 'type2', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
});
const onInsulin = createDefaultProfile({
  health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
});

/** An ordinary day's input; `checkIn: undefined` means none at all. */
function input(over: Partial<PermissionInput> = {}): PermissionInput {
  const { checkIn: c, ...rest } = 'checkIn' in over ? over : { ...over, checkIn: checkIn() };
  return { profile: ordinary, now: NOW, recent: [], ...(c ? { checkIn: c } : {}), ...rest };
}

const ALL: WalkIntent[] = ['start', 'restart', 'live'];
const refusedBy = (i: PermissionInput) => ALL.filter(intent => walkRefusal(i, intent) !== undefined);

describe('allowsMovement', () => {
  const p = (over: Partial<Permission>): Permission =>
    ({ mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], codes: [], needsCheckIn: false, ...over });

  it('takes only a plain yes', () => {
    expect(allowsMovement(p({}))).toBe(true);
    expect(allowsMovement(p({ disposition: 'adjust', restrictions: ['Keep it short and easy.'] }))).toBe(true);
    expect(allowsMovement(p({ allowed: false, disposition: 'emergency' }))).toBe(false);
    // Today's engine never allows a mode while still wanting a check-in, but
    // the walk must not start on one if that ever changes — the same belt
    // `startDecision` wears.
    expect(allowsMovement(p({ needsCheckIn: true }))).toBe(false);
  });
});

describe('the walk gate: three questions (re-audit 3, B03)', () => {
  it('allows a start, a restart and walking on, on an ordinary day', () => {
    expect(refusedBy(input())).toEqual([]);
  });

  it('refuses every one after an emergency answer, and says to call for help', () => {
    const i = input({ checkIn: checkIn({ urgentSymptoms: true, emergency: ['chest'] }) });
    for (const intent of ALL) {
      const p = walkRefusal(i, intent)!;
      expect(p.disposition).toBe('emergency');
      expect(p.reasons.join(' ')).toContain('emergency number');
    }
  });

  it('refuses every one while a foot needs protecting', () => {
    const profile = createDefaultProfile({ health: { footStatus: 'current_wound_or_active_charcot', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true } });
    expect(refusedBy(input({ profile }))).toEqual(ALL);
  });

  it('holds every one when the health questions have never been answered', () => {
    const profile = createDefaultProfile({ needsHealthReview: true });
    expect(refusedBy(input({ profile }))).toEqual(ALL);
    expect(walkRefusal(input({ profile }), 'live')!.reasons.join(' ')).toMatch(/health questions/i);
  });

  it('asks the full question to restart: no check-in today is a hold, though walking on goes ahead', () => {
    for (const c of [undefined, checkIn({ date: '2026-10-07' })]) {
      const i = input({ checkIn: c });
      expect(refusedBy(i)).toEqual(['start', 'restart']);
      expect(walkRefusal(i, 'restart')!.needsCheckIn).toBe(true);
    }
  });

  it('needs an insulin user’s reading from the last 30 minutes to restart, never to walk on', () => {
    const reading = (minutes: number) => input({
      profile: onInsulin,
      checkIn: checkIn({ glucose: { value: 140, unit: 'mg/dL', measuredAt: minutesBefore(NOW, minutes) } }),
    });
    expect(refusedBy(reading(30))).toEqual([]);
    // Just over: a paused walk may not start recording again on it (P09),
    // but a walk under way is not stopped by the reading ageing (F02).
    expect(refusedBy(reading(31))).toEqual(['start', 'restart']);
    expect(walkRefusal(reading(31), 'restart')!.needsCheckIn).toBe(true);
    expect(refusedBy(reading(90))).toEqual(['start', 'restart']);
  });
});

describe('every day’s effective record (round 3, B01 and B04)', () => {
  afterEach(() => {
    resetPendingCheckInsForTests();
    vi.useRealTimers();
  });

  const settings = { currentWeight: 82 } as AppData['settings'];
  const chest = (date: string): DailyCheckIn => ({ date, urgentSymptoms: true, emergency: ['chest'], news: [], sleep: 'gt7', energy: 4 });
  /** A save the device refuses, as the check-in sheet makes it. */
  const refusedSave = (answers: DailyCheckIn, stored: CheckInRecord[]) => saveCheckInRecord(answers, {
    profile: ordinary,
    update: async apply => {
      apply({ checkIns: stored } as AppData);
      return { ok: false };
    },
  });

  it('carries a 23:59 emergency to 00:01, before the new day has a check-in', () => {
    const lateEvening = checkIn({ date: '2026-10-08', urgentSymptoms: true, emergency: ['chest'] });
    const justAfter = new Date(2026, 9, 9, 0, 1);
    const i = walkInput({ profile: ordinary, checkIns: [lateEvening] }, justAfter);
    expect(i.checkIn).toBeUndefined();
    for (const intent of ALL) expect(walkRefusal(i, intent)?.disposition).toBe('emergency');
  });

  it('uses today’s record as the check-in and every day as the earlier ones', () => {
    const yesterday = checkIn({ date: '2026-10-07' });
    const today = checkIn();
    const i = walkInput({ profile: ordinary, checkIns: [yesterday, today] }, NOW);
    expect(i.checkIn).toBe(today);
    expect(i.recent).toEqual([yesterday, today]);
  });

  it('counts an answer the device refused to store: a chest pain whose save failed stops a walk', async () => {
    const day = toDateString(new Date());
    const stored = [checkIn({ date: day })];
    const gate = clinicalGate(() => deviceClinical({ profile: ordinary, checkIns: stored, settings }));
    for (const intent of ALL) expect(gate(intent)).toBe(true);
    const saved = await refusedSave(chest(day), stored);
    expect(saved.stored).toBe(false);
    // The store still holds the normal record; the effective one is the emergency.
    expect(deviceClinical({ profile: ordinary, checkIns: stored, settings }).checkIns.at(-1)!.emergency).toEqual(['chest']);
    for (const intent of ALL) expect(gate(intent)).toBe(false);
  });

  it('keeps a refused 23:59 emergency at 00:01 too', async () => {
    const stored = [checkIn({ date: '2026-10-08' })];
    await refusedSave(chest('2026-10-08'), stored);
    const gate = clinicalGate(() => deviceClinical({ profile: ordinary, checkIns: stored, settings }), () => new Date(2026, 9, 9, 0, 1));
    for (const intent of ALL) expect(gate(intent)).toBe(false);
  });

  it('holds everything on a device with no profile yet, rather than assuming a yes', () => {
    const gate = clinicalGate(() => deviceClinical({ profile: undefined, checkIns: [], settings }));
    for (const intent of ALL) expect(gate(intent)).toBe(false);
  });

  it('asks at the moment it is asked, not when it was made', () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T19:40:00+05:30') });
    const records = [checkIn({ date: toDateString(new Date()), glucose: { value: 140, unit: 'mg/dL', measuredAt: minutesBefore(new Date(), 29) } })];
    const gate = clinicalGate(() => ({ profile: onInsulin, checkIns: records }));
    expect(gate('restart')).toBe(true);
    vi.advanceTimersByTime(2 * 60_000);
    expect(gate('restart')).toBe(false);
    expect(gate('live')).toBe(true);
  });

  it('is told of every change that could alter the answer: the store, and answers waiting to be stored', async () => {
    const heard = vi.fn();
    const stop = watchClinical(heard);
    for (const l of [...storeListeners]) l();
    expect(heard).toHaveBeenCalledTimes(1);
    await refusedSave(chest(toDateString(new Date())), []);
    expect(heard.mock.calls.length).toBeGreaterThan(1);
    stop();
    const after = heard.mock.calls.length;
    for (const l of [...storeListeners]) l();
    await refusedSave(chest(toDateString(new Date())), []);
    expect(heard.mock.calls.length).toBe(after);
    expect(storeListeners.size).toBe(0);
  });
});
