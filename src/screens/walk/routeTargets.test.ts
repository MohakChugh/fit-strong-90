/**
 * A route's controls are thumb-sized and apart (journey §20.4 rule 1, H6-11):
 * Zoom, Recentre, Hide map, Show map and Show whole route at least 48 × 48 px
 * with 12 px between them, and the map pictures' credit a target as well
 * (KH-10). Rendered through the minimal host, with the map pictures on.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, type Host, type HostNode } from '@/test/host';
import type { Bbox, RouteLine } from '@/walk/routeRecord';

Object.assign(globalThis, {
  window: globalThis,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });

const { RouteFrame } = await import('./RouteFrame');
const { LiveRoute } = await import('./RouteView');

const LINE: RouteLine = { start: 0, end: 60_000, coords: [[12.97, 77.59], [12.972, 77.592]], ms: [0, 60_000] };
const BBOX: Bbox = [12.97, 77.59, 12.972, 77.592];

let host: Host | undefined;
afterEach(() => {
  host?.unmount();
  host = undefined;
});

const classes = (n: HostNode) => String(n.props.className ?? '').split(/\s+/);
const parentOf = (h: Host, child: HostNode) => h.all().find(n => n.children.includes(child))!;

/** At least 48 × 48 px: `min-h-12` and `min-w-12` (or taller), as `TARGET.tap` sets. */
function expectTarget(n: HostNode, name: string) {
  const c = classes(n);
  expect(c, name).toContain('min-w-12');
  expect(c.some(x => x === 'min-h-12' || x === 'min-h-14' || x === 'min-h-[60px]'), `${name}: ${c.join(' ')}`).toBe(true);
}

describe('a finished walk’s route controls (H6-11, KH-10)', () => {
  it('makes Zoom in, Zoom out, Recentre and Hide map targets, 12 px apart, and the credit a target', async () => {
    host = render(createElement(RouteFrame, { walkId: 'w1', lines: [LINE], bbox: BBOX, mapOn: true }));
    await host.settle();
    const names = ['Zoom in', 'Zoom out', 'Recentre', 'Hide map'];
    for (const name of names) expectTarget(host.button(name, { exact: true }), name);
    const row = parentOf(host, host.button('Zoom in', { exact: true }));
    expect(classes(row)).toContain('gap-3');
    // Four in a row only where four fit at the text size, measured in rem: larger text keeps two.
    expect(classes(row)).toEqual(expect.arrayContaining(['grid-cols-2', '@min-[23rem]:grid-cols-4']));
    expect(classes(parentOf(host, row))).toContain('@container');
    const credit = host.all().find(n => n.type === 'a')!;
    expect(credit.props.href).toBe('https://www.openstreetmap.org/copyright');
    expect(classes(credit)).toContain('min-h-12');
    // The credit and the controls are a column: 12 px between them too.
    expect(classes(parentOf(host, credit))).toContain('gap-3');
    await host.click(host.button('Hide map', { exact: true }));
    expectTarget(host.button('Show map', { exact: true }), 'Show map');
  });
});

describe('the live walk’s route controls (H6-11)', () => {
  it('makes Zoom in, Zoom out and Show whole route targets, 12 px apart', async () => {
    host = render(createElement(LiveRoute, { lines: [LINE], waiting: 'Waiting for GPS' }));
    await host.settle();
    for (const name of ['Zoom in', 'Zoom out', 'Show whole route']) expectTarget(host.button(name, { exact: true }), name);
    const row = parentOf(host, host.button('Zoom in', { exact: true }));
    expect(classes(row)).toContain('gap-3');
    expect(classes(parentOf(host, row))).toEqual(expect.arrayContaining(['@container', 'gap-3']));
    // Three in a row only where they fit at the text size; else the whole route takes the row below.
    expect(classes(row)).toEqual(expect.arrayContaining(['grid-cols-2', '@min-[18rem]:grid-cols-3']));
    expect(classes(host.button('Show whole route', { exact: true }))).toEqual(expect.arrayContaining(['col-span-2', '@min-[18rem]:col-span-1']));
  });
});
