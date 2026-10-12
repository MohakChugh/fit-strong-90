/**
 * Codex round 3 release conditions for the guided player, driven through the
 * real callers: `SessionPage`, its `Player`, `useGuidedSession` with its
 * runner and earphone handlers, the check-in path and the real store. What is
 * replaced is only what cannot run in node and decides nothing: audio, the 3D
 * figure, the router, and two styled primitives (Button, Dialog) swapped for
 * plain elements with the same handlers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { CardioStep, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import type { RunnerState } from '@/session/runner';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [router.params], useNavigate: () => router.navigate }));
vi.mock('@/components/hig/navigation', () => ({ cameFrom: () => false }));
vi.mock('@/components/session/FigureSlot', () => ({ FigureSlot: () => null }));
vi.mock('@/components/session/InfoSheet', () => ({ InfoSheet: () => null }));
vi.mock('@/voice/clips', () => ({ loadManifest: async () => null, primeAudio: async () => true, ClipNarrator: class {} }));
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {} }) }));
vi.mock('@/components/ui/button', async () => {
  const { createElement: h } = await import('react');
  return {
    Button: ({ children, onClick, disabled, ...rest }: { children?: unknown; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      h('button', { type: 'button', onClick, disabled, 'aria-label': rest['aria-label'] }, children as never),
  };
});
vi.mock('@/components/ui/dialog', async () => {
  const { createElement: h } = await import('react');
  const pass = ({ children }: { children?: unknown }) => h('div', null, children as never);
  return {
    Dialog: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null),
    DialogContent: pass, DialogHeader: pass, DialogFooter: pass, DialogTitle: pass, DialogDescription: pass,
  };
});

// What the browser would have: storage, a window, a document, earphone controls.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
const media: Record<string, ((d?: unknown) => void) | null> = {};
Object.assign(globalThis, {
  window: globalThis,
  location: { href: 'http://localhost/' },
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  Audio: class { play() { return Promise.resolve(); } pause() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});
Object.defineProperty(globalThis.navigator, 'mediaSession', {
  configurable: true,
  value: { setActionHandler: (a: string, fn: ((d?: unknown) => void) | null) => { media[a] = fn; }, metadata: null, playbackState: 'none' },
});

const store = await import('@/store/useStore');
const { default: SessionPage } = await import('./SessionPage');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { buildSessionPlan } = await import('@/engine/session');
const { saveProgress } = await import('@/session/persistence');
const { getMeta } = await import('@/data/catalog');
const { activeConditions, evaluateFlags } = await import('@/engine/safety');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const INSULIN = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } } satisfies ProfileInput;
const BACK = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: true }, health: { ...known, diabetes: 'type2', metformin: true } } satisfies ProfileInput;
const START = '2026-09-28';
const DAY = '2026-10-09';
const iso = (h: number, m = 0, d = 9) => new Date(2026, 9, d, h, m, 0).toISOString();
const clock = (h: number, m = 0, d = 9) => vi.setSystemTime(new Date(2026, 9, d, h, m, 0));
const KEY = 'fit-strong-90-guided';

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  router.params = new URLSearchParams();
  router.navigate = vi.fn();
  for (const k of Object.keys(media)) delete media[k];
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
async function seed(profile: UserProfile, records: DailyCheckIn[]) {
  const recs: CheckInRecord[] = records.map(c => ({ ...c, readiness: evaluateCheckIn(profile, c, records.filter(r => r.date < c.date)) }));
  await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, startDate: START }, checkIns: recs }));
}
function paused(plan: SessionPlan, index: number): RunnerState {
  return { planId: plan.id, date: plan.date, status: 'paused', index, stepStartedAt: 1_000, pausedAt: 1_000, visit: 1, extraMs: {}, logs: [], startedAt: 0, activeMs: 60_000 };
}
const saveRun = (plan: SessionPlan, state: RunnerState) => saveProgress(plan, state, 1_000, Date.now(), 'guided-test');
const progress = () => JSON.parse(local.get(KEY) ?? 'null') as { plan: SessionPlan; state: RunnerState } | null;
async function mount(query = '') {
  host?.unmount();
  router.params = new URLSearchParams(query);
  host = render(createElement(SessionPage));
  await host.settle();
  return host;
}
const h = () => host!;
/** Let the player's 4 Hz clock run once, in real time. */
const tick = async () => { await new Promise(r => setTimeout(r, 300)); await h().settle(); };
const playing = () => h().buttons('Pause', { exact: true }).length > 0;

describe('release condition 4 (B03): starting again is a restart, from the screen, the exit dialog or the earphones', () => {
  it('a pause past 30 minutes needs a new reading; exercise that never stopped is not cut off', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    expect(playing()).toBe(true);
    // Running on past the reading's 30 minutes: nothing interrupts it.
    clock(9, 31);
    await tick();
    expect(playing()).toBe(true);
    expect(h().text()).not.toMatch(/Check your glucose before you carry on/);

    await h().click(h().button('Pause', { exact: true }));
    await h().click(h().button('Resume', { exact: true }));
    expect(h().text()).toMatch(/Check your glucose before you carry on/);
    expect(progress()?.state.status).toBe('paused');
    // The earphones and the lock screen ask the same question.
    media.play?.();
    await h().settle();
    expect(progress()?.state.status).toBe('paused');

    await h().change(h().field('Glucose now'), { value: '130' });
    await h().click(h().button('Save this reading'));
    expect(progress()?.state.status).toBe('running');
    expect(playing()).toBe(true);
  });

  it('at exactly 30 minutes the reading still counts, and Keep going in the exit dialog asks the same question', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    clock(9, 29);
    await h().click(h().button('End session'));
    clock(9, 30);
    await h().click(h().button('Keep going'));
    expect(progress()?.state.status).toBe('running');
    clock(9, 40);
    await h().click(h().button('End session'));
    await h().click(h().button('Keep going'));
    expect(progress()?.state.status).toBe('paused');
    expect(h().text()).toMatch(/Check your glucose before you carry on/);
  });

  it('restoring saved progress with no check-in yet today, or under a profile hold, moves nothing', async () => {
    const p = createDefaultProfile(INSULIN);
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9) } }) });
    saveRun(plan, paused(plan, 3));
    clock(9, 0, 10);
    await seed(p, []);
    await mount('resume=1');
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    expect(h().text()).toMatch(/check-in|Check in/i);

    const eye = createDefaultProfile({ health: { ...INSULIN.health, retinopathy: 'recent_eye_treatment' } });
    await seed(eye, [ci({ date: '2026-10-10', glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9, 0, 10) } })]);
    await mount('resume=1');
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    expect(h().text()).toMatch(/eye/i);
  });

  it('a saved stretch is restored under the same restart question, as a stretch', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(8, 20) } })]);
    clock(9);
    await mount('mode=stretch&focus=backHips&minutes=10');
    expect(h().text()).toMatch(/Check again before you start/);
    expect(h().buttons('Start', { exact: true })).toHaveLength(0);
  });
});

describe('release condition 6 (B05): an archived interval plan runs to today’s limits', () => {
  it('under INT, LOAD, HEAD, capHeavy and COOL: no interval, no set over its cap, today’s cues and a full cool-down', async () => {
    const before = createDefaultProfile(INSULIN);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(8, 50) } });
    const plan = buildSessionPlan({ profile: before, date: DAY, startDate: START, sessions: [], checkIn: morning, focusOverride: 'upperB' });
    const cardioThen = plan.steps.find(s => s.kind === 'cardio');
    expect(cardioThen && cardioThen.kind === 'cardio' && cardioThen.parts.some(x => x.intensity === 'fast')).toBe(true);
    saveRun(plan, paused(plan, 0));

    const after = createDefaultProfile({ health: { ...INSULIN.health, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false, bpExercisePermission: { sys: 170, dia: 105 } } });
    const now = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(8, 50) }, bpReadings: [{ sys: 165, dia: 95, at: iso(8, 52) }] });
    await seed(after, [now]);
    await mount('resume=1');
    expect(h().buttons('Resume', { exact: true })).toHaveLength(1);

    const run = progress()!.plan;
    const cardio = run.steps.find(s => s.kind === 'cardio');
    expect(cardio?.kind).toBe('cardio');
    if (cardio?.kind !== 'cardio') return;
    expect(cardio.parts.some(x => x.intensity === 'fast' || x.intensity === 'tempo')).toBe(false);
    expect(cardio.parts.filter(x => x.intensity === 'cooldown').reduce((t, x) => t + x.seconds, 0)).toBeGreaterThanOrEqual(300);
    const readiness = evaluateCheckIn(after, now);
    expect(readiness.modifiers).toEqual(expect.arrayContaining(['INT', 'LOAD', 'COOL']));
    // What the app's own builder prescribes for today: every working set run
    // must be at least that cautious, with at least today's cues.
    const today = buildSessionPlan({ profile: after, date: DAY, startDate: START, sessions: [], checkIn: now, focusOverride: 'upperB' });
    let compared = 0;
    for (const s of run.steps) {
      if (s.kind !== 'set' || s.ramp) continue;
      const twin = today.steps.find(t => t.kind === 'set' && t.exerciseId === s.exerciseId && t.set === s.set && !t.ramp);
      if (!twin || twin.kind !== 'set') continue;
      compared++;
      expect(s.reps, s.id).toBeGreaterThanOrEqual(twin.reps);
      expect(s.rir, s.id).toBeGreaterThanOrEqual(twin.rir);
      const cues = run.exercises.find(e => e.exerciseId === s.exerciseId)?.rx.caps ?? [];
      for (const cue of today.exercises.find(e => e.exerciseId === s.exerciseId)?.rx.caps ?? []) expect(cues, s.id).toContain(cue);
    }
    expect(compared).toBeGreaterThan(0);
    // The saved plan had heavier sets than today allows: they were re-dosed, not run as saved.
    const heavier = plan.steps.filter(s => s.kind === 'set' && !s.ramp && today.steps.some(t => t.kind === 'set' && t.exerciseId === s.exerciseId && t.set === s.set && !t.ramp && (t.reps > s.reps || t.rir > s.rir)));
    expect(heavier.length).toBeGreaterThan(0);
  });

  it('under a new foot wound and eye restriction the runner never enters the work they rule out', async () => {
    const before = createDefaultProfile(INSULIN);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(8, 50) } });
    const plan = buildSessionPlan({ profile: before, date: DAY, startDate: START, sessions: [], checkIn: morning, focusOverride: 'lowerA' });
    saveRun(plan, paused(plan, 0));
    const after = createDefaultProfile({ health: { ...INSULIN.health, footStatus: 'current_wound_or_active_charcot', peripheralNeuropathy: 'yes', retinopathy: 'severe_or_proliferative' } });
    await seed(after, [morning]);
    await mount('resume=1');
    const conditions = activeConditions(after, evaluateCheckIn(after, morning));
    const banned = new Set(plan.steps.filter(s => 'exerciseId' in s && s.kind !== 'checkpoint' && evaluateFlags(getMeta(s.exerciseId)?.flags ?? {}, conditions).excluded).map(s => s.id));
    expect(banned.size).toBeGreaterThan(0);
    const visited = new Set<number>();
    for (let i = 0; i < 120 && progress()?.state.status === 'paused'; i++) {
      visited.add(progress()!.state.index);
      if (h().buttons('Enter my glucose').length) break;
      await h().click(h().button('Next', { exact: true }));
    }
    const run = progress()!.plan;
    for (const i of visited) expect(banned.has(run.steps[i].id), run.steps[i].id).toBe(false);
    expect(progress()!.state.logs.filter(l => banned.has(l.stepId)).every(l => l.skipped && !l.completed)).toBe(true);
  });
});

describe('release condition 7 (B06): the low and glucose checks are answered by a reading, or the session ends', () => {
  async function running(p: UserProfile) {
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
  }

  it('"I feel low" stops at once; leaving and coming back, or the earphones, resume nothing until a reading is in', async () => {
    const p = createDefaultProfile(INSULIN);
    await running(p);
    await h().click(h().button('I feel low'));
    expect(h().text()).toMatch(/Treat the low first/);
    expect(progress()?.state.status).toBe('paused');
    expect(store.getState().checkIns[0].lowSymptomsAt).toBeTruthy();
    media.play?.();
    await h().settle();
    expect(progress()?.state.status).toBe('paused');
    await h().click(h().button('Leave, and come back later'));
    expect(router.navigate).toHaveBeenCalled();
    await mount('resume=1');
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    expect(progress()?.state.status).toBe('paused');
  });

  it('a normal reading at the routine check carries on to the cardio, and nothing is logged before it', async () => {
    const p = createDefaultProfile(INSULIN);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } });
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning });
    const check = plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'glucose');
    expect(check).toBeGreaterThan(0);
    saveRun(plan, paused(plan, check));
    await seed(p, [morning]);
    await mount('resume=1');
    // Running, the session waits on the check; the tap pauses it, and the
    // saved run shows nothing was logged that could let Next skip it (P14b).
    await h().click(h().button('Resume', { exact: true }));
    expect(progress()!.state.status).toBe('running');
    await h().click(h().button('Enter my glucose'));
    expect(h().text()).toMatch(/Check your glucose/);
    expect(progress()!.state.status).toBe('paused');
    expect(progress()!.state.logs.find(l => l.stepId === 'c-glucose')?.answer).toBeUndefined();
    // Leaving now and coming back finds the check still unanswered.
    await h().click(h().button('Leave, and come back later'));
    await mount('resume=1');
    await h().click(h().button('Next', { exact: true }));
    expect(progress()!.plan.steps[progress()!.state.index].id).toBe('c-glucose');
    await h().click(h().button('Enter my glucose'));
    await h().change(h().field('Glucose now'), { value: '140' });
    await h().click(h().button('Save this reading'));
    const s = progress()!.state;
    expect(progress()!.plan.steps[s.index].kind).toBe('cardio');
    expect(s.coolDownFrom).toBeUndefined();
    expect(s.status).toBe('running');
  });

  it('the treated low is captured whole: the low itself, whether help was needed, and the timed re-check', async () => {
    const p = createDefaultProfile(INSULIN);
    await running(p);
    await h().click(h().button('I feel low'));
    await h().change(h().field('Glucose now'), { value: '50' });
    await h().click(h().field('Someone else had to help me treat this low'));
    await h().click(h().button('Save this reading'));
    expect(h().text()).toMatch(/No exercise today/);
    const c = store.getState().checkIns[0];
    expect(c.glucose?.value).toBe(50);
    expect(c.news).toContain('lowSevere');
  });

  it('a level 1 low is released only by a re-check 15 minutes on, and then to the cool-down only', async () => {
    const p = createDefaultProfile(INSULIN);
    await running(p);
    clock(9, 10);
    await h().click(h().button('I feel low'));
    await h().change(h().field('Glucose now'), { value: '65' });
    await h().click(h().button('Save this reading'));
    expect(h().text()).toMatch(/Measure again in/);
    clock(9, 20);
    await h().change(h().field('Glucose now'), { value: '95' });
    await h().click(h().field('My symptoms have gone'));
    await h().click(h().button('Save this reading'));
    expect(h().text()).toMatch(/Treat the low first|Check your glucose/);
    clock(9, 26);
    await h().change(h().field('Glucose now'), { value: '96' });
    await h().click(h().field('My symptoms have gone'));
    await h().click(h().button('Save this reading'));
    const s = progress()!.state;
    expect(s.coolDownFrom).toBeDefined();
    expect(s.status).toBe('running');
  });
});

describe('release condition 10 (B09): worse back symptoms stop that exercise for the day, and red flags take the higher path', () => {
  async function atBackCheck(p: UserProfile) {
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9) }, back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } });
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning, focusOverride: 'lowerA' });
    const check = plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'backSymptoms');
    expect(check).toBeGreaterThan(0);
    const provoking = (plan.steps[check] as { exerciseId?: string }).exerciseId!;
    saveRun(plan, paused(plan, check));
    await seed(p, [morning]);
    await mount('resume=1');
    return { plan, check, provoking };
  }

  it('leaving the report unanswered keeps the exercise out: Previous and Resume never replay it, and restoring keeps it out', async () => {
    const p = createDefaultProfile(BACK);
    const { plan, check, provoking } = await atBackCheck(p);
    await h().click(h().button('worse', { exact: true }));
    expect(h().text()).toMatch(/That exercise stops here/);
    expect(store.getState().checkIns[0].provoked).toEqual([provoking]);
    // Leave without answering, and come back to the saved run.
    await mount('resume=1');
    // Every step Previous lands on, not just the last.
    const landed: number[] = [];
    for (let i = 0; i < 6; i++) {
      await h().click(h().button('Previous', { exact: true }));
      landed.push(progress()!.state.index);
    }
    const at = progress()!.state.index;
    expect(at).toBeLessThan(check);
    for (const i of landed) {
      const st = plan.steps[i] as { exerciseId?: string; nextStepId?: string };
      expect(st.exerciseId, plan.steps[i].id).not.toBe(provoking);
    }
    await h().click(h().button('Resume', { exact: true }));
    await tick();
    const now = progress()!.state.index;
    expect((progress()!.plan.steps[now] as { exerciseId?: string }).exerciseId).not.toBe(provoking);
  });

  for (const [what, ticks] of [
    ['rapidly worsening weakness', ['New foot drop or foot dragging, or a leg getting weaker', 'It is getting worse over hours or days']],
    ['weakness in both legs', ['New weakness or numbness in both legs']],
    ['saddle numbness', ['New numbness around the genitals or bottom']],
    ['bladder or bowel change', ['Can’t pee, or new loss of bladder or bowel control']],
  ] as const) {
    it(`${what} is an emergency, whatever the pain score`, async () => {
      const p = createDefaultProfile(BACK);
      await atBackCheck(p);
      await h().click(h().button('worse', { exact: true }));
      for (const t of ticks) await h().click(h().field(t));
      await h().click(h().button('Save, and carry on without it'));
      expect(h().text()).toMatch(/Call emergency services now/);
      expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    });
  }
});

describe('acceptance J17 step 5 and scan M-06: a finished stretch the device will not store keeps its progress until it is stored', () => {
  for (const [what, error] of [
    ['Safari’s code-22 error', () => ({ name: 'QuotaExceededError', code: 22, message: 'QuotaExceededError: DOM Exception 22' })],
    ['a QuotaExceededError', () => new DOMException('The quota has been exceeded.', 'QuotaExceededError')],
  ] as const) it(`${what} on the sessions write`, async () => {
    let refuseSessions = true;
    store.resetForTests();
    await store.start({
      factory: fakeIndexedDB({ failWrite: name => (refuseSessions && name === 'sessions' ? error() : undefined) }),
      broadcast: null,
    });
    const p = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true } });
    await seed(p, [ci()]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    clock(9, 30);
    await tick();
    await tick();
    expect(h().text()).toMatch(/Stretch complete/);
    const key = 'fit-strong-90-stretch';
    // The save on reaching the summary failed: the work is still on the device.
    expect(local.get(key)).toBeTruthy();
    await h().click(h().button('Save and finish'));
    expect(h().text()).toMatch(/couldn’t save/);
    expect(local.get(key)).toBeTruthy();
    // Storage works again: stored once, and only then is the progress let go.
    refuseSessions = false;
    await h().click(h().button('Save and finish'));
    await h().settle();
    const stretches = store.getState().sessions.filter(x => x.planKind === 'stretch');
    expect(stretches).toHaveLength(1);
    expect(store.isSessionSaved(stretches[0].id)).toBe(true);
    expect(local.get(key)).toBeUndefined();
  });
});

const NONE = { health: { ...known } } satisfies ProfileInput;
/** The stop control on the running or paused player. */
const stopControl = () => h().button(/Stop: something’s wrong/);
const status = (slot: 'guided' | 'stretch' = 'guided') =>
  (JSON.parse(local.get(slot === 'stretch' ? 'fit-strong-90-stretch' : KEY) ?? 'null') as { state: RunnerState } | null)?.state.status;
const today = () => store.getState().checkIns.find(c => c.date === DAY);
const stretchRun = () => JSON.parse(local.get('fit-strong-90-stretch') ?? 'null') as { plan: SessionPlan; state: RunnerState } | null;
/** Finished and stored: the summary is up, the session is in History and its progress copy has gone. */
const finished = (kind: 'guided' | 'stretch') => {
  const s = store.getState().sessions.find(x => x.date === DAY && (kind === 'stretch' ? x.planKind === 'stretch' : x.planKind !== 'stretch'));
  return !!s && store.isSessionSaved(s.id) && status(kind) === undefined;
};

describe('scan M-01: a restart after midnight asks the new day’s check-in, not a reading', () => {
  it('someone without diabetes is asked the check-in in the player, and carries on once it allows', async () => {
    const p = createDefaultProfile(NONE);
    clock(23, 40, 8);
    await seed(p, [ci({ date: '2026-10-08' })]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('Pause', { exact: true }));
    clock(0, 5, 9);
    await h().click(h().button('Resume', { exact: true }));
    expect(h().text()).toMatch(/Check in to carry on/);
    expect(h().text()).not.toMatch(/Glucose now|Check your glucose/);
    expect(status('stretch')).toBe('paused');
    await h().click(h().button('None of these'));
    await h().click(h().button('See today’s plan'));
    expect(today()?.emergency).toEqual([]);
    await h().click(h().button('Carry on'));
    expect(status('stretch')).toBe('running');
    expect(playing()).toBe(true);
  });

  it('a low said at 00:05 is filed on the new day, and settling it still asks for that day’s check-in', async () => {
    const p = createDefaultProfile(INSULIN);
    clock(23, 40, 8);
    await seed(p, [ci({ date: '2026-10-08', glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(23, 35, 8), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    clock(0, 5, 9);
    await h().click(h().button('I feel low'));
    expect(store.getState().checkIns.find(c => c.date === '2026-10-08')?.lowSymptomsAt).toBeUndefined();
    expect(today()?.lowSymptomsAt).toBe(iso(0, 5));
    expect(today()?.sleep).toBeUndefined();
    clock(0, 6, 9);
    await h().change(h().field('Glucose now'), { value: '110' });
    await h().click(h().field('My symptoms have gone'));
    await h().click(h().button('Save this reading'));
    expect(today()?.glucose?.value).toBe(110);
    expect(h().text()).toMatch(/Check in to carry on/);
    expect(status()).toBe('paused');
  });
});

describe('scan M-02: a low found at the restart check allows the cool-down only', () => {
  it('62 at the restart, then 95 with symptoms gone, goes to the cool-down', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    clock(9, 5);
    await h().click(h().button('Pause', { exact: true }));
    clock(9, 40);
    await h().click(h().button('Resume', { exact: true }));
    expect(h().text()).toMatch(/Check your glucose before you carry on/);
    await h().change(h().field('Glucose now'), { value: '62' });
    await h().click(h().button('Save this reading'));
    expect(status()).toBe('paused');
    clock(9, 56);
    await h().change(h().field('Glucose now'), { value: '95' });
    await h().click(h().field('My symptoms have gone'));
    await h().click(h().button('Save this reading'));
    const s = progress()!.state;
    expect(s.coolDownFrom).toBeDefined();
    expect(s.status).toBe('running');
  });
});

describe('scan M-03: a finished session stays finished', () => {
  it('earphone and lock-screen controls go once it is done, so "previous track" cannot bring it back', async () => {
    const p = createDefaultProfile(NONE);
    await seed(p, [ci()]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    expect(media.previoustrack).toBeTruthy();
    await h().click(h().button('End session'));
    await h().click(h().button('Finish now'));
    expect(finished('guided')).toBe(true);
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) expect(media[a], a).toBeFalsy();
    expect(h().text()).toMatch(/Session complete/);
  });
});

describe('scan M-07: when this device is not saving, the summary never says "Saved"', () => {
  it('says the session is kept only until the app closes, and keeps its progress copy', async () => {
    store.resetForTests();
    await store.start({ factory: undefined });
    expect(store.getState().status).toBe('unavailable');
    const p = createDefaultProfile(NONE);
    await seed(p, [ci()]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    clock(9, 30);
    await tick();
    await tick();
    expect(h().text()).toMatch(/Stretch complete/);
    expect(h().text()).toMatch(/kept only until you close the app/);
    expect(h().text()).not.toMatch(/Saved|couldn’t save/);
    await h().click(h().button('Finish'));
    expect(router.navigate).toHaveBeenCalled();
    expect(local.get('fit-strong-90-stretch')).toBeTruthy();
  });
});

describe('scan M-08: an earlier run the device will not bank is kept aside before Start can overwrite it', () => {
  it('kept under its own key, and the start screen says so', async () => {
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ failWrite: name => (name === 'sessions' ? new DOMException('Full', 'QuotaExceededError') : undefined) }), broadcast: null });
    const p = createDefaultProfile(NONE);
    const yesterday = '2026-10-08';
    const plan = buildSessionPlan({ profile: p, date: yesterday, startDate: START, sessions: [], checkIn: ci({ date: yesterday }) });
    const work = plan.steps.filter(x => x.kind === 'hold' || x.kind === 'drill').slice(0, 3);
    const state: RunnerState = { ...paused(plan, plan.steps.indexOf(work[2]) + 1), logs: work.map(x => ({ stepId: x.id, kind: x.kind, completed: true, at: 1_000 })) };
    saveRun(plan, state);
    await seed(p, [ci()]);
    await mount();
    expect(h().text()).toMatch(/could not be added to your history/);
    const aside = JSON.parse(local.get('fit-strong-90-unbanked') ?? '[]') as { plan: SessionPlan }[];
    expect(aside.map(x => x.plan.date)).toEqual([yesterday]);
    await h().click(h().button('Start', { exact: true }));
    expect(progress()?.plan.date).toBe(DAY);
    expect((JSON.parse(local.get('fit-strong-90-unbanked') ?? '[]') as { plan: SessionPlan }[]).map(x => x.plan.date)).toEqual([yesterday]);
  });
});

describe('scan M-09: "I feel low", then End session, reaches the summary', () => {
  it('with the low’s guidance, not a prompt to carry on', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('I feel low'));
    await h().click(h().button('End session'));
    expect(finished('guided')).toBe(true);
    expect(h().text()).toMatch(/Session complete/);
    expect(h().text()).toMatch(/low is coming: check your glucose/);
    expect(h().text()).not.toMatch(/before you carry on/);
    expect(h().buttons('Save and finish')).toHaveLength(1);
  });
});

describe('acceptance J02, J08, J16: "Stop: something’s wrong" in the running player', () => {
  async function moving(p: UserProfile, query = 'mode=stretch&focus=backHips&minutes=10') {
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount(query);
    await h().click(h().button('Start', { exact: true }));
    expect(playing()).toBe(true);
  }
  const slot = 'stretch' as const;

  it('is there while moving and while paused, stops at once, and asks the stop rows', async () => {
    await moving(createDefaultProfile(BACK));
    expect(stopControl()).toBeTruthy();
    await h().click(h().button('Pause', { exact: true }));
    expect(stopControl()).toBeTruthy();
    await h().click(h().button('Resume', { exact: true }));
    await h().click(stopControl());
    expect(status(slot)).toBe('paused');
    const dialog = h().all().find(n => n.props.role === 'dialog');
    expect(dialog).toBeTruthy();
    for (const row of [/Chest pain or pressure/, /Face drooping/, /Severe breathlessness/, /Dizzy or faint/, /Just need a rest/, /Pain travelling down my leg/, /further down my leg/, /foot drop/i]) {
      expect(h().text(), String(row)).toMatch(row);
    }
  });

  it('an emergency ends the session and shows what to do', async () => {
    await moving(createDefaultProfile(BACK));
    await h().click(stopControl());
    await h().click(h().button(/Chest pain or pressure/));
    expect(today()?.emergency).toContain('chest');
    expect(finished(slot)).toBe(true);
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
  });

  it('leg answers are recorded, leave the movement out for the day, and carrying on is the restart question', async () => {
    await moving(createDefaultProfile(BACK));
    // On to the first stretch, past the welcome.
    const at = () => stretchRun()!.plan.steps[stretchRun()!.state.index] as { kind: string; exerciseId?: string };
    for (let i = 0; i < 4 && !(at().kind === 'hold' || at().kind === 'drill'); i++) await h().click(h().button('Next', { exact: true }));
    const movement = at().exerciseId;
    expect(movement).toBeTruthy();
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.back?.spreadToday).toBe(true);
    expect(today()?.provoked).toContain(movement);
    expect(status(slot)).toBe('paused');
    await h().click(h().button('Resume', { exact: true }));
    expect(status(slot)).toBe('running');
    await tick();
    const now = stretchRun()!;
    expect((now.plan.steps[now.state.index] as { exerciseId?: string }).exerciseId).not.toBe(movement);
    // The rest of the routine, not straight to its end (J2-04 rules out a new stretch only).
    expect(['hold', 'drill'], now.plan.steps[now.state.index].title).toContain(now.plan.steps[now.state.index].kind);
  });

  it('during a lift the same answers leave the lift out, and carrying on is the restart question', async () => {
    await moving(createDefaultProfile(BACK), '');
    await toStrength();
    const lift = (progress()!.plan.steps[run().index] as { exerciseId: string }).exerciseId;
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.provoked).toContain(lift);
    expect(status()).toBe('paused');
    await h().click(h().button('Resume', { exact: true }));
    expect(status()).toBe('running');
    await tick();
    expect((progress()!.plan.steps[run().index] as { exerciseId?: string }).exerciseId).not.toBe(lift);
  });

  it('both legs is an emergency; new weakness stops for today', async () => {
    await moving(createDefaultProfile(BACK));
    await h().click(stopControl());
    await h().click(h().field('New weakness or numbness in both legs'));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.emergency).toContain('bothLegs');
    expect(finished(slot)).toBe(true);
    expect(h().text()).toMatch(/Call emergency services now/);

    host?.unmount();
    host = undefined;
    local.clear();
    await moving(createDefaultProfile(BACK));
    await h().click(stopControl());
    await h().click(h().field('New foot drop or foot dragging, or a leg getting weaker'));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.back?.newWeakness).toBe(true);
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    expect(h().text()).toMatch(/today/i);
  });

  it('a rest records nothing and leaves the session paused', async () => {
    await moving(createDefaultProfile(BACK));
    const before = JSON.stringify(today());
    await h().click(stopControl());
    await h().click(h().button('Just need a rest'));
    expect(JSON.stringify(today())).toBe(before);
    expect(status(slot)).toBe('paused');
    expect(h().buttons('Resume', { exact: true })).toHaveLength(1);
  });

  it('dizziness is reported; for someone who can go low it offers the low path first', async () => {
    await moving(createDefaultProfile(BACK));
    await h().click(stopControl());
    await h().click(h().button(/Dizzy or faint/));
    expect(today()?.news).toContain('dizzy');
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);

    host?.unmount();
    host = undefined;
    local.clear();
    await moving(createDefaultProfile(INSULIN));
    await h().click(stopControl());
    await h().click(h().button(/Dizzy or faint/));
    expect(today()?.news).toContain('dizzy');
    expect(h().text()).toMatch(/dizziness can be a low/);
    await h().click(h().button('I feel low'));
    expect(h().text()).toMatch(/Treat the low first/);
    expect(today()?.lowSymptomsAt).toBeTruthy();
  });
});

describe('scan C2-03: History records the plan that ran, not the plan as it was saved', () => {
  it('re-dosed sets and the steady cardio that replaced intervals are recorded as run', async () => {
    const before = createDefaultProfile(NONE);
    const plan = buildSessionPlan({ profile: before, date: DAY, startDate: START, sessions: [], checkIn: ci(), focusOverride: 'upperB' });
    expect(plan.cardio?.format).toBe('intervals');
    saveRun(plan, paused(plan, 0));
    const after = createDefaultProfile({ health: { ...known, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false, bpExercisePermission: { sys: 170, dia: 105 } } });
    await seed(after, [ci({ bpReadings: [{ sys: 165, dia: 95, at: iso(8, 52) }] })]);
    await mount('resume=1');
    const ran = progress()!.plan;
    expect(ran.cardio?.format).not.toBe('intervals');
    const redosed = ran.steps.filter(s => s.kind === 'set' && !s.ramp && (plan.steps.find(x => x.id === s.id) as { reps?: number } | undefined)?.reps !== s.reps);
    expect(redosed.length).toBeGreaterThan(0);

    await h().click(h().button('Resume', { exact: true }));
    clock(11);
    await tick();
    expect(h().text()).toMatch(/Session complete/);
    const session = store.getState().sessions.find(x => x.date === DAY && x.guided)!;
    for (const set of session.sets) {
      const step = ran.steps.find(s => `guided-test-${s.id}` === set.id);
      expect(step?.kind, set.id).toBe('set');
      if (step?.kind === 'set') expect(set.plannedReps, set.id).toBe(step.reps);
    }
    expect(session.cardio?.format).toBe(ran.cardio?.format);
    expect(session.planId).toBe(ran.id);
  });
});

// ─── Claude scan 2 (docs/reimagine/claude-scan-2-safety.md) ────────────────

const { TREAT } = await import('@/engine/readiness');
const { LowGuidance } = await import('@/screens/walk/guidance');

/** The saved run's runner state: what earphones or the lock screen could have moved. */
const run = (slot: 'guided' | 'stretch' = 'guided') =>
  (JSON.parse(local.get(slot === 'stretch' ? 'fit-strong-90-stretch' : KEY) ?? 'null') as { state: RunnerState }).state;

/**
 * Earphone or lock-screen Play, Next and Previous, the way the system calls
 * them, then the clock moves on. Each press is checked on its own, so a Next
 * and a Previous cannot cancel out.
 */
async function pressEarphones(then: [h: number, m: number], slot: 'guided' | 'stretch' = 'guided') {
  const before = run(slot);
  for (const a of ['play', 'nexttrack', 'previoustrack', 'play']) {
    expect(media[a], `${a} is still handled`).toBeTruthy();
    media[a]!();
    await h().settle();
    expect(run(slot).status, a).toBe(before.status);
    expect(run(slot).index, a).toBe(before.index);
  }
  clock(...then);
  await tick();
  return before;
}

/** A guided run restored paused at its routine glucose check, for someone on insulin. */
async function atGlucoseCheck() {
  const p = createDefaultProfile(INSULIN);
  const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } });
  const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning });
  const check = plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'glucose');
  expect(check).toBeGreaterThan(0);
  saveRun(plan, paused(plan, check));
  await seed(p, [morning]);
  await mount('resume=1');
  await h().click(h().button('Resume', { exact: true }));
  await h().click(h().button('Enter my glucose'));
  return { plan, check };
}

describe('scan X2-04: earphone and lock-screen controls never talk over a safety question', () => {
  it('from an ordinary pause, with no question open, earphone Play still carries on', async () => {
    await seed(createDefaultProfile(BACK), [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('Pause', { exact: true }));
    expect(run().status).toBe('paused');
    media.play!();
    await h().settle();
    expect(run().status).toBe('running');
  });

  it('under "Stop: something’s wrong", Play, Next and Previous are acknowledged and move nothing', async () => {
    const p = createDefaultProfile(BACK);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    // Off the first step, so a Previous would have somewhere to go.
    await h().click(h().button('Next', { exact: true }));
    await h().click(stopControl());
    const before = await pressEarphones([9, 3]);
    expect(before.status).toBe('paused');
    expect(run().status).toBe('paused');
    expect(run().index).toBe(before.index);
    expect(h().text()).toMatch(/Stop: something’s wrong/);
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('under "That exercise stops here" nothing moves until the questions are answered', async () => {
    const p = createDefaultProfile(BACK);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9) }, back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } });
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning, focusOverride: 'lowerA' });
    saveRun(plan, paused(plan, plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'backSymptoms')));
    await seed(p, [morning]);
    await mount('resume=1');
    await h().click(h().button('worse', { exact: true }));
    const before = await pressEarphones([9, 3]);
    expect(run().status).toBe('paused');
    expect(run().index).toBe(before.index);
    expect(h().text()).toMatch(/That exercise stops here/);
    // Answering is the way on.
    await h().click(h().button('Save, and carry on without it'));
    expect(run().status).toBe('running');
  });

  it('at the glucose check the reading screen is neither resumed nor stepped back from the earphones', async () => {
    await atGlucoseCheck();
    const before = await pressEarphones([9, 3]);
    expect(run().status).toBe('paused');
    expect(run().index).toBe(before.index);
    expect(h().text()).toMatch(/Check your glucose/);
  });

  it('at the restart check Next and Previous move nothing, and a stop for today ends the run, so nothing outside the screen can reach it', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('Next', { exact: true }));
    await h().click(h().button('Pause', { exact: true }));
    clock(9, 40);
    await h().click(h().button('Resume', { exact: true }));
    expect(h().text()).toMatch(/Check your glucose before you carry on/);
    const before = await pressEarphones([9, 41]);
    expect(run().status).toBe('paused');
    expect(run().index).toBe(before.index);

    host?.unmount();
    host = undefined;
    local.clear();
    clock(9);
    await seed(createDefaultProfile(BACK), [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('Next', { exact: true }));
    await h().click(stopControl());
    await h().click(h().field('New foot drop or foot dragging, or a leg getting weaker'));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    // No exercise today: the run is over and in History, and the earphone and
    // lock-screen controls are gone with it (scan M-03).
    expect(finished('guided')).toBe(true);
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) expect(media[a], a).toBeFalsy();
    expect(h().text()).toMatch(/today/i);
  });

  it('while what the stop screen was told is still being written, the earphones move nothing either', async () => {
    const factory = fakeIndexedDB();
    store.resetForTests();
    await store.start({ factory, broadcast: null });
    await seed(createDefaultProfile(BACK), [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('Next', { exact: true }));
    await h().click(stopControl());
    await h().click(h().field('New foot drop or foot dragging, or a leg getting weaker'));
    factory.control.hold();
    await h().click(h().button('Save, and leave this movement out today'));
    const before = await pressEarphones([9, 3]);
    expect(run().status).toBe('paused');
    expect(run().index).toBe(before.index);
    factory.control.release();
    await h().settle();
    expect(today()?.back?.newWeakness).toBe(true);
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
  });
});

describe('scan X2-05: a low at the glucose check or the restart check takes the low path', () => {
  it('at the check before cardio: the 15 g treatment, a timed re-check, "symptoms gone", "someone had to help", then the cool-down only', async () => {
    const { plan, check } = await atGlucoseCheck();
    clock(9, 10);
    await h().change(h().field('Glucose now'), { value: '60' });
    await h().click(h().button('Save this reading'));
    const text = h().text();
    expect(text).toMatch(/Treat the low first/);
    expect(text).toContain(TREAT);
    expect(text).not.toMatch(/Cardio starts once it is in/);
    expect(text).toMatch(/Measure again in 15 minutes/);
    expect(h().field('My symptoms have gone')).toBeTruthy();
    expect(h().field('Someone else had to help me treat this low')).toBeTruthy();
    expect(run().status).toBe('paused');

    // The re-check 16 minutes on, symptoms gone: the cool-down, never the cardio itself.
    clock(9, 26);
    await h().change(h().field('Glucose now'), { value: '95' });
    await h().click(h().field('My symptoms have gone'));
    await h().click(h().button('Save this reading'));
    const s = run();
    const cardio = plan.steps.findIndex((x, i) => i > check && x.kind === 'cardio');
    expect(s.status).toBe('running');
    expect(s.index).toBe(cardio);
    expect(s.coolDownFrom?.index).toBe(cardio);
    expect(s.coolDownFrom?.segment).toBeGreaterThan(0);
    // The routine check was never logged as a normal reading.
    expect(s.logs.find(l => l.stepId === plan.steps[check].id)?.answer).toBeUndefined();
  });

  it('at the restart check: the same low path, and someone having had to help ends exercise for today', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    clock(9, 5);
    await h().click(h().button('Pause', { exact: true }));
    clock(9, 40);
    await h().click(h().button('Resume', { exact: true }));
    await h().change(h().field('Glucose now'), { value: '62' });
    await h().click(h().button('Save this reading'));
    const text = h().text();
    expect(text).toMatch(/Treat the low first/);
    expect(text).toContain(TREAT);
    expect(text).not.toMatch(/Starting again after a break needs a recent reading/);
    expect(text).toMatch(/Measure again in 15 minutes/);
    clock(9, 44);
    await h().change(h().field('Glucose now'), { value: '75' });
    await h().click(h().field('Someone else had to help me treat this low'));
    await h().click(h().button('Save this reading'));
    expect(today()?.news).toContain('lowSevere');
    expect(h().text()).toMatch(/No exercise today/);
    // No exercise today: the run is over and in History, its low guidance still on screen.
    expect(finished('guided')).toBe(true);
    expect(h().text()).toContain(TREAT);
  });
});

describe('scan X2-17: the player’s low screen has the walk’s line for someone who cannot swallow safely', () => {
  it('word for word, next to the 15 g treatment', async () => {
    const walk = render(createElement(LowGuidance, { unit: 'mg/dL' }));
    const line = /If you feel confused or cannot swallow safely.*?do not drive yourself\./.exec(walk.text())?.[0];
    walk.unmount();
    expect(line).toBeTruthy();
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('I feel low'));
    expect(h().text()).toContain(TREAT);
    expect(h().text()).toContain(line!);
  });
});

describe('scan X2-18: a number that does not fit the unit shown is asked about before anything is advised', () => {
  it('5.5 with mg/dL showing asks which unit; as mmol/L it carries on to cardio', async () => {
    const { plan, check } = await atGlucoseCheck();
    await h().change(h().field('Glucose now'), { value: '5.5' });
    expect(h().button('Save this reading').props.disabled).toBe(true);
    expect(h().text()).toMatch(/Which does your meter show/);
    expect(h().text()).not.toMatch(/medical advice|No exercise today|severe low/i);
    await h().click(h().button('5.5 mmol/L', { exact: true }));
    await h().click(h().button('Save this reading'));
    expect(today()?.glucose).toMatchObject({ value: 5.5, unit: 'mmol/L' });
    const s = run();
    expect(s.index).toBe(plan.steps.findIndex((x, i) => i > check && x.kind === 'cardio'));
    expect(s.coolDownFrom).toBeUndefined();
    expect(s.status).toBe('running');
  });

  it('95 with mmol/L showing asks which unit; "really" goes to the engine as a confirmed unit', async () => {
    const p = createDefaultProfile({ health: { ...INSULIN.health, glucoseUnit: 'mmol/L' } });
    await seed(p, [ci({ glucose: { value: 7.8, unit: 'mmol/L', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await h().click(h().button('I feel low'));
    await h().change(h().field('Glucose now'), { value: '95' });
    expect(h().button('Save this reading').props.disabled).toBe(true);
    expect(h().text()).toMatch(/That looks like mg\/dL rather than mmol\/L/);
    await h().click(h().button('95 mg/dL', { exact: true }));
    expect(h().button('Save this reading').props.disabled).toBeFalsy();
    // Back to mmol/L, and a number past what a meter reads in it.
    await h().click(h().button(/Unit: mg\/dL/));
    await h().change(h().field('Glucose now'), { value: '40' });
    expect(h().button('Save this reading').props.disabled).toBe(true);
    await h().click(h().button('40 mmol/L, really', { exact: true }));
    await h().click(h().button('Save this reading'));
    expect(today()?.glucose).toMatchObject({ value: 40, unit: 'mmol/L', unitConfirmed: true });
    expect(h().text()).toMatch(/Call emergency services now/);
  });
});

const { position } = await import('@/session/runner');

/** On the cool-down: the cardio's cool-down part, or the closing talk. Never strength, never the cardio's work. */
function onCoolDown(s: RunnerState): boolean {
  const at = position(progress()!.plan, s, Date.now());
  return at.step.block === 'wrapUp' || (at.step.kind === 'cardio' && at.segment.intensity === 'cooldown');
}

/** Next, on the running player, until a strength set is under way. */
async function toStrength() {
  for (let i = 0; i < 80 && progress()!.plan.steps[run().index].kind !== 'set'; i++) await h().click(h().button('Next', { exact: true }));
  expect(progress()!.plan.steps[run().index].kind).toBe('set');
}

/**
 * A low settled outside the player, as Today's check-in saves it: the low
 * kept among the earlier readings, a re-check of 110 at `at`, symptoms gone.
 */
async function settledOnToday(p: UserProfile, at: string, date = DAY) {
  const all = store.getState().checkIns;
  const { readiness: _r, ...c } = all.find(x => x.date === date)!;
  void _r;
  await seed(p, [...all.filter(x => x.date !== date), {
    ...c,
    glucoseEarlier: [...(c.glucoseEarlier ?? []), ...(c.glucose ? [c.glucose] : [])],
    glucose: { value: 110, unit: 'mg/dL', measuredAt: at, source: 'meter' },
    news: c.news.filter(n => n !== 'lowSymptoms'),
    lowRecovered: true,
  }]);
}

describe('spec §4.6 and scan M-02: after any low in a run, every way back is the cool-down only', () => {
  for (const [way, carryOn] of [
    ['Resume', async () => h().click(h().button('Resume', { exact: true }))],
    ['Keep going', async () => { await h().click(h().button('End session')); await h().click(h().button('Keep going')); }],
    ['earphone or lock-screen Play', async () => { media.play!(); await h().settle(); }],
  ] as const) {
    it(`${way}, after a low settled outside the player, carries on in the cool-down, not in strength`, async () => {
      const p = createDefaultProfile(INSULIN);
      await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
      await mount();
      await h().click(h().button('Start', { exact: true }));
      await toStrength();
      await h().click(h().button('Pause', { exact: true }));
      // A 62 at 09:05, treated, and settled on Today at 09:21 with 110 and the symptoms gone.
      clock(9, 22);
      await seed(p, [ci({
        glucoseEarlier: [{ value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' }, { value: 62, unit: 'mg/dL', measuredAt: iso(9, 5), source: 'meter' }],
        glucose: { value: 110, unit: 'mg/dL', measuredAt: iso(9, 21), source: 'meter' },
        lowRecovered: true,
      })]);
      expect(h().buttons('Resume', { exact: true })).toHaveLength(1);
      await carryOn();
      const s = run();
      expect(s.status).toBe('running');
      expect(s.coolDownFrom).toBeDefined();
      expect(onCoolDown(s)).toBe(true);
    });
  }

  it('reopening from Today after the low was settled there opens at the cool-down, and nothing before it can be reached', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await toStrength();
    clock(9, 5);
    await h().click(h().button('I feel low'));
    await h().change(h().field('Glucose now'), { value: '62' });
    await h().click(h().button('Save this reading'));
    await h().click(h().button('Leave, and come back later'));
    clock(9, 21);
    await settledOnToday(p, iso(9, 21));
    clock(9, 22);
    await mount('resume=1');
    let s = run();
    expect(s.status).toBe('paused');
    expect(s.coolDownFrom).toBeDefined();
    expect(onCoolDown(s)).toBe(true);
    // Previous, on screen or from the earphones, stops at the cool-down.
    for (let i = 0; i < 4; i++) {
      await h().click(h().button('Previous', { exact: true }));
      media.previoustrack!();
      await h().settle();
      expect(onCoolDown(run())).toBe(true);
    }
    await h().click(h().button('Resume', { exact: true }));
    s = run();
    expect(s.status).toBe('running');
    expect(onCoolDown(s)).toBe(true);
  });

  it('a low before midnight still allows only the cool-down when the run is reopened after it', async () => {
    const p = createDefaultProfile(INSULIN);
    clock(23, 40, 8);
    await seed(p, [ci({ date: '2026-10-08', glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(23, 35, 8), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await toStrength();
    clock(23, 56, 8);
    await h().click(h().button('I feel low'));
    await h().change(h().field('Glucose now'), { value: '62' });
    await h().click(h().button('Save this reading'));
    await h().click(h().button('Leave, and come back later'));
    // The new day's check-in at 00:12: 110, and the symptoms gone. The low
    // itself stays on yesterday's record.
    clock(0, 12, 9);
    const { readiness: _r, ...before } = store.getState().checkIns.find(c => c.date === '2026-10-08')!;
    void _r;
    await seed(p, [before, ci({ glucose: { value: 110, unit: 'mg/dL', measuredAt: iso(0, 12), source: 'meter' }, lowRecovered: true })]);
    expect(today()?.glucose?.value).toBe(110);
    expect(today()?.glucoseEarlier ?? []).toEqual([]);
    clock(0, 13, 9);
    await mount('resume=1');
    expect(run().coolDownFrom).toBeDefined();
    expect(onCoolDown(run())).toBe(true);
    await h().click(h().button('Resume', { exact: true }));
    expect(run().status).toBe('running');
    expect(onCoolDown(run())).toBe(true);
  });
});

const { getStrength } = await import('@/data/catalog');
const { assembleBackLeg } = await import('@/screens/track/backLegSeries');

describe('scan J2-02: "Stop: something’s wrong" for leg symptoms during a movement is that movement made worse', () => {
  it('during a lift: the session records it as worse, its back check is not asked, and the loading ladder steps down', async () => {
    const p = createDefaultProfile(BACK);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9) }, back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } });
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning, focusOverride: 'lowerA' });
    const check = plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'backSymptoms');
    const lift = (plan.steps[check] as { exerciseId: string }).exerciseId;
    const track = getStrength(lift)!.ladder?.track ?? (getStrength(lift)!.patterns.includes('hinge') ? 'hinge' : 'squat');
    saveRun(plan, paused(plan, plan.steps.findIndex(s => s.kind === 'set' && s.exerciseId === lift)));
    await seed(p, [morning]);
    await mount('resume=1');
    await h().click(h().button('Resume', { exact: true }));
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    await h().click(h().button('Resume', { exact: true }));
    // On past where its back check stood: that check is never asked.
    for (let i = 0; i < 80 && run().status !== 'done' && run().index <= check; i++) {
      expect(progress()!.plan.steps[run().index].id).not.toBe(plan.steps[check].id);
      await h().click(h().button('Next', { exact: true }));
    }
    expect(run().index).toBeGreaterThan(check);
    expect(/Left out today, because of your check-in: ([^.]*)\./.exec(h().text())?.[1]).not.toMatch(/How does your back feel/);
    await h().click(h().button('End session'));
    await h().click(h().button('Finish now'));
    const session = store.getState().sessions.find(x => x.date === DAY && x.guided)!;
    expect(session.symptomChecks?.[lift]).toBe('worse');
    expect(store.getState().profile!.ladder[track]).toBe(p.ladder[track] - 1);
    expect(store.getState().profile!.ladder.changedOn).toBe(DAY);
  });

  it('during a stretch with no back check: the session records it as worse, and the Back & leg chart shows it', async () => {
    const p = createDefaultProfile(BACK);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    const at = () => stretchRun()!.plan.steps[stretchRun()!.state.index] as { kind: string; exerciseId?: string };
    for (let i = 0; i < 4 && !(at().kind === 'hold' || at().kind === 'drill'); i++) await h().click(h().button('Next', { exact: true }));
    const movement = at().exerciseId!;
    expect(movement).toBeTruthy();
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    await h().click(h().button('End session'));
    await h().click(h().button('Finish now'));
    const session = store.getState().sessions.find(x => x.date === DAY && x.planKind === 'stretch')!;
    expect(session.symptomChecks?.[movement]).toBe('worse');
    const chart = assembleBackLeg({ from: DAY, to: DAY }, [], store.getState().sessions, store.getState().checkIns, store.getState().profile);
    expect(chart.sessions.find(x => x.sessionId === session.id)?.worse).toBe(true);
  });

  it('stopped at the back check itself: the check is passed over at once, and the movement it asked about is recorded as worse', async () => {
    const p = createDefaultProfile(BACK);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9) }, back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } });
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning, focusOverride: 'lowerA' });
    const check = plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'backSymptoms');
    const lift = (plan.steps[check] as { exerciseId: string }).exerciseId;
    // Stopped at the back check itself: the movement it asks about is the one left out.
    saveRun(plan, paused(plan, check));
    await seed(p, [morning]);
    await mount('resume=1');
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.provoked).toContain(lift);
    expect(h().buttons('same', { exact: true })).toHaveLength(0);
    await h().click(h().button('End session'));
    await h().click(h().button('Finish now'));
    expect(store.getState().sessions.find(x => x.date === DAY && x.guided)!.symptomChecks?.[lift]).toBe('worse');
  });
});

const { CANNOT_SWALLOW } = await import('@/engine/readiness');

describe('a low on the reading screen that leaves no exercise today ends the run, and its guidance stays on screen', () => {
  /** Filed into History straight away, with nothing outside the screen left to reach it (scan M-03). */
  const ended = () => {
    expect(finished('guided')).toBe(true);
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) expect(media[a], a).toBeFalsy();
  };
  /** The low's own guidance, not a bare summary: the 15 g treatment, the swallow line and the timed re-check. */
  const guidance = () => {
    const text = h().text();
    expect(text).toContain(TREAT);
    expect(text).toContain(CANNOT_SWALLOW.title);
    expect(text).toContain(CANNOT_SWALLOW.line);
    expect(text).toMatch(/Measure again in \d+ minutes?, at /);
    expect(text).not.toMatch(/Session complete/);
  };
  async function feelingLow() {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await toStrength();
    clock(9, 10);
    await h().click(h().button('I feel low'));
  }

  it('a level 2 low after "I feel low": the run is filed at once, and the re-check can still be recorded', async () => {
    await feelingLow();
    await h().change(h().field('Glucose now'), { value: '50' });
    await h().click(h().button('Save this reading'));
    ended();
    guidance();
    expect(h().text()).toMatch(/No exercise today/);
    expect(h().buttons('Back to Today')).toHaveLength(1);
    // The re-check, 15 minutes on, is still recorded here, and the guidance stays.
    clock(9, 25);
    await h().change(h().field('Glucose now'), { value: '58' });
    await h().click(h().button('Save this reading'));
    expect(today()?.glucose?.value).toBe(58);
    expect(h().text()).toContain(TREAT);
    expect(finished('guided')).toBe(true);
  });

  it('a low someone else had to help with ends the run the same way', async () => {
    await feelingLow();
    await h().change(h().field('Glucose now'), { value: '62' });
    await h().click(h().field('Someone else had to help me treat this low'));
    await h().click(h().button('Save this reading'));
    expect(today()?.news).toContain('lowSevere');
    ended();
    guidance();
  });

  it('a level 2 low at the check before cardio ends the run with the same guidance', async () => {
    await atGlucoseCheck();
    clock(9, 10);
    await h().change(h().field('Glucose now'), { value: '50' });
    await h().click(h().button('Save this reading'));
    ended();
    guidance();
    expect(h().text()).not.toMatch(/Cardio starts once it is in/);
  });

  it('still under 70 at the 15-minute re-check ends the run too (D29(3)); the first low does not', async () => {
    await feelingLow();
    await h().change(h().field('Glucose now'), { value: '65' });
    await h().click(h().button('Save this reading'));
    expect(run().status).toBe('paused');
    expect(media.play).toBeTruthy();
    clock(9, 26);
    await h().change(h().field('Glucose now'), { value: '64' });
    await h().click(h().button('Save this reading'));
    ended();
    guidance();
  });

  it('an emergency high ends the run and shows the emergency, not a low’s treatment: at the check, or after "I feel low"', async () => {
    await atGlucoseCheck();
    await h().change(h().field('Glucose now'), { value: '650' });
    await h().click(h().button('Save this reading'));
    ended();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(h().text()).not.toContain(TREAT);

    host?.unmount();
    host = undefined;
    local.clear();
    clock(9);
    await feelingLow();
    await h().change(h().field('Glucose now'), { value: '650' });
    await h().click(h().button('Save this reading'));
    ended();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(h().text()).not.toContain(TREAT);
  });

  it('a meter showing LO after "I feel low" is a severe low: recorded as LO and timed, the 140 kept, and the run ends with the low’s guidance', async () => {
    await feelingLow();
    await meterShows('LO');
    expect(() => h().field('Glucose now')).toThrow();
    await h().click(h().button('Save this reading'));
    expect(today()?.glucoseDisplay).toMatchObject({ display: 'LO', measuredAt: iso(9, 10), source: 'meter' });
    expect(today()?.glucose).toBeUndefined();
    expect(today()?.glucoseEarlier?.some(e => !('display' in e) && e.value === 140)).toBe(true);
    ended();
    guidance();
    expect(h().text()).toMatch(/Your meter shows LO/);
  });

  it('LO at the check before cardio ends the run the same way', async () => {
    await atGlucoseCheck();
    clock(9, 10);
    await meterShows('LO');
    await h().click(h().button('Save this reading'));
    expect(today()?.glucoseDisplay?.display).toBe('LO');
    ended();
    guidance();
    expect(h().text()).not.toMatch(/Cardio starts once it is in/);
  });
});

/** "Meter shows HI or LO?", in Quick Log's and the check-in's words, then the choice. */
async function meterShows(shows: 'HI' | 'LO') {
  if (h().buttons('Meter shows HI or LO?').length) await h().click(h().button('Meter shows HI or LO?'));
  expect(h().text()).toMatch(/What the meter shows/);
  await h().click(h().button(shows, { exact: true }));
}

describe('a meter showing HI on the reading screen is held as the check-in holds it', () => {
  it('HI at the check before cardio: check again, and the run waits; HI a second time: no exercise today, and the run ends', async () => {
    await atGlucoseCheck();
    clock(9, 10);
    await meterShows('HI');
    await h().click(h().button('Save this reading'));
    expect(today()?.glucoseDisplay).toMatchObject({ display: 'HI', measuredAt: iso(9, 10) });
    expect(h().text()).toMatch(/Your meter says HI, higher than it can measure/);
    expect(run().status).toBe('paused');
    expect(finished('guided')).toBe(false);
    clock(9, 14);
    await meterShows('HI');
    await h().click(h().button('Save this reading'));
    expect(today()?.glucoseEarlier?.some(e => 'display' in e && e.display === 'HI' && e.measuredAt === iso(9, 10))).toBe(true);
    expect(h().text()).toMatch(/Your meter has read HI more than once/);
    expect(finished('guided')).toBe(true);
  });
});

const { permission } = await import('@/engine/permission');

describe('scan J2-04 in the player: a spread said before any stretch still counts against stretching today', () => {
  it('during the welcome it is put down to the stretch about to start: the routine carries on without it, and no new stretch is offered today', async () => {
    const p = createDefaultProfile(BACK);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    const start = stretchRun()!;
    expect(start.plan.steps[start.state.index].kind).toBe('talk');
    const first = (start.plan.steps.find(s => s.kind === 'hold' || s.kind === 'drill') as { exerciseId: string }).exerciseId;
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.provoked).toContain(first);
    // The routine on screen carries on without that stretch (J16 step 6), and only without it …
    await h().click(h().button('Resume', { exact: true }));
    expect(status('stretch')).toBe('running');
    await h().click(h().button('Next', { exact: true }));
    const now = stretchRun()!;
    const at = now.plan.steps[now.state.index] as { kind: string; exerciseId?: string };
    expect(at.kind === 'hold' || at.kind === 'drill', `at ${now.plan.steps[now.state.index].title}`).toBe(true);
    expect(at.exerciseId).not.toBe(first);
    expect(/Left out today, because of your check-in: ([^.]*)\./.exec(h().text())?.[1].trim()).toBe(now.plan.steps.find(s => (s as { exerciseId?: string }).exerciseId === first)!.title);
    // … and a new stretch today is refused (J2-04).
    const next = permission({ profile: p, checkIn: today()!, now: new Date(), recent: store.getState().checkIns }, 'stretch');
    expect(next.allowed).toBe(false);
    expect(next.reasons.join(' ')).toMatch(/no more stretching today/);
  });

  it('a stretch already left out today is passed over: it is put down to the next one that would run', async () => {
    const p = createDefaultProfile(BACK);
    // The routine's first two stretches, as the player builds it.
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    const [first, second] = [...new Set(stretchRun()!.plan.steps.filter(s => s.kind === 'hold' || s.kind === 'drill').map(s => (s as { exerciseId: string }).exerciseId))];
    host?.unmount();
    host = undefined;
    local.clear();
    // The first is already left out today.
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' }, provoked: [first] })]);
    await mount('mode=stretch&focus=backHips&minutes=10');
    await h().click(h().button('Start', { exact: true }));
    await h().click(stopControl());
    await h().click(h().field(/further down my leg/));
    await h().click(h().button('Save, and leave this movement out today'));
    expect(today()?.provoked).toEqual(expect.arrayContaining([first, second]));
  });
});

describe('scan X2-08 in the player: a low just before midnight is still this low after it', () => {
  it('the low screen keeps its reading and its re-check time across midnight', async () => {
    const p = createDefaultProfile(INSULIN);
    clock(23, 40, 8);
    await seed(p, [ci({ date: '2026-10-08', glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(23, 35, 8), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    clock(23, 56, 8);
    await h().click(h().button('I feel low'));
    clock(23, 57, 8);
    await h().change(h().field('Glucose now'), { value: '62' });
    await h().click(h().button('Save this reading'));
    expect(h().text()).toMatch(/Stay sitting down, and enter your next reading here/);
    expect(h().text()).toMatch(/Measure again in 15 minutes/);
    // Past midnight, before the next reading: the same low, and its re-check still due at 00:12.
    clock(0, 5, 9);
    await h().click(h().button(/Unit: mg\/dL/));
    expect(h().text()).toMatch(/Stay sitting down, and enter your next reading here/);
    expect(h().text()).toMatch(/Measure again in 7 minutes/);
  });
});

describe('Codex final reconciliation: the glucose check before cardio cannot be skipped', () => {
  it('Next on screen, earphone Next and the clock all stop at the check until a reading is in', async () => {
    const p = createDefaultProfile(INSULIN);
    const morning = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } });
    const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: morning });
    const check = plan.steps.findIndex(s => s.kind === 'checkpoint' && s.question === 'glucose');
    expect(check).toBeGreaterThan(0);
    // Paused just before it, with no reading flow open: nothing is held.
    saveRun(plan, paused(plan, check - 1));
    await seed(p, [morning]);
    await mount('resume=1');
    for (let i = 0; i < 4; i++) await h().click(h().button('Next', { exact: true }));
    expect(run().index).toBe(check);
    for (let i = 0; i < 3; i++) { media.nexttrack!(); await h().settle(); }
    expect(run().index).toBe(check);
    // Running long past the check's own 30 seconds: the clock waits on it too.
    await h().click(h().button('Resume', { exact: true }));
    clock(9, 20);
    await tick();
    await h().click(h().button('Next', { exact: true }));
    media.nexttrack!();
    await h().settle();
    expect(run().status).toBe('running');
    expect(run().index).toBe(check);
    expect(run().logs.find(l => l.stepId === plan.steps[check].id)?.answer).toBeUndefined();
    expect(h().text()).toMatch(/Answer to carry on/);
  });
});

describe('Codex final reconciliation: a rest never suggests water to someone with a fluid limit (F13)', () => {
  for (const [what, fluidRestriction, says, never] of [
    ['a recorded fluid limit', true, 'Recover, breathe slowly, keep to your fluid plan', /sip water/],
    ['an unsure answer about a fluid limit', 'unsure', 'Recover, breathe slowly, keep to your fluid plan', /sip water/],
    ['no fluid limit', false, 'Recover, breathe slowly, sip water', /fluid plan|fluid limit/],
    ['the question not answered yet', undefined, 'Recover, breathe slowly, sip water unless you have a fluid limit', null],
  ] as const) {
    it(`with ${what}`, async () => {
      const p = createDefaultProfile({ health: { ...known, ...(fluidRestriction !== undefined ? { fluidRestriction } : {}) } });
      const plan = buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: ci(), focusOverride: 'upperB' });
      const rest = plan.steps.findIndex(s => s.kind === 'rest');
      expect(rest).toBeGreaterThan(0);
      saveRun(plan, paused(plan, rest));
      await seed(p, [ci()]);
      await mount('resume=1');
      expect(progress()!.plan.steps[run().index].kind).toBe('rest');
      expect(h().text()).toContain(says);
      if (never) expect(h().text()).not.toMatch(never);
    });
  }
});

const { segmentsFor } = await import('@/engine/timing');

describe('R5 follow-up: a hot day’s spare cool-down never says drink to someone with a fluid limit (F13)', () => {
  const hotDay = ci({ news: ['hot'] });
  /** Paused on the cardio's last part: the cool-down a hot day's shorter cardio gives back. */
  const atSpare = (plan: SessionPlan): RunnerState => {
    const index = plan.steps.findIndex(s => s.kind === 'cardio');
    const segs = segmentsFor(plan.steps[index]);
    expect(segs.at(-1)?.label).toMatch(/^Easy cool-down, cool off/);
    const before = segs.slice(0, -1).reduce((t, s) => t + s.seconds * 1000, 0);
    return { ...paused(plan, index), pausedAt: 1_000 + before + 1_000 };
  };
  const planned = (p: UserProfile) => buildSessionPlan({ profile: p, date: DAY, startDate: START, sessions: [], checkIn: hotDay, focusOverride: 'upperB' });

  for (const [what, fluidRestriction, says, never] of [
    ['a recorded fluid limit', true, 'Easy cool-down, cool off and keep to your fluid plan', /drink/i],
    ['an unsure answer about a fluid limit', 'unsure', 'Easy cool-down, cool off and keep to your fluid plan', /drink/i],
    ['no fluid limit', false, 'Easy cool-down, cool off and drink', /fluid plan|fluid limit/],
    ['the question not answered yet', undefined, 'Easy cool-down, cool off and drink unless you have a fluid limit', null],
  ] as const) {
    it(`with ${what}`, async () => {
      const p = createDefaultProfile({ health: { ...known, ...(fluidRestriction !== undefined ? { fluidRestriction } : {}) } });
      const plan = planned(p);
      saveRun(plan, atSpare(plan));
      await seed(p, [hotDay]);
      await mount('resume=1');
      expect(h().text()).toContain(says);
      if (never) expect(h().text()).not.toMatch(never);
    });
  }

  it('a plan saved before a fluid limit was recorded is said as the profile is now', async () => {
    const plan = planned(createDefaultProfile({ health: { ...known, fluidRestriction: false } }));
    saveRun(plan, atSpare(plan));
    await seed(createDefaultProfile({ health: { ...known, fluidRestriction: true } }), [hotDay]);
    await mount('resume=1');
    expect(h().text()).toContain('Easy cool-down, cool off and keep to your fluid plan');
    expect(h().text()).not.toMatch(/drink/i);
  });
});

describe('R5 follow-up: after a walk ended for a low, the line not to set off again says the person’s unit (as X2-19)', () => {
  it.each([['mg/dL', '70 mg/dL'], ['mmol/L', '3.9 mmol/L']] as const)('%s', (unit, level) => {
    const walk = render(createElement(LowGuidance, { unit }));
    const text = walk.text();
    walk.unmount();
    expect(text).toContain(`Do not set off again just because a reading is back above ${level}.`);
    if (unit === 'mmol/L') expect(text).not.toMatch(/\b70\b|mg\/dL/);
  });
});

describe('N-01 in the player: a check-in save the device refused cannot loosen the session, and is never saved inside it', () => {
  it('150/95 stored, a refused 120/80: the session keeps its blood pressure limits, and its saved check-in holds no stored copy', async () => {
    let refuse = false;
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ failWrite: (_n, row) => (refuse && row.key === 'checkIns' ? new DOMException('Full', 'QuotaExceededError') : undefined) }), broadcast: null });
    const p = createDefaultProfile({ health: { ...known, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } });
    await seed(p, [ci({ bpReadings: [{ sys: 150, dia: 95, at: iso(8, 50) }] })]);
    refuse = true;
    const { saveCheckInRecord } = await import('@/components/checkin/pending');
    expect((await saveCheckInRecord(ci({ bpReadings: [{ sys: 120, dia: 80, at: iso(8, 58) }] }), { profile: p, update: store.update })).stored).toBe(false);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    expect(progress()!.plan.changes.join(' ')).toMatch(/140 over 90/);
    clock(11);
    await tick();
    expect(h().text()).toMatch(/Session complete/);
    const session = store.getState().sessions.find(x => x.date === DAY && x.guided)!;
    expect(session.checkIn?.bpReadings).toEqual([{ sys: 120, dia: 80, at: iso(8, 58) }]);
    expect(session.checkIn).not.toHaveProperty('durable');
  });
});

describe('scan M-02, as the gates read the day: a low logged in Track counts, and one typed wrongly does not', () => {
  it('a 62 logged in Track during the run: carrying on is the cool-down only', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await toStrength();
    await h().click(h().button('Pause', { exact: true }));
    clock(9, 5);
    expect((await store.addObservation({ kind: 'glucose', value: 62, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' })).ok).toBe(true);
    // Settled on Today at 09:21: 110, the symptoms gone. The 62 is only in Track.
    clock(9, 21);
    await seed(p, [ci({
      glucoseEarlier: [{ value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' }],
      glucose: { value: 110, unit: 'mg/dL', measuredAt: iso(9, 21), source: 'meter' },
      lowRecovered: true,
    })]);
    clock(9, 22);
    await h().click(h().button('Resume', { exact: true }));
    const s = run();
    expect(s.status).toBe('running');
    expect(s.coolDownFrom).toBeDefined();
    expect(onCoolDown(s)).toBe(true);
  });

  it('a 50 answered "I typed it wrongly" never happened: the run carries on where it was', async () => {
    const p = createDefaultProfile(INSULIN);
    await seed(p, [ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } })]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    await toStrength();
    await h().click(h().button('Pause', { exact: true }));
    const at = run().index;
    clock(9, 6);
    await seed(p, [ci({
      glucoseEarlier: [{ value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' }, { value: 50, unit: 'mg/dL', measuredAt: iso(9, 5), source: 'meter' }],
      glucose: { value: 150, unit: 'mg/dL', measuredAt: iso(9, 6), source: 'meter' },
      resolutions: [{ kind: 'severeLow', readings: [`g:${iso(9, 5)}:50mg/dL`], resolution: 'mistake', at: iso(9, 6) }],
    })]);
    clock(9, 7);
    await h().click(h().button('Resume', { exact: true }));
    const s = run();
    expect(s.status).toBe('running');
    expect(s.coolDownFrom).toBeUndefined();
    expect(s.index).toBe(at);
  });
});

const { position: placeOf } = await import('@/session/runner');

describe('N-08: re-dosing cardio under the run never skips its cool-down, and never rewrites work already done', () => {
  const p = () => createDefaultProfile(NONE);
  const build = (checkIn: DailyCheckIn, profile = p()) => buildSessionPlan({ profile, date: DAY, startDate: START, sessions: [], checkIn, focusOverride: 'upperB' });
  const cardioOf = (plan: SessionPlan) => plan.steps.findIndex(s => s.kind === 'cardio');
  /** Paused `seconds` into the plan's cardio step. */
  const inCardio = (plan: SessionPlan, seconds: number): RunnerState => ({ ...paused(plan, cardioOf(plan)), stepStartedAt: 1_000, pausedAt: 1_000 + seconds * 1000 });
  const here = () => placeOf(progress()!.plan, run(), Date.now());

  it('resumed 700 s into a saved 120 + 1,200 + 300 dose, with today’s dose shorter: straight to today’s cool-down, run whole', async () => {
    const fresh = build(ci());
    const saved: SessionPlan = { ...fresh, steps: fresh.steps.map(s => (s.kind === 'cardio' ? { ...s, parts: [
      { seconds: 120, intensity: 'easy', label: 'Easy warm-up' }, { seconds: 1200, intensity: 'zone2', label: 'Steady' }, { seconds: 300, intensity: 'cooldown', label: 'Cool-down' }] } : s)) };
    saveRun(saved, inCardio(saved, 700));
    await seed(p(), [ci()]);
    await mount('resume=1');
    expect(progress()!.plan.steps[cardioOf(saved)]).toMatchObject({ parts: (fresh.steps[cardioOf(fresh)] as CardioStep).parts });
    const cool = (fresh.steps[cardioOf(fresh)] as CardioStep).parts.filter(x => x.intensity === 'cooldown').reduce((t, x) => t + x.seconds, 0) * 1000;
    expect(here()).toMatchObject({ stepIndex: cardioOf(saved), segmentElapsedMs: 0, stepRemainingMs: cool });
    expect(here().segment.intensity).toBe('cooldown');
    await h().click(h().button('Resume', { exact: true }));
    vi.setSystemTime(Date.now() + cool - 2000);
    await tick();
    expect(run().index).toBe(cardioOf(saved));
    expect(here().segment.intensity).toBe('cooldown');
  });

  it('a hot day noted 500 s into today’s intervals, past the hot dose’s shorter work: on at today’s cool-down’s start, not part-way through it', async () => {
    const plan = build(ci());
    expect(plan.cardio?.format).toBe('intervals');
    saveRun(plan, inCardio(plan, 500));
    await seed(p(), [ci()]);
    await mount('resume=1');
    await h().click(h().button('Resume', { exact: true }));
    expect(here().segment.intensity).toBe('fast');
    await seed(p(), [ci({ news: ['hot'] })]);
    await h().settle();
    const now = progress()!.plan.steps[cardioOf(plan)] as CardioStep;
    expect(now.parts.some(x => /cool off/.test(x.label))).toBe(true);
    const cool = now.parts.filter(x => x.intensity === 'cooldown').reduce((t, x) => t + x.seconds, 0) * 1000;
    expect(here()).toMatchObject({ segmentElapsedMs: 0, stepRemainingMs: cool });
    expect(here().segment.intensity).toBe('cooldown');
  });

  it('cardio re-dosed when the run was resumed, and since done, stays as it ran when today changes again', async () => {
    const fresh = build(ci());
    const saved: SessionPlan = { ...fresh, steps: fresh.steps.map(s => (s.kind === 'cardio' ? { ...s, parts: [
      { seconds: 120, intensity: 'easy', label: 'Easy warm-up' }, { seconds: 1200, intensity: 'zone2', label: 'Steady' }, { seconds: 300, intensity: 'cooldown', label: 'Cool-down' }] } : s)) };
    saveRun(saved, paused(saved, saved.steps.findIndex(s => s.kind === 'set')));
    await seed(p(), [ci()]);
    await mount('resume=1');
    const asRan = (progress()!.plan.steps[cardioOf(saved)] as CardioStep).parts;
    expect(asRan).toEqual((fresh.steps[cardioOf(fresh)] as CardioStep).parts);
    await h().click(h().button('Resume', { exact: true }));
    for (let i = 0; i < 200 && run().index <= cardioOf(saved); i++) await h().click(h().button('Next', { exact: true }));
    expect(run().index).toBeGreaterThan(cardioOf(saved));
    await seed(p(), [ci({ news: ['hot'] })]);
    await h().settle();
    expect((progress()!.plan.steps[cardioOf(saved)] as CardioStep).parts).toEqual(asRan);
  });

  it('a change reported mid-run re-doses only what is still to come: the sets already done stay as they ran', async () => {
    const bpProfile = createDefaultProfile({ health: { ...known, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } });
    const morning = ci({ bpReadings: [{ sys: 128, dia: 80, at: iso(8, 50) }] });
    await seed(bpProfile, [morning]);
    await mount();
    await h().click(h().button('Start', { exact: true }));
    for (let i = 0; i < 120 && progress()!.plan.steps[run().index].kind !== 'cardio'; i++) await h().click(h().button('Next', { exact: true }));
    const at = run().index;
    expect(progress()!.plan.steps[at].kind).toBe('cardio');
    const done = progress()!.plan.steps.slice(0, at);
    expect(build({ ...morning, bpReadings: [{ sys: 160, dia: 100, at: iso(9, 1) }] }, bpProfile).steps.slice(0, at)).not.toEqual(done);
    clock(9, 1);
    await seed(bpProfile, [{ ...morning, bpReadings: [{ sys: 160, dia: 100, at: iso(9, 1) }], bpEarlier: morning.bpReadings }]);
    await h().settle();
    expect(progress()!.plan.steps.slice(0, at)).toEqual(done);
  });
});
