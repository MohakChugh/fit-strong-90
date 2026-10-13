/**
 * Walk and stand-up reminders under every hold on movement (board D224),
 * driven through their real caller: `ReminderHost`, its real runner and
 * banner, under the shell's `UrgentProvider`, over the real store, gate and a
 * fake IndexedDB. Replaced are only the router, the vendored sheet and the
 * browser's globals, which cannot run in node and decide nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import type { AppData } from '@/types';
import type { DailyCheckIn } from '@/types/checkin';
import type { HabitSettings } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host } from '@/test/host';

vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => () => {},
    useSearchParams: () => [new URLSearchParams(), () => {}],
    useViewTransitionState: () => false,
    // A tab screen, where a waiting reminder shows above the tab bar.
    useLocation: () => ({ pathname: '/trends', search: '', state: null, key: 'k0' }),
    Link: ({ to, children }: { to: string; children?: ReactNode }) => createElement('a', { href: `#${to}` }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement } = await import('react');
  const pass = ({ children }: { children?: ReactNode }) => createElement('div', null, children);
  return { Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement('div', null, children) : null), SheetContent: pass, SheetTitle: pass, SheetClose: pass };
});

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
/** The page's own listeners, so the test can bring the app back into view as the browser would. */
const listeners = new Map<string, Set<() => void>>();
const listen = (type: string, f: () => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(f);
const unlisten = (type: string, f: () => void) => void listeners.get(type)?.delete(f);
Object.assign(globalThis, {
  window: globalThis,
  addEventListener: listen,
  removeEventListener: unlisten,
  document: {
    title: '', visibilityState: 'visible', activeElement: null, addEventListener: listen, removeEventListener: unlisten,
    getElementById: () => null, querySelector: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 },
  },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});
/** The icon's badge, the count of reminders waiting (`showBadge`). */
const badge = { count: 0 };
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true, setAppBadge: (n: number) => Promise.resolve(void (badge.count = n)), clearAppBadge: () => Promise.resolve(void (badge.count = 0)) },
});

const store = await import('@/store/useStore');
const { UrgentProvider } = await import('@/screens/home/UrgentBanner');
const { ReminderHost } = await import('./ReminderHost');
const { clearReminders } = await import('./pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { resetClinicalUnsavedForTests, saveClinical } = await import('@/setup/effective');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { lookedAround } = await import('@/setup/assemble');

const DAY = '2026-10-10';
const at = (hour: number, minute: number) => new Date(2026, 9, 10, hour, minute);
/** A walk after lunch, at 1 pm, and a stand-up every hour from noon: both come due at 1 pm. */
const HABITS: HabitSettings = {
  mealWalk: { enabled: true, meals: ['lunch'], finish: { lunch: '13:00' } },
  sittingBreak: { enabled: true, everyMinutes: 60, from: '12:00', to: '14:00' },
};
const KNOWN = { medicinesReviewed: true, bpMedicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } as const;
const plain = createDefaultProfile({ health: { ...KNOWN, diabetes: 'none' } });
/** Someone on insulin, who can go low: a change to the phone's clock holds them until a reading taken since (B-19). */
const onInsulin = createDefaultProfile({ health: { ...KNOWN, diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', fluidRestriction: false } });
const today = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
/** A reading at 12:50, fresh at 1 pm. */
const READING = { value: 140, unit: 'mg/dL' as const, measuredAt: at(12, 50).toISOString(), source: 'meter' as const };

let host: Host | undefined;
let fake: ReturnType<typeof fakeIndexedDB>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(12, 55));
  local.clear();
  listeners.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  resetClinicalUnsavedForTests();
  clearReminders();
  badge.count = 0;
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
  resetClinicalUnsavedForTests();
  clearReminders();
});

/** A finished record with the habits on, and today's check-in when there is one. */
async function seed(profile: UserProfile, checkIn?: DailyCheckIn, finish: (d: AppData) => AppData = d => d) {
  expect((await store.update(prev => finish({
    ...prev, profile, settings: { ...prev.settings, onboardingComplete: true, habits: HABITS },
    checkIns: checkIn ? [{ ...checkIn, readiness: evaluateCheckIn(profile, checkIn) }] : [],
  }))).ok).toBe(true);
}
/** A clinical answer the device refuses to store, saved as Me's editor saves one (board D197). */
async function refusedSave() {
  fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
  expect((await saveClinical(() => store.update(d => ({ ...d, profile: { ...d.profile!, health: { ...d.profile!.health, heartOrVascularDisease: true } } })))).ok).toBe(false);
  fake.control.setWriteError(undefined);
}

/** The app open from 12:55, back in view at 1:01 pm: the reminder the host delivers, as its banner shows it, and the icon's count. */
async function delivered(): Promise<{ shown: string[]; badge: number }> {
  host = render(h(UrgentProvider, null, h(ReminderHost)));
  await host.settle();
  vi.setSystemTime(at(13, 1));
  for (const wake of [...listeners.get('focus') ?? []]) wake();
  await host.settle();
  return { shown: host.all().filter(n => n.props['aria-label'] === 'Reminder').map(n => textOf(n.children)), badge: badge.count };
}
const WALK = 'A short walk after lunch?';
const STAND = 'Time to stand up for a few minutes';

describe('walk and stand-up reminders stay quiet under any hold on movement (board D224)', () => {
  it('with nothing held, one comes due and is delivered, before today’s check-in too: a check-in still to give holds nothing back', async () => {
    await seed(plain);
    const { shown, badge: waiting } = await delivered();
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatch(new RegExp(`${WALK}|${STAND}`));
    expect(waiting).toBe(2);
  });

  it('on insulin with a fresh reading, too', async () => {
    await seed(onInsulin, today({ glucose: READING }));
    expect(await delivered()).toMatchObject({ shown: [expect.stringMatching(new RegExp(`${WALK}|${STAND}`))], badge: 2 });
  });

  const holds: [string, () => Promise<void>][] = [
    ['the walk’s own gate holding: a foot to protect today', () => seed(plain, today({ news: ['footProblem'] }))],
    ['a refused clinical save (the pause)', async () => { await seed(plain, today()); await refusedSave(); }],
    ['an unanswered stop', () => seed(plain, today({ news: ['stopped'] }))],
    ['an unanswered stop beside the pause', async () => { await seed(plain, today({ news: ['stopped'] })); await refusedSave(); }],
    ['a change to the phone’s clock', async () => {
      await seed(onInsulin, today({ glucose: READING }));
      expect((await store.markClockChange([DAY])).ok).toBe(true);
    }],
    ['setup unfinished (Look around first)', () => seed(plain, today(), lookedAround)],
  ];
  for (const [kind, hold] of holds) {
    it(`under ${kind}, neither is delivered`, async () => {
      await hold();
      // Held back, not answered: nothing shows, and the icon counts nothing.
      expect(await delivered()).toEqual({ shown: [], badge: 0 });
    });
  }
});
