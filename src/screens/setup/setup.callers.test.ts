/**
 * Me's chapter editor, driven through its real caller: `ChapterEditor` with
 * the real store and its real Save. Only the router and the browser's globals
 * are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostChild, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ navigate: vi.fn(), state: null as unknown }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: '/me/profile', search: '?chapter=health', state: router.state }),
    useSearchParams: () => [new URLSearchParams('chapter=health')],
    Link: ({ children, to, onClick }: { children?: unknown; to: string; onClick?: () => void }) => h('a', { href: `#${to}`, onClick }, children as never),
  };
});
vi.mock('@/components/hig/navigation', async importOriginal => ({ ...await importOriginal<typeof import('@/components/hig/navigation')>(), cameFrom: () => false }));
// What each move asks the draft to store, passed through to the real one.
const saves = vi.hoisted(() => [] as unknown[][]);
vi.mock('@/setup/draft', async importOriginal => {
  const real = await importOriginal<typeof import('@/setup/draft')>();
  return { ...real, saveDraft: (...args: Parameters<typeof real.saveDraft>) => { saves.push(args); return real.saveDraft(...args); } };
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
  document: { title: '', activeElement: null, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } }, body: { nodeType: 1 } },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  // What base-ui's floating parts ask of a node.
  Element: class {}, HTMLElement: class {},
});

const store = await import('@/store/useStore');
const { ChapterEditor } = await import('./ChapterEditor');
const { completedSetup } = await import('@/setup/assemble');
const { gateProfile, resetPendingEditsForTests } = await import('@/setup/effective');
const { FOOT_WOUND, MINIMAL } = await import('@/setup/fixtures');
const { resetSetupSessionForTests } = await import('@/setup/draft');

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
  saves.length = 0;
  local.clear();
  store.resetForTests();
  resetSetupSessionForTests();
  resetPendingEditsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
});

const footStatus = () => ({ stored: store.getState().profile?.health.footStatus, gate: gateProfile(store.getState()).health.footStatus });

describe('a clinical edit in Me (H5-08; board D162)', () => {
  it('releases a hold only once its write is stored', async () => {
    expect((await store.update(d => completedSetup(d, FOOT_WOUND, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    // The wound has healed.
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'No'));
    fake.control.hold();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    // Still being written: walks stay held, on screen and at every gate.
    expect(footStatus()).toEqual({ stored: 'current_wound_or_active_charcot', gate: 'current_wound_or_active_charcot' });
    fake.control.release();
    await host.settle();
    expect(footStatus()).toEqual({ stored: 'healthy', gate: 'healthy' });
  });

  it('a stricter answer counts from the tap, and keeps counting if its write is refused', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(host.button(/^Foot problems: numbness, a wound or an ulcer/));
    await host.settle();
    await host.click(radio(host, 'Numbness or loss of feeling in your feet?', 'Yes'));
    await host.click(radio(host, 'A wound, an ulcer, or a hot, swollen foot (Charcot foot)?', 'Yes, now'));
    await host.click(radio(host, 'Has a doctor or nurse (clinician) told you to keep weight off a foot?', 'No'));
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(footStatus()).toEqual({ stored: 'healthy', gate: 'current_wound_or_active_charcot' });
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
  it('a Next hands the draft what its page opened with, so only its own changes are stored (H5-12)', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { AboutName } = await import('./pages/about');
    host = render(createElement(PageFrame, { id: 'about.name', View: AboutName }));
    await host.settle();
    await host.change(host.field('Name (optional)'), { value: 'Kai' });
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect(saves).toHaveLength(1);
    const [to, answers, from, opened] = saves[0] as [string, { name?: string }, string, { name?: string }];
    expect([to, answers.name, from]).toEqual(['about.figure', 'Kai', 'about.name']);
    expect(opened).toBeDefined();
    expect(opened.name).toBeUndefined();
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
    expect(store.getState().settings.setup?.draft).toBeUndefined();
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
    expect(saves).toHaveLength(0);
    expect(host.text()).toContain('Tick your allergies, or “No food allergies”.');
    await host.click(host.button('No food allergies', { exact: true }));
    await host.click(host.button('Next', { exact: true }));
    await host.settle();
    expect((saves[0] as [string, { allergies?: unknown }])[1].allergies).toEqual([]);
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
      const shown = render(createElement(PAGE_VIEWS[id], { a, set: () => {}, tried: false, ctx: { thisYear: 2026 }, mode: 'setup' }));
      await shown.settle();
      const text = shown.text();
      shown.unmount();
      for (const term of terms) expect(bare(text), `${id}: “${term}” before its plain words`).not.toContain(term);
    }
  });
});
