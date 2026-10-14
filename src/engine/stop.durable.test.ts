/**
 * An unanswered stop is a durable incident (journey §4.4, H6R-01 and K6R-13,
 * board D170): "I need to stop" said and not answered holds every movement,
 * across midnight, until the stop's own questions answer it. A normal check-in
 * the next morning answers nothing. Asked of the real engine and the shared
 * report path over an in-memory store.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { Mode } from './permission';
import { createDefaultProfile } from '@/profile/defaults';
import { reportSymptoms, resetPendingCheckInsForTests, saveCheckInRecord, type StoreUpdate } from '@/components/checkin/pending';
import { carryForward } from '@/components/checkin/form';
import { STOPPED, stopAnswer } from '@/walk/stop';
import { permission } from './permission';
import { reachableHistory } from './reach';
import { evaluateCheckIn, evaluateDays, newsReadingId, STOP_UNANSWERED } from './readiness';

const p = createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } });
const MODES: Mode[] = ['guided', 'stretch', 'walk'];
const day = (date: string, over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });

/** An in-memory store and the shared path's two writers over it. */
function device() {
  const data = { checkIns: [] as CheckInRecord[] };
  const update: StoreUpdate = async apply => {
    data.checkIns = apply({ checkIns: data.checkIns } as AppData).checkIns ?? [];
    return { ok: true };
  };
  return {
    data,
    report: (r: Parameters<typeof reportSymptoms>[0], date: string, at: Date) => reportSymptoms(r, { profile: p, update, date }, at),
    checkIn: (c: DailyCheckIn) => saveCheckInRecord(c, { profile: p, update }),
    answer: (date: string, at: Date) => permissionsOn(data.checkIns, date, at),
  };
}

function permissionsOn(checkIns: readonly CheckInRecord[], date: string, now: Date) {
  const checkIn = checkIns.find(c => c.date === date);
  return MODES.map(mode => permission({ profile: p, ...(checkIn ? { checkIn } : {}), recent: [...checkIns], now }, mode));
}

afterEach(() => resetPendingCheckInsForTests());

describe('an unanswered stop carries across midnight until its own answer (H6R-01, K6R-13)', () => {
  const STOP_AT = new Date(2026, 9, 8, 23, 58);
  const MORNING = new Date(2026, 9, 9, 9, 0);

  it('holds every movement the next morning, after an otherwise normal check-in', async () => {
    const d = device();
    await d.checkIn(day('2026-10-08'));
    await d.report(STOPPED, '2026-10-08', STOP_AT);
    await d.checkIn(day('2026-10-09'));
    for (const answer of d.answer('2026-10-09', MORNING)) {
      expect(answer.allowed, answer.mode).toBe(false);
      expect(answer.reasons, answer.mode).toContain(STOP_UNANSWERED.reason);
    }
    // The day it was said is one the engine reads from today.
    expect(reachableHistory(d.data.checkIns, '2026-10-09', p).map(c => c.date)).toContain('2026-10-08');
  });

  it('lets go once the stop’s own questions answer it the next day, and keeps the answer as history', async () => {
    const d = device();
    await d.checkIn(day('2026-10-08'));
    await d.report(STOPPED, '2026-10-08', STOP_AT);
    await d.checkIn(day('2026-10-09'));
    await d.report(stopAnswer('rest', false).report!, '2026-10-09', MORNING);
    for (const answer of d.answer('2026-10-09', MORNING)) expect(answer.reasons, answer.mode).not.toContain(STOP_UNANSWERED.reason);
    const today = d.data.checkIns.find(c => c.date === '2026-10-09')!;
    expect(today.resolutions?.some(a => a.readings.includes(newsReadingId('2026-10-08', 'stopped')) && a.resolution === 'resolved')).toBe(true);
  });

  it('records the answer to a stop said today, so its "stopped" coming back from an older copy reopens nothing', async () => {
    const d = device();
    await d.checkIn(day('2026-10-09'));
    await d.report(STOPPED, '2026-10-09', new Date(2026, 9, 9, 10, 0));
    await d.report(stopAnswer('rest', false).report!, '2026-10-09', new Date(2026, 9, 9, 10, 5));
    const answered = d.data.checkIns.find(c => c.date === '2026-10-09')!;
    expect(answered.news).not.toContain('stopped');
    expect(answered.resolutions?.some(a => a.readings.includes(newsReadingId('2026-10-09', 'stopped')) && a.resolution === 'resolved')).toBe(true);
    // The day as an older copy put it back: the answer still stands.
    const putBack = { ...answered, news: [...answered.news, 'stopped' as const] };
    const later = new Date(2026, 9, 9, 10, 10);
    for (const mode of MODES) expect(permission({ profile: p, checkIn: { ...putBack, readiness: evaluateCheckIn(p, putBack) }, recent: [], now: later }, mode).reasons).not.toContain(STOP_UNANSWERED.reason);
  });

  it('holds again for a new stop after an answered one', async () => {
    const d = device();
    await d.checkIn(day('2026-10-09'));
    await d.report(STOPPED, '2026-10-09', new Date(2026, 9, 9, 10, 0));
    await d.report(stopAnswer('rest', false).report!, '2026-10-09', new Date(2026, 9, 9, 10, 5));
    await d.report(STOPPED, '2026-10-09', new Date(2026, 9, 9, 11, 0));
    for (const answer of d.answer('2026-10-09', new Date(2026, 9, 9, 11, 1))) expect(answer.reasons, answer.mode).toContain(STOP_UNANSWERED.reason);
    // The reopening is the check-in's own (`carryForward`): a stop said again after its answer.
    const saved = d.data.checkIns.find(c => c.date === '2026-10-09')!;
    expect(saved.resolutions?.at(-1)?.resolution).toBe('reopened');
    expect(carryForward(saved, saved).resolutions?.length).toBe(saved.resolutions?.length);
  });

  it('is a day the gates read for days on, however many check-ins come after it', async () => {
    const d = device();
    await d.checkIn(day('2026-10-07'));
    await d.report(STOPPED, '2026-10-07', new Date(2026, 9, 7, 18, 0));
    await d.checkIn(day('2026-10-08'));
    await d.checkIn(day('2026-10-09'));
    const reach = reachableHistory(d.data.checkIns, '2026-10-09', p);
    expect(reach.map(c => c.date)).toContain('2026-10-07');
    // As the walk's gate reads it: only the reachable days.
    const today = reach.find(c => c.date === '2026-10-09')!;
    for (const mode of MODES) expect(permission({ profile: p, checkIn: today, recent: reach, now: MORNING }, mode).reasons, mode).toContain(STOP_UNANSWERED.reason);
  });

  it('reads the same from a history prepared once, as Trends and the week read it', async () => {
    const d = device();
    await d.checkIn(day('2026-10-08'));
    await d.report(STOPPED, '2026-10-08', STOP_AT);
    await d.checkIn(day('2026-10-09'));
    const today = d.data.checkIns.find(c => c.date === '2026-10-09')!;
    const fast = evaluateDays(p, d.data.checkIns, [today], MORNING).get(today)!;
    expect(fast.reasons.map(r => r.message)).toContain(STOP_UNANSWERED.reason);
    expect(fast.disposition).toBe('hold');
  });

  it('carries a stop said again after its answer, the same day, into the next', async () => {
    const d = device();
    await d.checkIn(day('2026-10-08'));
    await d.report(STOPPED, '2026-10-08', new Date(2026, 9, 8, 20, 0));
    await d.report(stopAnswer('rest', false).report!, '2026-10-08', new Date(2026, 9, 8, 20, 5));
    await d.report(STOPPED, '2026-10-08', STOP_AT);
    await d.checkIn(day('2026-10-09'));
    for (const answer of d.answer('2026-10-09', MORNING)) expect(answer.reasons, answer.mode).toContain(STOP_UNANSWERED.reason);
  });

  it('is not answered by a check-in that leaves the stop out: only its own questions release it', async () => {
    const d = device();
    await d.checkIn(day('2026-10-08'));
    await d.report(STOPPED, '2026-10-08', STOP_AT);
    await d.checkIn(day('2026-10-09', { news: [] }));
    await d.checkIn(day('2026-10-09', { news: [], energy: 5 }));
    for (const answer of d.answer('2026-10-09', MORNING)) expect(answer.allowed, answer.mode).toBe(false);
  });
});
