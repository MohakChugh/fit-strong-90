import fs from 'node:fs';
import path from 'node:path';
import { createElement as h, useState, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, textOf, type HostNode } from '@/test/host';
import type { SheetExit } from './navigation';
import { contrast } from '@/design/contrast';

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
const { RecommendationCard } = await import('@/screens/today/RecommendationCard');
const { contextOf } = await import('@/content');
const { BAR_COLOR, themeColorFor } = await import('@/lib/themeColor');
const { ScreenLoading } = await import('./AppShell');
const { OwnsUrgent, UrgentBanner } = await import('@/screens/home/UrgentBanner');
const { UrgentContext } = await import('@/screens/home/urgent');

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
    expect(read('src/screens/you/ProgrammeGroup.tsx')).toMatch(/<Sheet open=\{leaving\} dismissible=\{!busy\}/);
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

  it('names Back after a screen’s name, not the title it shows: Home shows its greeting and is called Home (journey §8.1)', () => {
    nav.record(at('/home'), 'LAUNCH', 0);
    router.location = at('/home');
    const home = render(h(Screen, { title: 'Good morning', navTitle: 'Home', children: null }));
    expect(home.all().find(n => n.type === 'h1')?.children).toEqual(['Good morning']);
    home.unmount();
    nav.markShown();
    // The chooser's Stretch row: the setup's own parent is Move, and the row names no opener.
    nav.record(at('/hub/stretch'), 'PUSH', 1);
    router.location = at('/hub/stretch');
    const host = render(h(Screen, { title: 'Stretch', back: { to: '/move', label: 'Move' }, children: null }));
    expect(backButton(host.all())!.props['aria-label']).toBe('Back to Home');
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
    nav.record(at('/home'), 'LAUNCH', 0);
    nav.markTab('browse');
    nav.record(at('/browse', null, '?q=dal'), 'PUSH', 1);
    nav.record(at('/hub/learn/card/card-dal'), 'PUSH', 2);
    nav.setTitle('/hub/learn/card/card-dal', 'Dal, chana and rajma');
    nav.markTab('home');
    nav.record(at('/home'), 'PUSH', 3);
    nav.record(at('/trends/glucose', { path: '/home', label: 'Home' }), 'PUSH', 4);
    router.location = at('/trends/glucose', { path: '/home', label: 'Home' });
    const host = render(h(TabBar));
    const [home, trends, browse] = links(host.all());
    expect(home.props['aria-current']).toBe('page');
    expect(trends.props['aria-current']).toBeUndefined();
    expect(browse.props['data-to']).toBe('/hub/learn/card/card-dal');
    expect(trends.props['data-to']).toBe('/trends');
  });

  it('pops the selected tab to its root through its own entries, then scrolls to the top', () => {
    nav.record(at('/browse'), 'LAUNCH', 0);
    nav.record(at('/hub/learn/topic/b12'), 'PUSH', 1);
    nav.record(at('/hub/learn/card/card-b12-food'), 'PUSH', 2);
    router.location = at('/hub/learn/card/card-b12-food');
    let host = render(h(TabBar));
    click(links(host.all())[2]);
    expect(router.navigate).toHaveBeenCalledWith(-2);

    nav.record(at('/browse'), 'POP', 0);
    router.location = at('/browse');
    host = render(h(TabBar));
    click(links(host.all())[2]);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

describe('the tab bar’s selection slides (motion M5, kiro KV-19)', () => {
  const at = (pathname: string) => ({ pathname, search: '', state: null, key: pathname });
  const indicator = (nodes: HostNode[]) => nodes.find(n => n.props['data-tab-selection'] !== undefined);

  it('one tinted selection, moved under the tapped tab by a transform, with spring-quick', () => {
    nav.record(at('/trends'), 'LAUNCH', 0);
    router.location = at('/trends');
    const host = render(h(TabBar));
    const pill = indicator(host.all())!;
    expect(pill).toBeDefined();
    expect(pill.props['aria-hidden']).toBe(true);
    const style = pill.props.style as { transform: string; transition: string };
    expect(style.transform).toBe('translateX(100%)');
    expect(style.transition).toMatch(/^transform \d+ms linear\(/);
    // On a phone the links have no fill of their own; the sidebar keeps its own.
    const links = host.all().filter(n => n.type === 'a');
    expect(String(links[1].props.className)).not.toMatch(/(^|\s)bg-tint\/15/);
    expect(String(links[1].props.className)).toContain('lg:bg-tint/15');
  });

  it('jumps under Reduce motion', () => {
    (document.documentElement.dataset as Record<string, string>).reduceMotion = '';
    nav.record(at('/me'), 'LAUNCH', 0);
    router.location = at('/me');
    const pill = indicator(render(h(TabBar)).all())!;
    expect((pill.props.style as { transform: string; transition: string })).toEqual({ transform: 'translateX(300%)', transition: 'none' });
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
    nav.record(at('/trends'), 'LAUNCH', 0);
    nav.record(at('/track/workout/w1'), 'PUSH', 1);
    nav.setTitle('/track/workout/w1', 'Workout');
    nav.markTab('home');
    nav.record(at('/home'), 'PUSH', 2);
    router.location = at('/home');
    const host = render(h(TabBar));
    const trends = host.all().filter(n => n.type === 'a')[1];
    expect(trends.props['data-to']).toBe('/track/workout/w1');
    nav.setPlaceCheck(() => false);
    expect(click(trends)).toBe(true);
    // Its root, as it was left.
    expect(router.navigate).toHaveBeenCalledWith('/trends', { state: { restoreScroll: '/trends' } });
  });

  it('is wired: the app checks places against the stored record, and forgets them all when nothing is set up', () => {
    expect(read('src/main.tsx')).toContain('setPlaceCheck(place => placeExists(place.pathname, getState()))');
    expect(read('src/App.tsx')).toMatch(/if \(!settings\.onboardingComplete\) forgetPlaces\(\);\s*\}, \[status, settings\.onboardingComplete\]\);/);
  });
});

describe('wiring that names the opener (S-10, S-11)', () => {
  it('Home’s tiles and its Today’s log row name Home (v1 Today’s reading and plan rows became tiles)', () => {
    expect(read('src/screens/home/model.ts')).toContain("export const FROM_HOME = { path: '/home', label: 'Home' };");
    // Glucose opens on every reading, so the one on the tile always shows (scan J2-08): see tileHref.
    expect(read('src/screens/home/Tile.tsx')).toMatch(/to=\{href\}\s+state=\{FROM_HOME\}/);
    expect(read('src/screens/home/HomeScreen.tsx')).toMatch(/to=\{HREF\.day\} state=\{FROM_HOME\}/);
  });

  it('Home is called Home on the stack, so what it opens without naming it (the chooser, Right now, the check-in’s start) goes Back to "Home" (journey §8.1)', () => {
    expect(read('src/screens/home/HomeScreen.tsx')).toMatch(/<Screen\s+title=\{greeting\([\s\S]*?\)\}\s+navTitle=\{FROM_HOME\.label\}/);
  });

  it('a tile selects no text while it is pressed and held for its menu, nor shows the system callout (M18, kiro KV-20)', () => {
    expect(read('src/screens/home/Tile.tsx')).toMatch(/className="block h-full select-none rounded-2xl \[-webkit-touch-callout:none\]"/);
  });

  it('a row into a movement screen that opens on its refusal skips the transition, asked at the tap (codex V1-05)', () => {
    // Browse asks the gate in `held`, which each category row calls at the tap.
    expect(read('src/screens/browse/BrowseScreen.tsx')).toMatch(/const held = \(id: CategoryId\) => \{\s*const \{ mode \} = categoryById\(id\);\s*return mode !== undefined && opensOnHold\(gateFor\(guided, mode\)\);/);
    expect(read('src/screens/browse/BrowseList.tsx')).toContain('onClick={() => { if (held(id)) skipNextTransition(); }}');
    // The Workout hub has no rows into Stretch or Walk: its "Stretch instead" is offered only while the stretch gate is open
    // (`movementCard`), so the Stretch hub never opens on its refusal from there.
    // Home's tiles ask the permission, not their line's tone.
    expect(read('src/screens/home/HomeScreen.tsx')).toMatch(/const opensOnHoldNow = \(id: CategoryId\) => \{\s*const \{ mode \} = categoryById\(id\);\s*return mode !== undefined && opensOnHold\(permissionFor\(mode\)\);/);
  });

  it('a reminder that invites movement is held back while a safety decision stands, on Home and in the floating banner (kiro KV-09)', () => {
    expect(read('src/screens/home/HomeScreen.tsx')).toContain('const waiting = offeredNow(usePending(), urgent !== undefined);');
    expect(read('src/reminders/ReminderHost.tsx')).toMatch(/offeredNow\(pending\.filter\(p => stillDue\(p\.occurrence, now, current\)\), urgent\)/);
  });

  it('Home’s reading tiles show each last reading with its day, worked out with the day’s figures (kiro KV-17)', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toContain('last: lastReadings(observations, today, prefs),');
    expect(home).toMatch(/readingLine\(id, \{ \.\.\.\(glucose \? \{ glucose \} : \{\}\), \.\.\.\(pressure \? \{ pressure \} : \{\}\), last \}\)/);
  });

  it('Home’s movement tiles know whether the person is in the programme, so a flare names no programme on the Workout tile (D35, J16 step 1)', () => {
    expect(read('src/screens/home/HomeScreen.tsx')).toMatch(/movementLine\(\{\s+mode, permission, status, enrolled,/);
  });

  it('a hub with nothing to pop to goes Back to Home, and a Workout page to its hub at its own address (codex V1-09)', () => {
    // A hub is framed by HubFrame, whose Back is HUB_BACK, Home (frame.test.ts).
    expect(read('src/screens/hub/HubFrame.tsx')).toContain('back={HUB_BACK}');
    for (const file of ['src/screens/hub/WorkoutHub.tsx', 'src/screens/hub/StretchHub.tsx', 'src/screens/hub/WalkHub.tsx']) expect(read(file), file).toMatch(/<HubFrame category=\{category\}/);
    for (const file of ['src/screens/move/PlanScreen.tsx', 'src/screens/move/ExercisesScreen.tsx']) {
      expect(read(file), file).toContain("back={{ to: '/hub/workout', label: 'Workout' }}");
    }
    // The Workout Log, at its own address in the hub (B-14, D51).
    expect(read('src/screens/workout/TodayWorkoutScreen.tsx')).toContain("back={{ to: '/hub/workout', label: 'Workout' }}");
    for (const file of ['src/screens/hub/StretchHub.tsx', 'src/screens/hub/WalkHub.tsx', 'src/screens/move/PlanScreen.tsx', 'src/screens/move/ExercisesScreen.tsx']) {
      expect(read(file), file).not.toContain("to: '/move'");
    }
  });

  it('the Walk hub carries a walk on only through status at the tap, then the gate, whose sheet it renders (codex H2-01, journey §4.1, §4.8)', () => {
    const hub = read('src/screens/hub/WalkHub.tsx');
    const pending = hub.slice(hub.indexOf('  if (pending) {'), hub.indexOf("held={card.state === 'held'"));
    expect(pending).toMatch(/start: \(mode, href, label\) => \{ if \(resumeAllowed\(statusNow\(\), 'walk'\)\) g\.start\(mode, href, label\); \}/);
    expect(pending).toContain('{g.sheet}');
    expect(pending).not.toMatch(/navigate\(pending\.href/);
  });

  it('a hub’s Continue describes the run as the player will run it, from one reconciliation (codex H2-02, B-30)', () => {
    for (const file of ['src/screens/hub/StretchHub.tsx', 'src/screens/hub/WorkoutHub.tsx']) {
      const src = read(file);
      expect(src, file).toMatch(/carriedOn\(saved, \{ data, checkIns, checkIn, profile, date, todayPlan/);
      expect(src, file).not.toMatch(/minutesLeft\(saved\)/);
    }
    const stretch = read('src/screens/hub/StretchHub.tsx');
    expect(stretch).toContain('const listed = resume ? { ...plan, steps: resume.left } : plan;');
    expect(stretch).toContain('return { spec, minutesLeft: run.minutesLeft, label: saved.plan.label, href: resumeHref(saved), left: run.left };');
    expect(stretch).toContain('saved: { minutesLeft: resume.minutesLeft, label: resume.label }');
    expect(read('src/screens/hub/WorkoutHub.tsx')).toContain('saved: { minutesLeft: leftOf(saved, guided, now), label: saved.plan.label }');
    // The player reconciles with the same dose and back checks.
    const player = read('src/pages/SessionPage.tsx');
    expect(player).toContain('todayDose(plan, { data, checkIns, checkIn, profile, date, todayPlan, spec })');
    expect(player).toContain("import { todayDose, withBackChecks } from '@/session/carryOn';");
  });

  it('a stretch the builder can’t make keeps its choices on screen, with a way to them, and isn’t kept in the address (kiro KH-01)', () => {
    const hub = read('src/screens/hub/StretchHub.tsx');
    expect(hub).toContain('const offering = offersRoutines(card.state);');
    expect(hub).toContain('local: chooseAnother,');
    expect(hub).toMatch(/const chooseAnother = \(\) => \{\s+const radio = document\.getElementById\(AREA_ID\)\?\.querySelector<HTMLElement>\('\[role="radio"\]\[aria-checked="true"\]'\);\s+radio\?\.scrollIntoView\(\{ block: 'center' \}\);\s+radio\?\.focus\(\);/);
    expect(hub).toContain('<div id={AREA_ID} className="contents">');
    expect(hub).toContain("const letGo = useRef(chosen && card.state === 'unbuildable');");
    expect(hub).toMatch(/if \(!letGo\.current\) return;\s+letGo\.current = false;\s+setParams\(new URLSearchParams\(\), \{ replace: true, preventScrollReset: true \}\);/);
    // A saved run is held to its own steps when nothing new can be built, as the player holds it.
    expect(hub).toContain("plan.kind === 'none' && g.permission.allowed && !resume ? { blocked:");
  });

  it('the walk summary, a full-screen task, can be left by Back, keeping the walk to save (codex V1-08, journey §20.4 rule 10)', () => {
    // Back, like Done, returns to where the walk was started: the Walk hub, or Home (motion M12, Plan 6).
    const summary = read('src/screens/walk/WalkSummary.tsx');
    expect(summary).toContain("const origin = walk.plan.from ?? '/home';");
    expect(summary).toContain("<Screen title=\"Your walk\" back={{ to: origin, label: origin === '/hub/walk' ? 'Walk' : 'Home' }}>");
  });

  it('a related card and a related exercise name the screen they were opened from', () => {
    expect(read('src/screens/guide/CardScreen.tsx')).toContain('state={{ path: `/hub/learn/card/${from.id}`, label: from.title }}');
    expect(read('src/screens/move/ExerciseScreen.tsx')).toContain('state={{ from: origin, path: location.pathname, label: ex.name }}');
  });

  it('Me’s Sources row opens Learn’s sources at their own address, not v1’s Guide through a redirect (Plan 2’s board note)', () => {
    const me = read('src/screens/you/MeHome.tsx');
    expect(me).toContain('<Row as={Link} to="/hub/learn/sources" viewTransition label="Sources and licences" chevron />');
    expect(me).not.toMatch(/to="\/guide/);
  });
});

describe('the safety surface wherever the person is (codex V1-02, V1-03, journey §4.7, B-02)', () => {
  const banner = h('section', { 'data-urgent-kind': 'emergency' }, 'Call emergency services now');
  const CHEST = 'Chest pain or pressure: call emergency services now.';
  const emergency = { kind: 'emergency', tone: 'stop', headline: 'Call emergency services now', when: 'Emergency answer today', reasons: [CHEST] } as const;
  const surfaces = (nodes: HostNode[]) => nodes.filter(n => n.props['data-urgent-kind'] !== undefined).length;
  const task = (urgent: typeof emergency | { kind: 'low' }, child: ReactNode) =>
    h(UrgentContext, { value: urgent as never }, h(nav.ScreenTopContext, { value: banner }, h(TaskFrame, null, child)));
  /** The gate's answers a task's own screen may draw. */
  const callNow = { allowed: false, disposition: 'emergency', reasons: [CHEST] } as const;
  const checkInFirst = { allowed: false, disposition: 'hold', reasons: ['Check in first, so today’s movement fits how you are.'] } as const;

  it('shows while a screen’s code is still loading', () => {
    const m = html(h(nav.ScreenTopContext, { value: banner }, h(ScreenLoading)));
    expect(m).toContain('data-urgent-kind="emergency"');
    expect(m).toContain('aria-busy="true"');
  });

  it('shows above "This screen didn’t load"', () => {
    const state = ErrorBoundary.getDerivedStateFromError(new TypeError('Failed to fetch dynamically imported module: /assets/a.js'));
    const boundary = new ErrorBoundary({ children: null, before: banner });
    boundary.state = { ...state, key: undefined };
    expect(html(boundary.render() as never)).toMatch(/data-urgent-kind="emergency"[\s\S]*This screen didn’t load/);
  });

  it('is owned once, above the routes, their loading and their failures; the shell only shows it', () => {
    expect(read('src/App.tsx')).toMatch(/<UrgentProvider>[\s\S]*<Suspense fallback=\{<ScreenLoading full \/>\}>\s*<AppRoutes/);
    const shell = read('src/components/hig/AppShell.tsx');
    expect(shell).not.toContain('<UrgentProvider>');
    expect(shell).toMatch(/<ErrorBoundary resetKey=\{pathname\} before=\{first\}>\s*<Suspense fallback=\{<ScreenLoading \/>\}>/);
  });

  it('is at the top of a full-screen task, once: a screen inside the task does not repeat it', () => {
    const host = render(task(emergency, h(Screen, { title: 'Your walk', children: null })));
    expect(surfaces(host.all())).toBe(1);
  });

  it('steps aside only while the task’s own screen draws the decision standing now (codex W-01)', () => {
    expect(surfaces(render(task(emergency, h(OwnsUrgent, { shows: callNow }))).all())).toBe(0);
    // A session opened before any check-in, its refusal still drawn, while an emergency is answered elsewhere: the surface stays.
    expect(surfaces(render(task(emergency, h(OwnsUrgent, { shows: checkInFirst }))).all())).toBe(1);
    // An emergency drawn earlier, for another reason, is not this one.
    expect(surfaces(render(task(emergency, h(OwnsUrgent, { shows: { ...callNow, reasons: ['Glucose over 600 mg/dL.'] } }))).all())).toBe(1);
    // A claim on a screen that has gone lets go.
    const host = render(task(emergency, h(OwnsUrgent, { shows: callNow })));
    host.update(task(emergency, null));
    expect(surfaces(host.all())).toBe(1);
  });

  it('follows what the task’s screen draws as it changes: a refusal drawn again as it stands now claims the new decision', () => {
    const host = render(task(emergency, h(OwnsUrgent, { shows: checkInFirst })));
    expect(surfaces(host.all())).toBe(1);
    host.update(task(emergency, h(OwnsUrgent, { shows: callNow })));
    expect(surfaces(host.all())).toBe(0);
    host.update(task(emergency, h(OwnsUrgent, { shows: checkInFirst })));
    expect(surfaces(host.all())).toBe(1);
  });

  it('the session’s gate and reading screens, and the live walk, claim what they draw; the walk summary’s guidance for how it ended claims nothing', () => {
    expect(read('src/components/checkin/SessionGate.tsx')).toContain('<OwnsUrgent shows={permission} />');
    const session = read('src/pages/SessionPage.tsx');
    // No claim for every kind, nor one for a decision the page does not draw.
    expect(session).not.toMatch(/<OwnsUrgent \/>|\{halt && <OwnsUrgent/);
    // Only the reading screen, which draws the decision with its timed re-check; not the check-in asked here, nor the done summary's strip.
    expect(session.match(/<OwnsUrgent shows=\{drawnHere\((permission|guidance)\)\} \/>/g)).toEqual(['<OwnsUrgent shows={drawnHere(permission)} />']);
    expect(session).toMatch(/\{permission && <OwnsUrgent shows=\{drawnHere\(permission\)\} \/>\}\s*\{permission\?\.reasons\.slice\(0, 2\)/);
    expect(read('src/screens/walk/LiveWalkScreen.tsx')).toMatch(/\{refusal && <OwnsUrgent shows=\{refusal\} \/>\}/);
    expect(read('src/screens/walk/WalkSummary.tsx')).not.toContain('OwnsUrgent');
  });

  it('is at the top of every sheet, and its way on closes the sheet first', async () => {
    // The page a sheet makes inert, as the app's index.html has it.
    Object.assign(document, { getElementById: () => null });
    const onOpenChange = vi.fn();
    const top = { key: 'emergency', draw: (exit: SheetExit) => h('button', { type: 'button', 'data-urgent-kind': 'emergency', onClick: () => exit.leave(() => {}) }, 'What to do') };
    const host = render(h(nav.SheetTopContext, { value: top }, h(Sheet, { open: true, onOpenChange, title: 'Add to Home', children: h('p', null, 'Choose a tile') })));
    const surface = host.all().find(n => n.props['data-urgent-kind'] !== undefined)!;
    expect(surface).toBeDefined();
    await host.click(surface);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // The check-in sheet shows today's outcome itself.
    const own = render(h(nav.SheetTopContext, { value: top }, h(Sheet, { open: true, onOpenChange, title: 'Check-in', ownsUrgent: true, children: null })));
    expect(surfaces(own.all())).toBe(0);
    expect(read('src/components/checkin/CheckInSheet.tsx')).toMatch(/<Sheet open=\{props\.open\} onOpenChange=\{props\.onOpenChange\} title="Check-in" detent="large" ownsUrgent>/);
  });

  it('brings a decision arriving, or changing, into view in a sheet scrolled down, heading first, keeping the form under it (codex W-02)', () => {
    Object.assign(document, { getElementById: () => null });
    let mounts = 0;
    function Draft() {
      const [n] = useState(() => ++mounts);
      return h('p', null, `Draft ${n}`);
    }
    const strip = (key: string, words: string) => ({ key, draw: () => h('section', { 'data-urgent-kind': 'emergency' }, words) });
    const sheet = (top: { key: string; draw: () => ReactNode } | null, ownsUrgent = false) =>
      h(nav.SheetTopContext, { value: top }, h(Sheet, { open: true, onOpenChange: () => {}, title: 'Add to Home', detent: 'large', ownsUrgent, children: h(Draft) }));
    const host = render(sheet(null));
    const body = host.all().find(n => n.props.tabIndex === -1)!.element!;
    body.scrollTop = 640;
    // A re-check is due while the person reads far down the sheet.
    host.update(sheet(strip('recheck|Re-check your glucose|Low glucose at 1:30 pm', 'Re-check at 1:45 pm')));
    expect(surfaces(host.all())).toBe(1);
    expect(body.scrollTop).toBe(0);
    // Reading on while it stands: nothing pulls the person back up, its time coming due included.
    body.scrollTop = 300;
    host.update(sheet(strip('recheck|Re-check your glucose|Low glucose at 1:30 pm', 'Re-check now')));
    expect(host.text()).toContain('Re-check now');
    expect(body.scrollTop).toBe(300);
    // It escalates: an emergency is answered on another screen. Into view again.
    host.update(sheet(strip('emergency|Call emergency services now|Emergency answer today', 'Call emergency services now')));
    expect(body.scrollTop).toBe(0);
    // The form under it was never drawn again from scratch.
    expect(host.text()).toContain('Draft 1');
    expect(mounts).toBe(1);
    // The check-in sheet draws its own outcome, where it is.
    body.scrollTop = 200;
    host.update(sheet(strip('seekHelp|No exercise today. Get medical advice today.|Low glucose at 9:05 am', 'Something else'), true));
    expect(body.scrollTop).toBe(200);
  });

  describe('its way on from a sheet goes only once the sheet has closed (codex W-05)', () => {
    const urgent = { kind: 'emergency', tone: 'stop', headline: 'Call emergency services now', when: 'Emergency answer today', reasons: [] } as const;
    const WAITING = 'Waiting for this to finish saving.';
    const raf = globalThis.requestAnimationFrame;
    beforeEach(() => {
      Object.assign(document, { getElementById: () => null });
      Object.assign(globalThis, { requestAnimationFrame: (f: () => void) => setTimeout(f, 0) });
      router.location = { pathname: '/hub/workout', search: '', state: null, key: 'k1' };
    });
    afterEach(() => Object.assign(globalThis, { requestAnimationFrame: raf }));
    const surface = { key: 'emergency|Call emergency services now|Emergency answer today', draw: (exit: SheetExit) => h(UrgentBanner, { urgent, exit }) };
    /** The announcement a screen reader hears, in the page from the start. */
    const live = (host: ReturnType<typeof render>) => host.all().find(n => n.props['aria-live'] === 'polite');
    /** "Finish workout": it refuses closing while it saves, and closes once the save is stored. */
    function Finish({ saving, saved = false }: { saving: boolean; saved?: boolean }) {
      const [open, setOpen] = useState(true);
      return h(nav.SheetTopContext, { value: surface },
        h(Sheet, { open: open && !saved, dismissible: !saving, onOpenChange: (o: boolean) => { if (!saving) setOpen(o); }, title: 'Finish workout', children: h('p', null, saving ? 'Saving…' : 'Save workout') }));
    }

    it('while the sheet saves, What to do waits, and says so; the save goes on, and once stored and closed it goes Home', async () => {
      const host = render(h(Finish, { saving: true }));
      expect(live(host)).toBeDefined();
      await host.click(host.button('What to do'));
      await host.settle();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(host.text()).toContain(WAITING);
      expect(textOf(live(host)!.children)).toBe(WAITING);
      expect(host.text()).toContain('Saving…');
      host.update(h(Finish, { saving: false, saved: true }));
      await host.settle();
      expect(router.navigate).toHaveBeenCalledWith('/home');
    });

    it('a save that fails keeps the person with its result, and What to do is theirs to tap again', async () => {
      const host = render(h(Finish, { saving: true }));
      await host.click(host.button('What to do'));
      // The save failed: the sheet can close again, and stays open with what it says.
      host.update(h(Finish, { saving: false }));
      await host.settle();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(host.text()).not.toContain(WAITING);
      expect(host.text()).toContain('Save workout');
      // Tapped again, it closes the sheet through its own close, and then goes.
      await host.click(host.button('What to do'));
      await host.settle();
      expect(router.navigate).toHaveBeenCalledWith('/home');
    });

    it('a sheet that can close goes Home once it has closed, not before', async () => {
      const refuse = vi.fn();
      const host = render(h(nav.SheetTopContext, { value: surface },
        h(Sheet, { open: true, onOpenChange: refuse, title: 'Add to Home', children: null })));
      await host.click(host.button('What to do'));
      await host.settle();
      // Its owner kept it open: nothing is left waiting to go later, out of the blue.
      expect(refuse).toHaveBeenCalledWith(false);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(host.text()).not.toContain(WAITING);
      const closes = render(h(Finish, { saving: false }));
      await closes.click(closes.button('What to do'));
      await closes.settle();
      expect(router.navigate).toHaveBeenCalledWith('/home');
    });
  });

  it('sheets and menus own the page while open: the toasts wait in #toasts, hidden (codex V1-13)', () => {
    expect(read('src/components/hig/Sheet.tsx')).toContain('claimModal()');
    expect(read('src/components/hig/ActionMenu.tsx')).toContain('claimModal()');
    expect(read('src/main.tsx')).toMatch(/<div id="toasts">\s*<Toaster/);
    expect(read('src/index.css')).toMatch(/#toasts\[data-held\] \{ visibility: hidden; \}/);
  });

  it('is announced outside the part of the page a sheet makes inert', () => {
    // A live region always in the page, so a decision arriving is announced; not an alert while it says nothing.
    expect(read('src/screens/home/UrgentBanner.tsx')).toMatch(/createPortal\(\s*<div aria-live="assertive" aria-atomic="true" className="sr-only">[\s\S]*?<\/div>,\s*document\.body,?\s*\)/);
  });
});

describe('Home’s targets and layout (kiro KV-08, KV-10, KV-11, KV-15, KV-18, KV-22)', () => {
  it('every target on Home is at least 48 px: no min-h-11 left (journey §20.4 rule 1)', () => {
    for (const file of ['src/screens/home/HomeScreen.tsx', 'src/screens/home/WeekCard.tsx', 'src/screens/home/RemindersCapsule.tsx']) {
      expect(read(file), file).not.toMatch(/\bmin-h-11\b/);
    }
  });

  it('the steps form’s Paste is at least 48 by 48, in rem so it grows with the text (journey §20.4 rule 1; codex H2-07, kiro KH-10)', () => {
    const paste = /className="([^"]*)"\s*>\s*Paste\s*</.exec(read('src/screens/track/QuickLog.tsx'));
    expect(paste?.[1]).toMatch(/\bmin-h-12\b/);
    expect(paste?.[1]).toMatch(/\bmin-w-12\b/);
    expect(paste?.[1]).not.toMatch(/\bmin-h-11\b/);
  });

  it('a hub’s "Saved on this device" stands until the next Add, never on a timer (journey §20.4 rule 8; kiro KH-16)', () => {
    for (const file of ['src/screens/hub/ReadingHub.tsx', 'src/screens/hub/StepsHub.tsx', 'src/screens/hub/BackHub.tsx']) {
      const hub = read(file);
      expect(hub, file).not.toMatch(/setTimeout\(\(\) => setNotice\(undefined\)/);
      expect(hub, file).toMatch(/const add = \(\) => \{\s+setNotice\(undefined\);\s+setLogOpen\(true\);\s+\};/);
      expect(hub, file).not.toMatch(/onClick=\{\(\) => setLogOpen\(true\)\}/);
    }
  });

  it('Back & leg’s emergency signs are body text in normal ink, before History (kiro KH-11)', () => {
    const hub = read('src/screens/hub/BackHub.tsx');
    expect(hub).toMatch(/<div className="px-1 text-\[length:var\(--text-body\)\] leading-snug">\s*<p>A pain number never rules out an emergency\. Get emergency care now for any of these:<\/p>\s*<EmergencySigns/);
    expect(hub.indexOf('<EmergencySigns')).toBeLessThan(hub.indexOf('<HistoryList'));
  });

  it('the Steps hub, while walking is held for the feet, says the hold and offers no walking advice or step goal (kiro KH-02)', () => {
    const hub = read('src/screens/hub/StepsHub.tsx');
    expect(hub).toContain("const held = feetHold(guided.profile, gateFor(guided, 'walk', now));");
    expect(hub).toMatch(/\{held \? \([\s\S]*?Walking is on hold for your feet[\s\S]*?\) : \(\s*<Interpretation text=\{STEPS_NOTE\.text\}/);
    expect(hub).toMatch(/\{!held && <Row as="button" type="button" label="Daily step goal"/);
    expect(hub).toContain('(held || steps === undefined ? undefined : stepsProgress(');
  });

  it('an urgent decision takes a menu away at once, with no exit, and it stays closed while it stands (codex H4-01, journey §4.3, M18)', () => {
    const menu = read('src/components/hig/ActionMenu.tsx');
    expect(menu).toContain('const urgent = useContext(UrgentContext) !== undefined;');
    expect(menu).toContain('if (!urgent && target && target !== shown) setShown(target);');
    expect(menu).toContain('if (urgent && shown) setShown(null);');
    expect(menu).toContain('const open = target !== null && !urgent;');
    expect(menu).toContain('if (!shown || urgent) return null;');
    // What it set off is still offered: it never finishes closing.
    expect(menu).toMatch(/if \(urgent && drawn\.current\) \{\s+drawn\.current = false;\s+onClosed\?\.\(\);/);
  });

  it('Me holds each row’s answer above its lists until it is stored, and FinishRow keeps its props (codex H4-04, journey §4.5)', () => {
    const me = read('src/screens/you/MeHome.tsx');
    expect(me).toContain('function FinishRow({ chapter }: { chapter: OpenChapter }) {');
    expect(me).toMatch(/const finish = withHeld\(setupProgress\(\{ profile, settings \}\)/);
    expect(me).toMatch(/\? withHeld\(newlyRelevant\(/);
    expect(me).toMatch(/if \(saved\.ok\) \{\s+hold\(key, undefined\);/);
    expect(me).not.toMatch(/const \[problem, setProblem\] = useState/);
  });

  it('Goals and Me read today from the shared clock, a new day at midnight (codex H4-06)', () => {
    expect(read('src/screens/you/GoalsScreen.tsx')).toContain('const { day } = useLocalDay();');
    const me = read('src/screens/you/MeHome.tsx');
    expect(me).toContain('const { now, day } = useLocalDay();');
    expect(me).not.toMatch(/now: new Date\(\)/);
  });

  it('"2 reminders" sits in the header’s wrapping area beside the status, not in the fixed bar', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).not.toMatch(/trailing=\{<RemindersCapsule/);
    expect(home).toMatch(/below=\{\(\s*<div className="flex flex-wrap items-center justify-end gap-3">\s*<StatusButton[\s\S]*?<RemindersCapsule waiting=\{waiting\} \/>\s*<\/div>/);
  });

  it('This week opens Trends from the whole card only when no button is on it', () => {
    expect(read('src/screens/home/WeekCard.tsx')).toMatch(/goal !== undefined && "after:absolute after:inset-0 after:rounded-2xl after:content-\[''\]"/);
  });

  it('the day marks grow with the text and wrap to more rows rather than being capped', () => {
    const week = read('src/screens/home/WeekCard.tsx');
    expect(week).not.toMatch(/min\(1\.25rem,20px\)|min\(var\(--text-footnote\),18px\)/);
    expect(week).toContain('grid-cols-[repeat(auto-fit,minmax(min(1.75rem,100%),1fr))]');
  });

  it('the nav bar is glass, so a running transition, Reduce transparency and more contrast make it solid (journey §20.1)', () => {
    const m = html(h(Screen, { title: 'Stretch', inline: true, children: null }));
    expect(m).toMatch(/<div data-bar="true" class="[^"]*\bglass\b/);
    expect(read('src/index.css')).toMatch(/\.glass\[data-bar\] \{ border-width: 0 0 1px; border-color: var\(--separator\); border-radius: 0; box-shadow: none; \}/);
  });

  it('a first layout the device would not store is said above the tiles, with Try again, as a refused change is (codex V1-11, V1-12)', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toContain("first.failed !== undefined ? { text: `Your Home tiles aren’t saved on this phone yet. ${first.failed}`, retry: first.retry }");
    expect(home).toMatch(/\{unsaved && \([\s\S]*?role="alert"[\s\S]*?\{unsaved\.retry && \([\s\S]*?onClick=\{unsaved\.retry\}[\s\S]*?Try again/);
  });

  it('Right now’s quiet way on reads "Something else", and the chooser ends with "All categories" (journey §7.4, L-15)', () => {
    expect(read('src/screens/home/HomeScreen.tsx')).toMatch(/>\s*Something else\s*<\/button>/);
    const m = html(h(ChooserSheet, { open: true, onOpenChange: () => {}, rows: [], onChoose: () => {} }));
    expect(m).toMatch(/<a href="#\/browse"[^>]*>[\s\S]*All categories/);
  });
});

describe('the Right now card runs its action directly (journey §7.4, K-32, B-09, codex V1-07)', () => {
  const card = {
    kind: 'mealWalk', title: 'A walk after lunch', detail: '', reason: 'You asked for a walk after lunch.',
    action: { label: 'I had lunch at 1:30 pm: walk now', to: '/walk/live', mode: 'walk', walk: { meal: 'lunch', mealStartedAt: 1 } },
    more: [{ label: 'Different time', to: '/hub/walk?meal=lunch' }, { label: 'Just a walk', to: '/walk/live', mode: 'walk', walk: {} }],
  } as const;

  it('shows the after-meal card’s stated time as its one primary action, then "Different time" and "Just a walk", quieter', () => {
    const m = html(h(RecommendationCard, { recommendation: card as never, eyebrow: 'Suggested for now', revision: 'r', changed: false, onAct: () => {} }));
    const labels = [...m.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([^<]*)<\/button>/g)].map(x => ({ cls: x[1], text: x[2] }));
    expect(labels.map(l => l.text)).toEqual(['I had lunch at 1:30 pm: walk now', 'Different time', 'Just a walk']);
    expect(labels[0].cls).toContain('bg-tint text-on-tint');
    for (const l of labels.slice(1)) for (const c of ['min-h-12', 'bg-tint/10', 'text-tint']) expect(l.cls.split(' '), `${l.text}: ${c}`).toContain(c);
  });

  it('a walk from the card with another walk still on this device deals with that one first, and starts nothing (codex W-04)', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // Before the shared start, which runs the walk's own flow and B-01's sequence (Plan 6 Task 8).
    expect(home).toMatch(/if \(action\.walk\) \{[\s\S]*?const first = walkFirst\(peekWalk\(\), action\.walk, Date\.now\(\), HOUR12\);\s*if \(first\) \{\s*setWalkAhead\(\{ first, open: true \}\);\s*return;\s*\}[\s\S]*?start\('walk', directWalkHref\(action\.walk, Date\.now\(\), measure\), 'Start walk'\);/);
    expect(home).toContain('onClick={() => navigate(walkAhead.first.action.to, { viewTransition: true })}');
  });

  it('a walk from the card starts at once through the shared start, with its id made at the tap; motion is asked in the tap that finally starts it (B-01)', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toMatch(/if \(action\.walk\) \{[\s\S]*?start\('walk', directWalkHref\(action\.walk, Date\.now\(\), measure\), 'Start walk'\);/);
    // Not asked early from the card: the walk's own start sequence asks, in the tap that finally starts it (Plan 6 Task 8).
    expect(home).not.toMatch(/requestMotion/);
    expect(read('src/screens/walk/useWalkFlow.tsx')).toMatch(/createStarter\(\{\s*requestMotion,/);
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
    // The floating tab bar is at most 4rem tall (tabs of up to 3.5rem in 0.25rem of padding), at least 0.5rem over the home indicator.
    expect(css).toContain(':root { --toast-offset-bottom: calc(4.5rem + max(0.5rem, env(safe-area-inset-bottom, 0px))); }');
    const bar = read('src/components/hig/TabBar.tsx');
    expect(bar).toContain('bottom-[max(0.5rem,env(safe-area-inset-bottom))]');
    expect(bar).toContain('min-h-[min(3.5rem,72px)]');
    // Positioned, so the labels paint above the sliding selection (M5).
    expect(bar).toMatch(/<ul className="relative flex items-stretch p-1 /);
    // The shell and the waiting reminder clear it the same way.
    expect(read('src/components/hig/AppShell.tsx')).toContain('pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))]');
    expect(read('src/reminders/ReminderHost.tsx')).toContain('bottom-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))]');
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
