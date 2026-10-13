/**
 * Kiro's final review of the player and its gate (FK-01 to FK-04), driven
 * through the real callers: `SessionPage`, its `Player` and `SessionGate`,
 * `useGuidedSession` and the real store. Replaced, as in
 * `session.callers.test.ts`, are only what cannot run in node and decides
 * nothing: audio, the 3D figure, the router, and two styled primitives.
 *
 * - FK-01: every control says what it does in a visible word (§20.4 rule 2, B-08).
 * - FK-02: the gate says Home, not v1's Today, in the mode's own words, with Check in its main way on.
 * - FK-03: the leave dialog and the start screen's note say Home.
 * - FK-04: nothing meaningful under 13 px (§20.4 rule 12).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), navigate: vi.fn(), below: undefined as string | undefined }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useSearchParams: () => [router.params], useNavigate: () => router.navigate, useLocation: () => ({ pathname: '/session', search: '', state: null }),
    Link: ({ children, to, onClick }: { children?: unknown; to: string; onClick?: () => void }) => h('a', { href: `#${to}`, onClick }, children as never),
  };
});
// The screen the session was opened from, if the app saw one: none after a fresh launch.
vi.mock('@/components/hig/navigation', async importOriginal => ({ ...await importOriginal<typeof import('@/components/hig/navigation')>(), cameFrom: () => router.below }));
vi.mock('@/components/session/FigureSlot', () => ({ FigureSlot: () => null }));
vi.mock('@/components/session/InfoSheet', () => ({ InfoSheet: () => null }));
vi.mock('@/voice/clips', () => ({ loadManifest: async () => null, primeAudio: async () => true, ClipNarrator: class {} }));
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {} }) }));
vi.mock('@/components/ui/button', async () => {
  const { createElement: h } = await import('react');
  return {
    Button: ({ children, onClick, disabled, className, ...rest }: { children?: unknown; onClick?: () => void; disabled?: boolean; className?: string; 'aria-label'?: string }) =>
      h('button', { type: 'button', onClick, disabled, className, 'aria-label': rest['aria-label'] }, children as never),
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

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  location: { href: 'http://localhost/' },
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} }, body: { nodeType: 1 } },
  Audio: class { play() { return Promise.resolve(); } pause() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});
Object.defineProperty(globalThis.navigator, 'mediaSession', {
  configurable: true,
  value: { setActionHandler() {}, metadata: null, playbackState: 'none' },
});

const store = await import('@/store/useStore');
const { default: SessionPage } = await import('./SessionPage');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const BACK = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: true }, health: { ...known, diabetes: 'type2', metformin: true } } satisfies ProfileInput;
const START = '2026-09-28';
const DAY = '2026-10-09';
const clock = (h: number, m = 0, d = 9) => vi.setSystemTime(new Date(2026, 9, d, h, m, 0));

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  router.params = new URLSearchParams();
  router.navigate = vi.fn();
  router.below = undefined;
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
  await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, startDate: START, onboardingComplete: true }, checkIns: recs }));
}
async function mount(query = '') {
  host?.unmount();
  router.params = new URLSearchParams(query);
  host = render(createElement(SessionPage));
  await host.settle();
  return host;
}
const h = () => host!;
/** What a control shows, its accessible name aside: the words a person reads on it. */
const shown = (n: HostNode) => textOf(n.children);
/** The button whose accessible name is exactly `name`, as VoiceOver and the acceptance suite find it. */
function named(name: string): HostNode {
  const found = h().all().filter(n => n.type === 'button' && String(n.props['aria-label'] ?? shown(n)).trim() === name);
  expect(found, `one button named “${name}”`).toHaveLength(1);
  return found[0];
}

describe('kiro FK-01: every control on the player shows a word for what it does (journey §20.4 rule 2, B-08)', () => {
  it('the start screen’s Back, then Previous, Add 15 s, Pause, Next, Mute, How to do it and End session, each with its word, named as before', async () => {
    await seed(createDefaultProfile(BACK), [ci()]);
    await mount();
    expect(shown(named('Back'))).toBe('Back');
    await h().click(named('Start'));
    const words: [string, string][] = [
      ['Previous', 'Previous'], ['Add 15 seconds', 'Add 15 s'], ['Pause', 'Pause'], ['Next', 'Next'],
      ['Mute voice', 'Mute'], ['How to do it', 'How to do it'], ['End session', 'End'],
    ];
    for (const [name, word] of words) expect(shown(named(name)), name).toBe(word);
    // Paused, the same control says Resume, and a muted voice says Unmute.
    await h().click(named('Pause'));
    expect(shown(named('Resume'))).toBe('Resume');
    await h().click(named('Mute voice'));
    expect(shown(named('Unmute voice'))).toBe('Unmute');
  });

  it('a set’s steppers show Less and More beside − and +, named for what they change', async () => {
    await seed(createDefaultProfile(BACK), [ci()]);
    await mount();
    await h().click(named('Start'));
    const steppers = () => h().all().filter(n => n.type === 'button' && /^(Less|More) /.test(String(n.props['aria-label'] ?? '')));
    for (let i = 0; i < 80 && steppers().length === 0; i++) await h().click(named('Next'));
    expect(steppers().length).toBeGreaterThan(0);
    for (const b of steppers()) expect(shown(b), String(b.props['aria-label'])).toBe(String(b.props['aria-label']).split(' ')[0]);
  });
});

/** Tailwind's sizes under 13 px: 12 px and below. */
const SMALL = /(^|\s)text-(xs|2xs|\[(?:[0-9]|1[0-2])px\]|\[0?\.[0-7]\d*rem\])(\s|$)/;
/** Every node carrying words whose own class, or an ancestor's, sets a size under 13 px. */
function smallText(list: Host['tree'], inherited = false): string[] {
  return list.flatMap(c => {
    if (typeof c === 'string') return inherited && c.trim() ? [c.trim()] : [];
    const small = SMALL.test(String(c.props.className ?? '')) || (inherited && !/(^|\s)text-(\[length:|sm|base|lg|xl|\dxl)/.test(String(c.props.className ?? '')));
    return smallText(c.children, small);
  });
}

describe('kiro FK-04: nothing meaningful on the player is under 13 px (journey §20.4 rule 12)', () => {
  it('the start screen’s kind and safety line, the block and step count, the timer ring’s label and the controls’ words', async () => {
    await seed(createDefaultProfile(BACK), [ci()]);
    await mount();
    expect(h().text()).toMatch(/Stop and get help for chest pain/);
    expect(smallText(h().tree)).toEqual([]);
    await h().click(named('Start'));
    expect(smallText(h().tree)).toEqual([]);
    // A step counted within its block: "Mobility · 2 of 6".
    for (let i = 0; i < 20 && !/ · \d+ of \d+/.test(h().text()); i++) await h().click(named('Next'));
    expect(h().text()).toMatch(/ · \d+ of \d+/);
    expect(smallText(h().tree)).toEqual([]);
    // A rest after a set: "Log the set you just did".
    for (let i = 0; i < 80 && !/Log the set you just did/.test(h().text()); i++) await h().click(named('Next'));
    expect(h().text()).toMatch(/Log the set you just did/);
    expect(smallText(h().tree)).toEqual([]);
  });

  it('no size under 13 px is left in the player’s files, for the states a test can’t reach: the voice notices, the side chip', () => {
    for (const file of ['src/pages/SessionPage.tsx', 'src/components/session/parts.tsx']) {
      const lines = readFileSync(file, 'utf8').split('\n').filter(l => SMALL.test(l.replace(/className=|["'`{}]/g, ' ')));
      expect(lines, file).toEqual([]);
    }
  });
});
