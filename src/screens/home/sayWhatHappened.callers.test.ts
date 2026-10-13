/**
 * "Say what happened" off the walk (journey §4.4, K6R-03, board D173),
 * driven through its real callers: the shared safety surface
 * (`UrgentProvider`, `UrgentBanner`), the check-in sheet that closes itself
 * first (`CheckInSheet`), the shared stop questions (`StopSheet`),
 * `useGuided().reportSymptoms` and the real store over a fake IndexedDB.
 * Replaced are only the router and the vendored sheet, which cannot run in
 * node and decide nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, useContext, useState, type ReactNode } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostNode } from '@/test/host';

vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => () => {},
    useSearchParams: () => [new URLSearchParams(), () => {}],
    useViewTransitionState: () => false,
    useLocation: () => ({ pathname: '/hub/walk', search: '', state: null, key: 'k0' }),
    Link: ({ to, children }: { to: string; children?: ReactNode }) => createElement('a', { href: `#${to}` }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, createContext, useContext: use } = await import('react');
  // Close closes, as the vendored sheet's does: through the sheet's own `onOpenChange`.
  const Closing = createContext<(open: boolean) => void>(() => {});
  return {
    Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children?: ReactNode }) =>
      (open ? createElement(Closing.Provider, { value: onOpenChange }, children) : null),
    // Where focus goes on closing, handed on for a test to ask (B-03).
    SheetContent: ({ children, finalFocus }: { children?: ReactNode; finalFocus?: unknown }) => createElement('div', { role: 'dialog', finalFocus }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => {
      const close = use(Closing);
      return createElement('button', { type: 'button', onClick: () => close(false) }, children);
    },
  };
});

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  // No #app root, so a sheet's inert background is a no-op, as it is before the app mounts.
  document: {
    title: '', visibilityState: 'visible', activeElement: null, addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 },
  },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  scrollTo() {},
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  ...(typeof globalThis.addEventListener === 'function' ? {} : { addEventListener() {}, removeEventListener() {} }),
  // A sheet hands focus back, then the next one opens.
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});

const store = await import('@/store/useStore');
const { useGuided } = await import('@/hooks/useGuided');
const { UrgentProvider } = await import('./UrgentBanner');
const { ScreenTopContext } = await import('@/components/hig/navigation');
const { Sheet } = await import('@/components/hig/Sheet');
const { CheckInSheet } = await import('@/components/checkin/CheckInSheet');
const { resetPendingCheckInsForTests, effectiveCheckIns } = await import('@/components/checkin/pending');
const { evaluateCheckIn, STOP_UNANSWERED } = await import('@/engine/readiness');
const { permission, PERMISSION_TEXT } = await import('@/engine/permission');
const { EMERGENCY_LABEL } = await import('@/components/checkin/copy');
const { default: WalkHub } = await import('@/screens/hub/WalkHub');
const { default: StretchHub } = await import('@/screens/hub/StretchHub');
const { default: WorkoutHub } = await import('@/screens/hub/WorkoutHub');
const { clinicalUnsaved, gateProfile, resetClinicalUnsavedForTests, saveClinical } = await import('@/setup/effective');
const { CLINICAL_UNSAVED } = await import('@/engine/readiness');
const { textOf } = await import('@/test/host');

const plain = createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } });
const DAY = '2026-10-09';
const day = (date: string, news: DailyCheckIn['news']): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news, sleep: 'gt7', energy: 4 });

let host: Host | undefined;
/** Whether the device refuses to store a check-in. */
let refuse = false;
let fake: ReturnType<typeof fakeIndexedDB>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 9, 9, 30));
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  refuse = false;
  fake = fakeIndexedDB({ failWrite: (_name, row) => (refuse && row.key === 'checkIns' ? new DOMException('Full', 'QuotaExceededError') : undefined) });
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
  resetClinicalUnsavedForTests();
});

async function seed(records: DailyCheckIn[]) {
  const recs = records.map((c, i) => ({ ...c, readiness: evaluateCheckIn(plain, c, records.slice(0, i)) }));
  await store.update(prev => ({ ...prev, profile: plain, checkIns: recs }));
}
/** Every movement, asked of what the device holds now. */
const held = () => {
  const all = effectiveCheckIns(store.getState().checkIns, plain);
  return (['guided', 'stretch', 'walk'] as const).map(mode =>
    permission({ profile: plain, checkIn: all.find(c => c.date === DAY), recent: all, now: new Date() }, mode).reasons.includes(STOP_UNANSWERED.reason));
};
const x = () => host!;
const dialogs = () => x().all().filter(n => n.props.role === 'dialog').length;
/** Every node under `root`. */
const inside = (root: HostNode): HostNode[] => root.children.flatMap(c => (typeof c === 'string' ? [] : [c, ...inside(c)]));

/** A screen, as the shell draws it: the shared surface first. */
function Screen() {
  return h('main', null, useContext(ScreenTopContext));
}

describe('"Say what happened" on the shared safety surface (journey §4.4, K6R-03)', () => {
  it('is the surface’s action for an unanswered stop, opens the stop’s own questions, and their answer releases every movement', async () => {
    await seed([day('2026-10-08', ['stopped']), day(DAY, [])]);
    expect(held()).toEqual([true, true, true]);
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    expect(x().text()).not.toContain('What to do');
    await x().click(x().button('Say what happened', { exact: true }));
    expect(x().text()).toContain('What’s happening?');
    // The walk it was said on has ended: nothing here to end.
    expect(x().buttons('End walk')).toHaveLength(0);
    await x().click(x().button('Just need a rest', { exact: true }));
    await x().settle();
    expect(held()).toEqual([false, false, false]);
    // Answered, the surface lets go and the questions close.
    expect(x().buttons('Say what happened', { exact: true })).toHaveLength(0);
    expect(dialogs()).toBe(0);
  });

  it('in a sheet, closes the sheet first and opens the questions once it has closed: sheets never stack', async () => {
    await seed([day(DAY, ['stopped'])]);
    function Open() {
      const [open, setOpen] = useState(true);
      return h(Sheet, { open, onOpenChange: setOpen, title: 'Add to Home', children: h('p', null, 'Choose a tile') });
    }
    host = render(h(UrgentProvider, null, h(Open)));
    await x().settle();
    await x().click(x().button('Say what happened', { exact: true }));
    expect(x().text()).not.toContain('Choose a tile');
    await x().settle();
    expect(x().text()).toContain('What’s happening?');
    expect(dialogs()).toBe(1);
  });

  /** What the stop's questions say, and nothing from the screen behind. */
  const asked = () => {
    const dialog = x().all().find(n => n.props.role === 'dialog');
    const text = (n: HostNode): string => n.children.map(c => (typeof c === 'string' ? c : text(c))).join(' ');
    return dialog ? text(dialog) : '';
  };

  it('says to get help now inside the questions the moment chest pain is said, while its answer is still being stored (H6F-01, board D212)', async () => {
    await seed([day(DAY, ['stopped'])]);
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    await x().click(x().button('Say what happened', { exact: true }));
    expect(asked()).not.toContain(PERMISSION_TEXT.emergencyTitle);
    // The stop's own surface is not drawn over its own questions.
    expect(asked()).not.toContain('Say what happened');
    fake.control.hold();
    await x().click(x().button(EMERGENCY_LABEL.chest, { exact: true }));
    await x().settle();
    expect(asked()).toContain('What’s happening?');
    expect(asked()).toContain(PERMISSION_TEXT.emergencyTitle);
    // Its way on waits for the answer to be stored, and says so, rather than closing over it (H6R-11).
    await x().click(x().button('What to do', { exact: true }));
    expect(asked()).toContain('Waiting for this to finish saving.');
    fake.control.release();
    await x().settle();
    expect(dialogs()).toBe(0);
  });

  it('and when the device refuses the answer, beside Try again, and while it is tried again (H6F-01, board D212)', async () => {
    await seed([day(DAY, ['stopped'])]);
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    await x().click(x().button('Say what happened', { exact: true }));
    refuse = true;
    await x().click(x().button(EMERGENCY_LABEL.chest, { exact: true }));
    await x().settle();
    expect(asked()).toContain('Your answer didn’t save.');
    expect(asked()).toContain(PERMISSION_TEXT.emergencyTitle);
    fake.control.hold();
    refuse = false;
    await x().click(x().button('Try again', { exact: true }));
    expect(asked()).toContain(PERMISSION_TEXT.emergencyTitle);
    fake.control.release();
    await x().settle();
    // Kept, the questions close, and the screen behind says it.
    expect(dialogs()).toBe(0);
    expect(x().text()).toContain(PERMISSION_TEXT.emergencyTitle);
  });

  it('hands focus to the screen’s title as it closes, the button that opened it having gone with the stop it answered (H6F-09, board D214)', async () => {
    await seed([day(DAY, ['stopped'])]);
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    await x().click(x().button('Say what happened', { exact: true }));
    const title = { focus() {} };
    const was = document.querySelector;
    document.querySelector = ((selector: string) => (selector === 'main h1' ? title : null)) as typeof document.querySelector;
    const dialog = x().all().find(n => n.props.role === 'dialog')!;
    expect((dialog.props.finalFocus as () => unknown)()).toBe(title);
    document.querySelector = was;
  });

  it('a hold that is not a stop keeps "What to do"', async () => {
    await seed([day(DAY, ['unwell'])]);
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    expect(x().text()).toContain('What to do');
    expect(x().buttons('Say what happened', { exact: true })).toHaveLength(0);
  });
});

describe('"Say what happened" in the check-in (journey §4.4, K6R-03)', () => {
  /** Whether the check-in's owner keeps it open when asked to close, as one still saving would. */
  const owner = { keeps: false };
  beforeEach(() => { owner.keeps = false; });
  function CheckIn() {
    const g = useGuided();
    const [open, setOpen] = useState(true);
    return h(CheckInSheet, { open, onOpenChange: (o: boolean) => { if (!owner.keeps) setOpen(o); }, profile: g.profile, date: g.date, initial: g.checkIn, onSave: g.saveCheckIn, recent: g.checkIns });
  }

  it('opens nothing over a check-in its owner keeps open, nor later when it closes: sheets never stack', async () => {
    await seed([day(DAY, ['stopped'])]);
    owner.keeps = true;
    host = render(h(UrgentProvider, null, h(CheckIn)));
    await x().settle();
    if (x().buttons('Change answers').length) await x().click(x().button('Change answers'));
    await x().click(x().button('Say what happened', { exact: true }));
    await x().settle();
    expect(x().text()).toContain('Anything else today?');
    expect(x().text()).not.toContain('What’s happening?');
    expect(dialogs()).toBe(1);
    // Closed later, for another reason: the questions do not open out of the blue.
    owner.keeps = false;
    await x().click(x().button('Close', { exact: true }));
    await x().settle();
    expect(dialogs()).toBe(0);
  });

  it('closes the check-in, then opens the stop’s own questions, whose answer releases the stop', async () => {
    await seed([day(DAY, ['stopped'])]);
    host = render(h(UrgentProvider, null, h(CheckIn)));
    await x().settle();
    if (x().buttons('Change answers').length) await x().click(x().button('Change answers'));
    await x().click(x().button('Say what happened', { exact: true }));
    expect(x().text()).not.toContain('Anything else today?');
    await x().settle();
    expect(x().text()).toContain('What’s happening?');
    expect(dialogs()).toBe(1);
    await x().click(x().button('Just need a rest', { exact: true }));
    await x().settle();
    expect(held()).toEqual([false, false, false]);
    expect(store.getState().checkIns.find(c => c.date === DAY)?.news).not.toContain('stopped');
  });
});

describe('"Say what happened" on every movement hub (journey §4.4, K6R-03)', () => {
  for (const [name, Hub] of [['Walk', WalkHub], ['Stretch', StretchHub], ['Workout', WorkoutHub]] as const) {
    it(`the ${name} hub's card opens the stop's own questions, whose answer releases the stop`, async () => {
      await seed([day(DAY, ['stopped'])]);
      host = render(h(UrgentProvider, null, h(Hub)));
      await x().settle();
      // The card's own, not the shared surface's at the top.
      const surface = new Set(x().all().filter(n => n.props['data-urgent-kind'] !== undefined).flatMap(inside));
      const card = x().buttons('Say what happened', { exact: true }).filter(b => !surface.has(b));
      expect(card).toHaveLength(1);
      await x().click(card[0]);
      expect(x().text()).toContain('What’s happening?');
      await x().click(x().button('Just need a rest', { exact: true }));
      await x().settle();
      expect(held()).toEqual([false, false, false]);
    });
  }
});

describe('the pause beside every safety decision on the shared surface (boards D197, D224)', () => {
  /** A finished record, with today's answers. */
  async function finished(news: DailyCheckIn['news'], over: Partial<DailyCheckIn> = {}) {
    const today = { ...day(DAY, news), ...over };
    expect((await store.update(prev => ({
      ...prev, profile: plain, settings: { ...prev.settings, onboardingComplete: true },
      checkIns: [{ ...today, readiness: evaluateCheckIn(plain, today) }],
    }))).ok).toBe(true);
  }
  /** A heart condition disclosed that the device refuses to store, saved as Me's editor saves a clinical answer. */
  async function refusedSave() {
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    const saved = await saveClinical(() => store.update(d => ({ ...d, profile: { ...d.profile!, health: { ...d.profile!.health, heartOrVascularDisease: true } } })));
    fake.control.setWriteError(undefined);
    expect([saved.ok, clinicalUnsaved()]).toEqual([false, true]);
  }
  /** Every movement, asked of what the device holds now, as every gate asks it. */
  const answers = () => {
    const state = store.getState();
    const profile = gateProfile(state);
    const all = effectiveCheckIns(state.checkIns, profile);
    return (['guided', 'stretch', 'walk'] as const).map(mode => permission({ profile, checkIn: all.find(c => c.date === DAY), recent: all, now: new Date() }, mode));
  };
  /** What a screen shows first, the shell's surface, top to bottom. */
  const surface = () => textOf(x().all().find(n => n.type === 'main')!.children);
  /** What the stop's own questions show. */
  const asked = () => textOf(x().all().find(n => n.props.role === 'dialog')?.children ?? []);

  it('a refused save and an unanswered stop: the surface says both, the stop first, and its “Say what happened” opens the stop’s questions', async () => {
    await finished(['stopped']);
    await refusedSave();
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    // The stop with its ask, then the pause with its own way out, never instead of the stop.
    const said = surface();
    expect(said).toContain('No exercise for now');
    expect(said.indexOf('Say what happened')).toBeGreaterThan(-1);
    expect(said.indexOf(CLINICAL_UNSAVED)).toBeGreaterThan(said.indexOf('Say what happened'));
    expect([x().buttons('Try again', { exact: true }).length, x().buttons('Discard changes', { exact: true }).length]).toEqual([1, 1]);
    // Every movement holds, saying the stop and then the pause, with what releases the stop, as without the pause.
    expect(answers().every(p => !p.allowed && p.reasons.includes(STOP_UNANSWERED.reason) && p.reasons.at(-1) === CLINICAL_UNSAVED)).toBe(true);
    expect(answers().map(p => [p.release, p.needsCheckIn])).toEqual(Array(3).fill([STOP_UNANSWERED.release, false]));
    await x().click(x().button('Say what happened', { exact: true }));
    expect(asked()).toContain('What’s happening?');
    // Over the stop's own questions, every other decision stands at their top: the pause (board D212).
    expect(asked()).toContain(CLINICAL_UNSAVED);
    await x().click(x().button('Just need a rest', { exact: true }));
    await x().settle();
    // The stop answered, its ask goes; the pause stays, and still holds every movement, saying that alone.
    expect(dialogs()).toBe(0);
    expect(x().buttons('Say what happened', { exact: true })).toHaveLength(0);
    expect(surface()).toContain(CLINICAL_UNSAVED);
    expect(answers().every(p => !p.allowed && p.reasons.join() === CLINICAL_UNSAVED)).toBe(true);
    // Its own way out: Discard changes, and the stored answers stand.
    await x().click(x().button('Discard changes', { exact: true }));
    await x().settle();
    expect(clinicalUnsaved()).toBe(false);
    expect(surface()).not.toContain(CLINICAL_UNSAVED);
    expect(answers().every(p => !p.reasons.includes(CLINICAL_UNSAVED))).toBe(true);
  });

  it('a refused save and advice today: the surface says both, the advice first; Try again refused says so, stored lets the pause go and the advice stay', async () => {
    await finished(['fainted']);
    await refusedSave();
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    const said = surface();
    expect(said).toContain('Get medical advice today');
    expect(said.indexOf(CLINICAL_UNSAVED)).toBeGreaterThan(said.indexOf('What to do'));
    expect(answers().every(p => p.disposition === 'today' && p.reasons.at(-1) === CLINICAL_UNSAVED)).toBe(true);
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    await x().click(x().button('Try again', { exact: true }));
    await x().settle();
    expect(surface()).toContain('That did not save.');
    expect(clinicalUnsaved()).toBe(true);
    fake.control.setWriteError(undefined);
    await x().click(x().button('Try again', { exact: true }));
    await x().settle();
    expect(clinicalUnsaved()).toBe(false);
    expect(store.getState().profile?.health.heartOrVascularDisease).toBe(true);
    expect(surface()).not.toContain(CLINICAL_UNSAVED);
    expect(surface()).toContain('Get medical advice today');
  });

  /** The surface's decisions, in the order it stacks them: each one's kind, and the pause as `unsaved`. */
  const stacked = () => x().all().find(n => n.type === 'main')!.children
    .flatMap(function sections(c): string[] {
      if (typeof c === 'string') return [];
      if (c.props['data-urgent-kind'] !== undefined) return [String(c.props['data-urgent-kind'])];
      if (c.props['data-urgent-pause'] !== undefined) return ['unsaved'];
      return c.children.flatMap(sections);
    });

  it('a stop and advice today: the surface lists both at once, the stop’s ask first, each with its own headline, time and safe action (board D224)', async () => {
    await finished(['stopped', 'fainted']);
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    expect(stacked()).toEqual(['hold', 'seekHelp']);
    // A screen reader hears both, once.
    const heard = textOf(x().all().find(n => n.props['aria-live'] === 'assertive')!.children);
    expect([heard.includes('No exercise for now'), heard.includes('Get medical advice today')]).toEqual([true, true]);
    const said = surface();
    expect(said.indexOf('No exercise for now')).toBeLessThan(said.indexOf('Say what happened'));
    expect(said.indexOf('Say what happened')).toBeLessThan(said.indexOf('No exercise today. Get medical advice today.'));
    expect(said.indexOf('No exercise today. Get medical advice today.')).toBeLessThan(said.indexOf('What to do'));
    expect(said.split('From today’s check-in')).toHaveLength(3);
    // The stop's own way on: its questions.
    await x().click(x().button('Say what happened', { exact: true }));
    expect(asked()).toContain('What’s happening?');
    // Over them, every other decision stands: the advice.
    expect(asked()).toContain('Get medical advice today');
    await x().click(x().button('Just need a rest', { exact: true }));
    await x().settle();
    expect(stacked()).toEqual(['seekHelp']);
  });

  it('a low and the pause: both stay, the low’s treatment first (board D224)', async () => {
    await finished(['lowSymptoms']);
    await refusedSave();
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    expect(stacked()).toEqual(['low', 'unsaved']);
    const said = surface();
    expect(said).toContain('Check your glucose now');
    expect(said).toContain('Feeling low today');
    // Each with its own way on: the low's to Home's Right now, the pause's Try again and Discard changes.
    expect(said.indexOf('What to do')).toBeGreaterThan(said.indexOf('Feeling low today'));
    expect(said.indexOf(CLINICAL_UNSAVED)).toBeGreaterThan(said.indexOf('What to do'));
    expect([x().buttons('Try again', { exact: true }).length, x().buttons('Discard changes', { exact: true }).length]).toEqual([1, 1]);
  });

  it('an emergency stands alone: call now, with nothing else, not a stop, advice today or the pause (board D224)', async () => {
    await finished(['stopped', 'fainted'], { urgentSymptoms: true, emergency: ['chest'] });
    await refusedSave();
    host = render(h(UrgentProvider, null, h(Screen)));
    await x().settle();
    expect(stacked()).toEqual(['emergency']);
    expect(surface()).toContain(PERMISSION_TEXT.emergencyTitle);
    for (const said of ['Say what happened', 'Get medical advice today', CLINICAL_UNSAVED]) expect(surface()).not.toContain(said);
  });

  it('in a full-screen task, each said once: what the task’s own screen draws steps aside, and the rest of the surface stays', async () => {
    const { OwnsUrgent, TaskUrgent } = await import('./UrgentBanner');
    const { SessionGate } = await import('@/components/checkin/SessionGate');
    await finished(['stopped']);
    await refusedSave();
    const [guided, , walk] = answers();
    /** The task's surface: its decision's section and its pause's, and every Try again on screen. */
    const drawn = async (screen: ReturnType<typeof h>) => {
      host?.unmount();
      host = render(h(UrgentProvider, null, h(TaskUrgent, null, screen)));
      await x().settle();
      const count = (attr: string) => x().all().filter(n => n.props[attr] !== undefined).length;
      return [count('data-urgent-kind'), count('data-urgent-pause'), x().buttons('Try again', { exact: true }).length];
    };
    // The session's gate draws the stop and the pause, with its own way out: nothing of the surface repeats them.
    expect(await drawn(h(SessionGate, { permission: guided, now: new Date(), onBack() {} }))).toEqual([0, 0, 1]);
    // A held walk draws the stop and says the pause, with no way out of it: the surface's pause stays.
    expect(await drawn(h('div', null, h(OwnsUrgent, { shows: walk }), h('p', null, 'This walk is on hold')))).toEqual([0, 1, 1]);
    // A gate still drawing an answer from before the stop, with the way out: the surface's stop stays.
    expect(await drawn(h(SessionGate, { permission: { ...guided, reasons: [CLINICAL_UNSAVED] }, now: new Date(), onBack() {} }))).toEqual([1, 0, 1]);
    // A screen that draws neither: the whole surface.
    expect(await drawn(h('p', null, 'Your walk'))).toEqual([1, 1, 1]);
  });

  it('in an open sheet, its way out keeps focus in the sheet as the pause goes (B-03)', async () => {
    await finished([]);
    await refusedSave();
    function Open() {
      return h(Sheet, { open: true, onOpenChange() {}, title: 'Add to Home', children: h('p', null, 'Choose a tile') });
    }
    host = render(h(UrgentProvider, null, h(Open)));
    await x().settle();
    const dialog = x().all().find(n => n.props.role === 'dialog')!;
    const body = inside(dialog).find(n => n.props.tabIndex === -1)!.element!;
    const pause = inside(dialog).find(n => n.props['data-urgent-pause'] !== undefined)!;
    // Where the strip sits: in the sheet's scrolling body, which a browser finds from it.
    Object.assign(pause.element!, { closest: (selector: string) => (selector === '[role="dialog"] [tabindex="-1"]' ? body : null) });
    let focused = 0;
    body.focus = () => void (focused += 1);
    await x().click(inside(dialog).find(n => n.type === 'button' && textOf(n.children) === 'Discard changes')!);
    await x().settle();
    expect([clinicalUnsaved(), asked().includes(CLINICAL_UNSAVED), focused]).toEqual([false, false, 1]);
  });

  it('in a full-screen task, a gate drawn with advice today and a stop says both; one drawn before the advice says only the stop', async () => {
    const { OwnsUrgent, TaskUrgent } = await import('./UrgentBanner');
    await finished(['stopped', 'fainted']);
    const [guided] = answers();
    expect(guided.disposition).toBe('today');
    const kinds = async (screen: ReturnType<typeof h>) => {
      host?.unmount();
      host = render(h(UrgentProvider, null, h(TaskUrgent, null, screen)));
      await x().settle();
      return x().all().filter(n => n.props['data-urgent-kind'] !== undefined).map(n => n.props['data-urgent-kind']);
    };
    expect(await kinds(h(OwnsUrgent, { shows: guided }))).toEqual([]);
    expect(await kinds(h(OwnsUrgent, { shows: { allowed: false, disposition: 'hold', reasons: [STOP_UNANSWERED.reason] } }))).toEqual(['seekHelp']);
    expect(await kinds(h('p', null, 'Your walk'))).toEqual(['hold', 'seekHelp']);
  });

  it('in an open sheet, a decision arriving beside the one standing there is brought into view', async () => {
    await finished(['stopped']);
    function Open() {
      return h(Sheet, { open: true, onOpenChange() {}, title: 'Add to Home', children: h('p', null, 'Choose a tile') });
    }
    host = render(h(UrgentProvider, null, h(Open)));
    await x().settle();
    const body = x().all().find(n => n.props.tabIndex === -1 && n.element)!.element!;
    body.scrollTop = 200;
    await finished(['stopped', 'fainted']);
    await x().settle();
    expect(asked()).toContain('Get medical advice today');
    expect(body.scrollTop).toBe(0);
  });

  it('in an open sheet, the pause arriving beside the decision standing there is brought into view', async () => {
    await finished(['stopped']);
    function Open() {
      return h(Sheet, { open: true, onOpenChange() {}, title: 'Add to Home', children: h('p', null, 'Choose a tile') });
    }
    host = render(h(UrgentProvider, null, h(Open)));
    await x().settle();
    // The sheet's scrolling body, scrolled down to its content.
    const body = x().all().find(n => n.props.tabIndex === -1 && n.element)!.element!;
    body.scrollTop = 200;
    await refusedSave();
    await x().settle();
    expect(asked()).toContain(CLINICAL_UNSAVED);
    expect(body.scrollTop).toBe(0);
  });

  for (const [name, Hub] of [['Walk', WalkHub], ['Stretch', StretchHub], ['Workout', WorkoutHub]] as const) {
    it(`a refused save and an unanswered stop: the ${name} hub’s card asks what happened, as it would without the pause`, async () => {
      await finished(['stopped']);
      await refusedSave();
      host = render(h(UrgentProvider, null, h(Hub)));
      await x().settle();
      // The card's own, not the shared surface's at the top.
      const shared = new Set(x().all().filter(n => n.props['data-urgent-kind'] !== undefined).flatMap(inside));
      const card = x().buttons('Say what happened', { exact: true }).filter(b => !shared.has(b));
      expect(card).toHaveLength(1);
      await x().click(card[0]);
      expect(asked()).toContain('What’s happening?');
    });
  }
});

describe('F-safety-06: the check-in opened on its questions keeps the shared decision in view (journey §4.3, §4.7, B-02)', () => {
  const insulin = createDefaultProfile({ health: {
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous',
    glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
  } });
  function CheckIn() {
    const g = useGuided();
    const [open, setOpen] = useState(true);
    return h(CheckInSheet, { open, onOpenChange: setOpen, profile: g.profile, date: g.date, initial: g.checkIn, onSave: g.saveCheckIn, recent: g.checkIns });
  }
  const kinds = () => x().all().filter(n => n.props['data-urgent-kind'] !== undefined).map(n => String(n.props['data-urgent-kind']));

  it('a 60 at 13:30, reopened at 13:36 for the re-check: the low, its time and the re-check stand above the questions', async () => {
    vi.setSystemTime(new Date(2026, 9, 9, 13, 30));
    const low: DailyCheckIn = { ...day(DAY, []), glucose: { value: 60, unit: 'mg/dL', measuredAt: new Date(2026, 9, 9, 13, 30).toISOString(), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: insulin, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...low, readiness: evaluateCheckIn(insulin, low) }] }));
    vi.setSystemTime(new Date(2026, 9, 9, 13, 36));
    host = render(h(UrgentProvider, null, h(CheckIn)));
    await x().settle();
    expect(x().text()).toContain('Right now, any of these?');
    expect(kinds()).toContain('recheck');
    const strip = x().all().find(n => n.props['data-urgent-kind'] === 'recheck')!;
    expect(textOf(strip.children)).toMatch(/Low glucose at .*· Re-check at/);
    // Re-checked at 13:46 and still low: the sheet's own outcome says the decision, and the surface steps aside.
    vi.setSystemTime(new Date(2026, 9, 9, 13, 46));
    await x().click(x().buttons('None of these', { exact: true })[0]);
    await x().change(x().field('Glucose reading'), { value: '62' });
    await x().click(x().button('See today’s plan'));
    await x().settle();
    expect(x().text()).not.toContain('Right now, any of these?');
    expect(kinds()).toEqual([]);
  });

  it('an emergency ticked on the questions is said once, by the sheet’s own banner', async () => {
    await store.update(prev => ({ ...prev, profile: insulin, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [] }));
    host = render(h(UrgentProvider, null, h(CheckIn)));
    await x().settle();
    expect(kinds()).toEqual([]);
    // While its save is on its way, the emergency's banner stands over the questions.
    fake.control.hold();
    await x().click(x().button(EMERGENCY_LABEL.chest));
    await x().settle();
    expect(x().text()).toContain('Right now, any of these?');
    expect(x().text()).toMatch(/Call/);
    expect(kinds()).toEqual([]);
    fake.control.release();
    await x().settle();
    expect(store.getState().checkIns.find(c => c.date === DAY)?.emergency).toContain('chest');
    expect(kinds()).toEqual([]);
  });
});
