import { createElement as h, type ReactNode } from 'react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/host';

/**
 * The route table's own redirects, driven through a real router (codex
 * V1-10): each keeps the address's query and navigation state, and a v1
 * setup address goes Home in one hop once set up. The screens are probes
 * that note every place they were drawn at.
 */
const seen = vi.hoisted(() => [] as { at: string; state: unknown }[]);
vi.mock('@/screens/home/routes', async () => {
  const { useLocation: where } = await import('react-router-dom');
  return {
    default: function HomeProbe() {
      const l = where();
      seen.push({ at: `${l.pathname}${l.search}`, state: l.state });
      return null;
    },
  };
});
vi.mock('@/components/hig/AppShell', async () => {
  const { Outlet: Out } = await import('react-router-dom');
  return { AppShell: () => h(Out) };
});
vi.mock('@/components/hig/StorageBanner', () => ({ TaskFrame: ({ children }: { children: ReactNode }) => children }));
// A class component, which the host doesn't run; nothing here fails to draw.
vi.mock('@/components/hig/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: { children: ReactNode }) => children }));

const { AppRoutes } = await import('./routes');

/** Every place the app was at, once the redirects have run. */
async function land(entry: { pathname: string; search?: string; state?: unknown }, onboarded: boolean, setupOpen = false) {
  const places: string[] = [];
  function Where() {
    const l = useLocation();
    places.push(`${l.pathname}${l.search}`);
    return null;
  }
  render(h(MemoryRouter, { initialEntries: [entry] }, h(Where), h(AppRoutes, { onboarded, setupOpen }), h(Outlet)));
  await new Promise(r => setTimeout(r, 10));
  return [...new Set(places)];
}

beforeEach(() => { seen.length = 0; });

describe('the route table’s redirects keep the query and the state (journey §19.3, K-17)', () => {
  it('the app root opens Home with its query: /?choose=1 opens the chooser', async () => {
    await land({ pathname: '/', search: '?choose=1', state: { from: 'shortcut' } }, true);
    expect(seen.at(-1)).toEqual({ at: '/home?choose=1', state: { from: 'shortcut' } });
  });

  it('setup’s addresses go Home once set up, with the query', async () => {
    await land({ pathname: '/setup/health', search: '?goal=1' }, true);
    expect(seen.at(-1)?.at).toBe('/home?goal=1');
  });

  it('v1’s Welcome goes Home in one hop once set up, never through /setup', async () => {
    const places = await land({ pathname: '/welcome', search: '?goal=1' }, true);
    expect(seen.at(-1)?.at).toBe('/home?goal=1');
    expect(places).toEqual(['/welcome?goal=1', '/home?goal=1']);
  });

  it('the Workout Log’s and Trends’ workout addresses keep the query (D51)', async () => {
    expect((await land({ pathname: '/trends/workout', search: '?from=bookmark' }, true)).at(-1)).toBe('/trends?from=bookmark');
    expect((await land({ pathname: '/hub/workout/log/old', search: '?date=2026-10-05' }, true)).at(-1)).toBe('/hub/workout/log?date=2026-10-05');
  });

  it('after “Look around first”, setup carries on at its own address (journey §19.1)', async () => {
    const places = await land({ pathname: '/setup/health/conditions' }, true, true);
    // Setup's routes load on first use, which this host doesn't draw: the address staying put, with Home never drawn, is the table's part.
    expect(places).toEqual(['/setup/health/conditions']);
    expect(seen).toEqual([]);
  });

  it('before setup, every address goes to setup with its query', async () => {
    const places = await land({ pathname: '/today', search: '?checkin=walk' }, false);
    expect(places.at(-1)).toBe('/setup?checkin=walk');
  });
});
