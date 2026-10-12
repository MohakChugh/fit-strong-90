/**
 * Me's chapter editor, driven through its real caller: `ChapterEditor` with
 * the real store and its real Save. Only the router and the browser's globals
 * are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostChild, type HostNode } from '@/test/host';
import type { AppData } from '@/types';
import type { DailyCheckIn, Mode } from '@/types/checkin';
import type { CheckpointStep, SessionPlan } from '@/types/plan';

type Leave = { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string } };
const router = vi.hoisted(() => ({
  navigate: vi.fn(), state: null as unknown,
  // The leave guard's blocker (board D198), as the router keeps it: asked of each navigation, its state changing a render later.
  shouldBlock: undefined as undefined | ((leave: Leave) => boolean),
  blocker: 'unblocked' as 'unblocked' | 'blocked' | 'proceeding',
  proceeded: 0,
  resets: 0,
  redraw: new Set<() => void>(),
}));
vi.mock('react-router-dom', async () => {
  const { createElement: h, useEffect, useReducer } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: '/me/profile', search: '?chapter=health', state: router.state }),
    useSearchParams: () => [new URLSearchParams('chapter=health')],
    Link: ({ children, to, onClick }: { children?: unknown; to: string; onClick?: () => void }) => h('a', { href: `#${to}`, onClick }, children as never),
    Navigate: ({ to }: { to: string }) => h('a', { 'data-navigate': to }),
    useBlocker: (shouldBlock: ((leave: Leave) => boolean) | boolean) => {
      router.shouldBlock = typeof shouldBlock === 'function' ? shouldBlock : () => shouldBlock;
      const [, redraw] = useReducer((x: number) => x + 1, 0);
      useEffect(() => {
        router.redraw.add(redraw);
        return () => void router.redraw.delete(redraw);
      }, []);
      const later = (next: typeof router.blocker) => setTimeout(() => { router.blocker = next; router.redraw.forEach(r => r()); }, 0);
      return {
        state: router.blocker,
        proceed: () => { router.proceeded += 1; later('proceeding'); },
        reset: () => { router.resets += 1; later('unblocked'); },
      };
    },
  };
});
// Base UI's dialog can't open in this host: a plain one stands in, with its title and its content.
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return {
    Sheet: ({ open, title, children }: { open: boolean; title?: string; children?: unknown }) =>
      (open ? h('div', { role: 'dialog', 'aria-label': title }, h('h2', null, title), children as never) : null),
  };
});
vi.mock('@/components/hig/navigation', async importOriginal => ({ ...await importOriginal<typeof import('@/components/hig/navigation')>(), cameFrom: () => false }));
// The app's toasts put their styles in the page as they load; this document has no page.
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {} }) }));
// Base UI's slider and switch call their handlers as they render, which this host can't run; neither is tested here.
vi.mock('@/components/ui/slider', () => ({ Slider: () => null }));
vi.mock('@/screens/you/controls', async importOriginal => ({ ...await importOriginal<typeof import('@/screens/you/controls')>(), Toggle: () => null }));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  location: { href: 'http://localhost/' },
  document: { title: '', activeElement: null, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } }, body: { nodeType: 1 } },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  // What base-ui's floating parts ask of a node.
  Element: class {}, HTMLElement: class {},
});

const store = await import('@/store/useStore');
const { ChapterEditor } = await import('./ChapterEditor');
const { completedSetup } = await import('@/setup/assemble');
const { gateProfile, resetClinicalUnsavedForTests } = await import('@/setup/effective');
const { FOOT_WOUND, MINIMAL, NO_CONDITIONS, withMeds } = await import('@/setup/fixtures');
const { PERMISSION_TEXT, permission, readinessFor } = await import('@/engine/permission');
const { CLINICAL_UNSAVED, evaluateCheckIn } = await import('@/engine/readiness');
const { dailyTimes } = await import('@/reminders/schedule');
const { waterBlock } = await import('@/reminders/water');
const { scriptFor } = await import('@/session/script');
const { toDateString } = await import('@/lib/utils');
const { AUTOSAVE_MS, resetSetupSessionForTests } = await import('@/setup/draft');
const { withDraft } = await import('@/setup/draft');

const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026, hasSteps: false };
const all = (list: HostChild[]): HostNode[] => list.flatMap(c => (typeof c === 'string' ? [] : [c, ...all(c.children)]));
const textIn = (n: HostChild): string => (typeof n === 'string' ? n : n.children.map(textIn).join(' '));
/** The option `option` of the question named `question` (a radio group's label). */
function radio(host: Host, question: string, option: string): HostNode {
  const group = host.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === question);
  if (!group) throw new Error(`no question “${question}”`);
  const found = all(group.children).find(n => n.props.role === 'radio' && textIn(n).trim().startsWith(option));
  if (!found) throw new Error(`no “${option}” for “${question}”`);
  return found;
}

let host: Host | undefined;
let fake: ReturnType<typeof fakeIndexedDB>;
beforeEach(async () => {
  router.navigate = vi.fn();
  router.state = null;
  router.shouldBlock = undefined;
  router.blocker = 'unblocked';
  router.proceeded = 0;
  router.resets = 0;
  local.clear();
  store.resetForTests();
  resetSetupSessionForTests();
  resetClinicalUnsavedForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
});

const footStatus = () => ({ stored: store.getState().profile?.health.footStatus, gate: gateProfile(store.getState()).health.footStatus });

const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];
/** The profile every gate reads, as Home, the hubs, the reminders and the player read it (`gateProfile`). */
const gate = () => gateProfile(store.getState());
/** Today's check-in, fine unless `over` says otherwise. */
const today = (over: Partial<DailyCheckIn> = {}): DailyCheckIn =>
  ({ date: toDateString(new Date(NOW)), urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
/** A mode's answer at that gate, with today's check-in as stored, as a Start asks it. */
const answer = (mode: Mode, checkIn: DailyCheckIn = today()) =>
  permission({ profile: gate(), now: new Date(NOW), checkIn: { ...checkIn, readiness: evaluateCheckIn(gate(), checkIn) } }, mode);
/** Every movement held for answers not stored, and that alone said (board D197). */
const pausedForUnsaved = () => MODES.every(mode => {
  const p = answer(mode);
  return !p.allowed && p.reasons.length === 1 && p.reasons[0] === PERMISSION_TEXT.unsaved;
});
const WATER = { enabled: true, glassMl: 250, everyMinutes: 60, from: '09:00', to: '18:00' };
const withWater = (d: AppData): AppData => ({ ...d, settings: { ...d.settings, habits: { ...d.settings.habits, water: WATER } } });
/** The day's water reminders, by the profile every gate reads (`dailyTimes`, as the reminders and the calendar file read it). */
const waterTimes = () => dailyTimes(store.getState().settings.habits, gate()).filter(t => t.habit === 'water');
/** The glucose check before cardio, as the player says it (`scriptFor`). */
const CHECK: CheckpointStep = { id: 'check', block: 'cardio', title: 'Glucose check', kind: 'checkpoint', question: 'glucose', seconds: 30 };
const glucoseLine = () => scriptFor(CHECK, { profile: gate(), plan: {} as SessionPlan, coaching: () => undefined, exposures: () => 0 }).map(c => c.text).join(' ');
const diskFull = () => fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
/** A leave of Me's editor (Back, a tab, the browser's Back), as the router asks its guard first: whether it was held. */
const leave = async (h: Host) => {
  const held = router.shouldBlock?.({ currentLocation: { pathname: '/me/profile', search: '?chapter=health' }, nextLocation: { pathname: '/me/profile', search: '' } }) ?? false;
  router.blocker = held ? 'blocked' : 'unblocked';
  router.redraw.forEach(r => r());
  await h.settle();
  return held;
};

describe('a clinical edit in Me (H5-08; boards D162, D197, D198)', () => {
  it('a pending edit can’t release anything: a healed wound releases walks only once its write is stored, and leaving meanwhile asks first', async () => {
    expect((await store.update(d => completedSetup(d, FOOT_WOUND, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    expect(answer('walk').reasons).toContain(PERMISSION_TEXT.footWalk);
    // The wound has healed.
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'No'));
    fake.control.hold();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    // Still being written: walks stay held, at every gate, and the editor stays, asking before it's left.
    expect(footStatus()).toEqual({ stored: 'current_wound_or_active_charcot', gate: 'current_wound_or_active_charcot' });
    expect(answer('walk').reasons).toContain(PERMISSION_TEXT.footWalk);
    expect(host.button('Saving…').props.disabled).toBe(true);
    expect(await leave(host)).toBe(true);
    expect(host.text()).toContain('Discard your changes?');
    await host.click(host.button('Cancel', { exact: true }));
    await host.settle();
    fake.control.release();
    await host.settle();
    expect(footStatus()).toEqual({ stored: 'healthy', gate: 'healthy' });
    expect(answer('walk').reasons).not.toContain(PERMISSION_TEXT.footWalk);
    expect(await leave(host)).toBe(false);
  });

  it('a pending heart “No” keeps water reminders off until it’s stored (H5F-04)', async () => {
    const { withC } = await import('@/setup/fixtures');
    const heart = withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'vigorous', dizzy: 'no' });
    expect((await store.update(d => withWater(completedSetup(d, heart, NOW, CTX)))).ok).toBe(true);
    expect(waterTimes()).toEqual([]);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(host.button(/^Heart or circulation problems/));
    fake.control.hold();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(gate().health.heartOrVascularDisease).toBe(true);
    expect(waterBlock(gate(), store.getState().settings.habits)).toContain('heart conditions');
    expect(waterTimes()).toEqual([]);
    fake.control.release();
    await host.settle();
    expect(store.getState().profile?.health.heartOrVascularDisease).toBe(false);
    expect(waterTimes().length).toBeGreaterThan(0);
  });

  it('a refused heart disclosure holds every movement and pauses water reminders, saying that alone, until it’s stored (H5F-01, H5F-02)', async () => {
    expect((await store.update(d => withWater(completedSetup(d, MINIMAL, NOW, CTX)))).ok).toBe(true);
    expect(waterTimes().length).toBeGreaterThan(0);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(host.button(/^Heart or circulation problems/));
    await host.settle();
    await host.click(radio(host, 'Has a doctor given you a fluid limit?', 'No'));
    await host.click(radio(host, 'Has a doctor or nurse (clinician) cleared you to exercise?', 'Not yet'));
    await host.click(radio(host, 'Do you get dizzy when you stand up?', 'No'));
    diskFull();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(store.getState().profile?.health.heartOrVascularDisease).toBe(false);
    // No session starts, every mode saying only why.
    expect(pausedForUnsaved()).toBe(true);
    // The day's answer says only that, with no advice worked out from answers that aren't stored.
    const day = readinessFor({ profile: gate(), now: new Date(NOW), checkIn: { ...today(), readiness: evaluateCheckIn(gate(), today()) } });
    expect([day.reasons.map(r => r.message), day.actions]).toEqual([[CLINICAL_UNSAVED], []]);
    // Water reminders pause.
    expect(waterTimes()).toEqual([]);
    expect(waterBlock(gate(), store.getState().settings.habits)).toBe('Paused until your health answers are saved, since some answers need a fluid limit.');
    // Tried again and stored: the disclosure is the record's, and holds as it does.
    fake.control.setWriteError(undefined);
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(store.getState().profile?.health.heartOrVascularDisease).toBe(true);
    expect(gate().clinicalUnsaved).toBeUndefined();
    expect(waterBlock(gate(), store.getState().settings.habits)).toContain('heart conditions');
    expect(answer('walk').reasons).not.toContain(PERMISSION_TEXT.unsaved);
  });

  it('two failed saves leave everything held: a wound disclosed, then taken back, both refused, lift nothing until one is stored or discarded (H5R-04)', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(host.button(/^Foot problems: numbness, a wound or an ulcer/));
    await host.settle();
    await host.click(radio(host, 'Numbness or loss of feeling in your feet?', 'Yes'));
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'Yes, now'));
    await host.click(radio(host, 'Has a doctor or nurse (clinician) told you to keep weight off a foot?', 'No'));
    diskFull();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(pausedForUnsaved()).toBe(true);
    // Taken back, and that refused too.
    await host.click(host.button(/^Foot problems: numbness, a wound or an ulcer/));
    await host.settle();
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(pausedForUnsaved()).toBe(true);
    // Leaving asks first. Cancel stays, still held.
    expect(await leave(host)).toBe(true);
    expect(host.text()).toContain('Discard your changes?');
    await host.click(host.button('Cancel', { exact: true }));
    await host.settle();
    expect(router.resets).toBe(1);
    expect(pausedForUnsaved()).toBe(true);
    // Discard changes: the record's own answers stand, and the gates read them again.
    expect(await leave(host)).toBe(true);
    await host.click(host.button('Discard changes', { exact: true }));
    await host.settle();
    expect(router.proceeded).toBe(1);
    expect(gate().clinicalUnsaved).toBeUndefined();
    expect(answer('walk').allowed).toBe(true);
    expect(store.getState().profile?.health.footStatus).toBe('healthy');
  });

  it('a refused change taken back still holds, and asks before leaving, until a save of it is stored (H5R-04)', async () => {
    expect((await store.update(d => completedSetup(d, FOOT_WOUND, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'No'));
    diskFull();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    // Taken back: the answers are the record's again, but what was refused is neither stored over nor discarded.
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'Yes, now'));
    expect(pausedForUnsaved()).toBe(true);
    expect(await leave(host)).toBe(true);
    await host.click(host.button('Cancel', { exact: true }));
    await host.settle();
    fake.control.setWriteError(undefined);
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(gate().clinicalUnsaved).toBeUndefined();
    expect(await leave(host)).toBe(false);
  });

  it('the session’s glucose speech uses the stored profile: a lows “No” on its way, or refused, changes nothing it says (H5F-03)', async () => {
    const lows = withMeds({ insulin: 'yes' }, {
      conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2', clearance: 'vigorous', targets: 'no',
      insulinHow: 'basalOnly', lowsRisk: 'yes', glucoseStartMin: 90, glucoseStartUnit: 'mg/dL', priorDka: 'no', dizzy: 'no', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
    });
    expect((await store.update(d => completedSetup(d, lows, NOW, CTX))).ok).toBe(true);
    expect(glucoseLine()).toContain('If you are under 162, have 15 to 20 grams of fast carbs first.');
    host = render(createElement(ChapterEditor, { chapter: 'medicines' }));
    await host.settle();
    await host.click(radio(host, 'A severe low in the last 6 months, or do you often not feel lows coming?', 'No'));
    diskFull();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(glucoseLine()).toContain('If you are under 162');
    expect(pausedForUnsaved()).toBe(true);
    // Tried again, on its way.
    fake.control.setWriteError(undefined);
    fake.control.hold();
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(glucoseLine()).toContain('If you are under 162');
    fake.control.release();
    await host.settle();
    expect(store.getState().profile?.health.highHypoRisk).toBe(false);
    expect(glucoseLine()).toContain('If you are under 126');
  });

  it('with nothing to store to, a release isn’t taken, and everything holds for the session (K5R-05)', async () => {
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }), broadcast: null });
    expect((await store.update(d => completedSetup(d, FOOT_WOUND, NOW, CTX))).ok).toBe(false);
    expect(store.getState().profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'No'));
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(footStatus()).toEqual({ stored: 'current_wound_or_active_charcot', gate: 'current_wound_or_active_charcot' });
    expect(pausedForUnsaved()).toBe(true);
  });

  it('a change that isn’t clinical, refused, holds nothing, and leaves without asking', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'about' }));
    await host.settle();
    await host.change(host.field('Name (optional)'), { value: 'Kai' });
    diskFull();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(gate().clinicalUnsaved).toBeUndefined();
    expect(await leave(host)).toBe(false);
  });
});

describe('a refused clinical save beside a clock change and an unanswered stop (boards D170, D174, D197)', () => {
  it('every movement holds at every gate while any stands, the pause said alone; each lets go only by its own rule, the others holding on', async () => {
    const { useContext, useEffect } = await import('react');
    const { UrgentProvider } = await import('@/screens/home/UrgentBanner');
    const { ScreenTopContext } = await import('@/components/hig/navigation');
    const { UnsavedClinical } = await import('@/components/profile/UnsavedClinical');
    const { useGuided } = await import('@/hooks/useGuided');
    const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
    const { allowsMovement, deviceClinical, storeGate, walkInput } = await import('@/walk/gate');
    const { resumePermission } = await import('@/engine/permission');
    const { STOP_UNANSWERED } = await import('@/engine/readiness');
    const { STOPPED } = await import('@/walk/stop');
    resetPendingCheckInsForTests();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const at = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000);
      vi.setSystemTime(at(0));
      // Someone on insulin, who can go low, with setup finished and this morning's check-in and reading.
      const lows = withMeds({ insulin: 'yes' }, {
        conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2', clearance: 'vigorous', targets: 'no',
        insulinHow: 'basalOnly', lowsRisk: 'yes', glucoseStartMin: 90, glucoseStartUnit: 'mg/dL', priorDka: 'no', dizzy: 'no', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
      });
      const morning = today({ glucose: { value: 180, unit: 'mg/dL', measuredAt: at(0).toISOString(), source: 'meter' } });
      const DAY = morning.date;
      expect((await store.update(d => {
        const done = completedSetup(d, lows, NOW, CTX);
        return { ...done, checkIns: [{ ...morning, readiness: evaluateCheckIn(done.profile!, morning) }] };
      })).ok).toBe(true);
      /** Every mode, asked of what the device holds now as every gate asks it (a start, and carrying on), and the walk's own gate. */
      const gates = () => {
        const input = walkInput(deviceClinical(store.getState()), new Date());
        return {
          asked: MODES.flatMap(mode => [permission(input, mode), resumePermission(input, mode)]),
          walk: (['start', 'restart', 'live'] as const).map(intent => storeGate(intent)),
        };
      };
      expect(gates().asked.every(allowsMovement)).toBe(true);

      // The surface every tab screen draws, with Home's pause, and the shared report path.
      const seen: { report?: ReturnType<typeof useGuided>['reportSymptoms'] } = {};
      const Report = () => {
        const g = useGuided();
        useEffect(() => { seen.report = g.reportSymptoms; });
        return null;
      };
      const Screen = () => createElement('main', null, useContext(ScreenTopContext), createElement(UnsavedClinical));
      host = render(createElement(UrgentProvider, null, createElement(Report), createElement(Screen)));
      await host.settle();

      // On a walk, the phone's clock changed, and "I need to stop" was said, its questions closed unanswered.
      vi.setSystemTime(at(10));
      expect((await store.markClockChange([DAY])).ok).toBe(true);
      await seen.report!(STOPPED, at(10));
      await host.settle();
      // Then, in Me, a lows answer the device refused to store.
      vi.setSystemTime(at(15));
      const editor = render(createElement(ChapterEditor, { chapter: 'medicines' }));
      await editor.settle();
      await editor.click(radio(editor, 'A severe low in the last 6 months, or do you often not feel lows coming?', 'No'));
      diskFull();
      await editor.click(editor.button('Save', { exact: true }));
      await editor.settle();
      expect(editor.text()).toContain('That did not save.');
      editor.unmount();
      fake.control.setWriteError(undefined);
      await host.settle();

      // All three stand: every mode held at every gate, saying the pause alone (D197).
      let now = gates();
      expect(now.asked.every(p => !p.allowed && p.reasons.length === 1 && p.reasons[0] === PERMISSION_TEXT.unsaved)).toBe(true);
      expect(now.walk).toEqual([false, false, false]);
      expect(host.text()).toContain(CLINICAL_UNSAVED);

      // The pause's own rule, Discard changes: the stored answers stand, and the stop and the clock change still hold every mode.
      await host.click(host.button('Discard changes', { exact: true }));
      expect(gate().clinicalUnsaved).toBeUndefined();
      expect(store.getState().profile?.health.highHypoRisk).toBe(true);
      now = gates();
      expect(now.asked.every(p => !allowsMovement(p) && p.reasons.includes(STOP_UNANSWERED.reason) && p.reasons.includes(PERMISSION_TEXT.clockChanged))).toBe(true);
      expect(now.walk).toEqual([false, false, false]);

      // The stop's own rule, its questions, from the surface: the clock change still holds every mode.
      vi.setSystemTime(at(20));
      await host.click(host.button('Say what happened', { exact: true }));
      await host.click(host.button('Just need a rest', { exact: true }));
      now = gates();
      expect(now.asked.every(p => !allowsMovement(p) && p.reasons.includes(PERMISSION_TEXT.clockChanged) && !p.reasons.includes(STOP_UNANSWERED.reason))).toBe(true);
      expect(now.walk).toEqual([false, false, false]);

      // The clock change's own rule, a reading taken since, as it is given: every mode goes ahead.
      vi.setSystemTime(at(25));
      await seen.report!({ glucose: { value: 180, unit: 'mg/dL', source: 'meter' } }, at(25));
      await host.settle();
      now = gates();
      expect(now.asked.every(allowsMovement)).toBe(true);
      expect(now.walk).toEqual([true, true, true]);
    } finally {
      vi.useRealTimers();
      resetPendingCheckInsForTests();
    }
  });
});

describe('two copies of Me changing the same safety answer (H5F-10; board D196)', () => {
  it('Save says so and shows the other copy’s answer, stays usable, and saves once the person chooses again', async () => {
    const { withC } = await import('@/setup/fixtures');
    const back = withC({ pain: 'yes' }, { painAreas: ['lowerBack'], worseWith: 'unknown', neuroHistory: 'no', clearance: 'vigorous' });
    expect((await store.update(d => completedSetup(d, back, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'backFeet' }));
    await host.settle();
    await host.click(radio(host, 'What makes it worse?', 'Standing, walking or arching back'));
    // The other copy, meanwhile: sitting or bending forward.
    const { editOf, editedRecord, editorOpens, editorState } = await import('@/setup/edit');
    const { answersToEdit } = await import('@/setup/prefill');
    const elsewhere = (d: Parameters<typeof editedRecord>[0]) => {
      const opened = answersToEdit(d.settings.setup?.answers, d.profile!, d.settings, '2026-10-10', CTX);
      return editedRecord(d, editOf(editorState(editorOpens('backFeet', d.profile), { ...opened, worseWith: 'flexion' }, opened, CTX), opened), '2026-10-10', CTX);
    };
    expect((await store.update(elsewhere)).ok).toBe(true);
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Your answers changed in another window of FitStrong. Check them here, then Save again.');
    expect(radio(host, 'What makes it worse?', 'Sitting or bending forward').props['aria-checked']).toBe(true);
    expect(store.getState().profile?.pain.worseWith).toBe('flexion');
    // Still usable: the person chooses again, and it saves.
    await host.click(radio(host, 'What makes it worse?', 'Standing, walking or arching back'));
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Saved.');
    expect(store.getState().profile?.pain.worseWith).toBe('extension');
  });
});

describe('body readings from Me (H5-14)', () => {
  it('a save of another chapter makes no reading from a value another tab changed since', async () => {
    expect((await store.update(d => completedSetup(d, { ...MINIMAL, weightKg: 68 }, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    // Another tab: 70 kg.
    expect((await store.update(d => ({ ...d, profile: { ...d.profile!, weightKg: 70 } }))).ok).toBe(true);
    await host.settle();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Saved.');
    expect(store.getState().observations.filter(o => o.kind === 'weight')).toEqual([]);
    expect(store.getState().profile?.weightKg).toBe(70);
  });
});

describe('Your medicines in Me', () => {
  it('clearing the year metformin was started clears it from the record (H5-21)', async () => {
    const { withMeds } = await import('@/setup/fixtures');
    expect((await store.update(d => completedSetup(d, withMeds({ metformin: 'yes' }, { metforminSince: '2019' }), NOW, CTX))).ok).toBe(true);
    expect(store.getState().profile?.health.metforminSince).toBe('2019');
    host = render(createElement(ChapterEditor, { chapter: 'medicines' }));
    await host.settle();
    await host.change(host.field('Year you started metformin (optional)'), { value: '' });
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Saved.');
    expect(store.getState().profile?.health.metformin).toBe(true);
    expect(store.getState().profile?.health.metforminSince).toBeUndefined();
  });
});

describe('setup’s pages', () => {
  it('a Next stores only what its page changed, onto the draft as it is now: another copy’s answer on the same page stays (H5-12, H5R-14)', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { AboutName } = await import('./pages/about');
    host = render(createElement(PageFrame, { id: 'about.name', View: AboutName }));
    await host.settle();
    await host.change(host.field('Name (optional)'), { value: 'Kai' });
    // Another copy, the same page: the year.
    expect((await store.update(d => withDraft(d, 'about.name', { metric: true, birthYear: 1958 }))).ok).toBe(true);
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/about/figure', undefined);
    expect(store.getState().settings.setup?.draft).toMatchObject({ at: 'about.figure', answers: { name: 'Kai', birthYear: 1958 } });
  });

  it('Skip for now never gets past an answer that can’t be stored, such as an underage year; cleared, it skips (K5-04, H5-15)', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { AboutName } = await import('./pages/about');
    host = render(createElement(PageFrame, { id: 'about.name', View: AboutName }));
    await host.settle();
    await host.change(host.field('Year you were born (optional)'), { value: '2015' });
    await host.click(host.button('Skip for now', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain('FitStrong is made for adults aged 18 and over.');
    expect(store.getState().settings.setup?.draft?.answers?.skippedPages).toBeUndefined();
    await host.change(host.field('Year you were born (optional)'), { value: '' });
    await host.click(host.button('Skip for now', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/about/figure', undefined);
  });

  it('Back from the first page of a chapter opened with Review’s Edit returns to Review (K5-14; board D156)', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { HealthConditions } = await import('./pages/health');
    router.state = { fromReview: true };
    host = render(createElement(PageFrame, { id: 'health.conditions', View: HealthConditions }));
    await host.settle();
    await host.click(host.button('Back', { exact: true }));
    expect(router.navigate).toHaveBeenCalledWith('/setup/review', { replace: true, state: { back: true, fromReview: true } });
  });
});

describe('a preference page half answered in Me (K5-15; board D157)', () => {
  it('holds Save, saying why at the question: allergies unticked would be stored unknown', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'food' }));
    await host.settle();
    await host.click(host.button('No food allergies', { exact: true }));
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Tick your allergies, or “No food allergies”.');
    expect(host.text()).not.toContain('Saved.');
    expect(store.getState().profile?.food?.allergies).toEqual([]);
  });

  it('and estimates chosen after “Yes” to food being hard asks for meals only or estimates, at the suggestion', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'food' }));
    await host.settle();
    await host.click(radio(host, 'Would you like to log what you eat?', 'Yes, with calorie and carb estimates'));
    await host.click(radio(host, 'Has food or weight ever been hard for you?', 'Yes'));
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Choose “Use meals only” or “Keep estimates”.');
    expect(store.getState().profile?.food?.level).toBe('ideas');
  });
});

describe('Review (journey §6.2)', () => {
  it('says why diabetes reads as “Other” under Your health (K5-11; board D153)', async () => {
    const { ReviewPage } = await import('./ReviewPage');
    const { withDraft } = await import('@/setup/draft');
    const { INSULIN_NO_DIABETES } = await import('@/setup/fixtures');
    expect((await store.update(d => withDraft(d, 'review', INSULIN_NO_DIABETES))).ok).toBe(true);
    host = render(createElement(ReviewPage));
    await host.settle();
    expect(host.text()).toContain('Diabetes shows as “Other” because insulin, or a tablet that can cause lows, is ticked or marked “Not sure”.');
  });
});

describe('a number typed that isn’t an answer, at Review (H5F-05; board D199)', () => {
  it('“Start using FitStrong” waits, saying where, and the text and the answers stay', async () => {
    const { ReviewPage } = await import('./ReviewPage');
    const { COMPLEX } = await import('@/setup/fixtures');
    const { RAW_LEFT, changeAnswers, flushAnswers } = await import('@/setup/draft');
    // A care team's start figure of 180 mg/dL, replaced with an unfinished “18”, then Back to Review.
    const lows = { ...COMPLEX, glucoseStartMin: 180, glucoseStartUnit: 'mg/dL' as const };
    expect((await store.update(d => withDraft(d, 'review', lows))).ok).toBe(true);
    changeAnswers(lows, { glucoseStartMin: undefined }, { glucoseStartMin: '18' }, 'medicines.lows');
    expect(await flushAnswers('review')).toBe('saved');
    host = render(createElement(ReviewPage));
    await host.settle();
    await host.click(host.all().find(n => n.props.role === 'checkbox')!);
    await host.click(host.button('Start using FitStrong', { exact: true }));
    await host.settle();
    expect(host.text()).toContain(RAW_LEFT('medicines'));
    expect(store.getState().settings.setup).toMatchObject({ stage: 'open', draft: { raw: { glucoseStartMin: '18' } } });
    // The hold meanwhile names that chapter, as one with a question left.
    const { useSafetyLeft } = await import('./useSetup');
    const Probe = () => createElement('p', null, JSON.stringify(useSafetyLeft() ?? 'none'));
    host.unmount();
    host = render(createElement(Probe));
    await host.settle();
    expect(host.text()).toContain('"ask":"Answer 1 question about your medicines"');
    // Opened by its address, Review goes back to the page.
    host.unmount();
    const { Guarded } = await import('./routes');
    host = render(createElement(Guarded, { id: 'review' }));
    await host.settle();
    expect(host.all().find(n => n.props['data-navigate'])?.props['data-navigate']).toBe('/setup/medicines/lows');
  });
});

describe('the hold while setup is unfinished (§6.1; K5-07)', () => {
  it('names the safety chapter the draft still asks, with how many questions; nothing once setup is finished', async () => {
    const { useSafetyLeft } = await import('./useSetup');
    const { withDraft } = await import('@/setup/draft');
    const { COMPLEX } = await import('@/setup/fixtures');
    const { sciaticaSide: _s, worseWith: _w, neuroHistory: _n, ...noBack } = COMPLEX;
    void [_s, _w, _n];
    expect((await store.update(d => withDraft(d, 'movement.focus', noBack))).ok).toBe(true);
    const Probe = () => createElement('p', null, JSON.stringify(useSafetyLeft() ?? 'none'));
    host = render(createElement(Probe));
    await host.settle();
    expect(host.text()).toContain('{"chapter":"your back and feet","ask":"Answer 2 questions about your back and feet"}');
    // Finished from a draft holding every answer.
    expect((await store.update(d => completedSetup(withDraft(d, 'review', COMPLEX), COMPLEX, NOW, CTX))).ok).toBe(true);
    await host.settle();
    expect(host.text()).toContain('"none"');
  });
});

describe('allergies in setup (K5-08; board D150)', () => {
  it('have their own page with no Skip for now; “No food allergies” is one tap, then Next', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { FoodAllergies } = await import('./pages/food');
    host = render(createElement(PageFrame, { id: 'food.allergies', View: FoodAllergies }));
    await host.settle();
    expect(host.buttons('Skip for now')).toHaveLength(0);
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain('Tick your allergies, or “No food allergies”.');
    await host.click(host.button('No food allergies', { exact: true }));
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/food/logging', undefined);
    expect(store.getState().settings.setup?.draft?.answers?.allergies).toEqual([]);
  });

  const allergiesPage = async () => {
    const { PageFrame } = await import('./PageFrame');
    const { FoodAllergies } = await import('./pages/food');
    const shown = render(createElement(PageFrame, { id: 'food.allergies', View: FoodAllergies }));
    await shown.settle();
    return shown;
  };
  const OWN = 'Something else you’re allergic to (optional)';
  const stored = () => store.getState().settings.setup?.draft;

  it('own words that can’t be stored yet keep every earlier exclusion, and leave the answer not known until they can (H5F-08; board D222)', async () => {
    const { allergyAnswer } = await import('@/food/allergens');
    // Milk ticked and peanut typed, with “How do you eat?” skipped.
    const { pattern: _p, ...answers } = { ...MINIMAL, allergies: ['milk' as const], customAllergies: ['peanut'] };
    void _p;
    expect((await store.update(d => withDraft(d, 'food.allergies', answers))).ok).toBe(true);
    host = await allergiesPage();
    const typed = `peanut, ${'k'.repeat(61)}`;
    await host.change(host.field(OWN), { value: typed });
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    await host.settle();
    expect([stored()?.answers?.allergies, stored()?.answers?.customAllergies, stored()?.raw]).toEqual([['milk'], ['peanut'], { customAllergies: typed }]);
    // Meal ideas ask first, so a dish with peanuts can't show.
    expect(allergyAnswer(undefined, store.getState().settings.setup)).toBeUndefined();
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    // Corrected: stored, and known again.
    await host.change(host.field(OWN), { value: 'peanut, kiwi' });
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(allergyAnswer(undefined, store.getState().settings.setup)).toEqual({ allergies: ['milk'], customAllergies: ['peanut', 'kiwi'] });
  });

  it('a chip ticked here leaves own words another window stored meanwhile, and the field shows them (H5R-03)', async () => {
    const { withFields } = await import('@/setup/draft');
    expect((await store.update(d => withDraft(d, 'food.allergies', MINIMAL))).ok).toBe(true);
    host = await allergiesPage();
    expect(host.field(OWN).props.value).toBe('');
    // Another window: kiwi, in the person's own words.
    expect((await store.update(d => withFields(d, new Map([['customAllergies', { baseline: undefined, value: ['kiwi'] }]]), new Map(), undefined))).ok).toBe(true);
    await host.settle();
    expect(host.field(OWN).props.value).toBe('kiwi');
    await host.click(host.button('Milk', { exact: true }));
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    await host.settle();
    expect([stored()?.answers?.allergies, stored()?.answers?.customAllergies]).toEqual([['milk'], ['kiwi']]);
    // Unticked again: kiwi is still an answer, so the chips' is none, not unanswered.
    await host.click(host.button('Milk', { exact: true }));
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    expect([stored()?.answers?.allergies, stored()?.answers?.customAllergies]).toEqual([[], ['kiwi']]);
  });
});

describe('plain words first, the term in brackets (K5-13; board D155)', () => {
  it('a clinician, a Charcot foot, DKA, a closed-loop system and HbA1c are named only after plain words', async () => {
    const { PAGE_VIEWS } = await import('./pages');
    const { PAGE_TITLE } = await import('./titles');
    const { NO_CLASSES, NO_CONDITIONS } = await import('@/setup/fixtures');
    const a = {
      conditions: { ...NO_CONDITIONS, diabetes: 'yes', bp: 'yes', feet: 'yes', pain: 'yes' }, diabetesType: 'type2', targets: 'yes',
      regular: 'yes', classes: { ...NO_CLASSES, insulin: 'yes' },
    } as const;
    const terms = ['clinician', 'Charcot foot', 'DKA', 'diabetic ketoacidosis', 'closed-loop system', 'HbA1c'];
    const bare = (text: string) => text.replace(/\([^)]*\)/g, '');
    for (const title of Object.values(PAGE_TITLE)) for (const term of terms) expect(bare(title), title).not.toContain(term);
    for (const id of ['health.feet', 'health.limits', 'medicines.lows', 'medicines.ketones', 'backFeet.history'] as const) {
      // Tried, with a figure that can't be taken, so what's said about it shows too (K5R-10).
      const shown = render(createElement(PAGE_VIEWS[id], { a, raw: { hba1cPercent: '40' }, set: () => {}, tried: true, ctx: { thisYear: 2026 }, mode: 'setup' }));
      await shown.settle();
      const text = shown.text();
      shown.unmount();
      for (const term of terms) expect(bare(text), `${id}: “${term}” before its plain words`).not.toContain(term);
    }
  });
});

describe('a setup page, its answers kept as they’re given (§6.1; H5-16, K5-17; board D169)', () => {
  const draft = () => store.getState().settings.setup?.draft;
  const SAVE_FAILED = 'Your answers aren’t being saved on this phone.';
  const page = async (id: 'about.name' | 'about.figure' | 'about.body' | 'medicines.which' | 'health.limits' | 'health.conditions') => {
    const { PageFrame } = await import('./PageFrame');
    const { PAGE_VIEWS } = await import('./pages');
    const shown = render(createElement(PageFrame, { id, View: PAGE_VIEWS[id] }));
    await shown.settle();
    return shown;
  };
  /** The app closed and opened again. */
  const reopen = async () => {
    host?.unmount();
    host = undefined;
    await new Promise(r => setTimeout(r, 30));
    expect((await store.reload()).ok).toBe(true);
    resetSetupSessionForTests();
  };

  it('Back stores what the page holds, and the page it goes to, before any Next', async () => {
    host = await page('about.name');
    await host.change(host.field('Year you were born (optional)'), { value: '195' });
    await host.click(host.button('Back', { exact: true }));
    await host.settle();
    expect(draft()).toEqual({ at: 'welcome.start', answers: expect.not.objectContaining({ birthYear: expect.anything() }), raw: { birthYear: '195' } });
  });

  it('Close, after Look around first, stores the page itself to resume on, then goes Home', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    expect((await store.update(lookedAround)).ok).toBe(true);
    host = await page('about.figure');
    await host.click(radio(host, 'Body for the exercise demos', 'Female'));
    await host.click(host.button('Close', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/home');
    expect(draft()).toMatchObject({ at: 'about.figure', answers: { figure: 'female' } });
  });

  it('a change still waiting is stored as the page is left', async () => {
    host = await page('about.name');
    await host.change(host.field('Name (optional)'), { value: 'Kai' });
    expect(draft()).toBeUndefined();
    host.unmount();
    host = undefined;
    await new Promise(r => setTimeout(r, 30));
    expect(draft()).toMatchObject({ at: 'about.name', answers: { name: 'Kai' } });
  });

  it('a number shows as typed after the app is closed, and is an answer only once it’s valid: “195” holds Next, “7.” stays “7.” (H5R-15)', async () => {
    host = await page('about.name');
    await host.change(host.field('Year you were born (optional)'), { value: '195' });
    await reopen();
    host = await page('about.name');
    expect(host.field('Year you were born (optional)').props.value).toBe('195');
    expect(draft()?.answers?.birthYear).toBeUndefined();
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain('Enter the year you were born, from');
    await host.change(host.field('Year you were born (optional)'), { value: '1958' });
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/about/figure', undefined);
    expect(draft()?.answers?.birthYear).toBe(1958);
    // A weight half typed: the answer it gives so far, and the text as typed.
    host.unmount();
    host = await page('about.body');
    // The host gives fields side by side one id, so the weight is found by its own placeholder.
    const weight = () => host!.all().find(n => n.type === 'input' && n.props.placeholder === '65')!;
    await host.change(weight(), { value: '70.' });
    await reopen();
    host = await page('about.body');
    expect(weight().props.value).toBe('70.');
    expect(draft()?.answers?.weightKg).toBe(70);
  });

  it('units don’t change while a measure typed isn’t an answer: it’s corrected or cleared first, never lost (H5F-11; board D223)', async () => {
    host = await page('about.body');
    const field = (hint: string) => host!.all().find(n => n.type === 'input' && n.props.placeholder === hint)!;
    await host.change(field('160'), { value: '0' });
    await host.click(radio(host, 'Units', 'ft, in and lb'));
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    await host.settle();
    expect(draft()?.answers?.metric).not.toBe(false);
    expect(draft()?.raw).toEqual({ heightCm: '0' });
    expect(field('160').props.value).toBe('0');
    expect(host.text()).toContain('Enter a height between 50 and 260 cm (1 ft 8 in and 8 ft 6 in). Then change units.');
    // Cleared, and the waist too: then a waist that isn't one holds them the same way.
    await host.change(field('160'), { value: '' });
    await host.change(field('85'), { value: '1.2.3' });
    await host.click(radio(host, 'Units', 'ft, in and lb'));
    await host.settle();
    expect(host.text()).toContain('Enter a waist between 30 and 250 cm (12 and 98 inches). Then change units.');
    // Cleared, the units change.
    await host.change(field('85'), { value: '' });
    await host.click(radio(host, 'Units', 'ft, in and lb'));
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    expect(draft()?.answers?.metric).toBe(false);
  });

  it('a number its unit makes invalid isn’t an answer either: a start figure in mmol/L, then mg/dL (H5R-15)', async () => {
    const { MedicinesLows } = await import('./pages/medicines');
    const { PageFrame } = await import('./PageFrame');
    const lows = { ...MINIMAL, conditions: { ...MINIMAL.conditions!, diabetes: 'yes' as const }, diabetesType: 'type2' as const, regular: 'yes' as const, classes: { insulin: 'yes' as const } };
    expect((await store.update(d => withDraft(d, 'medicines.lows', lows))).ok).toBe(true);
    host = render(createElement(PageFrame, { id: 'medicines.lows', View: MedicinesLows }));
    await host.settle();
    await host.click(radio(host, 'Its unit', 'mmol/L'));
    await host.change(host.field('Lowest glucose to start exercise at'), { value: '5.5' });
    await host.settle();
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    expect(draft()?.answers).toMatchObject({ glucoseStartMin: 5.5, glucoseStartUnit: 'mmol/L' });
    await host.click(radio(host, 'Its unit', 'mg/dL'));
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    expect(draft()?.answers?.glucoseStartMin).toBeUndefined();
    expect(draft()?.raw).toEqual({ glucoseStartMin: '5.5' });
  });

  it('a change made while Next is being stored stays on the page, and the next Next goes on from it (H5R-11)', async () => {
    const { NO_CLASSES } = await import('@/setup/fixtures');
    // No insulin, then Next, slowly stored.
    const which = { ...MINIMAL, conditions: { ...MINIMAL.conditions!, diabetes: 'yes' as const }, diabetesType: 'type2' as const, regular: 'yes' as const, classes: { ...NO_CLASSES } };
    expect((await store.update(d => withDraft(d, 'medicines.which', which))).ok).toBe(true);
    host = await page('medicines.which');
    fake.control.hold();
    await host.click(host.button('Next', { exact: true }));
    await host.click(host.button(/^Insulin/));
    fake.control.release();
    await host.settle();
    await new Promise(r => setTimeout(r, 30));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    await new Promise(r => setTimeout(r, 30));
    expect(router.navigate).toHaveBeenCalledWith('/setup/medicines/lows', undefined);
    expect(draft()?.answers?.classes?.insulin).toBe('yes');
  });

  it('a change the device refused says so on the page, and Try again stores it (H5R-16)', async () => {
    host = await page('about.name');
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    await host.change(host.field('Name (optional)'), { value: 'Kai' });
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    await host.settle();
    expect(host.text()).toContain(SAVE_FAILED);
    expect(host.field('Name (optional)').props.value).toBe('Kai');
    fake.control.setWriteError(undefined);
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(host.text()).not.toContain(SAVE_FAILED);
    expect(draft()?.answers?.name).toBe('Kai');
  });

  it('Welcome says so too, for a change from the page Back left (H5R-16)', async () => {
    const { changeAnswers, flushAnswers } = await import('@/setup/draft');
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    changeAnswers({}, { name: 'Kai' }, {}, 'about.name');
    expect(await flushAnswers('welcome.start')).toBe('failed');
    const { WelcomePage } = await import('./WelcomePage');
    host = render(createElement(WelcomePage));
    await host.settle();
    expect(host.text()).toContain(SAVE_FAILED);
    fake.control.setWriteError(undefined);
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(host.text()).not.toContain(SAVE_FAILED);
    expect(draft()?.answers?.name).toBe('Kai');
  });

  it('a backup restored on Welcome itself: Get started carries on in the restored record, and Review finishes it (V-J11, V-J37; H5R-09)', async () => {
    const { TRANSFER_FORMAT } = await import('@/store/transfer');
    const { WelcomePage } = await import('./WelcomePage');
    host = render(createElement(WelcomePage));
    await host.settle();
    const backup = {
      format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5,
      settings: { onboardingComplete: false, setup: { stage: 'open', draft: { at: 'health.conditions', answers: { figure: 'female', metric: true } } } },
      observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    };
    expect((await store.importRecord(backup, 'replace')).ok).toBe(true);
    await host.settle();
    await host.click(host.button('Get started', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/health/conditions', { state: { welcomeBack: true } });
    expect(host.text()).not.toContain(SAVE_FAILED);
    host.unmount();
    // Review, open before a restore, finishes the restored record.
    const { ReviewPage } = await import('./ReviewPage');
    expect((await store.update(d => withDraft(d, 'review', MINIMAL))).ok).toBe(true);
    host = render(createElement(ReviewPage));
    await host.settle();
    const again = { ...backup, settings: { onboardingComplete: false, setup: { stage: 'open', draft: { at: 'review', answers: MINIMAL } } } };
    expect((await store.importRecord(again, 'replace')).ok).toBe(true);
    await host.settle();
    const agree = host.all().find(n => n.props.role === 'checkbox');
    if (agree) await host.click(agree);
    await host.click(host.button('Start using FitStrong', { exact: true }));
    await host.settle();
    expect(host.text()).not.toContain('replaced on this device');
  });

  it('Close with the change refused stays, and says so (H5R-16)', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    expect((await store.update(lookedAround)).ok).toBe(true);
    host = await page('about.figure');
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    await host.click(radio(host, 'Body for the exercise demos', 'Female'));
    await host.click(host.button('Close', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalledWith('/home');
    expect(host.text()).toContain(SAVE_FAILED);
  });

  it('Back waits for its store: refused, the page stays and says so, and a page not about health asks nothing (H5R-16)', async () => {
    host = await page('about.name');
    diskFull();
    await host.change(host.field('Name (optional)'), { value: 'Kai' });
    await host.click(host.button('Back', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain(SAVE_FAILED);
    expect(host.text()).not.toContain('Discard your changes?');
    fake.control.setWriteError(undefined);
    await host.click(host.button('Back', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup', expect.objectContaining({ replace: true }));
    expect(draft()?.answers?.name).toBe('Kai');
  });

  it('on a safety page, leaving with its changes refused asks first: Cancel stays, Discard changes drops them and goes (board D198)', async () => {
    const { answersQueue, withQueued } = await import('@/setup/draft');
    // As the router does, a navigation asks the page's guard first.
    router.navigate = vi.fn(() => {
      if (!router.shouldBlock?.({ currentLocation: { pathname: '/setup/health/conditions', search: '' }, nextLocation: { pathname: '/setup/about/body', search: '' } })) return;
      router.blocker = 'blocked';
      router.redraw.forEach(r => r());
    });
    host = await page('health.conditions');
    diskFull();
    await host.click(host.button(/^Heart or circulation problems/));
    await host.click(host.button('Back', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain('Discard your changes?');
    await host.click(host.button('Cancel', { exact: true }));
    await host.settle();
    expect(host.text()).not.toContain('Discard your changes?');
    expect(host.text()).toContain(SAVE_FAILED);
    // The browser's Back asks too.
    expect(await leave(host)).toBe(true);
    expect(host.text()).toContain('Discard your changes?');
    await host.click(host.button('Cancel', { exact: true }));
    await host.settle();
    expect(router.resets).toBe(1);
    // Back again, refused again, and Discard changes: the stored answers stand, and Back goes, asking no more.
    await host.click(host.button('Back', { exact: true }));
    await host.settle();
    await host.click(host.button('Discard changes', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/about/body', expect.objectContaining({ replace: true }));
    expect(router.blocker).toBe('unblocked');
    expect(withQueued({}).conditions).toBeUndefined();
    expect(answersQueue().refused).toBeUndefined();
  });

  it('Close on a safety page with its changes refused asks too, and Discard changes goes Home', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    expect((await store.update(lookedAround)).ok).toBe(true);
    host = await page('health.conditions');
    diskFull();
    await host.click(host.button(/^Heart or circulation problems/));
    await host.click(host.button('Close', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalledWith('/home');
    await host.click(host.button('Discard changes', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/home');
  });

  it('Review shows a change the device refused, with Try again, and Close stores what’s waiting first (H5R-16)', async () => {
    const { changeAnswers, flushAnswers } = await import('@/setup/draft');
    const { lookedAround } = await import('@/setup/assemble');
    const { ReviewPage } = await import('./ReviewPage');
    expect((await store.update(d => lookedAround(withDraft(d, 'review', MINIMAL)))).ok).toBe(true);
    diskFull();
    changeAnswers(MINIMAL, { name: 'Kai' }, {}, 'about.name');
    expect(await flushAnswers()).toBe('failed');
    host = render(createElement(ReviewPage));
    await host.settle();
    expect(host.text()).toContain(SAVE_FAILED);
    await host.click(host.button('Close', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalledWith('/home');
    fake.control.setWriteError(undefined);
    await host.click(host.button('Try again', { exact: true }));
    await host.settle();
    expect(host.text()).not.toContain(SAVE_FAILED);
    expect(draft()?.answers?.name).toBe('Kai');
    await host.click(host.button('Close', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/home');
  });

  it('a number typed after another window stored that answer shows the stored one, and says so (H5F-06; board D220)', async () => {
    const { withC } = await import('@/setup/fixtures');
    const { withFields } = await import('@/setup/draft');
    expect((await store.update(d => withDraft(d, 'health.limits', withC({ bp: 'yes' }, { bpMedicine: 'no', clearance: 'none', targets: 'yes' })))).ok).toBe(true);
    host = await page('health.limits');
    await host.change(host.field('Top number exercise is fine up to'), { value: '150' });
    // Another window stores 170/100 before this one's texts are stored.
    const other = new Map([['bpPermission', { baseline: undefined, value: { sys: 170, dia: 100 } }]]);
    expect((await store.update(d => withFields(d, other, new Map([['bpPermission.sys', '170'], ['bpPermission.dia', '100']]), undefined))).ok).toBe(true);
    await new Promise(r => setTimeout(r, AUTOSAVE_MS + 50));
    await host.settle();
    // The two fields by their hints: this host gives sibling fields one id.
    const shown = (hint: string) => host!.all().find(n => n.type === 'input' && n.props.placeholder === hint)?.props.value;
    expect([shown('170'), shown('105')]).toEqual(['170', '100']);
    expect(host.text()).toContain('Another window of FitStrong changed an answer at the same time, and its answer was kept.');
  });

  it('a field takes no more than a backup holds: the name by its length, and allergies of the person’s own kept as typed until they fit (H5-18)', async () => {
    const { NAME_MAX } = await import('@/setup/limits');
    host = await page('about.name');
    expect(host.field('Name (optional)').props.maxLength).toBe(NAME_MAX);
    host.unmount();
    const { FoodAllergies } = await import('./pages/food');
    const { PageFrame } = await import('./PageFrame');
    const allergies = async () => {
      const shown = render(createElement(PageFrame, { id: 'food.allergies', View: FoodAllergies }));
      await shown.settle();
      return shown;
    };
    host = await allergies();
    const long = `kiwi, ${'x'.repeat(61)}`;
    await host.change(host.field('Something else you’re allergic to (optional)'), { value: long });
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain('Each allergy in 60 characters or fewer.');
    await reopen();
    expect([draft()?.answers?.allergies, draft()?.answers?.customAllergies]).toEqual([undefined, undefined]);
    expect(draft()?.raw).toEqual({ customAllergies: long });
    host = await allergies();
    expect(host.field('Something else you’re allergic to (optional)').props.value).toBe(long);
    await host.change(host.field('Something else you’re allergic to (optional)'), { value: 'kiwi, brinjal' });
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/food/logging', undefined);
    expect(draft()?.answers).toMatchObject({ allergies: [], customAllergies: ['kiwi', 'brinjal'] });
    expect(draft()?.raw).toBeUndefined();
  });

  it('Me’s Save waits for a number typed that isn’t an answer yet (H5R-15)', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'about' }));
    await host.settle();
    await host.change(host.field('Year you were born (optional)'), { value: '195' });
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Answer the questions marked above, then Save.');
    expect(host.text()).toContain('Enter the year you were born, from');
    expect(store.getState().profile?.birthYear).toBeUndefined();
    await host.change(host.field('Year you were born (optional)'), { value: '1958' });
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(store.getState().profile?.birthYear).toBe(1958);
  });
});

describe('tap targets (§20.4.1; H5-22; board D159)', () => {
  /** The least height a node's classes give it, in px at the default text size. */
  const leastHeight = (className: unknown): number => {
    const classes = String(className ?? '').split(/\s+/);
    const px = classes.map(c => {
      const units = /^(?:min-)?h-(\d+)$/.exec(c);
      if (units) return Number(units[1]) * 4;
      const rem = /^(?:min-)?h-\[(\d*\.?\d+)rem\]$/.exec(c);
      return rem ? Number(rem[1]) * 16 : 0;
    });
    return Math.max(0, ...px);
  };
  const tappable = (n: HostNode) => n.type === 'button' || n.type === 'input' || ['radio', 'checkbox', 'switch', 'button'].includes(String(n.props.role));

  it('every control setup’s questions use is at least 48 px tall', async () => {
    const { ChoiceRows, CheckRows, PlainButton, Segmented, TimeField } = await import('@/screens/you/controls');
    const { NumberAnswer, TextInput } = await import('./controls');
    const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    const shown = render(createElement('div', null,
      createElement(TextInput, { label: 'Name', text: '', onText: () => {} }),
      createElement(NumberAnswer, { label: 'Year', text: '', onText: () => {} }),
      createElement(Segmented, { label: 'Units', options, value: 'a', onChange: () => {} }),
      createElement(TimeField, { id: 't', label: 'From', value: '09:00', onChange: () => {} }),
      createElement(PlainButton, null, 'Skip for now'),
      createElement(ChoiceRows, { label: 'One', options, value: 'a', onChange: () => {} }),
      createElement(CheckRows, { label: 'Some', options, value: [], onChange: () => {} }),
    ));
    const small = shown.all().filter(tappable).filter(n => leastHeight(n.props.className) < 48);
    shown.unmount();
    expect(small.map(n => `${String(n.type)} ${String(n.props.className)}`)).toEqual([]);
  });

  it('the body picture only shows what’s chosen: areas are chosen in the labelled list', async () => {
    const { BackFeetWhere } = await import('./pages/backFeet');
    const shown = render(createElement(BackFeetWhere, { a: { painAreas: ['lowerBack'] }, raw: {}, set: () => {}, tried: false, ctx: { thisYear: 2026 }, mode: 'setup' }));
    const picture = shown.all().find(n => n.type === 'svg');
    const inPicture = (n: HostNode): HostNode[] => [n, ...n.children.flatMap(c => (typeof c === 'string' ? [] : inPicture(c)))];
    expect(picture?.props['aria-hidden']).toBe(true);
    expect(inPicture(picture!).filter(n => n.props.onClick !== undefined)).toEqual([]);
    expect(shown.all().some(n => n.props.role === 'checkbox' && n.props['aria-checked'] === true)).toBe(true);
    shown.unmount();
  });
});

describe('radio groups by keyboard (WAI-ARIA radio group; H5-23; board D160)', () => {
  it('one tab stop, on the chosen option or else the first; the arrow keys move to an option and choose it, wrapping', async () => {
    const { useState } = await import('react');
    const { ChoiceRows, Segmented } = await import('@/screens/you/controls');
    const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }];
    for (const Group of [ChoiceRows, Segmented] as const) {
      const Stateful = () => {
        const [value, setValue] = useState<string>();
        return createElement(Group as typeof ChoiceRows<string>, { label: 'Q', options, value, onChange: setValue });
      };
      const shown = render(createElement(Stateful));
      const radios = () => shown.all().filter(n => n.props.role === 'radio');
      const focused: number[] = [];
      const press = async (index: number, key: string) => {
        const siblings = radios().map((_, i) => ({ focus: () => focused.push(i) }));
        await (radios()[index].props.onKeyDown as (e: unknown) => unknown)({ key, preventDefault() {}, currentTarget: { closest: () => ({ querySelectorAll: () => siblings }) } });
        await shown.settle();
      };
      const state = () => radios().map(n => [n.props.tabIndex, n.props['aria-checked']]);
      expect(state()).toEqual([[0, false], [-1, false], [-1, false]]);
      await press(0, 'ArrowDown');
      expect(state()).toEqual([[-1, false], [0, true], [-1, false]]);
      await press(1, 'ArrowRight');
      await press(2, 'ArrowDown');
      expect(state()).toEqual([[0, true], [-1, false], [-1, false]]);
      await press(0, 'ArrowUp');
      await press(2, 'ArrowLeft');
      expect(state()).toEqual([[-1, false], [0, true], [-1, false]]);
      expect(focused).toEqual([1, 2, 0, 2, 1]);
      // Any other key is the button's own.
      await press(1, 'Tab');
      expect(focused).toHaveLength(5);
      shown.unmount();
    }
  });

  it('and so do the Voices card’s, in setup’s Voice page: the voices, each with its Preview beside it, and how much the coach explains (H5-23)', async () => {
    const { useState } = await import('react');
    const { VoiceSettingsCard } = await import('@/components/profile/VoiceSettingsCard');
    type Voice = Parameters<typeof VoiceSettingsCard>[0]['voice'];
    const Stateful = () => {
      const [voice, setVoice] = useState<Voice>({ rate: 1, verbosity: 'auto', mode: 'coach', muted: false, checked: true });
      return createElement(VoiceSettingsCard, { voice, onChange: patch => setVoice(v => ({ ...v, ...patch })) });
    };
    const shown = render(createElement(Stateful));
    await shown.settle();
    for (const name of ['Voice', 'How much the coach explains']) {
      const group = shown.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === name)!;
      const radios = () => all(shown.all().filter(n => n === shown.all().find(m => m.props.role === 'radiogroup' && m.props['aria-label'] === name))).filter(n => n.props.role === 'radio');
      expect(group, name).toBeDefined();
      const focused: number[] = [];
      const stops = () => radios().map(n => n.props.tabIndex);
      expect(stops().filter(t => t === 0), name).toHaveLength(1);
      const before = radios().findIndex(n => n.props['aria-checked'] === true);
      const siblings = radios().map((_, i) => ({ focus: () => focused.push(i) }));
      await (radios()[before].props.onKeyDown as (e: unknown) => unknown)({ key: 'ArrowDown', preventDefault() {}, currentTarget: { closest: () => ({ querySelectorAll: () => siblings }) } });
      await shown.settle();
      const after = (before + 1) % radios().length;
      expect(radios()[after].props['aria-checked'], name).toBe(true);
      expect(radios()[after].props.tabIndex, name).toBe(0);
      expect(focused, name).toEqual([after]);
    }
    shown.unmount();
  });
});

describe('body measures on Review and in Profile & health (§4.10, B-24; H5-24)', () => {
  it('Review dates a measure finishing will store as from now, and one no reading holds as never recorded', async () => {
    const { ReviewPage } = await import('./ReviewPage');
    const { withDraft } = await import('@/setup/draft');
    const { createDefaultProfile } = await import('@/profile/defaults');
    // An upgrader's v1 height, never dated, and a weight entered now.
    expect((await store.update(d => ({ ...withDraft(d, 'review', { ...MINIMAL, heightCm: 170, weightKg: 70 }), profile: createDefaultProfile({ heightCm: 170, weightKg: 68, needsHealthReview: true }) }))).ok).toBe(true);
    host = render(createElement(ReviewPage));
    await host.settle();
    expect(host.text()).toMatch(/70 kg, entered \d+ \w+ \d{4} at /);
    expect(host.text()).toContain('170 cm, date not recorded');
  });

  it('Profile & health dates each measure from its reading', async () => {
    const { ProfileHealthScreen } = await import('./ProfileHealthScreen');
    expect((await store.update(d => completedSetup(d, { ...MINIMAL, weightKg: 70 }, NOW, CTX), { addObservations: [{ kind: 'weight', value: 70, unit: 'kg', scope: 'pointInTime', source: 'manual', at: NOW, context: 'profile' }] })).ok).toBe(true);
    host = render(createElement(ProfileHealthScreen));
    await host.settle();
    expect(host.text()).toMatch(/70 kg, entered \d+ \w+ 2026 at /);
  });
});

describe('a clinical save the device refused, in Profile & health (board D197; H5F-12)', () => {
  /** Profile & health after a wound disclosed in Me wasn't stored: its write, with whether the next try is stored. */
  const setUp = async () => {
    const { ProfileHealthScreen } = await import('./ProfileHealthScreen');
    const { saveClinical } = await import('@/setup/effective');
    const { StoreFailure } = await import('@/store/db');
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    const tries = { stored: false };
    const wounded = (d: AppData): AppData => ({ ...d, profile: { ...d.profile!, health: { ...d.profile!.health, footStatus: 'current_wound_or_active_charcot' } } });
    const write = () => (tries.stored ? store.update(wounded) : Promise.resolve({ ok: false as const, failure: new StoreFailure('quotaExceeded', 'Storage is full') }));
    expect((await saveClinical(write)).ok).toBe(false);
    host = render(createElement(ProfileHealthScreen));
    await host.settle();
    // Where focus goes once the way out is gone: the region that says what happened.
    const region = host.all().find(n => n.props.tabIndex === -1 && n.element && textIn(n).includes(CLINICAL_UNSAVED))!;
    const focused = { count: 0 };
    region.element!.focus = () => void (focused.count += 1);
    return { tries, focused };
  };
  const said = (h: Host, text: string) => h.all().some(n => n.props.role === 'status' && textIn(n).includes(text));

  it('says so, and every movement waits; Try again refused again keeps waiting, and stored, says so where focus now is', async () => {
    const { tries, focused } = await setUp();
    expect(host!.text()).toContain(CLINICAL_UNSAVED);
    expect(pausedForUnsaved()).toBe(true);
    await host!.click(host!.button('Try again', { exact: true }));
    await host!.settle();
    expect(said(host!, 'That did not save. Storage is full')).toBe(true);
    expect(pausedForUnsaved()).toBe(true);
    tries.stored = true;
    await host!.click(host!.button('Try again', { exact: true }));
    await host!.settle();
    expect(store.getState().profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(gate().clinicalUnsaved).toBeUndefined();
    expect(host!.text()).not.toContain(CLINICAL_UNSAVED);
    expect(said(host!, 'Saved. Movement follows your health answers again.')).toBe(true);
    expect(focused.count).toBe(1);
  });

  it('Discard changes: the stored answers stand, said where focus now is', async () => {
    const { focused } = await setUp();
    await host!.click(host!.button('Discard changes', { exact: true }));
    await host!.settle();
    expect(gate().clinicalUnsaved).toBeUndefined();
    expect(store.getState().profile?.health.footStatus).toBe('healthy');
    expect(host!.text()).not.toContain(CLINICAL_UNSAVED);
    expect(said(host!, 'Not kept. The health answers stored before stand.')).toBe(true);
    expect(focused.count).toBe(1);
  });
});

describe('a screen opened for a record another copy has since replaced (H5R-09, K5R-03)', () => {
  const replaceElsewhere = async () => {
    const { openDb } = await import('@/store/db');
    const { commitChange } = await import('@/store/snapshot');
    const tab = await openDb(fake);
    expect((await commitChange(tab, undefined, () => ({ change: { reset: true, schemaVersion: 6 } }))).ok).toBe(true);
    tab.close();
  };

  it('a setup page’s Next stores nothing into the new record', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { AboutName } = await import('./pages/about');
    host = render(createElement(PageFrame, { id: 'about.name', View: AboutName }));
    await host.settle();
    await host.change(host.field('Name (optional)'), { value: 'Old' });
    await replaceElsewhere();
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup?.draft).toBeUndefined();
    expect(router.navigate).not.toHaveBeenCalledWith('/setup/about/figure', undefined);
  });

  it('Me’s Save stores nothing into the new record', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'about' }));
    await host.settle();
    await host.change(host.field('Name (optional)'), { value: 'Old' });
    await replaceElsewhere();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().profile).toBeUndefined();
  });
});
