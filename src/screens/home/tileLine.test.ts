import { describe, expect, it } from 'vitest';
import { PERMISSION_TEXT, permission, type Mode, type Permission } from '@/engine/permission';
import { evaluateCheckIn } from '@/engine/readiness';
import { createDefaultProfile } from '@/profile/defaults';
import type { Status } from '@/health/status';
import type { DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { movementLine, workoutNormal } from './tileLine';

const base: Permission = { mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false };
const hold = (...reasons: string[]): Permission => ({ ...base, allowed: false, disposition: 'hold', reasons });

describe('movementLine (journey §7.5)', () => {
  it('allowed: the normal line', () => {
    expect(movementLine({ mode: 'walk', permission: base, status: 'normal', normal: 'After lunch · 10–15 min' })).toEqual({ text: 'After lunch · 10–15 min', tone: 'normal' });
  });
  it('allowed with changes: the normal line, then "with changes"', () => {
    const p = { ...base, disposition: 'adjust' as const, restrictions: ['No intervals.'] };
    expect(movementLine({ mode: 'guided', permission: p, status: 'normal', normal: 'Full Body B · 45 min' }).text).toBe('Full Body B · 45 min · with changes');
  });
  it('emergency or no exercise today: "Not today", even while unwell (Review Focus 3)', () => {
    const p = { ...base, allowed: false, disposition: 'emergency' as const, reasons: [PERMISSION_TEXT.emergencyTitle] };
    expect(movementLine({ mode: 'stretch', permission: p, status: 'unwell', normal: 'x' })).toEqual({ text: 'Not today', tone: 'stop' });
    expect(movementLine({ mode: 'stretch', permission: { ...p, disposition: 'today' }, status: 'normal', normal: 'x' }).text).toBe('Not today');
  });
  it('away or unwell: "Paused"', () => {
    expect(movementLine({ mode: 'walk', permission: base, status: 'away', normal: 'x' })).toEqual({ text: 'Paused', tone: 'quiet' });
    expect(movementLine({ mode: 'walk', permission: base, status: 'unwell', normal: 'x' }).text).toBe('Paused');
  });
  it('a hold uses the gate’s own headline', () => {
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.footWalk), status: 'normal', normal: 'x' })).toEqual({ text: 'No walking for now', tone: 'caution' });
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.stale), status: 'normal', normal: 'x' }).text).toBe('Check glucose first');
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.staleNoTime), status: 'normal', normal: 'x' }).text).toBe('Check glucose first');
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.future), status: 'normal', normal: 'x' }).text).toBe('Check the reading’s time');
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.noCheckIn), status: 'normal', normal: 'x' }).text).toBe('Check in first');
    const low = { ...hold('Glucose 65 mg/dL is a low.'), release: 'Treat it, then re-check in 15 minutes.', needsCheckIn: true };
    expect(movementLine({ mode: 'stretch', permission: low, status: 'normal', normal: 'x' })).toEqual({ text: 'Waiting for your re-check', tone: 'caution' });
    expect(movementLine({ mode: 'walk', permission: hold('Something new the engine says.'), status: 'normal', normal: 'x' }).text).toBe('Not now: open to see why');
  });
  it('a check-in can’t release a foot restriction: the foot headline wins, in either order', () => {
    for (const reasons of [[PERMISSION_TEXT.footWalk, PERMISSION_TEXT.noCheckIn], [PERMISSION_TEXT.noCheckIn, PERMISSION_TEXT.footWalk]]) {
      for (const needsCheckIn of [false, true]) {
        expect(movementLine({ mode: 'walk', permission: { ...hold(...reasons), needsCheckIn }, status: 'normal', normal: 'Just a walk' })).toEqual({ text: 'No walking for now', tone: 'caution' });
      }
    }
  });
  it('flare-up: v1 plans gentler workouts and stretches; walking has no flare plan, so Walk keeps its line and suggests a stretch (L-08)', () => {
    expect(movementLine({ mode: 'guided', permission: base, status: 'flare', normal: 'x' }).text).toBe('Gentle only today');
    expect(movementLine({ mode: 'stretch', permission: base, status: 'flare', normal: 'x' }).text).toBe('Gentle stretch');
    expect(movementLine({ mode: 'walk', permission: base, status: 'flare', normal: 'Just a walk' })).toEqual({ text: 'Just a walk · Stretch is suggested today', tone: 'normal' });
    // A flare changes the suggestion, never the gate: a held mode stays held.
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.footWalk), status: 'flare', normal: 'Just a walk' }).text).toBe('No walking for now');
  });
  it('flare-up outside the programme: the Workout tile suggests a stretch and names no programme, whatever check-in it still needs (D35)', () => {
    const normal = workoutNormal({ enrolled: false, label: 'Full Body B', minutes: 45 });
    const checkInOnly = { ...hold(PERMISSION_TEXT.noCheckIn), needsCheckIn: true };
    const withChanges = { ...base, disposition: 'adjust' as const, restrictions: ['No intervals.'] };
    for (const permission of [base, withChanges, checkInOnly, { ...checkInOnly, reasons: [PERMISSION_TEXT.stale] }]) {
      expect(movementLine({ mode: 'guided', permission, status: 'flare', normal, enrolled: false })).toEqual({ text: 'Stretch is suggested today', tone: 'normal' });
    }
    // In the programme, the flare's recovery session, as before.
    expect(movementLine({ mode: 'guided', permission: base, status: 'flare', normal: 'Full Body B · 45 min', enrolled: true }).text).toBe('Gentle only today');
    // Only during a flare: on an ordinary day the tile still says the programme isn't joined.
    expect(movementLine({ mode: 'guided', permission: checkInOnly, status: 'normal', normal, enrolled: false }).text).toBe('12-week programme · not joined');
    // A stop, a setup gap or a safety hold keeps its own words.
    const stop = { ...base, allowed: false, disposition: 'today' as const, reasons: ['No exercise today.'] };
    expect(movementLine({ mode: 'guided', permission: stop, status: 'flare', normal, enrolled: false }).text).toBe('Not today');
    expect(movementLine({ mode: 'guided', permission: hold(PERMISSION_TEXT.medicinesUnknown), status: 'flare', normal, enrolled: false }).text).toBe('Finish setting up · your medicines');
    const low = { ...hold('Glucose 65 mg/dL is a low.'), release: 'Treat it, then re-check in 15 minutes.', needsCheckIn: true };
    expect(movementLine({ mode: 'guided', permission: low, status: 'flare', normal, enrolled: false }).text).toBe('Waiting for your re-check');
    // Stretch and Walk are not the programme: their flare lines stand.
    expect(movementLine({ mode: 'stretch', permission: base, status: 'flare', normal: 'x', enrolled: false }).text).toBe('Gentle stretch');
    expect(movementLine({ mode: 'walk', permission: base, status: 'flare', normal: 'Just a walk', enrolled: false }).text).toBe('Just a walk · Stretch is suggested today');
  });
  it('works out the flare line first, then says "check in first" for a hold only a check-in answers, except where there is nothing to check in for (kiro KV-03 to KV-05)', () => {
    const checkInOnly = { ...hold(PERMISSION_TEXT.noCheckIn), needsCheckIn: true };
    const notJoined = workoutNormal({ enrolled: false, label: 'Full Body B', minutes: 45 });
    // mode, status, the gate (allowed, or held only for the check-in), in the programme, the normal line, the tile's line
    const rows: [Mode, Status, 'allowed' | 'checkIn', boolean, string, string][] = [
      ['guided', 'normal', 'allowed', true, 'Full Body B · 45 min', 'Full Body B · 45 min'],
      ['guided', 'normal', 'checkIn', true, 'Full Body B · 45 min', 'Full Body B · 45 min · check in first'],
      ['guided', 'normal', 'allowed', false, notJoined, '12-week programme · not joined'],
      ['guided', 'normal', 'checkIn', false, notJoined, '12-week programme · not joined'],
      ['guided', 'flare', 'allowed', true, 'Full Body B · 45 min', 'Gentle only today'],
      ['guided', 'flare', 'checkIn', true, 'Full Body B · 45 min', 'Gentle only today · check in first'],
      ['guided', 'flare', 'allowed', false, notJoined, 'Stretch is suggested today'],
      ['guided', 'flare', 'checkIn', false, notJoined, 'Stretch is suggested today'],
      ['stretch', 'normal', 'allowed', true, '10 or 15 min', '10 or 15 min'],
      ['stretch', 'normal', 'checkIn', true, '10 or 15 min', '10 or 15 min · check in first'],
      ['stretch', 'flare', 'allowed', true, '10 or 15 min', 'Gentle stretch'],
      ['stretch', 'flare', 'checkIn', true, '10 or 15 min', 'Gentle stretch · check in first'],
      ['walk', 'normal', 'allowed', true, 'Just a walk', 'Just a walk'],
      ['walk', 'normal', 'checkIn', true, 'Just a walk', 'Just a walk · check in first'],
      ['walk', 'flare', 'allowed', true, 'Just a walk', 'Just a walk · Stretch is suggested today'],
      ['walk', 'flare', 'checkIn', true, 'Just a walk', 'Just a walk · Stretch is suggested today · check in first'],
    ];
    for (const [mode, status, gate, enrolled, normal, line] of rows) {
      // Stretch and Walk read the same in the programme or not.
      for (const joined of mode === 'guided' ? [enrolled] : [true, false]) {
        const p = gate === 'allowed' ? base : checkInOnly;
        expect(movementLine({ mode, permission: p, status, normal, enrolled: joined }), `${mode} ${status} ${gate} ${joined}`).toEqual({ text: line, tone: 'normal' });
      }
    }
  });
  it('a hold that only needs today’s check-in keeps the normal line and says so (L-03)', () => {
    const p = { ...base, allowed: false, disposition: 'hold' as const, reasons: [PERMISSION_TEXT.noCheckIn], needsCheckIn: true };
    expect(movementLine({ mode: 'guided', permission: p, status: 'normal', normal: 'Full Body B · 45 min' })).toEqual({ text: 'Full Body B · 45 min · check in first', tone: 'normal' });
    const stale = { ...p, reasons: [PERMISSION_TEXT.stale] };
    expect(movementLine({ mode: 'walk', permission: stale, status: 'normal', normal: 'Just a walk' }).text).toBe('Just a walk · check in first');
  });
  it('a profile gap says to finish setting up, naming the chapter (L-03)', () => {
    const p = { ...base, allowed: false, disposition: 'hold' as const, reasons: [PERMISSION_TEXT.medicinesUnknown], needsCheckIn: false };
    expect(movementLine({ mode: 'stretch', permission: p, status: 'normal', normal: 'x' })).toEqual({ text: 'Finish setting up · your medicines', tone: 'caution' });
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.healthUnreviewed), status: 'normal', normal: 'x' }).text).toBe('Finish setting up · your health');
  });
  it('the Workout tile’s normal line when not enrolled (D35, L-03)', () => {
    expect(workoutNormal({ enrolled: false, label: 'Full Body B', minutes: 45 })).toBe('12-week programme · not joined');
    expect(workoutNormal({ enrolled: true, label: 'Full Body B', minutes: 45 })).toBe('Full Body B · 45 min');
    // A rest day's plan has no session to time.
    expect(workoutNormal({ enrolled: true, label: 'Rest Day', minutes: 0 })).toBe('Rest Day');
  });
  it('a re-check names its time until it comes, then the gate’s own words stand (L-07)', () => {
    const low = { ...hold('Glucose 62 mg/dL is a low.'), release: 'Treat it, then re-check in 15 minutes.', needsCheckIn: true };
    const recheckAt = new Date('2026-10-08T13:45:00').toISOString();
    const line = (time: string) => movementLine({ mode: 'stretch', permission: low, status: 'normal', normal: 'x', recheckAt, now: new Date(`2026-10-08T${time}:00`), hour12: true }).text;
    expect(line('13:32')).toBe('Waiting for your re-check at 1:45 pm');
    expect(line('13:45')).toBe('Waiting for your re-check');
    expect(line('14:10')).toBe('Waiting for your re-check');
    expect(movementLine({ mode: 'stretch', permission: low, status: 'normal', normal: 'x', recheckAt, now: new Date('2026-10-08T13:32:00'), hour12: false }).text).toBe('Waiting for your re-check at 13:45');
    // Without the moment it is worked out at, no time is claimed.
    expect(movementLine({ mode: 'stretch', permission: low, status: 'normal', normal: 'x', recheckAt }).text).toBe('Waiting for your re-check');
    // A time never changes what outranks it: an emergency still reads "Not today", a foot hold still its own headline.
    expect(movementLine({ mode: 'stretch', permission: { ...low, disposition: 'emergency' }, status: 'normal', normal: 'x', recheckAt, now: new Date('2026-10-08T13:32:00') }).text).toBe('Not today');
    expect(movementLine({ mode: 'walk', permission: { ...low, reasons: [PERMISSION_TEXT.footWalk, ...low.reasons] }, status: 'normal', normal: 'x', recheckAt, now: new Date('2026-10-08T13:32:00') }).text).toBe('No walking for now');
  });
});

describe('movementLine with the real gate', () => {
  const now = new Date('2026-10-08T09:00:00');
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const checkIn = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
  const record = (profile: UserProfile, c: DailyCheckIn) => ({ ...c, readiness: evaluateCheckIn(profile, c) });
  const onInsulin = createDefaultProfile({ health: { diabetes: 'type2', insulin: 'injections_or_pump', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter' } });

  it('P06: a flare outside the programme, before the day’s check-in: no programme pressure on the Workout tile (acceptance J16 step 1)', () => {
    const profile = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' } });
    const p = permission({ profile, now }, 'guided');
    expect(p).toMatchObject({ allowed: false, needsCheckIn: true });
    const line = movementLine({ mode: 'guided', permission: p, status: 'flare', normal: workoutNormal({ enrolled: false, label: 'Full Body B', minutes: 45 }), enrolled: false });
    expect(line).toEqual({ text: 'Stretch is suggested today', tone: 'normal' });
    expect(line.text).not.toMatch(/Week \d+ of 12|programme|don.t break|make up/i);
  });

  it('P05: a foot wound holds Walk only; Stretch reads normally, before and after the check-in (Review Focus 1)', () => {
    const profile = createDefaultProfile({ health: { footStatus: 'current_wound_or_active_charcot', peripheralNeuropathy: 'yes' } });
    const line = (mode: 'walk' | 'stretch', normal: string, c?: DailyCheckIn) =>
      movementLine({ mode, permission: permission({ profile, now, ...(c ? { checkIn: record(profile, c) } : {}) }, mode), status: 'normal', normal });
    // No check-in yet: Walk's reasons are the foot and the missing check-in, and only the check-in can be answered.
    expect(line('walk', 'Just a walk')).toEqual({ text: 'No walking for now', tone: 'caution' });
    expect(line('stretch', 'Back & hips · 10 min')).toEqual({ text: 'Back & hips · 10 min · check in first', tone: 'normal' });
    // Checked in: walking is still held, and the stretch goes ahead, seated and on the floor.
    expect(line('walk', 'Just a walk', checkIn())).toEqual({ text: 'No walking for now', tone: 'caution' });
    expect(line('stretch', 'Back & hips · 10 min', checkIn())).toEqual({ text: 'Back & hips · 10 min · with changes', tone: 'normal' });
  });

  it('a stale reading on insulin reads "check in first", though the gate adds how old it is (L-03)', () => {
    const p = permission({ profile: onInsulin, checkIn: record(onInsulin, checkIn({ glucose: { value: 140, unit: 'mg/dL', measuredAt: minutesAgo(45) } })), now }, 'walk');
    expect(p.reasons).toEqual([expect.stringContaining('Your last reading was 45 minutes ago.')]);
    expect(movementLine({ mode: 'walk', permission: p, status: 'normal', normal: 'Just a walk' })).toEqual({ text: 'Just a walk · check in first', tone: 'normal' });
  });

  it('a 62 mg/dL at 1:30 pm: every movement tile waits for the re-check at 1:45 pm, then drops the time', () => {
    const at = (time: string) => new Date(`2026-10-08T${time}:00`);
    const p = createDefaultProfile({ health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    const record = (c: DailyCheckIn) => ({ ...c, readiness: evaluateCheckIn(p, c) });
    const c = record(checkIn({ glucose: { value: 62, unit: 'mg/dL', measuredAt: at('13:30').toISOString() } }));
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      const line = (time: string) => movementLine({
        mode, permission: permission({ profile: p, checkIn: c, now: at(time) }, mode), status: 'normal', normal: 'x',
        ...(c.readiness.recheckAt ? { recheckAt: c.readiness.recheckAt } : {}), now: at(time), hour12: true,
      });
      expect(line('13:32'), mode).toEqual({ text: 'Waiting for your re-check at 1:45 pm', tone: 'caution' });
      expect(line('13:46'), mode).toEqual({ text: 'Waiting for your re-check', tone: 'caution' });
    }
  });

  it('a low waiting for its re-check says so, even before the day’s check-in, as v1’s gate puts the re-check first', () => {
    const glucose = { value: 65, unit: 'mg/dL' as const, measuredAt: minutesAgo(1) };
    // The second is a day begun by a reading typed in the player: the check-in itself is still to come.
    const reported: DailyCheckIn = { date: '2026-10-08', urgentSymptoms: false, news: [], glucose };
    for (const c of [checkIn({ glucose }), reported]) {
      const p = permission({ profile: onInsulin, checkIn: record(onInsulin, c), now }, 'stretch');
      expect(movementLine({ mode: 'stretch', permission: p, status: 'normal', normal: 'x' })).toEqual({ text: 'Waiting for your re-check', tone: 'caution' });
    }
  });
});
