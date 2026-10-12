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
