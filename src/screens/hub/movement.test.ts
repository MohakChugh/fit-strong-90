import { describe, expect, it, vi } from 'vitest';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import type { TileLine } from '@/screens/home/tileLine';
import {
  JOIN_HREF, actionTarget, movementCard, restDayOf, resumeAllowed, runAction, sessionParts, stretchReason,
  type CardInput, type HubActionKind, type HubCard,
} from './movement';

const ok: Permission = { mode: 'stretch', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false };
const line = (text: string, tone: TileLine['tone'] = 'normal'): TileLine => ({ text, tone });
const input = (over: Partial<CardInput> = {}): CardInput => ({
  mode: 'stretch', permission: ok, gate: 'go', status: 'normal', line: line('Back & hips · 10 min'),
  title: 'Back & hips · 10 min', gaps: { healthUnreviewed: false, medicinesUnknown: false }, stretchOpen: true, ...over,
});
const kinds = (c: HubCard) => [c.primary?.kind, ...c.secondary.map(a => a.kind)].filter(Boolean);
const held = (mode: Permission['mode'], reasons: string[], over: Partial<Permission> = {}): Permission =>
  ({ ...ok, mode, allowed: false, disposition: 'hold', reasons, needsCheckIn: false, ...over });

describe('movementCard: the hub column of the copy table (journey §7.5)', () => {
  it('allowed: Start, in the mode’s own words', () => {
    const c = movementCard(input());
    expect(c.state).toBe('go');
    expect(c.primary).toEqual({ kind: 'start', label: 'Start stretch' });
    expect(movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, title: 'Full Body B · 45 min', enrolled: true, recovery: true })).primary?.label).toBe('Start recovery session');
  });

  it('allowed with changes: Start, with the changes listed', () => {
    const p = { ...ok, disposition: 'adjust' as const, restrictions: ['Gentle range only.'] };
    const c = movementCard(input({ permission: p }));
    expect(c.today).toBe('With changes for today');
    expect(c.restrictions).toEqual(['Gentle range only.']);
  });

  it('only a check-in needed: "Check in & start", which the gate turns into the check-in', () => {
    const p = held('stretch', [PERMISSION_TEXT.noCheckIn], { needsCheckIn: true });
    expect(movementCard(input({ permission: p, gate: 'checkIn' })).primary).toEqual({ kind: 'start', label: 'Check in & start' });
  });

  it('a hold: the gate’s own headline and reasons, no Start, and today’s check-in to put a mistake right', () => {
    const p = held('walk', [PERMISSION_TEXT.footWalk], { release: 'Walking is back once your foot has healed or a clinician says it is fine.' });
    const c = movementCard(input({ mode: 'walk', permission: p, gate: 'hold', title: 'Just a walk', line: line('No walking for now', 'caution') }));
    expect(c.state).toBe('held');
    // The gate's card, as Home's and the check-in's (§8.4): the tile's shorter line stays on the tile.
    expect(c.title).toBe('No walk for now');
    expect(c.reasons).toEqual([PERMISSION_TEXT.footWalk]);
    expect(c.release).toMatch(/foot has healed/);
    expect(c.primary).toBeUndefined();
    expect(kinds(c)).toEqual(['review', 'stretch']);
  });

  it('a re-check waiting: the gate’s headline, when it is due, and "Enter a new reading", which is the check-in', () => {
    const p = held('stretch', ['Treat the low and re-check.'], { needsCheckIn: true, release: 'Re-check your glucose in 15 minutes.' });
    const c = movementCard(input({ permission: p, gate: 'recheck', line: line('Waiting for your re-check at 9:15 am', 'caution') }));
    expect(c.title).toBe('Check again before you start');
    expect(c.detail).toBe('Waiting for your re-check at 9:15 am');
    expect(c.primary).toEqual({ kind: 'review', label: 'Enter a new reading' });
  });

  it('a hold the tile can only point at ("Not now: open to see why") still says the gate’s headline here', () => {
    const p = held('stretch', ['Something new the tile has no headline for.']);
    expect(movementCard(input({ permission: p, gate: 'hold', line: line('Not now: open to see why', 'caution') })).title).toBe('No stretch for now');
  });

  it('a profile gap names the chapter; no check-in can answer it', () => {
    const p = held('stretch', [PERMISSION_TEXT.medicinesUnknown]);
    const c = movementCard(input({ permission: p, gate: 'hold', gaps: { healthUnreviewed: false, medicinesUnknown: true }, line: line('Finish setting up · your medicines', 'caution') }));
    expect(c.state).toBe('gap');
    expect(c.title).toBe('Your diabetes medicines');
    expect(c.primary).toEqual({ kind: 'profile', label: 'Answer the questions about your medicines' });
    expect(kinds(c)).toContain('review');
  });

  it('an emergency or a stop for today: the stop, the same headline as Home’s card, with no Start', () => {
    const p: Permission = { ...ok, allowed: false, disposition: 'emergency', reasons: ['Call your local emergency number now.'], needsCheckIn: false };
    const c = movementCard(input({ permission: p, gate: 'emergency', line: line('Not today', 'stop') }));
    expect(c).toMatchObject({ state: 'stopped', tone: 'stop', title: PERMISSION_TEXT.emergencyTitle });
    expect(kinds(c)).toEqual(['review']);
  });

  it('Away or Unwell: paused, Change status first, and a quiet Start anyway (L-04)', () => {
    const c = movementCard(input({ status: 'unwell', line: line('Paused', 'quiet') }));
    expect(c).toMatchObject({ state: 'paused', title: 'Paused while you’re unwell', primary: { kind: 'status', label: 'Change status' } });
    expect(c.secondary).toEqual([{ kind: 'anyway', label: 'Start anyway' }]);
    expect(movementCard(input({ status: 'away' })).title).toBe('Paused while you’re away');
  });

  it('a stop still outranks status, as on the tile', () => {
    const p: Permission = { ...ok, allowed: false, disposition: 'today', reasons: ['Get advice today.'], needsCheckIn: false };
    expect(movementCard(input({ permission: p, gate: 'today', status: 'away' })).state).toBe('stopped');
  });

  it('Workout outside the programme: Join, and Stretch instead; during a flare the stretch comes first (D35)', () => {
    const base = input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: false, title: 'x' });
    const c = movementCard(base);
    expect(c.state).toBe('join');
    expect(c.primary).toEqual({ kind: 'join', label: 'Join the 12-week programme' });
    expect(kinds(c)).toEqual(['join', 'stretch']);
    const flare = movementCard({ ...base, status: 'flare' });
    expect(flare.primary).toEqual({ kind: 'stretch', label: 'Stretch instead' });
    expect(flare.secondary).toEqual([{ kind: 'join', label: 'Join the 12-week programme' }]);
  });

  it('a run saved today carries on, through the gate', () => {
    expect(movementCard(input({ saved: { minutesLeft: 6, label: 'Back & hips stretch' } }))).toMatchObject({
      state: 'resume', title: 'Continue your stretch', detail: '6 min left · Back & hips stretch', primary: { kind: 'continue', label: 'Continue stretch' },
    });
    expect(movementCard(input({ gate: 'checkIn', saved: { minutesLeft: 6, label: 'x' } })).primary?.label).toBe('Check in & continue');
  });

  it('Workout on a rest day: Stretch instead, with the optional rest-day mobility', () => {
    const c = movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: true, rest: { mobility: true } }));
    expect(c).toMatchObject({ state: 'rest', title: 'Rest day', primary: { kind: 'stretch', label: 'Stretch instead' } });
    expect(c.secondary).toEqual([{ kind: 'mobility', label: 'Start rest-day mobility' }]);
  });

  it('a flare: the tile’s flare words, never "check in first", which the button says', () => {
    const p = held('stretch', [PERMISSION_TEXT.noCheckIn], { needsCheckIn: true });
    expect(movementCard(input({ permission: p, gate: 'checkIn', status: 'flare', line: line('Gentle stretch · check in first') })).today).toBe('Gentle stretch');
    const walk = movementCard(input({ mode: 'walk', permission: { ...ok, mode: 'walk' }, status: 'flare', title: 'Just a walk', line: line('Just a walk · Stretch is suggested today') }));
    expect(walk.today).toBe('Stretch is suggested today');
    expect(kinds(walk)).toEqual(['start', 'stretch']);
  });

  it('a routine the builder can’t make today says so, with no Start', () => {
    const c = movementCard(input({ blocked: 'This routine cannot be put together safely today. Try another area or length.' }));
    expect(c.state).toBe('held');
    expect(c.primary).toBeUndefined();
  });

  it('B-09: the after-meal button states the time, with Different time and Just a walk', () => {
    const c = movementCard(input({ mode: 'walk', permission: { ...ok, mode: 'walk' }, title: 'Just a walk', afterMeal: { title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' } }));
    expect(c.title).toBe('A walk after lunch');
    expect(c.primary).toEqual({ kind: 'start', label: 'I had lunch at 1:10 pm: walk now' });
    expect(kinds(c)).toEqual(['start', 'otherTime', 'justWalk']);
    const first = movementCard(input({ mode: 'walk', gate: 'checkIn', permission: held('walk', [PERMISSION_TEXT.noCheckIn], { needsCheckIn: true }), title: 'x', afterMeal: { title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' } }));
    expect(first.note).toBe('A short check-in comes first.');
  });

  it('a start that waits for a choice is shown, not usable, and says why', () => {
    const c = movementCard(input({ waiting: 'Choose the meal to start.' }));
    expect(c.primary).toMatchObject({ kind: 'start', disabled: true });
    expect(c.note).toBe('Choose the meal to start.');
  });

  it('never offers a start-kind action while the gate refuses (Review Focus 1)', () => {
    const refusals: Partial<CardInput>[] = [
      { gate: 'hold', permission: held('stretch', ['A hold.']) },
      { gate: 'recheck', permission: held('stretch', ['A low.'], { needsCheckIn: true }) },
      { gate: 'today', permission: { ...ok, allowed: false, disposition: 'today', reasons: ['x'], needsCheckIn: false } },
      { gate: 'emergency', permission: { ...ok, allowed: false, disposition: 'emergency', reasons: ['x'], needsCheckIn: false } },
      { gate: 'hold', permission: held('stretch', [PERMISSION_TEXT.healthUnreviewed]), gaps: { healthUnreviewed: true, medicinesUnknown: false } },
    ];
    for (const r of refusals) {
      for (const extra of [{}, { saved: { minutesLeft: 3, label: 'x' } }, { afterMeal: { title: 't', label: 'l' } }]) {
        const c = movementCard(input({ ...r, ...extra }));
        expect(kinds(c), `${r.gate}`).not.toContain('start');
        expect(kinds(c), `${r.gate}`).not.toContain('continue');
      }
    }
  });
});

describe('actionTarget: every way a hub can start movement goes through the gate (§4.1, §4.2; Review Focus 1)', () => {
  const ctx = {
    mode: 'stretch' as const, href: '/session?mode=stretch&focus=backHips&minutes=10', startLabel: 'Start stretch',
    resumeHref: '/session?mode=stretch&focus=backHips&minutes=10&resume=1', plainHref: '/walk/live?id=abcd-1234',
  };

  it('Start, Start anyway, Review, Continue, rest-day mobility and Just a walk are all gate starts', () => {
    for (const kind of ['start', 'anyway', 'review', 'continue', 'mobility', 'justWalk'] as HubActionKind[]) expect(actionTarget(kind, ctx).via, kind).toBe('gate');
    expect(actionTarget('continue', ctx)).toEqual({ via: 'gate', mode: 'stretch', href: ctx.resumeHref, label: 'Continue stretch' });
    expect(actionTarget('mobility', ctx)).toMatchObject({ via: 'gate', mode: 'guided', href: '/session' });
    expect(actionTarget('justWalk', { ...ctx, mode: 'walk' })).toMatchObject({ via: 'gate', mode: 'walk', href: ctx.plainHref });
  });

  it('everything else only navigates or opens a sheet, and never to the player or a live walk', () => {
    for (const kind of ['profile', 'join', 'stretch', 'status', 'otherTime'] as HubActionKind[]) {
      const t = actionTarget(kind, ctx);
      expect(t.via, kind).not.toBe('gate');
      if (t.via === 'go') expect(t.to).not.toMatch(/^\/(session|walk\/live)/);
    }
    expect(actionTarget('join', ctx)).toEqual({ via: 'go', to: JOIN_HREF });
  });

  it('runAction starts only through `start`', () => {
    const fx = { start: vi.fn(), go: vi.fn(), status: vi.fn(), local: vi.fn() };
    runAction(actionTarget('anyway', ctx), fx);
    expect(fx.start).toHaveBeenCalledWith('stretch', ctx.href, 'Start stretch');
    expect(fx.go).not.toHaveBeenCalled();
    runAction(actionTarget('status', ctx), fx);
    expect(fx.status).toHaveBeenCalledTimes(1);
  });
});

describe('the smaller rules', () => {
  it('resumeAllowed: never while Away or Unwell, and only a stretch during a flare (A-34)', () => {
    expect(resumeAllowed('normal', 'guided')).toBe(true);
    expect(resumeAllowed('flare', 'stretch')).toBe(true);
    expect(resumeAllowed('flare', 'guided')).toBe(false);
    expect(resumeAllowed('unwell', 'stretch')).toBe(false);
    expect(resumeAllowed('away', 'stretch')).toBe(false);
  });

  it('restDayOf: a rest day, with its optional mobility when the plan has one', () => {
    expect(restDayOf({ kind: 'restDay', focus: 'rest' })).toEqual({ mobility: true });
    expect(restDayOf({ kind: 'none', focus: 'rest' })).toEqual({ mobility: false });
    expect(restDayOf({ kind: 'full', focus: 'upperA' })).toBeUndefined();
  });

  it('sessionParts: the blocks today’s session holds', () => {
    expect(sessionParts({ blockStarts: { mobility: 0, strength: 4, cardio: 12 } })).toBe('mobility, strength and cardio');
    expect(sessionParts({ blockStarts: { mobility: 0 } })).toBe('mobility');
    expect(sessionParts({ blockStarts: {} })).toBeUndefined();
  });

  it('stretchReason: only real inputs, and none for a routine the person chose (§8.3)', () => {
    const r = (over: Partial<Parameters<typeof stretchReason>[0]>) => stretchReason({ chosen: false, flare: false, focus: 'backHips', fromLast: false, ...over });
    expect(r({ chosen: true, flare: true })).toBeUndefined();
    expect(r({ flare: true })).toBe('Your back is in a flare-up, so this is the gentler routine.');
    expect(r({ yesterday: { pain: 3 } })).toBe('Your check-in yesterday said back pain 3 of 10.');
    expect(r({ yesterday: { pain: 0 } })).toBeUndefined();
    expect(r({ focus: 'hipsLegs', yesterday: { legPain: 2 } })).toBe('Your check-in yesterday said leg pain 2 of 10.');
    expect(r({ fromLast: true })).toBe('The routine you did last time.');
    expect(r({ focusSetting: 'stretch' })).toBe('You chose stretching as your focus.');
  });
});

describe('the edges the copy table implies', () => {
  it('outside the programme during a flare with stretching held: Join stays the way in', () => {
    const c = movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: false, status: 'flare', stretchOpen: false, title: 'x' }));
    expect(c.primary).toEqual({ kind: 'join', label: 'Join the 12-week programme' });
    expect(c.secondary).toEqual([]);
  });

  it('unanswered health questions: the health chapter, Home’s title, and today’s check-in beside it', () => {
    const p = held('stretch', [PERMISSION_TEXT.healthUnreviewed]);
    const c = movementCard(input({ permission: p, gate: 'hold', gaps: { healthUnreviewed: true, medicinesUnknown: false } }));
    expect(c).toMatchObject({ state: 'gap', title: 'Finish your health profile', primary: { kind: 'profile', label: 'Answer the questions about your health' } });
    expect(c.secondary).toEqual([{ kind: 'review', label: 'Review today’s check-in' }]);
  });

  it('a re-check is its own way on: no second check-in button, and no stretch during it', () => {
    const p = held('stretch', ['A low.'], { needsCheckIn: true });
    expect(movementCard(input({ permission: p, gate: 'recheck' })).secondary).toEqual([]);
  });

  it('a routine the builder can’t make says the builder’s words', () => {
    const words = 'This routine cannot be put together safely today. Try another area or length.';
    expect(movementCard(input({ blocked: words })).reasons).toEqual([words]);
  });

  it('a rest day: no Stretch instead while stretching is held, and mobility only when the plan has it', () => {
    const rest = (mobility: boolean, stretchOpen: boolean) =>
      movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: true, rest: { mobility }, stretchOpen }));
    expect(rest(true, false).primary).toBeUndefined();
    expect(rest(false, true).secondary).toEqual([]);
  });

  it('“With changes” only when there are changes to list', () => {
    const c = movementCard(input({ permission: { ...ok, disposition: 'adjust', restrictions: [] } }));
    expect(c.today).toBeUndefined();
    expect(c.restrictions).toEqual([]);
  });

  it('the after-meal button says nothing of a check-in when none is due', () => {
    const c = movementCard(input({ mode: 'walk', permission: { ...ok, mode: 'walk' }, title: 'Just a walk', afterMeal: { title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' } }));
    expect(c.note).toBeUndefined();
  });

  it('the targets that only navigate go where they say, and runAction carries each kind out', () => {
    const ctx = { mode: 'stretch' as const, href: '/session?mode=stretch&focus=backHips&minutes=10', startLabel: 'Start stretch' };
    expect(actionTarget('profile', ctx)).toEqual({ via: 'go', to: '/me/profile' });
    expect(actionTarget('stretch', ctx)).toEqual({ via: 'go', to: '/hub/stretch' });
    expect(actionTarget('otherTime', ctx)).toEqual({ via: 'local' });
    const fx = { start: vi.fn(), go: vi.fn(), status: vi.fn(), local: vi.fn() };
    runAction(actionTarget('join', ctx), fx);
    expect(fx.go).toHaveBeenCalledWith(JOIN_HREF);
    runAction(actionTarget('otherTime', ctx), fx);
    expect(fx.local).toHaveBeenCalledTimes(1);
    expect(fx.status).not.toHaveBeenCalled();
    expect(fx.start).not.toHaveBeenCalled();
  });

  it('a day the plan refuses is not a rest day', () => {
    expect(restDayOf({ kind: 'none', focus: 'upperA' })).toBeUndefined();
  });

  it('stretchReason names a pain only for the area the routine serves', () => {
    expect(stretchReason({ chosen: false, flare: false, focus: 'neckShoulders', yesterday: { pain: 3, legPain: 2 }, fromLast: false })).toBeUndefined();
    expect(stretchReason({ chosen: false, flare: false, focus: 'backHips', yesterday: { legPain: 2 }, fromLast: false })).toBeUndefined();
  });
});
