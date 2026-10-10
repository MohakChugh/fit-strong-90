import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { StatusPeriod, UserSettings, WorkoutSession } from '@/types';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import type { Meal } from '@/types/habits';
import type { SessionPlan } from '@/types/plan';
import type { HealthProfile, UserProfile } from '@/types/profile';
import { PERMISSION_TEXT, permission, type Mode, type Permission } from '@/engine/permission';
import { evaluateCheckIn } from '@/engine/readiness';
import type { SavedProgress } from '@/session/persistence';
import { timeOf } from '@/lib/time';
import { mealFromSearch } from '@/walk/plan';
import { newObservation, type Observation, type ObservationInput } from './observation';
import {
  HREF,
  activitiesFrom,
  dayPartOf,
  freezeKey,
  gateOf,
  habitAt,
  isEnrolled,
  mealOfWalk,
  mealWalkNow,
  recommend,
  resumeHref,
  savedRun,
  trainedOn,
  trainingWindow,
  type RecommendInput,
} from './recommend';

// Thursday 8 October 2026, 09:00 on this device's clock.
const TODAY = '2026-10-08';
/** The owner's programme start: in the programme unless a test says otherwise. */
const START = '2026-09-28';
const at = (day: string, time: string) => new Date(`${day}T${time}:00`);
const NOW = at(TODAY, '09:00');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function readiness(over: Partial<Readiness> = {}): Readiness {
  return {
    outcome: 'green', modifiers: [], back: 'none', nerveFlag: false, reasons: [], actions: [],
    vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [], ...over,
  };
}

/** A completed check-in: its first question ("Right now, any of these?") is answered. */
function checkIn(over: Partial<Readiness> = {}, date = TODAY): CheckInRecord {
  return { date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, readiness: readiness(over) };
}

function plan(over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'plan', date: TODAY, week: 3, phase: 'foundation', mode: 'normal', focus: 'lowerA', label: 'Lower A · Squat',
    mobilityDayType: 'lowerSquat', readiness: readiness(), kind: 'full', steps: [], exercises: [], cardio: null,
    blockStarts: { mobility: 0, strength: 900, cardio: 2820, wrapUp: 3540 }, totalSeconds: 3600, changes: [], warnings: [],
    ...over,
  };
}

const restDay = () => plan({ focus: 'rest', label: 'Rest Day', kind: 'none', blockStarts: {}, totalSeconds: 0 });

function owner(health: Partial<HealthProfile> = {}, extra: Partial<UserProfile> = {}): UserProfile {
  return createDefaultProfile({ health: { diabetes: 'type2', medicinesReviewed: true, ...health }, ...extra });
}

const allowed = (mode: Mode, over: Partial<Permission> = {}): Permission =>
  ({ mode, allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false, ...over });

const firstCheckIn = (mode: Mode): Permission => ({
  mode, allowed: false, disposition: 'hold', needsCheckIn: true, restrictions: [],
  reasons: ['Check in first, so today’s movement fits how you are.'], release: 'Answer today’s check-in.',
});

const held = (mode: Mode, over: Partial<Permission> = {}): Permission => ({
  mode, allowed: false, disposition: 'hold', needsCheckIn: false, restrictions: [],
  reasons: ['Your resting blood pressure is above 160/100.'], release: 'Rest, and ask your clinician before exercising.', ...over,
});

type Perms = Record<Mode, Permission>;
const every = (f: (m: Mode) => Permission): Perms => ({ guided: f('guided'), stretch: f('stretch'), walk: f('walk') });

let ids = 0;
function session(date: string, time: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s${++ids}`, date, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 3, status: 'completed',
    sets: [], startedAt: at(date, time).toISOString(), completedAt: null, notes: '', totalVolume: 0, guided: true, ...over,
  };
}
const stretched = (date: string, time: string, over: Partial<WorkoutSession> = {}) =>
  session(date, time, { planKind: 'stretch', muscleGroup: 'mobility', ...over });

function walked(day: string, time: string, id = `w${++ids}`): Observation {
  return newObservation({
    kind: 'movementMinutes', value: 20, scope: 'sessionObserved', coverageMs: 20 * 60_000, source: 'measured',
    at: `${day}T${time}:00+05:30`, context: `walk:${id}`,
  });
}

function saved(over: { date?: string; label?: string; kind?: SessionPlan['kind']; savedAt?: number; plan?: Partial<SessionPlan> } = {}): SavedProgress {
  const p = plan({ date: over.date ?? TODAY, label: over.label ?? 'Lower A · Squat', kind: over.kind ?? 'full', totalSeconds: 1080, ...over.plan });
  return {
    plan: p,
    state: { planId: p.id, date: p.date, status: 'paused', index: 0, stepStartedAt: 0, visit: 1, extraMs: {}, logs: [] },
    savedAt: over.savedAt ?? NOW.getTime() - 60 * 60_000,
    clockAt: 0,
  };
}

function input(over: Partial<RecommendInput> = {}): RecommendInput {
  return {
    now: NOW, settings: { startDate: START }, profile: owner(), plan: plan(), sessions: [], checkIns: [], observations: [],
    saved: [], permissions: every(firstCheckIn), ...over,
  };
}

/** Settings as a test states them: outside the programme unless a start date is given. */
const settings = (s: Partial<UserSettings>): RecommendInput['settings'] => ({ startDate: '', ...s });

/** Three mornings of stretching in the week before today. */
const morningStretches = () => [stretched('2026-10-05', '07:30'), stretched('2026-10-06', '07:10'), stretched('2026-10-07', '08:00')];

// ---------------------------------------------------------------------------
// 1. Safety
// ---------------------------------------------------------------------------

describe('1. safety comes first', () => {
  it('turns an emergency from any mode into the check-in’s own words, with no way to start moving', () => {
    const permissions = { ...every(allowed), walk: held('walk', { disposition: 'emergency', reasons: ['You reported chest pain.', 'Do not drive yourself.'], release: undefined }) };
    const r = recommend(input({ permissions, saved: [saved()] }));
    expect(r).toEqual({
      kind: 'emergency',
      title: 'Call emergency services now',
      detail: '',
      reason: 'You reported chest pain. Do not drive yourself.',
      action: { label: 'Review your check-in', to: HREF.checkIn('walk') },
    });
  });

  it('shows no country’s emergency number', () => {
    const permissions = every(m => held(m, { disposition: 'emergency', reasons: ['Possible stroke.'] }));
    const r = recommend(input({ permissions }));
    expect(JSON.stringify(r)).not.toMatch(/\b(112|911|999|108)\b|tel:/);
  });

  it('says to stop and get advice today, offering the check-in rather than any start', () => {
    const permissions = every(m => held(m, { disposition: 'today', reasons: ['New weakness in your leg.'], release: 'Contact your doctor today.' }));
    const r = recommend(input({ permissions, checkIns: [checkIn({ disposition: 'today' })] }));
    expect(r.kind).toBe('seekHelp');
    expect(r.title).toBe('No exercise today. Get medical advice today.');
    expect(r.reason).toBe('New weakness in your leg.');
    expect(r.detail).toBe('Contact your doctor today.');
    expect(r.action).toEqual({ label: 'Review your check-in', to: HREF.checkIn('guided') });
  });

  it('asks for the glucose re-check after a low, in the gate’s words', () => {
    const permissions = every(m => held(m, { needsCheckIn: true, reasons: ['Glucose 62 mg/dL is low. Treat it first.'], release: 'Check again and add the new reading.' }));
    const low = checkIn({ outcome: 'red', disposition: 'hold', recheckMinutes: 15, recheckAt: at(TODAY, '09:15').toISOString(), awaitingReading: true });
    const r = recommend(input({ permissions, checkIns: [low] }));
    expect(r).toMatchObject({ kind: 'recheck', title: 'Re-check your glucose', reason: 'Glucose 62 mg/dL is low. Treat it first.' });
    // When it is due comes first; the gate's words are the reason (scan J2-03).
    expect(r.detail).toBe(`Re-check at ${timeOf(at(TODAY, '09:15'))}, then enter the new reading.`);
    expect(r.action).toEqual({ label: 'Enter a new reading', to: HREF.checkIn('guided') });
  });

  it('asks for the check-in itself on a day begun by a report, but never ahead of a low’s re-check', () => {
    // A report before any check-in: the record holds only what was said.
    const permissions = every(m => held(m, { needsCheckIn: true, reasons: ['You said you are dizzy.'] }));
    const reported: CheckInRecord = { date: TODAY, urgentSymptoms: false, news: ['dizzy'], readiness: readiness({ outcome: 'red', disposition: 'hold' }) } as CheckInRecord;
    const r = recommend(input({ permissions, checkIns: [reported] }));
    // The day's suggestion stands, reached through the check-in ("Check in & start").
    expect(r.kind).not.toBe('hold');
    expect(r.action.mode).toBe('guided');
    expect(gateOf(permissions.guided, reported, false)).toBe('checkIn');
    // A low reported on a walk: its re-check is the step that matters now
    // (scan J2-03 found Today hiding it behind "Check in").
    const low: CheckInRecord = { ...reported, news: ['lowSymptoms'], readiness: readiness({ outcome: 'red', disposition: 'hold', recheckMinutes: 15, recheckAt: at(TODAY, '09:15').toISOString() }) } as CheckInRecord;
    expect(gateOf(permissions.guided, low, false)).toBe('recheck');
    expect(recommend(input({ permissions, checkIns: [low] })).kind).toBe('recheck');
  });

  it('says when the re-check can be taken when the gate gives no wording', () => {
    const permissions = every(m => held(m, { needsCheckIn: true, release: undefined }));
    const low = checkIn({ outcome: 'red', disposition: 'hold', recheckMinutes: 15, recheckAt: at(TODAY, '09:15').toISOString(), awaitingReading: true });
    // Written as the whole app writes a time of day (J2-14): 9:15 am, or 09:15 on a 24-hour clock.
    expect(recommend(input({ permissions, checkIns: [low] })).detail).toBe(`Re-check at ${timeOf(at(TODAY, '09:15'))}, then enter the new reading.`);
    expect(recommend(input({ permissions, checkIns: [low], now: at(TODAY, '09:20') })).detail).toBe('It is time to re-check. Enter the new reading.');
  });

  it('lets a resumable session lose to a safety hold', () => {
    const r = recommend(input({ saved: [saved()], checkIns: [checkIn({ outcome: 'red', disposition: 'hold' })], permissions: every(m => held(m)) }));
    expect(r.kind).toBe('hold');
    expect(r.title).toBe('No session for now');
    expect(r.detail).toBe('Rest, and ask your clinician before exercising.');
    expect(r.reason).toBe('Your resting blood pressure is above 160/100.');
    expect(r.action.mode).toBeUndefined();
  });

  it('holds only the mode that would have been suggested', () => {
    // A walking habit, and a foot that rules out walking only.
    const observations = ['2026-10-05', '2026-10-06', '2026-10-07'].map(d => walked(d, '07:30'));
    const permissions = { ...every(allowed), walk: held('walk', { reasons: ['No walking today: your foot needs protecting.'] }) };
    const r = recommend(input({ settings: settings({ focus: 'explore' }), observations, permissions, checkIns: [checkIn()] }));
    expect(r.kind).toBe('hold');
    expect(r.title).toBe('No walk for now');
    expect(r.action).toEqual({ label: 'Review your check-in', to: HREF.checkIn('walk') });
  });

  it('names a held stretch, and offers nothing that starts it', () => {
    const s = settings({ statusPeriods: [{ kind: 'flare', from: '2026-10-06' }] });
    const permissions = { ...every(allowed), stretch: held('stretch', { reasons: ['Leg symptoms reach below the knee and are spreading.'] }) };
    const r = recommend(input({ settings: s, permissions, checkIns: [checkIn()] }));
    expect(r).toMatchObject({ kind: 'hold', title: 'No stretch for now', reason: 'Leg symptoms reach below the knee and are spreading.' });
    expect(r.action).toEqual({ label: 'Review your check-in', to: HREF.checkIn('stretch') });
  });

  it('does not interrupt a suggestion whose own mode is allowed', () => {
    const permissions = { ...every(allowed), walk: held('walk') };
    expect(recommend(input({ permissions, checkIns: [checkIn()] })).kind).toBe('scheduled');
  });

  it('holds a suggestion with no mode only when every mode is held', () => {
    const away: StatusPeriod[] = [{ kind: 'away', from: '2026-10-06' }];
    const s = settings({ statusPeriods: away });
    expect(recommend(input({ settings: s, permissions: every(m => held(m)), checkIns: [checkIn({ disposition: 'hold' })] })).kind).toBe('hold');
    expect(recommend(input({ settings: s, permissions: { ...every(m => held(m)), stretch: allowed('stretch') } })).kind).toBe('status');
  });

  it('puts an unreviewed health profile at the top, before any check-in, in the gate’s words', () => {
    const profile = owner({}, { needsHealthReview: true });
    const permissions = every(m => ({ ...firstCheckIn(m), reasons: [PERMISSION_TEXT.healthUnreviewed, PERMISSION_TEXT.noCheckIn], release: 'Answer the health questions in your profile.' }));
    const r = recommend(input({ profile, permissions }));
    expect(r).toEqual({
      kind: 'hold',
      title: 'Finish your health profile',
      detail: 'Answer the health questions in your profile.',
      reason: PERMISSION_TEXT.healthUnreviewed,
      action: { label: 'Open your health profile', to: HREF.profile },
    });
  });

  it('asks about the diabetes medicines when a diabetic profile never answered them', () => {
    const profile = owner({ medicinesReviewed: undefined });
    const release = 'Answer the diabetes medicine questions in your health profile.';
    const r = recommend(input({ profile, permissions: every(m => held(m, { needsCheckIn: true, release })) }));
    expect(r).toEqual({
      kind: 'hold',
      title: 'Your diabetes medicines',
      detail: release,
      reason: PERMISSION_TEXT.medicinesUnknown,
      action: { label: 'Answer them', to: HREF.profile },
    });
  });

  it('still puts an emergency above an unanswered profile', () => {
    const profile = owner({}, { needsHealthReview: true });
    const permissions = every(m => held(m, { disposition: 'emergency' }));
    expect(recommend(input({ profile, permissions })).kind).toBe('emergency');
  });

  it('treats the first check-in of the day as a step before starting, not a stop', () => {
    const r = recommend(input());
    expect(r.kind).toBe('scheduled');
    expect(r.action).toEqual({ label: 'Check in & start', to: HREF.guided, mode: 'guided' });
  });

  it('treats a glucose reading that is too old to start on as a step, and says so', () => {
    const stale = 'With insulin or a sulfonylurea, check your glucose within 30 minutes of starting. Your last reading was 2 hours ago.';
    const permissions = every(m => held(m, { needsCheckIn: true, reasons: [stale] }));
    const r = recommend(input({ permissions, checkIns: [checkIn()] }));
    expect(r.kind).toBe('scheduled');
    expect(r.action.label).toBe('Re-check & start');
    expect(r.detail).toContain(stale);
  });

  it('does not offer a check-in as the way past a stop the check-in itself made', () => {
    const ketones = checkIn({ outcome: 'red', disposition: 'hold', awaitingReading: true });
    expect(recommend(input({ permissions: every(m => held(m, { needsCheckIn: true })), checkIns: [ketones] })).kind).toBe('hold');
    // A record from before v5 has only its colour.
    const old = checkIn({ outcome: 'red' });
    expect(recommend(input({ permissions: every(m => held(m, { needsCheckIn: true })), checkIns: [old] })).kind).toBe('hold');
  });
});

describe('gateOf', () => {
  it('reads each kind of answer', () => {
    expect(gateOf(allowed('guided'), undefined, false)).toBe('go');
    expect(gateOf(allowed('guided', { disposition: 'adjust', restrictions: ['No head-down positions.'] }), undefined, false)).toBe('go');
    expect(gateOf(firstCheckIn('guided'), undefined, false)).toBe('checkIn');
    expect(gateOf(firstCheckIn('guided'), undefined, true)).toBe('hold');
    expect(gateOf(held('guided'), checkIn(), false)).toBe('hold');
    expect(gateOf(held('guided', { disposition: 'today' }), checkIn(), false)).toBe('today');
    expect(gateOf(held('guided', { disposition: 'emergency' }), checkIn(), false)).toBe('emergency');
    expect(gateOf(held('guided', { needsCheckIn: true }), checkIn({ recheckMinutes: 15 }), false)).toBe('recheck');
  });
});

// ---------------------------------------------------------------------------
// 2. Resume
// ---------------------------------------------------------------------------

describe('2. resume', () => {
  it('offers to continue today’s session ahead of starting one', () => {
    const r = recommend(input({ saved: [saved()] }));
    expect(r).toEqual({
      kind: 'resume',
      title: 'Continue your session',
      detail: '18 min left · Lower A · Squat',
      reason: 'You stopped part-way through. It picks up where you left off.',
      action: { label: 'Check in & continue', to: HREF.resume, mode: 'guided' },
    });
    expect(recommend(input({ saved: [saved()], permissions: every(allowed), checkIns: [checkIn()] })).action.label).toBe('Continue');
  });

  it('resumes a stretch as a stretch, at its own address, through the stretch gate', () => {
    const run = saved({ kind: 'stretch', label: 'Back & hips', plan: { stretch: { focus: 'backHips', minutes: 10 } } });
    const r = recommend(input({ saved: [run] }));
    expect(r.title).toBe('Continue your stretch');
    expect(r.action).toEqual({ label: 'Check in & continue', to: '/session?mode=stretch&focus=backHips&minutes=10&resume=1', mode: 'stretch' });
  });

  it('finds a stretch’s routine from its plan id when the plan does not carry it', () => {
    const run = saved({ kind: 'stretch', plan: { id: 'stretch:2026-10-08:hipsLegs:15:green:' } });
    expect(resumeHref(run)).toBe('/session?mode=stretch&focus=hipsLegs&minutes=15&resume=1');
    expect(resumeHref(saved({ kind: 'stretch', plan: { id: 'odd' } }))).toBe('/session?mode=stretch&resume=1');
    expect(resumeHref(saved())).toBe(HREF.resume);
  });

  it('offers the run saved most recently when both a session and a stretch were left today', () => {
    const session = saved({ savedAt: NOW.getTime() - 3 * 3600_000 });
    const stretch = saved({ kind: 'stretch', label: 'Back & hips', savedAt: NOW.getTime() - 600_000, plan: { stretch: { focus: 'backHips', minutes: 10 } } });
    expect(recommend(input({ saved: [session, stretch] })).title).toBe('Continue your stretch');
    expect(savedRun([session, stretch], TODAY, 'today')).toBe(stretch);
    expect(savedRun([session, stretch], TODAY, 'earlier')).toBeUndefined();
    const yesterday = saved({ date: '2026-10-07' });
    expect(savedRun([yesterday, stretch], TODAY, 'earlier')).toBe(yesterday);
  });

  it('does not let an earlier day’s session take the place of today’s', () => {
    expect(recommend(input({ saved: [saved({ date: '2026-10-07' })] })).kind).toBe('scheduled');
  });

  it('is not pushed while the status is not Normal (D25)', () => {
    const s = settings({ statusPeriods: [{ kind: 'unwell', from: TODAY }] });
    expect(recommend(input({ settings: s, saved: [saved()] })).kind).toBe('status');
  });

  it('lets a paused stretch be picked up during a flare-up, but not a guided session', () => {
    const flare = settings({ statusPeriods: [{ kind: 'flare', from: '2026-10-06' }] });
    const stretch = saved({ kind: 'stretch', label: 'Back & hips', plan: { stretch: { focus: 'backHips', minutes: 10 } } });
    expect(recommend(input({ settings: flare, saved: [stretch] })).title).toBe('Continue your stretch');
    expect(recommend(input({ settings: flare, saved: [saved()] })).kind).toBe('status');
    const away = settings({ statusPeriods: [{ kind: 'away', from: '2026-10-06' }] });
    expect(recommend(input({ settings: away, saved: [stretch] })).kind).toBe('status');
  });
});

// ---------------------------------------------------------------------------
// 3. Status
// ---------------------------------------------------------------------------

describe('3. status', () => {
  it('suppresses the scheduled session while away, and pushes nothing', () => {
    const s = settings({ statusPeriods: [{ kind: 'away', from: '2026-10-06', to: '2026-10-11' }] });
    const r = recommend(input({ settings: s }));
    expect(r).toEqual({
      kind: 'status',
      title: 'Nothing planned while you’re away',
      detail: 'Your plan waits for you.',
      reason: 'You marked yourself away since Tuesday, until Sunday.',
      action: { label: 'I’m back', to: HREF.statusNormal },
    });
  });

  it('suggests rest while unwell', () => {
    const r = recommend(input({ settings: settings({ statusPeriods: [{ kind: 'unwell', from: TODAY }] }) }));
    expect(r).toMatchObject({ kind: 'status', title: 'Rest today', reason: 'You marked yourself unwell today. Nothing is suggested until you change it.' });
    expect(r.action).toEqual({ label: 'I feel better', to: HREF.statusNormal });
  });

  it('suggests only a gentle stretch, or rest, during a flare-up', () => {
    const s = settings({ statusPeriods: [{ kind: 'flare', from: '2026-09-20' }] });
    const r = recommend(input({ settings: s }));
    expect(r.title).toBe('A gentle stretch, or rest');
    expect(r.reason).toBe('You marked a flare-up since 20 September. Only gentle movement is suggested until you change it.');
    expect(r.action).toEqual({ label: 'Check in & stretch', to: HREF.stretch, mode: 'stretch' });
  });

  it('suggests rest, not the same stretch again, once a flare-up’s stretch is done today', () => {
    const s = settings({ statusPeriods: [{ kind: 'flare', from: '2026-09-20' }] });
    const r = recommend(input({ settings: s, sessions: [stretched(TODAY, '07:30')] }));
    expect(r.title).toBe('Rest for the rest of the day');
    expect(r.action.mode).toBeUndefined();
    expect(r.reason).toMatch(/already stretched today/);
  });

  it('comes before a stated focus and a habit', () => {
    const s = settings({ focus: 'move', statusPeriods: [{ kind: 'away', from: TODAY }] });
    expect(recommend(input({ settings: s, sessions: morningStretches() })).kind).toBe('status');
  });

  it('lets go once the period has ended', () => {
    const s = settings({ startDate: START, statusPeriods: [{ kind: 'away', from: '2026-10-01', to: '2026-10-07' }] });
    expect(recommend(input({ settings: s })).kind).toBe('scheduled');
  });
});

// ---------------------------------------------------------------------------
// 4. Explicit preference
// ---------------------------------------------------------------------------

describe('4. a stated focus', () => {
  it('suggests a stretch for a stretch focus, even with training days in the profile', () => {
    const r = recommend(input({ settings: settings({ focus: 'stretch' }) }));
    expect(r).toMatchObject({ kind: 'preference', title: 'A morning stretch', reason: 'You chose stretching as your focus.' });
    expect(r.action).toEqual({ label: 'Check in & stretch', to: HREF.stretch, mode: 'stretch' });
  });

  it('suggests a walk for a move focus', () => {
    const r = recommend(input({ settings: settings({ focus: 'move' }), permissions: every(allowed), checkIns: [checkIn()] }));
    expect(r).toMatchObject({ kind: 'preference', title: 'A morning walk', reason: 'You chose moving more as your focus.' });
    expect(r.action).toEqual({ label: 'Walk now', to: HREF.walk, mode: 'walk' });
  });

  it('does not push the chosen routine a second time in a day', () => {
    const r = recommend(input({ settings: settings({ focus: 'stretch' }), sessions: [stretched(TODAY, '07:00')] }));
    expect(r.kind).toBe('gentle');
    expect(r.action.mode).toBe('walk');
  });

  it('steps aside for a scheduled session once the person has joined the programme', () => {
    const joined = settings({ focus: 'stretch', startDate: '2026-09-28' });
    expect(recommend(input({ settings: joined })).kind).toBe('scheduled');
    // Off the training schedule, the stated focus is back.
    expect(recommend(input({ settings: joined, plan: restDay() })).kind).toBe('preference');
    expect(recommend(input({ settings: joined, sessions: [session(TODAY, '06:00')] })).kind).toBe('preference');
  });

  it('outweighs a habit', () => {
    const observations = ['2026-10-05', '2026-10-06', '2026-10-07'].map(d => walked(d, '08:00'));
    expect(recommend(input({ settings: settings({ focus: 'stretch' }), observations })).kind).toBe('preference');
  });
});

// ---------------------------------------------------------------------------
// 5. Repeated habit
// ---------------------------------------------------------------------------

describe('5. a habit', () => {
  it('promotes a stretch after three morning stretches in seven days, saying why', () => {
    const r = recommend(input({ plan: restDay(), sessions: morningStretches() }));
    expect(r).toMatchObject({ kind: 'habit', title: 'A morning stretch', reason: 'You usually stretch in the morning.' });
  });

  it('only outside the hours the person usually trains', () => {
    const mornings = [session('2026-10-01', '07:00'), session('2026-10-03', '07:15')];
    const evenings = [session('2026-10-01', '18:00'), session('2026-10-03', '18:30')];
    // Trains in the morning: the pending session keeps the morning.
    expect(recommend(input({ sessions: [...morningStretches(), ...mornings] })).kind).toBe('scheduled');
    // Trains in the evening: the stretch takes the morning, the session the evening.
    expect(recommend(input({ sessions: [...morningStretches(), ...evenings] })).kind).toBe('habit');
    expect(recommend(input({ sessions: [...morningStretches(), ...evenings], now: at(TODAY, '18:00') })).kind).toBe('scheduled');
  });

  it('is not held back by a training window once today’s session is done', () => {
    const mornings = [session('2026-10-01', '07:00'), session('2026-10-08', '06:00')];
    expect(recommend(input({ sessions: [...morningStretches(), ...mornings] })).kind).toBe('habit');
  });

  it('applies when there is no programme history to protect', () => {
    expect(recommend(input({ sessions: morningStretches() })).kind).toBe('habit');
  });

  it('counts days, not entries, and only the 7 days before today', () => {
    const twoDays = [stretched('2026-10-06', '07:00'), stretched('2026-10-06', '08:00'), stretched('2026-10-07', '07:00')];
    expect(recommend(input({ plan: restDay(), sessions: twoDays })).kind).not.toBe('habit');
    const tooOld = [stretched('2026-09-30', '07:00'), stretched('2026-10-06', '07:00'), stretched('2026-10-07', '07:00')];
    expect(recommend(input({ plan: restDay(), sessions: tooOld })).kind).not.toBe('habit');
    const justIn = [stretched('2026-10-01', '07:00'), stretched('2026-10-06', '07:00'), stretched('2026-10-07', '07:00')];
    expect(recommend(input({ plan: restDay(), sessions: justIn })).kind).toBe('habit');
  });

  it('is not suggested again once done in this part of today', () => {
    const r = recommend(input({ plan: restDay(), sessions: [...morningStretches(), stretched(TODAY, '07:00')] }));
    expect(r.kind).toBe('gentle');
  });

  it('belongs to its part of the day', () => {
    expect(recommend(input({ plan: restDay(), sessions: morningStretches(), now: at(TODAY, '13:00') })).kind).toBe('gentle');
  });

  it('reads walks from their observations, at their own local time', () => {
    const observations = ['2026-10-04', '2026-10-05', '2026-10-07'].map(d => walked(d, '19:30'));
    const r = recommend(input({ plan: restDay(), observations, now: at(TODAY, '19:00') }));
    expect(r).toMatchObject({ kind: 'habit', title: 'An evening walk', reason: 'You usually walk in the evening.' });
  });

  it('ignores a skipped stretch, which was not a choice carried out', () => {
    const sessions = [...morningStretches().slice(0, 2), stretched('2026-10-07', '07:00', { status: 'skipped' })];
    expect(recommend(input({ plan: restDay(), sessions })).kind).not.toBe('habit');
  });
});

describe('habitAt', () => {
  it('prefers the choice made on more days, then the most recent', () => {
    const activities = activitiesFrom(
      [stretched('2026-10-02', '07:00'), stretched('2026-10-03', '07:00'), stretched('2026-10-04', '07:00')],
      ['2026-10-02', '2026-10-03', '2026-10-05', '2026-10-07'].map(d => walked(d, '07:00')),
    );
    expect(habitAt(activities, TODAY, 'morning')).toEqual({ mode: 'walk', days: 4 });
    const even = activitiesFrom(morningStretches(), ['2026-10-02', '2026-10-03', '2026-10-04'].map(d => walked(d, '07:00')));
    expect(habitAt(even, TODAY, 'morning')).toEqual({ mode: 'stretch', days: 3 });
  });
});

// ---------------------------------------------------------------------------
// 6. Scheduled
// ---------------------------------------------------------------------------

describe('6. today’s scheduled session', () => {
  it('is the suggestion on a training day, with its length and blocks', () => {
    const r = recommend(input({ permissions: every(allowed), checkIns: [checkIn()] }));
    expect(r).toEqual({
      kind: 'scheduled',
      title: 'Lower A · Squat',
      detail: '60 min · mobility, strength and cardio.',
      reason: 'A training day in your plan, and today’s session is not done yet.',
      action: { label: 'Start session', to: HREF.guided, mode: 'guided' },
    });
  });

  it('names the recovery version when the check-in asked for one', () => {
    const r = recommend(input({ plan: plan({ kind: 'recovery', totalSeconds: 1500 }), permissions: every(allowed), checkIns: [checkIn({ outcome: 'recovery' })] }));
    expect(r.detail).toBe('25 min · a gentler recovery version today. Adjusted for today’s check-in.');
    expect(r.action.label).toBe('Start recovery session');
  });

  it('is done once a programme session with real work is in, partial included', () => {
    expect(recommend(input({ sessions: [session(TODAY, '06:30')] })).kind).toBe('gentle');
    expect(recommend(input({ sessions: [session(TODAY, '06:30', { status: 'partial' })] })).kind).toBe('gentle');
    expect(recommend(input({ sessions: [session(TODAY, '06:30', { status: 'skipped' })] })).kind).toBe('scheduled');
  });

  it('is not marked done by a stretch, or by a rest day’s optional mobility', () => {
    expect(recommend(input({ sessions: [stretched(TODAY, '06:30')] })).kind).toBe('scheduled');
    expect(recommend(input({ sessions: [session(TODAY, '06:30', { planKind: 'restDay' })] })).kind).toBe('scheduled');
    // Records from before planKind carry the kind in the plan id.
    expect(recommend(input({ sessions: [session(TODAY, '06:30', { planId: `${TODAY}:rest:restDay:green:` })] })).kind).toBe('scheduled');
    expect(recommend(input({ sessions: [session(TODAY, '06:30', { planId: `stretch:${TODAY}:backHips:10:green:` })] })).kind).toBe('scheduled');
  });

  it('says so when today’s session was only partly done', () => {
    const r = recommend(input({ sessions: [session(TODAY, '06:30', { status: 'partial' })] }));
    expect(r.reason).toBe('You did part of today’s session, so nothing demanding.');
  });

  it('is for the enrolled only: a strength focus without a start date leads to the programme instead', () => {
    expect(recommend(input({ settings: settings({ focus: 'explore' }) })).kind).toBe('choose');
    expect(recommend(input({ settings: settings({ focus: 'strength' }) })).kind).toBe('plan');
    expect(recommend(input({ settings: settings({ focus: 'strength', startDate: START }) })).kind).toBe('scheduled');
  });
});

describe('a training day whose session the check-in took off', () => {
  const off = plan({ kind: 'none', totalSeconds: 0, blockStarts: {} });

  it('shows the gate’s hold, never "a rest day"', () => {
    const refused = held('guided', { reasons: ['New or worse tingling or numbness: no guided session today.'], release: 'Change today’s answers once things have settled.' });
    const permissions = { ...every(allowed), guided: refused };
    const r = recommend(input({ plan: off, permissions, checkIns: [checkIn({ outcome: 'amber', disposition: 'adjust' })] }));
    expect(r).toEqual({
      kind: 'hold',
      title: 'No session for now',
      detail: 'Change today’s answers once things have settled.',
      reason: 'New or worse tingling or numbness: no guided session today.',
      action: { label: 'Review your check-in', to: HREF.checkIn('guided') },
    });
  });

  it('says the session is off, not that it is a rest day, if the gate still allows it', () => {
    const r = recommend(input({ plan: off, permissions: every(allowed), checkIns: [checkIn()] }));
    expect(r.kind).toBe('gentle');
    expect(r.reason).toBe('Today’s session is off after your check-in, so nothing demanding.');
  });
});

describe('isEnrolled: the one rule for being in the programme (codex F29)', () => {
  it('is a start date and training days to hold it on, whatever the focus', () => {
    for (const focus of [undefined, 'strength', 'stretch', 'move', 'explore'] as const) {
      const f = focus ? { focus } : {};
      expect(isEnrolled(settings({ startDate: START, ...f }), owner())).toBe(true);
      expect(isEnrolled(settings(f), owner())).toBe(false);
    }
  });

  it('never enrols on a focus alone', () => {
    expect(isEnrolled(settings({ focus: 'strength' }), owner())).toBe(false);
    expect(isEnrolled({ startDate: '' }, owner())).toBe(false);
  });

  it('needs training days, and a profile to hold them', () => {
    expect(isEnrolled({ startDate: START }, owner({}, { trainingDays: [] }))).toBe(false);
    expect(isEnrolled({ startDate: START }, undefined)).toBe(false);
    expect(isEnrolled({ startDate: START }, { trainingDays: ['monday'] })).toBe(true);
  });

  it('takes a blank start date for none', () => {
    expect(isEnrolled({ startDate: '  ' }, owner())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Done or rest day
// ---------------------------------------------------------------------------

describe('7. done, or a rest day', () => {
  it('offers an optional easy walk on a rest day', () => {
    const r = recommend(input({ plan: restDay() }));
    expect(r).toMatchObject({ kind: 'gentle', title: 'An easy walk, if you like', reason: 'A rest day in your plan. Rest counts too.' });
    expect(r.action.mode).toBe('walk');
  });

  it('never suggests a second demanding workout after the session', () => {
    const r = recommend(input({ sessions: [session(TODAY, '06:30')] }));
    expect(r.reason).toBe('Today’s session is done, so nothing demanding.');
    expect(r.action.mode).not.toBe('guided');
  });

  it('offers the gentle routine chosen recently before a walk', () => {
    const r = recommend(input({ plan: restDay(), sessions: [stretched('2026-10-06', '13:00')] }));
    expect(r.title).toBe('A gentle stretch, if you like');
  });

  it('skips a mode the gate holds rather than suggest it and refuse it', () => {
    const permissions = { ...every(allowed), walk: held('walk') };
    expect(recommend(input({ plan: restDay(), permissions, checkIns: [checkIn()] })).action.mode).toBe('stretch');
  });

  it('says there is nothing more once both are done', () => {
    const r = recommend(input({ plan: restDay(), sessions: [stretched(TODAY, '07:00')], observations: [walked(TODAY, '08:00')] }));
    expect(r).toMatchObject({ title: 'That’s today’s movement', action: { label: 'See your day', to: HREF.day } });
  });

  it('suggests a walk after a meal only for someone who asked, at that meal', () => {
    const habits = { mealWalk: { enabled: true, meals: ['lunch' as const], finish: { lunch: '13:30' } } };
    const lunch = recommend(input({ plan: restDay(), settings: settings({ startDate: START, habits }), now: at(TODAY, '13:40') }));
    expect(lunch.kind).toBe('mealWalk');
    expect(lunch.title).toBe('A walk after lunch');
    expect(lunch.detail).toBe('About 10 minutes, starting soon after you finish eating.');
    expect(lunch.reason).toContain('Reynolds 2016');
    expect(recommend(input({ plan: restDay(), settings: settings({ startDate: START, habits }), now: at(TODAY, '15:00') })).title).toBe('An easy walk, if you like');
    const off = { mealWalk: { ...habits.mealWalk, enabled: false } };
    expect(recommend(input({ plan: restDay(), settings: settings({ startDate: START, habits: off }), now: at(TODAY, '13:40') })).title).toBe('An easy walk, if you like');
  });

  it('applies to someone outside the programme once they have moved today', () => {
    const r = recommend(input({ settings: settings({ focus: 'explore' }), observations: [walked(TODAY, '07:00')] }));
    expect(r).toMatchObject({ kind: 'gentle', reason: 'You have already moved today.' });
    expect(r.action.mode).toBe('stretch');
  });
});

describe('mealWalkNow', () => {
  const habits = (finish: string) => ({ mealWalk: { enabled: true, meals: ['dinner' as const], finish: { dinner: finish } } });

  it('runs from the usual finish for 45 minutes', () => {
    expect(mealWalkNow(habits('20:00'), at(TODAY, '19:59'))).toBeUndefined();
    expect(mealWalkNow(habits('20:00'), at(TODAY, '20:00'))).toBe('dinner');
    expect(mealWalkNow(habits('20:00'), at(TODAY, '20:44'))).toBe('dinner');
    expect(mealWalkNow(habits('20:00'), at(TODAY, '20:45'))).toBeUndefined();
  });

  it('carries past midnight', () => {
    expect(mealWalkNow(habits('23:40'), at(TODAY, '00:10'))).toBe('dinner');
  });

  it('needs a time and the meal to be chosen', () => {
    expect(mealWalkNow({ mealWalk: { enabled: true, meals: ['dinner'] } }, at(TODAY, '20:10'))).toBeUndefined();
    expect(mealWalkNow({ mealWalk: { enabled: true, meals: [], finish: { dinner: '20:00' } } }, at(TODAY, '20:10'))).toBeUndefined();
    expect(mealWalkNow({ mealWalk: { enabled: true, meals: ['dinner'], finish: { dinner: '8pm' } } }, at(TODAY, '20:10'))).toBeUndefined();
    expect(mealWalkNow(undefined, at(TODAY, '20:10'))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Too little history
// ---------------------------------------------------------------------------

describe('8. too little to go on', () => {
  it('follows a strength focus to the programme when there is no plan yet', () => {
    const r = recommend(input({ settings: settings({ focus: 'strength' }) }));
    expect(r).toMatchObject({ kind: 'plan', reason: 'You chose building strength.', action: { to: HREF.plan } });
  });

  it('with no profile yet, as with health questions left unanswered, those questions come first (scan J2-09)', () => {
    for (const profile of [undefined, owner({}, { needsHealthReview: true })]) {
      expect(recommend(input({ settings: settings({ focus: 'strength' }), profile })), String(!!profile)).toMatchObject({ title: 'Finish your health profile', action: { to: HREF.profile } });
    }
  });

  it('otherwise asks, through the chooser, without inventing a need', () => {
    const r = recommend(input({ settings: settings({ focus: 'explore' }) }));
    expect(r).toEqual({
      kind: 'choose',
      title: 'What would you like to do?',
      detail: 'Stretch, walk, a guided session, a log or something to read.',
      reason: 'There is not enough to go on yet to suggest one thing, so the choice is yours.',
      action: { label: 'See the choices', to: HREF.choose },
    });
  });
});

// ---------------------------------------------------------------------------
// Time of day, records and freezing
// ---------------------------------------------------------------------------

describe('time of day', () => {
  it('splits the day at 04:00, 12:00 and 17:00', () => {
    expect([0, 3, 4, 11, 12, 16, 17, 23].map(dayPartOf)).toEqual([
      'evening', 'evening', 'morning', 'morning', 'daytime', 'daytime', 'evening', 'evening',
    ]);
  });

  it('words the suggestion for the part of the day', () => {
    const s = settings({ focus: 'stretch' });
    expect(recommend(input({ settings: s, now: at(TODAY, '11:59') })).title).toBe('A morning stretch');
    expect(recommend(input({ settings: s, now: at(TODAY, '12:00') })).title).toBe('An afternoon stretch');
    expect(recommend(input({ settings: s, now: at(TODAY, '17:00') })).title).toBe('An evening stretch');
  });
});

describe('activitiesFrom', () => {
  it('reads stretches, programme sessions and walks, one entry each', () => {
    const sessions = [stretched('2026-10-06', '07:30'), session('2026-10-06', '18:00'), session('2026-10-05', '18:00', { planKind: undefined, guided: undefined })];
    const observations = [walked('2026-10-07', '07:30', 'a'), walked('2026-10-07', '07:10', 'a')];
    expect(activitiesFrom(sessions, observations).map(a => [a.mode, a.day, a.part])).toEqual([
      ['stretch', '2026-10-06', 'morning'],
      ['programme', '2026-10-06', 'evening'],
      ['programme', '2026-10-05', 'evening'],
      ['walk', '2026-10-07', 'morning'],
    ]);
  });

  it('counts a rest day’s optional mobility as neither a stretch nor training time', () => {
    expect(activitiesFrom([session('2026-10-06', '07:00', { planKind: 'restDay' })], [])).toEqual([]);
    expect(activitiesFrom([session('2026-10-06', '07:00', { planId: 'stretch:2026-10-06:backHips:10:green:' })], [])[0].mode).toBe('stretch');
  });

  it('keeps a session with no clock time, without a part of the day', () => {
    const [a] = activitiesFrom([session('2026-10-06', '07:00', { startedAt: null })], []);
    expect(a).toMatchObject({ mode: 'programme', day: '2026-10-06' });
    expect(a.part).toBeUndefined();
  });

  it('finds the parts of the day the programme happens in, over the 28 days before today', () => {
    const activities = activitiesFrom([session('2026-09-09', '07:00'), session('2026-09-20', '18:00'), session(TODAY, '13:00')], []);
    expect([...trainingWindow(activities, TODAY)]).toEqual(['evening']);
    const edge = activitiesFrom([session('2026-09-10', '07:00')], []);
    expect([...trainingWindow(edge, TODAY)]).toEqual(['morning']);
  });

  it('counts only real programme work as today’s session', () => {
    expect(trainedOn([session(TODAY, '07:00')], TODAY)).toBe(true);
    expect(trainedOn([stretched(TODAY, '07:00')], TODAY)).toBe(false);
    expect(trainedOn([session(TODAY, '07:00', { status: 'in_progress' })], TODAY)).toBe(false);
    expect(trainedOn([session('2026-10-07', '07:00')], TODAY)).toBe(false);
  });
});

describe('freezing', () => {
  const base = { now: NOW, checkIns: [] as CheckInRecord[], statusPeriods: [] as StatusPeriod[], startDate: '2026-09-28', visit: 0 };

  it('holds still while other records change and the clock moves within the day', () => {
    const key = freezeKey(base);
    expect(freezeKey({ ...base, now: at(TODAY, '17:30') })).toBe(key);
    expect(freezeKey({ ...base, checkIns: [checkIn({}, '2026-10-07')] })).toBe(key);
  });

  it('moves on a new or changed check-in, a status change, a return to the screen or a new day', () => {
    const key = freezeKey(base);
    const today = checkIn();
    expect(freezeKey({ ...base, checkIns: [today] })).not.toBe(key);
    expect(freezeKey({ ...base, checkIns: [checkIn({ outcome: 'amber' })] })).not.toBe(freezeKey({ ...base, checkIns: [today] }));
    expect(freezeKey({ ...base, statusPeriods: [{ kind: 'away', from: TODAY }] })).not.toBe(key);
    expect(freezeKey({ ...base, visit: 1 })).not.toBe(key);
    expect(freezeKey({ ...base, now: at('2026-10-09', '00:01') })).not.toBe(key);
    // Moving the plan back changes today's session, so it is a change too.
    expect(freezeKey({ ...base, startDate: '2026-09-30' })).not.toBe(key);
  });

  it('stays put when only the plan offer is answered', () => {
    const away = { kind: 'away', from: '2026-10-01', to: '2026-10-07' } as const;
    const key = freezeKey({ ...base, statusPeriods: [away] });
    expect(freezeKey({ ...base, statusPeriods: [{ ...away, planShift: 'kept' }] })).toBe(key);
    expect(freezeKey({ ...base, statusPeriods: [{ ...away, to: '2026-10-06' }] })).not.toBe(key);
  });

  it('gives the same recommendation for the same inputs', () => {
    const i = input({ sessions: morningStretches(), plan: restDay() });
    expect(recommend(i)).toEqual(recommend(i));
  });
});

// ---------------------------------------------------------------------------
// With the real gate
// ---------------------------------------------------------------------------

describe('with the real permission()', () => {
  const owner2 = owner({ hypertension: 'treated', bpMonitor: true });
  const real = (c: CheckInRecord | undefined): Perms => every(m => permission({ profile: owner2, ...(c ? { checkIn: c } : {}), now: NOW, recent: [] }, m));
  const answered = (over: Partial<DailyCheckIn>): CheckInRecord => {
    const c: DailyCheckIn = { date: TODAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over };
    return { ...c, readiness: evaluateCheckIn(owner2, c, []) };
  };

  it('asks for the day’s first check-in on the scheduled session', () => {
    expect(recommend(input({ profile: owner2, permissions: real(undefined) })).action).toEqual({ label: 'Check in & start', to: HREF.guided, mode: 'guided' });
  });

  it('starts the session after an ordinary check-in', () => {
    const c = answered({});
    const r = recommend(input({ profile: owner2, checkIns: [c], permissions: real(c) }));
    expect(r.kind).toBe('scheduled');
    expect(r.action.label).toBe('Start session');
  });

  it('stops for an emergency answer, in the check-in’s own words', () => {
    const c = answered({ urgentSymptoms: true, emergency: ['chest'] });
    const r = recommend(input({ profile: owner2, checkIns: [c], permissions: real(c) }));
    expect(r.kind).toBe('emergency');
    expect(r.title).toBe('Call emergency services now');
    expect(r.action.mode).toBeUndefined();
  });

  it('shows a frozen choice under the gate as it is now (codex F32)', () => {
    // On insulin, a pre-session reading is good for 30 minutes (D29(6)).
    const insulin = owner({ hypertension: 'none', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' });
    const c: DailyCheckIn = {
      date: TODAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
      glucose: { value: 140, unit: 'mg/dL', measuredAt: NOW.toISOString() },
    };
    const record: CheckInRecord = { ...c, readiness: evaluateCheckIn(insulin, c, []) };
    const gateAt = (minutes: number): Perms => every(m => permission({ profile: insulin, checkIn: record, now: new Date(NOW.getTime() + minutes * 60_000), recent: [] }, m));
    // What Today froze at 09:00: everything but the permissions.
    const frozen = input({ profile: insulin, checkIns: [record] });
    const then = recommend({ ...frozen, permissions: gateAt(0) });
    const now = recommend({ ...frozen, permissions: gateAt(31) });
    expect(then).toMatchObject({ kind: 'scheduled', action: { label: 'Start session', mode: 'guided' } });
    expect(now).toMatchObject({ kind: 'scheduled', title: then.title, reason: then.reason, action: { label: 'Re-check & start', mode: 'guided' } });
    expect(now.detail).toContain('31 minutes ago');
  });

  it('holds every movement for a resting blood pressure above 160/100', () => {
    const c = answered({ bp: { sys: 168, dia: 96 }, bpReadings: [{ sys: 168, dia: 96 }] });
    const r = recommend(input({ profile: owner2, checkIns: [c], permissions: real(c) }));
    expect(r.kind).toBe('hold');
    expect(r.action.mode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The small hours (scan J2-05)
// ---------------------------------------------------------------------------

/** One piece of a saved walk, as the walk writes it: `minutes` from `time`, under the walk's context. */
function walkPiece(day: string, time: string, minutes: number, id: string, over: Partial<ObservationInput> = {}): Observation {
  return newObservation({
    kind: 'movementMinutes', value: minutes, scope: 'sessionObserved', coverageMs: minutes * 60_000, source: 'measured',
    at: `${day}T${time}:00+05:30`, context: `walk:${id}`, ...over,
  });
}

describe('the small hours (scan J2-05)', () => {
  const FRIDAY = '2026-10-09';
  const move = settings({ focus: 'move' });
  const night = (over: Partial<RecommendInput>, time = '00:02') => recommend(input({ settings: move, now: at(FRIDAY, time), ...over }));
  const movedTonight = 'You have already moved this evening, and it is the middle of the night.';

  it('suggests rest from midnight until 04:00, whatever the focus would say', () => {
    expect(night({})).toEqual({
      kind: 'gentle',
      title: 'Rest well',
      detail: 'Movement can wait until the morning.',
      reason: 'It is the middle of the night.',
      action: { label: 'See your day', to: HREF.day },
    });
    expect(night({}, '03:59').title).toBe('Rest well');
    // The morning starts at 04:00, as `dayPartOf` has it, and the evening runs until midnight.
    expect(night({}, '04:00').title).toBe('A morning walk');
    expect(recommend(input({ settings: move, now: at(TODAY, '23:59') })).title).toBe('An evening walk');
  });

  it('starts no movement for a plan, a focus, a habit, a meal, a flare-up or a paused run', () => {
    // Today's session, on a training day in the programme.
    expect(night({ settings: settings({ startDate: START }) }, '01:00').title).toBe('Rest well');
    expect(night({ settings: settings({ focus: 'stretch' }) }).title).toBe('Rest well');
    // Three nights of walking in the small hours make a habit of that part of the day.
    const owl = ['2026-10-05', '2026-10-06', '2026-10-07'].map(d => walked(d, '00:30'));
    expect(night({ settings: settings({ focus: 'explore' }), observations: owl }, '00:40').title).toBe('Rest well');
    // The walk after a dinner that ends just before midnight.
    const late = { mealWalk: { enabled: true, meals: ['dinner' as const], finish: { dinner: '23:40' } } };
    expect(night({ settings: settings({ habits: late }) }, '00:10').title).toBe('Rest well');
    expect(night({ settings: settings({ statusPeriods: [{ kind: 'flare', from: TODAY }] }) }).title).toBe('Rest well');
    const stretch = saved({ date: FRIDAY, kind: 'stretch', label: 'Back & hips', savedAt: at(FRIDAY, '00:20').getTime(), plan: { stretch: { focus: 'backHips', minutes: 10 } } });
    expect(night({ saved: [stretch] }, '00:30').title).toBe('Rest well');
    // Nothing to go on yet: rest, rather than a list of things to do.
    expect(night({ settings: settings({ focus: 'explore' }) }).title).toBe('Rest well');
  });

  it('leaves unwell and away in their own words, which already ask for nothing', () => {
    expect(night({ settings: settings({ statusPeriods: [{ kind: 'unwell', from: TODAY }] }) })).toMatchObject({ kind: 'status', title: 'Rest today' });
    expect(night({ settings: settings({ statusPeriods: [{ kind: 'away', from: TODAY }] }) }).kind).toBe('status');
  });

  it('still puts safety first', () => {
    expect(night({ permissions: every(m => held(m, { disposition: 'emergency', reasons: ['Possible stroke.'] })) }).kind).toBe('emergency');
    const low = checkIn({ outcome: 'red', disposition: 'hold', recheckMinutes: 15, recheckAt: at(FRIDAY, '00:15').toISOString() }, FRIDAY);
    expect(night({ permissions: every(m => held(m, { needsCheckIn: true })), checkIns: [low] }).kind).toBe('recheck');
    expect(night({ permissions: every(m => held(m)), checkIns: [checkIn({ disposition: 'hold' }, FRIDAY)] }).kind).toBe('hold');
  });

  it('counts a walk that ran past midnight as just done, and starts the next morning fresh', () => {
    // 23:45 to 00:10. D10 credits Thursday with 15 minutes and Friday with 10;
    // the walk itself is Thursday's, the day My Day lists it on.
    const late = [walkPiece(TODAY, '23:45', 15, 'late'), walkPiece(FRIDAY, '00:00', 10, 'late')];
    expect(activitiesFrom([], late)).toEqual([expect.objectContaining({ id: 'walk:late', mode: 'walk', day: TODAY, part: 'evening' })]);
    // At 00:10, just after it ended: no walk again, and the card says it was done.
    expect(night({ observations: late }, '00:10')).toMatchObject({ kind: 'gentle', title: 'Rest well', reason: movedTonight });
    expect(night({ observations: late }, '00:10').action.mode).toBeUndefined();
    // Any movement that evening counts, a stretch included; that morning's does not.
    expect(night({ observations: [walked(TODAY, '19:00')] }, '01:00').reason).toBe(movedTonight);
    expect(night({ sessions: [stretched(TODAY, '21:30')] }, '01:00').reason).toBe(movedTonight);
    expect(night({ observations: [walked(TODAY, '08:00')] }, '01:00').reason).toBe('It is the middle of the night.');
    // Before midnight, the evening's walk is today's: no second walk.
    expect(recommend(input({ settings: move, observations: [walked(TODAY, '22:00')], now: at(TODAY, '23:50') })).action.mode).not.toBe('walk');
    // From 04:00 Friday is a day of its own, as its My Day is: the walk was Thursday's.
    expect(night({ observations: late }, '07:00').title).toBe('A morning walk');
  });

  it('works the suggestion out again when the small hours end, and not within them', () => {
    const base = { checkIns: [] as CheckInRecord[], statusPeriods: [] as StatusPeriod[], startDate: START, visit: 0 };
    const key = freezeKey({ ...base, now: at(FRIDAY, '00:10') });
    expect(freezeKey({ ...base, now: at(FRIDAY, '03:59') })).toBe(key);
    expect(freezeKey({ ...base, now: at(FRIDAY, '04:00') })).not.toBe(key);
  });
});

// ---------------------------------------------------------------------------
// A walk after a meal (D26; scan J2-07)
// ---------------------------------------------------------------------------

describe('a walk after a meal (D26; scan J2-07)', () => {
  const habits = { mealWalk: { enabled: true, meals: ['breakfast', 'lunch', 'dinner'] as Meal[], finish: { breakfast: '08:30', lunch: '13:30', dinner: '20:30' } } };
  const meal = (over: Partial<RecommendInput>, time: string, focus: UserSettings['focus'] = 'move') =>
    recommend(input({ settings: settings({ habits, focus }), now: at(TODAY, time), ...over }));
  /** A walk the person started from Walk's "After a meal". */
  const tagged = (time: string, id: string) => walkPiece(TODAY, time, 10, id, { tag: 'afterMeal', mealStartedAt: `${TODAY}T${time}:00+05:30` });

  it('is offered in the 45 minutes after the meal, ahead of a stated focus', () => {
    expect(meal({}, '13:35')).toEqual({
      kind: 'mealWalk',
      title: 'A walk after lunch',
      detail: 'About 10 minutes, starting soon after you finish eating.',
      reason: 'You asked for a walk after lunch. In a study of people with type 2 diabetes, a short walk after meals lowered the rise in glucose (Reynolds 2016).',
      action: { label: 'Check in & walk', to: '/walk?meal=lunch', mode: 'walk' },
    });
    expect(meal({}, '13:35', 'stretch').title).toBe('A walk after lunch');
    // Before the meal's usual end, and once its 45 minutes are over, the focus is back.
    expect(meal({}, '13:29').title).toBe('An afternoon walk');
    expect(meal({}, '14:15').title).toBe('An afternoon walk');
  });

  it('comes before the day’s session as well, which waits for it', () => {
    expect(meal({ settings: settings({ habits, startDate: START }) }, '13:35').kind).toBe('mealWalk');
    expect(meal({ settings: settings({ habits, startDate: START }) }, '15:00').kind).toBe('scheduled');
  });

  it('is offered to someone who has not moved yet and chose no focus', () => {
    expect(meal({}, '20:40', 'explore').title).toBe('A walk after dinner');
  });

  it('opens Walk on "After a meal" with that meal chosen', () => {
    for (const [time, which] of [['08:40', 'breakfast'], ['13:40', 'lunch'], ['20:40', 'dinner']] as const) {
      const url = new URL(meal({}, time).action.to, 'https://app.test');
      expect(url.pathname).toBe(HREF.walk);
      expect(mealFromSearch(url.searchParams)).toBe(which);
    }
  });

  it('treats each meal on its own: a walk after breakfast leaves lunch’s to come', () => {
    const breakfast = [walkPiece(TODAY, '08:40', 10, 'b')];
    expect(meal({ observations: breakfast }, '08:55').kind).not.toBe('mealWalk');
    expect(meal({ observations: breakfast }, '13:31')).toMatchObject({ kind: 'mealWalk', title: 'A walk after lunch' });
    // With lunch's walk in, it is not offered again; dinner's is still to come.
    const lunch = [...breakfast, walkPiece(TODAY, '13:40', 10, 'l')];
    expect(meal({ observations: lunch }, '13:55').kind).not.toBe('mealWalk');
    expect(meal({ observations: lunch }, '20:35').title).toBe('A walk after dinner');
  });

  it('counts a walk said to be after a meal as that meal’s, even before its usual end', () => {
    // After an early breakfast, at 07:30: breakfast's walk, and no other meal's.
    const early = [tagged('07:30', 'e')];
    expect(meal({ observations: early }, '08:35').kind).not.toBe('mealWalk');
    expect(meal({ observations: early }, '13:31').title).toBe('A walk after lunch');
    // The same walk with nothing said about a meal may have come before it.
    expect(meal({ observations: [walkPiece(TODAY, '07:30', 10, 'u')] }, '08:35').title).toBe('A walk after breakfast');
  });

  it('skips a held walk rather than suggest it and refuse it', () => {
    const permissions = { ...every(allowed), walk: held('walk') };
    expect(meal({ permissions, checkIns: [checkIn()] }, '13:35', 'stretch')).toMatchObject({ kind: 'preference', title: 'An afternoon stretch' });
  });

  it('goes quiet under a status (D25)', () => {
    expect(meal({ settings: settings({ habits, focus: 'move', statusPeriods: [{ kind: 'flare', from: TODAY }] }) }, '13:35').kind).toBe('status');
  });

  it('keeps when a walk started, and whether the person said it followed a meal', () => {
    expect(activitiesFrom([], [tagged('13:42', 'm')])[0]).toMatchObject({ id: 'walk:m', mode: 'walk', day: TODAY, part: 'daytime', minute: 13 * 60 + 42, afterMeal: true });
    const [plain] = activitiesFrom([], [walked(TODAY, '07:05')]);
    expect(plain).toMatchObject({ minute: 7 * 60 + 5 });
    expect(plain.afterMeal).toBeUndefined();
  });
});

describe('mealOfWalk', () => {
  const habits = { mealWalk: { enabled: true, meals: ['breakfast', 'lunch'] as Meal[], finish: { breakfast: '08:30', lunch: '13:30' } } };
  const clock = (h: number, m: number) => h * 60 + m;

  it('gives a walk to the meal whose 45 minutes it started in', () => {
    expect(mealOfWalk(habits, { minute: clock(8, 30) })).toBe('breakfast');
    expect(mealOfWalk(habits, { minute: clock(9, 14) })).toBe('breakfast');
    expect(mealOfWalk(habits, { minute: clock(9, 15) })).toBeUndefined();
    expect(mealOfWalk(habits, { minute: clock(8, 29) })).toBeUndefined();
    expect(mealOfWalk(habits, { minute: clock(13, 40) })).toBe('lunch');
  });

  it('gives a walk said to be after a meal to the nearest chosen meal, up to two hours from its usual end', () => {
    expect(mealOfWalk(habits, { minute: clock(7, 0), afterMeal: true })).toBe('breakfast');
    expect(mealOfWalk(habits, { minute: clock(12, 0), afterMeal: true })).toBe('lunch');
    expect(mealOfWalk(habits, { minute: clock(15, 30), afterMeal: true })).toBe('lunch');
    expect(mealOfWalk(habits, { minute: clock(15, 31), afterMeal: true })).toBeUndefined();
    expect(mealOfWalk(habits, { minute: clock(6, 29), afterMeal: true })).toBeUndefined();
  });

  it('needs a chosen meal with a time, and a walk with a clock time', () => {
    expect(mealOfWalk(undefined, { minute: clock(8, 40) })).toBeUndefined();
    expect(mealOfWalk({ mealWalk: { enabled: true, meals: ['dinner'], finish: { breakfast: '08:30' } } }, { minute: clock(8, 40) })).toBeUndefined();
    expect(mealOfWalk(habits, {})).toBeUndefined();
  });
});
