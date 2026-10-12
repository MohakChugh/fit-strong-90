import fs from 'node:fs';
import path from 'node:path';
import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, type HostNode } from '@/test/host';

/**
 * The shell's own surfaces, as rendered: rows, groups, sheets, the storage
 * banner, the screen frame and the tab bar, plus the stylesheet, the icons
 * and the wiring other screens use (scan claude-scan-1-surface.md). Markup
 * is rendered on the server; the Back button and the tab bar run in the node
 * host, through their real handlers, against the real navigation stack.
 */

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/today', search: '', state: null as unknown, key: 'k0' },
}));
vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useLocation: () => router.location,
    useRouteError: () => undefined,
    // A plain anchor: router-only props (state, viewTransition) are not attributes.
    Link: ({ children, to, ...props }: { children?: ReactNode; to: string; [prop: string]: unknown }) => {
      const rest = Object.fromEntries(Object.entries(props).filter(([k]) => k !== 'state' && k !== 'viewTransition'));
      return createElement('a', { href: `#${to}`, 'data-to': to, ...rest }, children);
    },
  };
});
const notice = vi.hoisted(() => ({ current: undefined as undefined | { title: string; detail: string; tone: 'warning' | 'error' } }));
vi.mock('@/store/useStore', () => ({ useStorageNotice: () => notice.current }));
// The vendored dialog needs a DOM; these plain stand-ins keep the hig Sheet's own markup.
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement(Fragment, null, children) : null),
    SheetContent: ({ children, className }: { children?: ReactNode; className?: string }) => createElement('div', { 'data-slot': 'sheet-content', role: 'dialog', className }, children),
    SheetTitle: ({ children, className }: { children?: ReactNode; className?: string }) => createElement('h2', { className }, children),
    SheetClose: ({ children, className }: { children?: ReactNode; className?: string }) => createElement('button', { type: 'button', className }, children),
  };
});

const { Group, Row } = await import('./List');
const { Screen } = await import('./Screen');
const { Sheet } = await import('./Sheet');
const { StorageBanner, TaskFrame } = await import('./StorageBanner');
const { ErrorBoundary } = await import('./ErrorBoundary');
const { TabBar } = await import('./TabBar');
const { createSwipe, dragOffset, nextVelocity, releaseVelocity, shouldDismiss } = await import('./sheetGesture');
const nav = await import('./navigation');
const { SourceList, ClaimText } = await import('@/screens/guide/parts');
const { ChooserSheet } = await import('@/screens/today/ChooserSheet');
const { contextOf } = await import('@/content');
const { BAR_COLOR, themeColorFor } = await import('@/lib/themeColor');

const ROOT = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** The class attribute of the first element matching `tag` whose markup contains `marker`. */
const classOf = (markup: string, marker: RegExp) => markup.match(marker)?.[1] ?? '';

beforeEach(() => {
  nav.resetNavigationForTests();
  router.navigate.mockReset();
  router.location = { pathname: '/today', search: '', state: null, key: 'k0' };
  notice.current = undefined;
  Object.assign(globalThis, {
    document: { title: '', activeElement: null, documentElement: { dataset: {} } },
    window: Object.assign(globalThis.window ?? {}, { scrollTo: vi.fn(), matchMedia: () => ({ matches: false }) }),
  });
});
afterEach(() => vi.restoreAllMocks());

describe('rows at large text sizes (S-03)', () => {
  const markup = () => html(h(Row, { label: 'Vitamin B12', detail: 'You take metformin', value: '320 pg/mL', icon: h('svg'), chevron: true, onClick: () => {} }));

  it('lay themselves out by their own width: a container that stacks below 16 rem', () => {
    const m = markup();
    expect(classOf(m, /<button class="([^"]*)"/)).toMatch(/@container/);
    expect(m).toMatch(/class="flex min-h-\[3\.25rem\][^"]*@max-\[16rem\]:flex-wrap[^"]*@max-\[16rem\]:px-2/);
  });

  it('put the icon above the text and the value under it when stacked, rather than squeezing the label', () => {
    const m = markup();
    expect(m).toMatch(/size-7[^"]*@max-\[16rem\]:basis-full/);
    expect(m).toMatch(/max-w-\[50%\][^"]*@max-\[16rem\]:order-last[^"]*@max-\[16rem\]:basis-full/);
    // A text accessory or switch too wide to sit beside a 60% label goes under it too.
    expect(m).toMatch(/min-w-0 flex-1 @max-\[16rem\]:min-w-\[60%\]/);
  });

  it('keep whole words: break-word, never overflow-wrap anywhere', () => {
    const m = markup();
    expect(m).not.toContain('overflow-wrap:anywhere');
    expect(m.match(/\[overflow-wrap:break-word\]/g)).toHaveLength(3);
  });

  it('move a group’s header and footer in with its rows when they stack', () => {
    const m = html(h(Group, { header: 'For you', footer: 'General information, not medical advice.', children: h(Row, { label: 'A' }) }));
    expect(classOf(m, /<section class="([^"]*)"/)).toMatch(/@container/);
    expect(m).toMatch(/<h2 class="px-4[^"]*@max-\[16rem\]:px-2/);
    expect(m).toMatch(/<p class="px-4[^"]*@max-\[16rem\]:px-2/);
  });
});

describe('source rows (S-06)', () => {
  it('wrap long names clear of the arrow and halve their padding when narrow', () => {
    const cited = [{
      source: { id: 's', url: 'https://example.org', title: 'Physical Activity Guidelines Exercise/Physical', organisation: 'WHO', edition: '2020', licence: undefined },
      locators: ['Chapter 2'],
    }];
    const m = html(h(SourceList, { header: 'Sources', cited } as never));
    expect(m).toMatch(/<a href="https:\/\/example\.org"[^>]*class="@container/);
    const row = m.match(/<a href="https:\/\/example\.org"[\s\S]*?<\/a>/)![0];
    // The title and both lines under it.
    expect(row.match(/\[overflow-wrap:break-word\]/g)).toHaveLength(3);
    expect(m).toMatch(/@max-\[16rem\]:px-2/);
  });
});

describe('the tint is for things you can tap (S-23)', () => {
  it('marks a claim "For you" in the text’s own colour', () => {
    const shown = { claim: { id: 'c', statement: 'Eat more dal.', appliesTo: ['diabetes'] }, attached: [] };
    const m = html(h(ClaimText, { shown, ctx: contextOf(['diabetes']) } as never));
    expect(m).toContain('For you ·');
    expect(m).not.toContain('text-tint');
  });

  it('shows "Suggested" in the chooser in the label colour, not the action tint', () => {
    const rows = [{ id: 'stretch', label: 'Stretch', detail: 'Gentle mobility', to: '/move/stretch', mode: 'stretch', suggested: true }];
    const m = html(h(ChooserSheet, { open: true, onOpenChange: () => {}, rows, onChoose: () => {} } as never));
    expect(m).toMatch(/<span class="([^"]*)">Suggested<\/span>/);
    expect(classOf(m, /<span class="([^"]*)">Suggested<\/span>/)).not.toContain('text-tint');
  });

  it('shows a topic’s "For you" reason in the label colour', () => {
    expect(read('src/screens/guide/TopicScreen.tsx')).toMatch(/<span className="font-semibold text-foreground">For you ·/);
  });
});

describe('sheets (S-04, S-19)', () => {
  const sheet = () => html(h(Sheet, { open: true, onOpenChange: () => {}, title: 'What would help now?', children: h('p', null, 'Body') }));

  it('show the whole title: no clamp, and the bar grows with it', () => {
    const m = sheet();
    const title = classOf(m, /<h2 class="([^"]*)"/);
    expect(title).not.toMatch(/line-clamp|truncate/);
    expect(title).toContain('[overflow-wrap:break-word]');
    expect(m).toMatch(/class="flex min-h-11 items-center/);
    expect(m).not.toMatch(/class="relative flex h-11/);
  });

  it('keep Close in the flow, and stack it above a full-width title when the text is large', () => {
    const m = sheet();
    const close = classOf(m, /<button type="button" class="([^"]*)">Close<\/button>/);
    expect(close).not.toMatch(/\babsolute\b/);
    expect(close).toContain('@max-[16rem]:self-end');
    expect(m).toMatch(/@max-\[16rem\]:flex-col-reverse/);
    // A mirror of Close keeps the title centred while they share the bar.
    expect(m).toMatch(/<span aria-hidden="true" class="invisible[^"]*@max-\[16rem\]:hidden">Close<\/span>/);
  });

  it('make the grabber and the title bar a drag handle the browser will not scroll', () => {
    expect(sheet()).toMatch(/<div class="@container shrink-0 touch-none select-none border-b border-separator">/);
  });

  it('close on a long pull or a flick, and settle back otherwise', () => {
    const height = 520;
    expect(shouldDismiss({ distance: 40, velocity: 0.1, height })).toBe(false);
    expect(shouldDismiss({ distance: 160, velocity: 0, height })).toBe(true);
    expect(shouldDismiss({ distance: 60, velocity: 1.2, height })).toBe(true);
    expect(shouldDismiss({ distance: 10, velocity: 2, height })).toBe(false);
    expect(shouldDismiss({ distance: -30, velocity: 2, height })).toBe(false);
    // A tall sheet closes at 200 px, not at 30% of itself.
    expect(shouldDismiss({ distance: 210, velocity: 0, height: 860 })).toBe(true);
  });

  it('follow the finger down, barely give upward, and ignore a speed the finger then rested from', () => {
    expect(dragOffset(120)).toBe(120);
    expect(dragOffset(-60)).toBe(-10);
    expect(dragOffset(-600)).toBe(-16);
    expect(releaseVelocity(1.5, 40)).toBe(1.5);
    expect(releaseVelocity(1.5, 300)).toBe(0);
    expect(nextVelocity(0, 30, 20)).toBeCloseTo(1.2);
    expect(nextVelocity(0.5, 10, 0)).toBe(0.5);
  });
});

describe('a sheet that will not close yet (review C2-07)', () => {
  /** A sheet's panel and backdrop, as the drag sees them. */
  const target = () => ({
    panel: { style: { transform: '', transition: '' }, offsetHeight: 520 },
    backdrop: { style: { opacity: '', transition: '' } },
  });
  const swipeWith = (opts: { open: () => boolean; dismissible?: boolean }) => {
    const dismiss = vi.fn();
    const swipe = createSwipe({
      dismiss,
      isOpen: opts.open,
      dismissible: () => opts.dismissible ?? true,
      afterAnswer: run => run(),
    });
    return { swipe, dismiss };
  };
  const pull = (swipe: ReturnType<typeof createSwipe>, t: ReturnType<typeof target>, dy: number) => {
    swipe.start(1, 100, 0, t);
    swipe.move(1, 100 + dy / 2, 40);
    swipe.move(1, 100 + dy, 300);
    swipe.end(1, 100 + dy, 320);
  };

  it('asks first, and settles back in view when the sheet stays open, as one saving does', () => {
    const t = target();
    const { swipe, dismiss } = swipeWith({ open: () => true });
    pull(swipe, t, 300);
    expect(dismiss).toHaveBeenCalledTimes(1);
    // Not left off screen while it is still open, with the page behind it inert.
    expect(t.panel.style.transform).toBe('');
    expect(t.backdrop.style.opacity).toBe('');
    expect(t.panel.style.transition).toBe('');
  });

  it('slides away only once the sheet has said yes', () => {
    const t = target();
    let open = true;
    const swipe = createSwipe({ dismiss: () => { open = false; }, isOpen: () => open, dismissible: () => true, afterAnswer: run => run() });
    pull(swipe, t, 300);
    expect(t.panel.style.transform).toBe('translate3d(0, 100%, 0)');
    expect(t.backdrop.style.opacity).toBe('0');
  });

  it('resists, never asks, and settles back while the sheet says it cannot be dismissed', () => {
    const t = target();
    const { swipe, dismiss } = swipeWith({ open: () => true, dismissible: false });
    swipe.start(1, 100, 0, t);
    swipe.move(1, 400, 300);
    expect(t.panel.style.transform).toBe(`translate3d(0, ${dragOffset(300, false)}px, 0)`);
    expect(dragOffset(300, false)).toBeLessThanOrEqual(24);
    swipe.end(1, 400, 320);
    expect(dismiss).not.toHaveBeenCalled();
    expect(t.panel.style.transform).toBe('');
  });

  it('leaves a short pull alone: no question asked, and back where it was', () => {
    const t = target();
    const { swipe, dismiss } = swipeWith({ open: () => true });
    pull(swipe, t, 30);
    expect(dismiss).not.toHaveBeenCalled();
    expect(t.panel.style.transform).toBe('');
  });

  it('is told so by the sheets that refuse while they save', () => {
    expect(read('src/screens/you/RestoreFlow.tsx')).toMatch(/<Sheet open=\{open\} dismissible=\{!locked\}/);
    expect(read('src/screens/workout/sheets.tsx')).toMatch(/<Sheet open=\{open\} dismissible=\{!saving\}/);
    expect(read('src/screens/move/PlanScreen.tsx').match(/dismissible=\{!saving\}/g)).toHaveLength(2);
    expect(read('src/screens/you/FocusScreen.tsx')).toMatch(/<Sheet open=\{leaving\} dismissible=\{!busy\}/);
  });
});

describe('the storage notice in a screen’s header (S-01)', () => {
  const quota = { tone: 'error' as const, title: 'That did not save', detail: 'There is not enough space on this device to save that. Free some space, or export and remove older records.' };

  it('is one capped line that opens the details, never the whole explanation in the header', () => {
    notice.current = quota;
    const m = html(h(StorageBanner, { inHeader: true }));
    const button = classOf(m, /<button type="button" class="([^"]*)"/);
    expect(button).toMatch(/max-h-\[30dvh\]/);
    expect(m).toMatch(/class="line-clamp-2[^"]*">That did not save/);
    expect(m).toContain('>Details<');
    // The explanation is there for a screen reader, and only for it.
    expect(m).toMatch(/<span class="sr-only">\. There is not enough space/);
    expect(m.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '')).not.toContain('not enough space');
  });

  it('says all of it in place in a full-screen task, where it scrolls away with the task', () => {
    notice.current = quota;
    const m = html(h(TaskFrame, { children: h('p', null, 'Task') }));
    expect(m.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '')).toContain('not enough space');
  });
});

describe('a screen that failed to download (S-13)', () => {
  it('reloads on Try again, the only way to fetch it again, and offers no second reload button', () => {
    const state = ErrorBoundary.getDerivedStateFromError(new TypeError('Failed to fetch dynamically imported module: /assets/routes-a.js'));
    expect(state).toEqual({ failed: true, download: true });
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { ...state, key: undefined };
    const m = html(boundary.render() as never);
    expect(m).toContain('Try again');
    expect(m).not.toContain('Reload the app');
  });

  it('draws a screen that broke while drawing again on Try again, with a reload beside it', () => {
    const state = ErrorBoundary.getDerivedStateFromError(new TypeError('x is undefined'));
    expect(state).toEqual({ failed: true, download: false });
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { ...state, key: undefined };
    expect(html(boundary.render() as never)).toContain('Reload the app');
  });
});

describe('the screen frame', () => {
  it('shows the compact title as soon as the large one is under the bar: its sentinel follows the h1 (S-20)', () => {
    const m = html(h(Screen, { title: 'Today', subtitle: 'Thursday, 8 October', children: h('p', null, 'x') }));
    expect(m).toMatch(/<\/h1><div aria-hidden="true" class="h-px"><\/div><p class="[^"]*">Thursday, 8 October<\/p>/);
  });

  it('keeps whole words in the large title (S-03)', () => {
    const m = html(h(Screen, { title: 'Food & diabetes', children: null }));
    expect(classOf(m, /<h1 tabindex="-1" class="([^"]*)"/)).toContain('[overflow-wrap:break-word]');
  });

  it('grows its side margins with the text only up to 20px (S-03)', () => {
    const m = html(h(Screen, { title: 'Today', children: null }));
    expect(m.match(/pl-\[max\(min\(1rem,20px\),env\(safe-area-inset-left\)\)\]/g)).toHaveLength(2);
  });
});

/** The node host's tree: the header's Back button. */
const backButton = (nodes: HostNode[]) => nodes.find(n => n.type === 'button' && String(n.props['aria-label'] ?? '').startsWith('Back'));

describe('Back, driven through the screen’s own button (S-09, S-10, S-12, S-02)', () => {
  const at = (pathname: string, state: unknown = null, key = pathname) => ({ pathname, search: '', state, key });

  it('pops one entry to the screen below, named after it', async () => {
    nav.record(at('/today'), 'LAUNCH', 0);
    nav.setTitle('/today', 'Today');
    nav.markShown();
    nav.record(at('/track/metric/glucose', { path: '/today', label: 'Today' }), 'PUSH', 1);
    router.location = at('/track/metric/glucose', { path: '/today', label: 'Today' });
    const host = render(h(Screen, { title: 'Glucose', back: { to: '/today', label: 'Today' }, children: null }));
    const button = backButton(host.all())!;
    expect(button.props['aria-label']).toBe('Back to Today');
    await host.click(button);
    expect(router.navigate).toHaveBeenCalledWith(-1);
    // The screen took the navigation's focus request, on its own path.
    expect(nav.takeFocusRequest('/track/metric/glucose')).toBe(false);
  });

  it('with nothing to pop to, replaces this entry with the parent, keeping its real name', async () => {
    nav.record(at('/guide/card/card-dal'), 'LAUNCH', 0);
    router.location = at('/guide/card/card-dal');
    const host = render(h(Screen, { title: 'Dal, chana and rajma', back: { to: '/guide/topic/food-diabetes', label: 'Food & diabetes' }, children: null }));
    const button = backButton(host.all())!;
    expect(button.props['aria-label']).toBe('Back to Food & diabetes');
    await host.click(button);
    expect(router.navigate).toHaveBeenCalledWith('/guide/topic/food-diabetes', { replace: true, state: undefined });
    expect(nav.backPending()).toBe(true);
  });

  it('names a Guide card’s Back after the topic, not "Back" (the labels the Guide passes)', () => {
    for (const file of ['src/screens/guide/CardScreen.tsx', 'src/screens/guide/MealDetailScreen.tsx', 'src/screens/guide/SampleWeekScreen.tsx']) {
      expect(read(file), file).not.toMatch(/backLabel/);
    }
    expect(read('src/screens/guide/CardScreen.tsx')).toContain('label: home.title');
  });
});

describe('the tab bar (S-18)', () => {
  const at = (pathname: string, state: unknown = null, search = '') => ({ pathname, search, state, key: `${pathname}${search}` });
  const links = (nodes: HostNode[]) => nodes.filter(n => n.type === 'a');
  const click = (node: HostNode) => (node.props.onClick as (e: unknown) => void)({ button: 0, preventDefault() {}, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false });

  it('selects the tab a screen was opened in, and links every other tab to its place', () => {
    nav.record(at('/today'), 'LAUNCH', 0);
    nav.markTab('guide');
    nav.record(at('/guide', null, '?q=dal'), 'PUSH', 1);
    nav.record(at('/guide/card/card-dal'), 'PUSH', 2);
    nav.setTitle('/guide/card/card-dal', 'Dal, chana and rajma');
    nav.markTab('today');
    nav.record(at('/today'), 'PUSH', 3);
    nav.record(at('/track/metric/glucose', { path: '/today', label: 'Today' }), 'PUSH', 4);
    router.location = at('/track/metric/glucose', { path: '/today', label: 'Today' });
    const host = render(h(TabBar));
    const [today, , track, guide] = links(host.all());
    expect(today.props['aria-current']).toBe('page');
    expect(track.props['aria-current']).toBeUndefined();
    expect(guide.props['data-to']).toBe('/guide/card/card-dal');
    expect(track.props['data-to']).toBe('/track');
  });

  it('pops the selected tab to its root through its own entries, then scrolls to the top', () => {
    nav.record(at('/guide'), 'LAUNCH', 0);
    nav.record(at('/guide/topic/b12'), 'PUSH', 1);
    nav.record(at('/guide/card/card-b12-food'), 'PUSH', 2);
    router.location = at('/guide/card/card-b12-food');
    let host = render(h(TabBar));
    click(links(host.all())[3]);
    expect(router.navigate).toHaveBeenCalledWith(-2);

    nav.record(at('/guide'), 'POP', 0);
    router.location = at('/guide');
    host = render(h(TabBar));
    click(links(host.all())[3]);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

describe('a tab never reopens a record that has gone (acceptance J18)', () => {
  const at = (pathname: string) => ({ pathname, search: '', state: null, key: pathname });
  const click = (node: HostNode) => {
    let prevented = false;
    (node.props.onClick as (e: unknown) => void)({ button: 0, preventDefault() { prevented = true; }, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false });
    return prevented;
  };

  it('asks again at the tap, and opens the root when the place’s record went after the bar drew', () => {
    nav.record(at('/track'), 'LAUNCH', 0);
    nav.record(at('/track/workout/w1'), 'PUSH', 1);
    nav.setTitle('/track/workout/w1', 'Workout');
    nav.markTab('today');
    nav.record(at('/today'), 'PUSH', 2);
    router.location = at('/today');
    const host = render(h(TabBar));
    const track = host.all().filter(n => n.type === 'a')[2];
    expect(track.props['data-to']).toBe('/track/workout/w1');
    nav.setPlaceCheck(() => false);
    expect(click(track)).toBe(true);
    // Its root, as it was left.
    expect(router.navigate).toHaveBeenCalledWith('/track', { state: { restoreScroll: '/track' } });
  });

  it('is wired: the app checks places against the stored record, and forgets them all when nothing is set up', () => {
    expect(read('src/main.tsx')).toContain('setPlaceCheck(place => placeExists(place.pathname, getState()))');
    expect(read('src/App.tsx')).toMatch(/if \(!settings\.onboardingComplete\) forgetPlaces\(\);\s*\}, \[status, settings\.onboardingComplete\]\);/);
  });
});

describe('wiring that names the opener (S-10, S-11)', () => {
  it('Today’s Glucose, Blood pressure and plan rows name Today', () => {
    const today = read('src/screens/today/TodayScreen.tsx');
    expect(today).toContain("const FROM_TODAY = { path: '/today', label: 'Today' };");
    // Opened on every reading, so the one on the row always shows (scan J2-08).
    expect(today).toMatch(/to="\/track\/metric\/glucose\?group=all" state=\{FROM_TODAY\}/);
    expect(today).toMatch(/to="\/track\/metric\/bloodPressure" state=\{FROM_TODAY\}/);
    expect(today).toMatch(/to=\{HREF\.plan\}\s+state=\{FROM_TODAY\}/);
  });

  it('a related card and a related exercise name the screen they were opened from', () => {
    expect(read('src/screens/guide/CardScreen.tsx')).toContain('state={{ path: `/guide/card/${from.id}`, label: from.title }}');
    expect(read('src/screens/move/ExerciseScreen.tsx')).toContain('state={{ from: origin, path: location.pathname, label: ex.name }}');
  });
});

describe('the stylesheet', () => {
  const css = read('src/index.css');

  it('scales input text with the text size, never under 16px, and lets a field’s own class win (S-05)', () => {
    expect(css).not.toMatch(/font-size:\s*16px\s*!important/);
    expect(css).toMatch(/@layer base \{\s*input:not\(\[type="checkbox"\], \[type="radio"\], \[type="range"\], \[type="file"\]\), textarea, select \{\s*font-size: max\(16px, var\(--text-body\)\);/);
    expect(read('src/components/ui/input.tsx')).not.toContain('md:text-sm');
  });

  it('has no global smooth scrolling, so a pushed screen appears at its top at once (S-16)', () => {
    expect(css).not.toMatch(/\*\s*\{\s*scroll-behavior:\s*smooth/);
  });

  it('gives native controls the app’s scheme, not only the device’s (S-17)', () => {
    expect(css).toMatch(/:root \{ color-scheme: light; \}\s*:root\.dark \{ color-scheme: dark; \}/);
  });

  it('plays Back as the mirror of a push, over one steady background (S-24)', () => {
    expect(css).toMatch(/::view-transition-group\(root\) \{\s*background-color: var\(--grouped-bg\);/);
    expect(css).toMatch(/::view-transition-old\(root\),\s*::view-transition-new\(root\) \{\s*mix-blend-mode: normal;/);
    expect(css).toMatch(/::view-transition-new\(root\) \{\s*animation: fs-nav-in-trailing/);
    expect(css).toMatch(/:root\[data-nav="back"\]::view-transition-new\(root\) \{\s*animation-name: fs-nav-in-leading;/);
    expect(css).toMatch(/:root\[data-nav="back"\]::view-transition-old\(root\) \{\s*animation-name: fs-nav-fade-out, fs-nav-out-trailing;/);
    expect(css).toMatch(/@keyframes fs-nav-in-trailing \{\s*from \{ opacity: 0; transform: translate3d\(1\.75rem, 0, 0\); \}/);
    expect(css).toMatch(/@keyframes fs-nav-in-leading \{\s*from \{ opacity: 0; transform: translate3d\(-1\.75rem, 0, 0\); \}/);
    // The leaving screen is gone before the new one is more than faint.
    expect(css).toMatch(/::view-transition-old\(root\) \{\s*animation: fs-nav-fade-out 0\.1s linear both/);
    expect(css).toMatch(/fs-nav-in-trailing 0\.3s var\(--ease-out-quart\) 0\.07s both/);
  });

  it('puts text on the safety red at 4.5:1 or better in both themes (S-07)', () => {
    const values = (name: string) => [...css.matchAll(new RegExp(`--${name}: oklch\\(([^)]+)\\)`, 'g'))].map(m => m[1].split(/\s+/).map(Number));
    const [fillLight, fillDark] = values('safety');
    const [textLight, textDark] = values('on-safety');
    expect(contrast(textLight, fillLight)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(textDark, fillDark)).toBeGreaterThanOrEqual(4.5);
    // White on the dark-mode red was the failure.
    expect(contrast([1, 0, 0], fillDark)).toBeLessThan(3);
    expect(read('src/components/motion/FormDemo.tsx')).toContain("bg-[var(--safety)] text-[var(--on-safety)]");
    expect(read('src/components/motion/MotionView.tsx')).toMatch(/bg-\[var\(--safety\)\][^"]*text-\[var\(--on-safety\)\]/);
  });
});

describe('toasts', () => {
  it('sit clear of the tab bar and the home indicator, and of nothing beside the sidebar', () => {
    const main = read('src/main.tsx');
    expect(main).toContain("offset={{ bottom: 'var(--toast-offset-bottom)' }}");
    expect(main).toContain("mobileOffset={{ bottom: 'var(--toast-offset-bottom)' }}");
    const css = read('src/index.css');
    // The tab bar is 3.0625rem tall (TabBar.tsx), over the home indicator.
    expect(css).toContain(':root { --toast-offset-bottom: calc(3.0625rem + env(safe-area-inset-bottom, 0px) + 0.5rem); }');
    expect(read('src/components/hig/TabBar.tsx')).toContain('h-[3.0625rem]');
    expect(css).toMatch(/@media \(min-width: 64rem\) \{\s*:root \{ --toast-offset-bottom: 1\.5rem; \}/);
  });
});

describe('the bars follow the app’s theme (S-17)', () => {
  it('keeps the device-keyed colours while the app follows the device, and both say a chosen theme', () => {
    expect(themeColorFor('system', '(prefers-color-scheme: dark)')).toBe(BAR_COLOR.dark);
    expect(themeColorFor('system', '(prefers-color-scheme: light)')).toBe(BAR_COLOR.light);
    expect(themeColorFor('dark', '(prefers-color-scheme: light)')).toBe(BAR_COLOR.dark);
    expect(themeColorFor('light', '(prefers-color-scheme: dark)')).toBe(BAR_COLOR.light);
  });

  it('starts from the same colours in index.html, its first-paint script and the manifest', () => {
    const index = read('index.html');
    expect(index).toContain(`media="(prefers-color-scheme: light)" content="${BAR_COLOR.light}"`);
    expect(index).toContain(`media="(prefers-color-scheme: dark)" content="${BAR_COLOR.dark}"`);
    expect(index).toContain(`dark ? '${BAR_COLOR.dark}' : '${BAR_COLOR.light}'`);
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect([manifest.theme_color, manifest.background_color]).toEqual([BAR_COLOR.light, BAR_COLOR.light]);
  });
});

describe('Home Screen icons (S-22)', () => {
  const size = (file: string) => {
    const png = fs.readFileSync(path.join(ROOT, 'public', file));
    expect(png.subarray(1, 4).toString('ascii'), file).toBe('PNG');
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };

  it('ships PNGs at 180, 192 and 512, with a maskable one', () => {
    expect(size('apple-touch-icon.png')).toEqual([180, 180]);
    expect(size('pwa-192x192.png')).toEqual([192, 192]);
    expect(size('pwa-512x512.png')).toEqual([512, 512]);
    expect(size('pwa-maskable-512x512.png')).toEqual([512, 512]);
  });

  it('names them in index.html and the manifest', () => {
    expect(read('index.html')).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/fit-strong-90/apple-touch-icon.png" />');
    const icons: { src: string; type: string; purpose: string }[] = JSON.parse(read('public/manifest.webmanifest')).icons;
    expect(icons.filter(i => i.type === 'image/png').map(i => `${i.src} ${i.purpose}`)).toEqual([
      'pwa-192x192.png any', 'pwa-512x512.png any', 'pwa-maskable-512x512.png maskable',
    ]);
  });
});

/** WCAG contrast of two OKLCH colours ([L, C, h]), clipped into sRGB as the browser draws them. */
function contrast(a: number[], b: number[]): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function luminance([L, C, hue]: number[]): number {
  const a = C * Math.cos((hue * Math.PI) / 180);
  const b = C * Math.sin((hue * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const [r, g, bl] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(v => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}
