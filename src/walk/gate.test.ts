import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { PERMISSION_TEXT, type Permission, type PermissionInput } from '@/engine/permission';
import { toDateString } from '@/lib/utils';
import { resetPendingCheckInsForTests, saveCheckInRecord } from '@/components/checkin/pending';
import { allowsMovement, clinicalGate, deviceClinical, deviceGate, heldBy, STATUS_HOLD, statusRefusal, storeStartPermission, walkInput, walkRefusal, watchClinical } from './gate';
import { clockGeneration, takenHere, UNASKED, withClockChange } from './consent';
import { STOP_UNANSWERED } from '@/engine/readiness';
import type { WalkIntent } from './live';

/** The store's own change notifications, so a test can fire them. */
const storeListeners = vi.hoisted(() => new Set<() => void>());
/** What the device holds, when a test sets it: the store's state otherwise. */
const device = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock('@/store/useStore', async importOriginal => {
  const real = await importOriginal<typeof import('@/store/useStore')>();
  return {
    ...real,
    getState: () => (device.state ?? real.getState()) as ReturnType<typeof real.getState>,
    subscribe: (listener: () => void) => {
      storeListeners.add(listener);
      return () => void storeListeners.delete(listener);
    },
  };
});

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

describe('a change to the phone’s clock mid-walk (B-19, the conservative path, held by the device: H6R-02, H6R-03, board D174)', () => {
  const taken = { value: 140, unit: 'mg/dL' as const, measuredAt: minutesBefore(NOW, 10), source: 'meter' as const };
  /** The device after a walk saw the change around today: its hold, on every day the gates read. */
  const hold = withClockChange(UNASKED, [TODAY]).clock!;
  const held = (c: CheckInRecord): CheckInRecord => ({ ...c, clockHold: hold });
  const clinical = { profile: onInsulin, checkIns: [checkIn({ glucose: taken })] };
  const after = { profile: onInsulin, checkIns: clinical.checkIns.map(held) };
  /** A reading taken on this phone since the change: of its new clock generation. */
  const since = { ...taken, value: 130, measuredAt: minutesBefore(NOW, 2), gen: hold.generation };

  it('lets a restart go on a reading taken 10 minutes ago', () => {
    expect(walkRefusal(walkInput(clinical, NOW), 'restart')).toBeUndefined();
  });

  it('holds a Track reading from before the change too, and lets one taken since go', () => {
    const logged = (glucose: object) => ({ profile: onInsulin, checkIns: [held(checkIn({ logged: { glucose: [{ value: 120, unit: 'mg/dL', measuredAt: minutesBefore(NOW, 5), unitConfirmed: true, source: 'meter', ...glucose }] } }))] });
    expect(walkRefusal(walkInput(logged({}), NOW), 'restart')?.reasons).toContain(PERMISSION_TEXT.clockChanged);
    expect(walkRefusal(walkInput(logged({ gen: hold.generation }), NOW), 'restart')).toBeUndefined();
  });

  it('holds a restart on a reading from before the change, however its time reads now', () => {
    expect(walkRefusal(walkInput(after, NOW), 'restart')?.reasons).toContain(PERMISSION_TEXT.clockChanged);
    // Set back: the same reading timed a minute in the future, which the freshness rule alone would let pass.
    const ahead = { profile: onInsulin, checkIns: [checkIn({ glucose: { ...taken, measuredAt: minutesBefore(NOW, -1) } })] };
    expect(walkRefusal(walkInput(ahead, NOW), 'restart')).toBeUndefined();
    expect(walkRefusal(walkInput({ ...ahead, checkIns: ahead.checkIns.map(held) }, NOW), 'restart')?.reasons).toContain(PERMISSION_TEXT.clockChanged);
  });

  it('holds walking under way too: carrying on needs a reading taken since the change (H6-02)', () => {
    const live = walkRefusal(walkInput(after, NOW), 'live');
    expect(live).toMatchObject({ allowed: false, disposition: 'hold', needsCheckIn: true });
    expect(live?.reasons).toContain(PERMISSION_TEXT.clockChanged);
  });

  it('keeps a reading taken after the change', () => {
    const fresh = { profile: onInsulin, checkIns: [held(checkIn({ glucose: since, glucoseEarlier: [taken] }))] };
    expect(walkRefusal(walkInput(fresh, NOW), 'restart')).toBeUndefined();
    expect(walkRefusal(walkInput(fresh, NOW), 'live')).toBeUndefined();
  });

  it('asks for a reading on a day the change reached with none, and for no one who needs none', () => {
    // Walking on past midnight: the change reached the new day, which holds no record yet.
    const tomorrow = toDateString(new Date(NOW.getTime() + 86_400_000));
    const reached = { generation: 1, days: [TODAY, tomorrow] };
    const night = new Date(`${tomorrow}T00:05:00+05:30`);
    expect(walkRefusal(walkInput({ profile: onInsulin, checkIns: [{ ...checkIn({ glucose: taken }), clockHold: reached }] }, night), 'live')?.reasons).toContain(PERMISSION_TEXT.clockChanged);
    expect(walkRefusal(walkInput({ profile: ordinary, checkIns: [held(checkIn())] }, NOW), 'live')).toBeUndefined();
    expect(walkRefusal(walkInput({ profile: ordinary, checkIns: [held(checkIn())] }, NOW), 'restart')).toBeUndefined();
  });

  it('is asked of the device’s own gates with the change, as the live walk asks them, a new walk’s start included', () => {
    const settings = (walk?: AppData['settings']['walk']) => ({ currentWeight: 70, ...(walk ? { walk } : {}) }) as AppData['settings'];
    const state = (walk?: AppData['settings']['walk'], checkIns = clinical.checkIns) => ({ profile: onInsulin, checkIns, settings: settings(walk) });
    expect(deviceGate(() => state(), () => NOW)('restart')).toBe(true);
    const changedHere = withClockChange(UNASKED, [TODAY]);
    for (const intent of ['start', 'restart', 'live'] as const) {
      expect(deviceGate(() => state(changedHere), () => NOW)(intent), intent).toBe(false);
      expect(clinicalGate(() => after, () => NOW)(intent), intent).toBe(false);
    }
    expect(deviceGate(() => state(changedHere, [checkIn({ glucose: since, glucoseEarlier: [taken] })]), () => NOW)('restart')).toBe(true);
  });
});

describe('B-01’s final gate, asked of what the device holds at that moment', () => {
  afterEach(() => { device.state = undefined; });
  const reading = (minutes: number) => ({ glucose: { value: 140, unit: 'mg/dL' as const, measuredAt: minutesBefore(NOW, minutes), source: 'meter' as const } });

  it('starts on a reading taken 10 minutes ago, and not on one taken 40 minutes ago', () => {
    device.state = { profile: onInsulin, checkIns: [checkIn(reading(10))], settings: { currentWeight: 70 }, observations: [] };
    expect(allowsMovement(storeStartPermission(NOW))).toBe(true);
    device.state = { profile: onInsulin, checkIns: [checkIn(reading(40))], settings: { currentWeight: 70 }, observations: [] };
    expect(allowsMovement(storeStartPermission(NOW))).toBe(false);
  });

  it('asks the start question, so no check-in today is no start', () => {
    device.state = { profile: ordinary, checkIns: [], settings: { currentWeight: 70 }, observations: [] };
    const p = storeStartPermission(NOW);
    expect(allowsMovement(p)).toBe(false);
    expect(p.needsCheckIn).toBe(true);
  });
});

describe('the device’s clock changes (B-19, board D174)', () => {
  it('none until a walk sees one; each moves the generation on, so a reading taken between two changes is held after the second', () => {
    expect(clockGeneration({})).toBe(0);
    const once = withClockChange(UNASKED, [TODAY, TODAY]);
    expect(once.clock).toEqual({ generation: 1, days: [TODAY] });
    expect(clockGeneration({ walk: once })).toBe(1);
    const twice = withClockChange(once, ['2026-10-09']);
    expect(twice.clock).toEqual({ generation: 2, days: ['2026-10-09'] });
    // The consents and markers stay as they were.
    expect(withClockChange({ saveRoutes: true, map: 'off', routesErasedAt: 5 }, [TODAY])).toMatchObject({ saveRoutes: true, map: 'off', routesErasedAt: 5 });
    const between = { value: 130, unit: 'mg/dL' as const, measuredAt: minutesBefore(NOW, 2), gen: 1 };
    const day = { ...checkIn({ date: '2026-10-09', glucose: between }), clockHold: twice.clock };
    expect(walkRefusal(walkInput({ profile: onInsulin, checkIns: [day] }, new Date('2026-10-09T19:40:00+05:30')), 'restart')?.reasons).toContain(PERMISSION_TEXT.clockChanged);
  });

  it('stamps a glucose reading recorded here now with this phone’s generation, and nothing else', () => {
    const glucose = { kind: 'glucose' as const, value: 120, unit: 'mg/dL', scope: 'pointInTime' as const, source: 'manual' as const };
    expect(takenHere(glucose, 0)).toBe(glucose);
    expect(takenHere(glucose, 2)).toEqual({ ...glucose, gen: 2 });
    expect(takenHere({ ...glucose, gen: 1 }, 2)).toEqual({ ...glucose, gen: 1 });
    const steps = { kind: 'steps' as const, value: 900, scope: 'dayTotal' as const, source: 'manual' as const };
    expect(takenHere(steps, 2)).toBe(steps);
  });
});

describe('carrying a walk on asks the status first, as the hubs’ Continue does (H2-01, journey §4.8, A-34)', () => {
  it('refuses a restart while Away or Unwell, and in a flare-up, in the hubs’ words', () => {
    expect(statusRefusal('away', 'restart')).toMatchObject({ allowed: false, disposition: 'hold', reasons: [STATUS_HOLD.away], release: STATUS_HOLD.release, needsCheckIn: false });
    expect(statusRefusal('unwell', 'restart')?.reasons).toEqual(['A walk isn’t carried on while you’re unwell.']);
    expect(statusRefusal('flare', 'restart')?.reasons).toEqual(['During a flare-up only a stretch is carried on.']);
    expect(statusRefusal('normal', 'restart')).toBeUndefined();
  });

  it('asks nothing of a new walk (“Start anyway”) or one recording now: the status changes only off the walk screen, and coming back is a restart', () => {
    for (const status of ['away', 'unwell', 'flare'] as const) {
      expect(statusRefusal(status, 'start')).toBeUndefined();
      expect(statusRefusal(status, 'live')).toBeUndefined();
    }
  });

  it('is asked by the live walk’s own gate, from the device’s status today', () => {
    const settings = (statusPeriods?: { kind: 'unwell' | 'away' | 'flare'; from: string; to?: string }[]) =>
      ({ currentWeight: 70, ...(statusPeriods ? { statusPeriods } : {}) }) as AppData['settings'];
    const state = (s: AppData['settings']) => ({ profile: ordinary, checkIns: [checkIn()], settings: s });
    const unwell = deviceGate(() => state(settings([{ kind: 'unwell', from: TODAY }])), () => NOW);
    expect(unwell('restart')).toBe(false);
    expect(unwell('start')).toBe(true);
    expect(unwell('live')).toBe(true);
    expect(deviceGate(() => state(settings([{ kind: 'unwell', from: '2026-10-01', to: '2026-10-07' }])), () => NOW)('restart')).toBe(true);
    expect(deviceGate(() => state(settings()), () => NOW)('restart')).toBe(true);
  });

  it('shows a stop before the status, and the status before any other hold, as the hubs order them (§4.2)', () => {
    const status = statusRefusal('unwell', 'restart')!;
    const stop: Permission = { mode: 'walk', allowed: false, disposition: 'today', reasons: ['No exercise today.'], restrictions: [], needsCheckIn: false };
    const hold: Permission = { ...stop, disposition: 'hold', reasons: ['Check in first.'], needsCheckIn: true };
    expect(heldBy(stop, status)).toBe(stop);
    expect(heldBy({ ...stop, disposition: 'emergency' }, status)?.disposition).toBe('emergency');
    expect(heldBy(hold, status)).toBe(status);
    expect(heldBy(hold, undefined)).toBe(hold);
    expect(heldBy(undefined, status)).toBe(status);
    expect(heldBy(undefined, undefined)).toBeUndefined();
  });

  it('shows an unanswered stop before the status too, so "Say what happened" is never hidden by Away, Unwell or a flare-up (K6R-02)', () => {
    const status = statusRefusal('unwell', 'restart')!;
    const stopped: Permission = { mode: 'walk', allowed: false, disposition: 'hold', reasons: [STOP_UNANSWERED.reason], release: STOP_UNANSWERED.release, restrictions: [], needsCheckIn: false };
    expect(heldBy(stopped, status)).toBe(stopped);
    // Among other reasons too.
    const both = { ...stopped, reasons: ['Check in first.', STOP_UNANSWERED.reason] };
    expect(heldBy(both, status)).toBe(both);
  });
});
