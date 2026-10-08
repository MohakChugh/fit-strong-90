import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { createDefaultProfile } from '@/profile/defaults';
import { toDateString } from '@/lib/utils';
import { evaluateCheckIn, TREAT } from '@/engine/readiness';
import { addGapTime, finishWalk, leaveWalk, returnToWalk, startWalk, updateOpenSegment, type Walk } from './clock';
import type { LiveSnapshot } from './live';
import { summarise } from './record';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import type { CheckInRecord } from '@/types/checkin';
import {
  distanceFigure,
  draftWarning,
  endingLine,
  heldAction,
  heldLowAdvice,
  lowAdvice,
  lowOpen,
  lowReportedDuring,
  lowStage,
  reportNote,
  noticeText,
  paceFigure,
  recordingLine,
  spokenProgress,
  stepsFigure,
  summaryRows,
  targetLine,
  wakeHint,
  liveTitle,
  walkSpan,
  walkTitle,
} from './readout';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const time = () => '7:10 pm';

function snapshot(over: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return {
    walk: startWalk('abcd-1234', { kind: 'walk', gps: true, steps: true }, T),
    now: T,
    observedMs: 0,
    gps: { state: 'acquiring' },
    distanceM: 0,
    distanceMeasured: false,
    steps: 0,
    stepsState: 'waiting',
    wake: 'held',
    notice: null,
    blocked: null,
    draftKept: true,
    ...over,
  };
}

describe('live figures', () => {
  it('never shows a pace it does not have', () => {
    for (const state of ['acquiring', 'measuring', 'still'] as const) {
      expect(paceFigure({ state })).toMatchObject({ value: 'Measuring pace…' });
      expect(paceFigure({ state })!.unit).toBeUndefined();
    }
    expect(paceFigure({ state: 'lost' })!.value).toBe('No GPS signal');
    expect(paceFigure({ state: 'weak' })!.value).toBe('Weak GPS signal');
    expect(paceFigure({ state: 'denied' })).toEqual({ value: 'Location is off', note: 'The walk is still being timed.' });
    expect(paceFigure({ state: 'ok', secPerKm: 769.2 })).toEqual({ value: '12:49', unit: 'min/km', note: 'Recent pace, GPS estimate' });
    expect(paceFigure({ state: 'off' })).toBeUndefined();
  });

  it('does not call distance 0 km before GPS has measured anything', () => {
    expect(distanceFigure(snapshot())).toEqual({ value: 'Measuring…', note: 'Distance measured by GPS' });
    expect(distanceFigure(snapshot({ distanceMeasured: true, distanceM: 650, gps: { state: 'lost' } }))).toMatchObject({ value: '0.65', unit: 'km' });
    expect(distanceFigure(snapshot({ gps: { state: 'denied' } }))!.value).toBe('Not measured');
    expect(distanceFigure(snapshot({ gps: { state: 'off' } }))).toBeUndefined();
  });

  it('says why steps are not being counted', () => {
    expect(stepsFigure('counting', 1204, 'en-US')).toEqual({ value: '1,204', unit: 'steps', note: 'Counted while the app is open' });
    expect(stepsFigure('counting', 1, 'en-US')!.unit).toBe('step');
    expect(stepsFigure('needsPermission', 0)!.note).toMatch(/tap/);
    expect(stepsFigure('denied', 0)!.value).toBe('Not counting');
    expect(stepsFigure('noSensor', 0)!.value).toBe('Not counting');
    expect(stepsFigure('off', 0)).toBeUndefined();
  });

  it('counts down to a target, then says it was reached', () => {
    expect(targetLine(0, undefined)).toBeUndefined();
    expect(targetLine(0, 10)).toBe('Your target is 10 min · 10:00 to go');
    expect(targetLine(9 * 60_000 + 59_500, 10)).toBe('Your target is 10 min · 0:01 to go');
    expect(targetLine(10 * 60_000, 10)).toBe('You reached your 10 minutes');
  });

  it('says plainly whether anything is being recorded, and when the screen may sleep', () => {
    const s = snapshot();
    expect(recordingLine(s)).toBe('Recording while this screen is open');
    expect(recordingLine({ ...s, walk: { ...s.walk, status: 'paused' } })).toMatch(/^Paused/);
    // Away, or held because movement is refused: neither is recording.
    expect(recordingLine({ ...s, walk: { ...s.walk, status: 'away' } })).toMatch(/^Paused/);
    expect(recordingLine({ ...s, blocked: 'live' })).toBe('On hold. Nothing is being recorded.');
    expect(recordingLine({ ...s, walk: { ...s.walk, status: 'away' }, blocked: 'restart' })).toMatch(/^On hold/);

    expect(wakeHint({ wake: 'held', walk: s.walk, blocked: null })).toBeUndefined();
    expect(wakeHint({ wake: 'pending', walk: s.walk, blocked: null })).toBeUndefined();
    expect(wakeHint({ wake: 'unavailable', walk: s.walk, blocked: null })).toBe('Keep the screen on to keep recording.');
    // Paused or held, nothing is being recorded, so a dark screen loses nothing.
    expect(wakeHint({ wake: 'unavailable', walk: { ...s.walk, status: 'paused' }, blocked: null })).toBeUndefined();
    expect(wakeHint({ wake: 'unavailable', walk: s.walk, blocked: 'live' })).toBeUndefined();
  });

  it('F08: says plainly when the walk in progress would not survive a reload', () => {
    expect(draftWarning(true, 'live')).toBeUndefined();
    expect(draftWarning(true, 'summary')).toBeUndefined();
    expect(draftWarning(false, 'live')).toBe('This phone would not store the walk in progress, so a reload would lose the latest of it. Finish to save it.');
    expect(draftWarning(false, 'summary')).toBe('This phone would not store this unsaved walk, so a reload would lose it. Save it now.');
  });

  it('gives screen readers a minute-by-minute line', () => {
    expect(spokenProgress(snapshot({ observedMs: 125_000, distanceMeasured: true, distanceM: 160, stepsState: 'counting', steps: 230 })))
      .toBe('2 minutes recorded, 0.16 kilometres, 230 steps.');
    expect(spokenProgress(snapshot({ observedMs: 60_000 }))).toBe('1 minute recorded.');
  });

  it('gives the time a walk ran, once when it is all one minute, with the date when it was not today', () => {
    const at = (t: number) => (t < T + 60_000 ? '7:40 pm' : '8:05 pm');
    const day = (t: number) => toDateString(new Date(t));
    expect(walkSpan(T, T + 20_000, { time: at })).toBe('7:40 pm');
    expect(walkSpan(T, T + 1_500_000, { time: at, today: day(T) })).toBe('7:40 pm to 8:05 pm');
    const yesterday = walkSpan(T, T + 1_500_000, { time: at, today: day(T + 86_400_000) });
    expect(yesterday).toBe(`${format(new Date(T), 'EEE d MMM')}, 7:40 pm to 8:05 pm`);
  });

  it('names an after-meal walk, briefly in the live bar', () => {
    const meal = { plan: { kind: 'afterMeal' as const, meal: { which: 'breakfast' as const, startedAt: T }, gps: false, steps: false } };
    expect(walkTitle(meal)).toBe('Walk after breakfast');
    expect(liveTitle(meal)).toBe('After breakfast');
    expect(walkTitle({ plan: { kind: 'walk', gps: false, steps: false } })).toBe('Walk');
    expect(liveTitle({ plan: { kind: 'walk', gps: false, steps: false } })).toBe('Walk');
  });
});

describe('coming back', () => {
  const gap = (ms: number, cause: 'hidden' | 'left' = 'hidden') => ({ start: T, end: T + ms, cause, added: false });

  it('asks continue or finish, and offers to add a minute or more', () => {
    expect(noticeText({ kind: 'away', gapIndex: 0, gap: gap(240_000) })).toEqual({
      message: 'Recording paused while the app was away, for 4 min. Continue walking, or finish?',
      add: 'I kept walking: add 4 min',
    });
    const short = noticeText({ kind: 'away', gapIndex: 0, gap: gap(25_000) });
    expect(short.message).toMatch(/for 25 seconds/);
    expect(short.add).toBeUndefined();
    expect(noticeText({ kind: 'away', gapIndex: 0, gap: gap(90_000, 'left') }).message).toMatch(/while this screen was closed/);
  });

  it('confirms added time as time the person entered', () => {
    expect(noticeText({ kind: 'added', gap: gap(240_000) }).message).toBe('Added 4 min as time you entered. It is kept separate from recorded time.');
  });
});

describe('summary rows', () => {
  function walked(): Walk {
    let w = startWalk('abcd-1234', { kind: 'afterMeal', meal: { which: 'dinner', startedAt: T - 600_000 }, gps: true, steps: true }, T);
    w = updateOpenSegment(w, s => ({ ...s, gps: [{ start: T, end: T + 1_000_000, distanceM: 1300 }], steps: 2015, motion: true }));
    w = returnToWalk(leaveWalk(w, T + 1_080_000, 'hidden'), T + 1_380_000).walk;
    return finishWalk(w, T + 1_390_000, 'finish');
  }

  it('lists what was measured and how', () => {
    const w = walked();
    expect(summaryRows(w, summarise(w), { locale: 'en-US', time })).toEqual([
      { label: 'After dinner', value: 'Started 7:10 pm', detail: 'When the meal started' },
      { label: 'Distance', value: '1.30 km', detail: 'Measured by GPS' },
      { label: 'Average pace', value: '12:49 min/km', detail: 'GPS estimate' },
      { label: 'Steps', value: '2,015', detail: 'Counted while the app was open' },
      { label: 'Not recorded', value: '5 min', detail: 'The app was away, so this time is not counted' },
    ]);
  });

  it('shows added time instead of a gap once the person adds it', () => {
    const w = addGapTime(walked(), 0);
    const rows = summaryRows(w, summarise(w), { locale: 'en-US', time });
    expect(rows.find(r => r.label === 'Time you added')).toEqual({ label: 'Time you added', value: '5 min', detail: 'Entered by you for time the app was away' });
    expect(rows.find(r => r.label === 'Not recorded')).toBeUndefined();
  });

  it('warns that distance may be short when GPS covered little of the walk', () => {
    let w = startWalk('abcd-1234', { kind: 'walk', gps: true, steps: false }, T);
    w = updateOpenSegment(w, s => ({ ...s, gps: [{ start: T, end: T + 200_000, distanceM: 300 }] }));
    w = finishWalk(w, T + 600_000, 'finish');
    expect(summaryRows(w, summarise(w), { time })[0].detail).toMatch(/may be short/);
  });

  it('says what was not measured, and lists nothing that was off', () => {
    const noSignal = finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: true, steps: true }, T), T + 300_000, 'finish');
    expect(summaryRows(noSignal, summarise(noSignal), { time }).map(r => [r.label, r.value])).toEqual([
      ['Distance', 'Not measured'],
      ['Steps', 'Not counted'],
    ]);
    const off = finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, T), T + 300_000, 'finish');
    expect(summaryRows(off, summarise(off), { time })).toEqual([]);
  });

  it('explains a walk that was finished because it was left open', () => {
    const left = returnToWalk(leaveWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, T), T + 600_000, 'hidden'), T + 99_000_000).walk;
    expect(endingLine(left, time)).toBe('This walk was left open, so it was finished at 7:10 pm, when the app last saw it. Here is what was recorded.');
    expect(endingLine(finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, T), T + 1, 'finish'), time)).toBeUndefined();
  });
});

describe('the low guidance', () => {
  it('shows the treatment the check-in actually gives for a low', () => {
    // Walk shows `TREAT`; this holds the check-in to giving the same sentence.
    const profile = createDefaultProfile({
      health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'vigorous' },
    });
    const readiness = evaluateCheckIn(profile, { date: '2026-10-08', urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, glucose: { value: 50, unit: 'mg/dL' } }, []);
    expect(JSON.stringify(readiness)).toContain(TREAT);
  });
});

describe('the held screen (N01, N06)', () => {
  const hold = (over: Partial<Permission> = {}): Permission =>
    ({ mode: 'walk', allowed: false, disposition: 'hold', reasons: ['Check in first.'], restrictions: [], codes: [], needsCheckIn: true, ...over });

  it('offers help before any form in an emergency, the low reading after "I feel low", else the check-in', () => {
    expect(heldAction(hold({ disposition: 'emergency', needsCheckIn: false }), true)).toBe('emergency');
    expect(heldAction(hold({ disposition: 'emergency' }), false)).toBe('emergency');
    expect(heldAction(hold(), true)).toBe('lowReading');
    expect(heldAction(hold(), false)).toBe('checkIn');
    // Held until today's answers change — dizzy, say — the check-in is how they change.
    expect(heldAction(hold({ needsCheckIn: false, reasons: ['Dizzy or faint on standing or when active: sit or lie down somewhere safe.'] }), false)).toBe('checkIn');
    // Held for the health questions: those are answered in the profile, not the check-in.
    expect(heldAction(hold({ needsCheckIn: false, reasons: [PERMISSION_TEXT.healthUnreviewed] }), false)).toBe('profile');
    expect(heldAction(hold({ needsCheckIn: false, reasons: [PERMISSION_TEXT.medicinesUnknown] }), false)).toBe('profile');
    // Both missing: the profile first, since no check-in can answer it.
    expect(heldAction(hold({ needsCheckIn: true, reasons: [PERMISSION_TEXT.healthUnreviewed, PERMISSION_TEXT.noCheckIn] }), false)).toBe('profile');
  });

  it('sees a low reported during this walk as open until the symptoms are said to have gone', () => {
    const walk = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T);
    const record = (over: Partial<CheckInRecord>): CheckInRecord =>
      ({ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, readiness: {} as CheckInRecord['readiness'], ...over });
    const at = (ms: number) => new Date(T + ms).toISOString();
    expect(lowOpen(record({ news: ['lowSymptoms'], lowSymptomsAt: at(300_000) }), walk)).toBe(true);
    expect(lowOpen(record({ news: [], lowSymptomsAt: at(300_000) }), walk)).toBe(false);
    // Reported before this walk began: that one is not this walk's to follow up.
    expect(lowOpen(record({ news: ['lowSymptoms'], lowSymptomsAt: at(-600_000) }), walk)).toBe(false);
    expect(lowOpen(undefined, walk)).toBe(false);
  });

  it('knows a low was reported during this walk even once its symptoms are said to have gone (M-05)', () => {
    const walk = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T);
    const record = (over: Partial<CheckInRecord>): CheckInRecord =>
      ({ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, readiness: {} as CheckInRecord['readiness'], ...over });
    const at = (ms: number) => new Date(T + ms).toISOString();
    expect(lowReportedDuring(record({ news: [], lowSymptomsAt: at(300_000) }), walk)).toBe(true);
    expect(lowReportedDuring(record({ news: ['lowSevere'], lowSymptomsAt: at(-600_000) }), walk)).toBe(false);
    expect(lowReportedDuring(undefined, walk)).toBe(false);
  });

  it('says plainly when the device would not keep a report, and that it still counts', () => {
    expect(reportNote(true)).toBeUndefined();
    expect(reportNote(false)).toMatch(/could not save/);
    expect(reportNote(false)).toMatch(/still counts/);
  });
});

describe('a walk that ended for an emergency', () => {
  it('says why on its summary', () => {
    const w = finishWalk(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T), T + 300_000, 'emergency');
    expect(endingLine(w)).toBe('This walk ended because of symptoms that need emergency help.');
  });
});

describe('after a walk ended for a low (X2-13)', () => {
  const walk = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T);
  const at = (minutes: number) => T + minutes * 60_000;
  const isoAt = (minutes: number) => new Date(at(minutes)).toISOString();
  const record = (over: Partial<CheckInRecord>): CheckInRecord =>
    ({ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, readiness: {} as CheckInRecord['readiness'], ...over });
  const felt = { news: ['lowSymptoms' as const], lowSymptomsAt: isoAt(10) };

  it('times the re-check from the low itself, not from when the walk finished', () => {
    // "I feel low" at +10, nothing measured: due at +25, whenever the walk ended.
    expect(lowStage(record(felt), walk, at(21))).toEqual({ stage: 'untreated', since: at(10), recheckAt: at(25) });
    expect(lowStage(record(felt), walk, at(26))).toEqual({ stage: 'due', since: at(10), recheckAt: at(25) });
  });

  it('takes the engine’s own re-check time once a low reading is in, and counts it as treated', () => {
    // The episode began with a low at +11; a second low at +13 does not restart the clock.
    const measured = record({ ...felt, glucose: { value: 62, unit: 'mg/dL', measuredAt: isoAt(13) }, readiness: { recheckAt: isoAt(26) } as CheckInRecord['readiness'] });
    expect(lowStage(measured, walk, at(21))).toEqual({ stage: 'waiting', since: at(11), recheckAt: at(26) });
    expect(lowStage(measured, walk, at(26))).toEqual({ stage: 'due', since: at(11), recheckAt: at(26) });
  });

  it('has said its piece once a reading since the low is not low, and counts a meter showing LO as low', () => {
    expect(lowStage(record({ ...felt, glucose: { value: 110, unit: 'mg/dL', measuredAt: isoAt(12) } }), walk, at(20))).toBeUndefined();
    expect(lowStage(record({ ...felt, glucoseDisplay: { display: 'LO', measuredAt: isoAt(12) } }), walk, at(20)))
      .toEqual({ stage: 'waiting', since: at(12), recheckAt: at(27) });
  });

  it('times a severe low from its reading, which the engine gives no re-check time', () => {
    const severe = record({ ...felt, glucose: { value: 45, unit: 'mg/dL', measuredAt: isoAt(12) } });
    expect(lowStage(severe, walk, at(20))).toEqual({ stage: 'waiting', since: at(12), recheckAt: at(27) });
  });

  it('has nothing to say without a low reported on this walk', () => {
    expect(lowStage(undefined, walk, at(20))).toBeUndefined();
    expect(lowStage(record({ news: ['lowSymptoms'], lowSymptomsAt: new Date(T - 60_000).toISOString() }), walk, at(20))).toBeUndefined();
  });

  it('puts the same words on the hold card once a low reading is in (J2-03)', () => {
    const time = (t: number) => String(t);
    const waiting = { stage: 'waiting' as const, since: at(11), recheckAt: at(26) };
    const due = { stage: 'due' as const, since: at(11), recheckAt: at(26) };
    expect(heldLowAdvice(waiting, time)).toEqual(lowAdvice(waiting, time));
    expect(heldLowAdvice(due, time)).toEqual(lowAdvice(due, time));
    // Before any reading the card already carries the engine's own words: check now, or treat it if you cannot.
    expect(heldLowAdvice({ stage: 'untreated', since: at(10), recheckAt: at(25) }, time)).toBeUndefined();
    expect(heldLowAdvice(undefined, time)).toBeUndefined();
  });

  it('gives the treatment with the re-check time until the re-check, and again if the re-check finds it still low', () => {
    const time = (t: number) => (t === at(25) ? '10:25' : t === at(11) ? '10:11' : t === at(26) ? '10:26' : '?');
    const untreated = lowAdvice({ stage: 'untreated', since: at(10), recheckAt: at(25) }, time);
    expect(untreated.lines).toContain(TREAT);
    expect(untreated.lines.join(' ')).toMatch(/10:25/);
    // A low reading is in and not yet re-checked: the treatment and the re-check time, as the player gives them (J2-03).
    const waiting = lowAdvice({ stage: 'waiting', since: at(11), recheckAt: at(26) }, time);
    expect(waiting.lines).toContain(TREAT);
    expect(waiting.title).toMatch(/10:26/);
    expect(waiting.lines.join(' ')).toMatch(/10:26/);
    expect(waiting.lines.join(' ')).toMatch(/10:11/);
    const due = lowAdvice({ stage: 'due', since: at(11), recheckAt: at(26) }, time);
    expect(due.lines[0]).toBe('Check your glucose now.');
    expect(due.lines.join(' ')).toContain(TREAT);
  });
});
