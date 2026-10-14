import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/host';
import type { AppData } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { enterWithoutSaving, resetSetupSessionForTests } from '@/setup/draft';

/**
 * `/me/profile` (journey §16, §19.2; board D80): Profile & health once set
 * up, a chapter's own pages with `?chapter=…`, and setup itself while setup
 * is unfinished. The two screens are probes.
 */
const seen = vi.hoisted(() => [] as string[]);
const store = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock('@/store/useStore', async importOriginal => ({ ...(await importOriginal<object>()), useStore: () => store.state }));
vi.mock('@/screens/setup/ProfileHealthScreen', () => ({ ProfileHealthScreen: () => { seen.push('Profile & health'); return null; } }));
vi.mock('@/screens/setup/ChapterEditor', () => ({ ChapterEditor: ({ chapter }: { chapter: string }) => { seen.push(`Edit ${chapter}`); return null; } }));

const { default: YouRoutes } = await import('./routes');

const settings = migrateData({ version: CURRENT_VERSION } as AppData).settings;
const profile = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
const SET_UP = { settings: { ...settings, onboardingComplete: true }, profile };

/** Where `/me/profile…` ends up, once its redirect has run. */
async function land(path: string, state: object) {
  store.state = state;
  const places: string[] = [];
  function Where() {
    const l = useLocation();
    places.push(`${l.pathname}${l.search}`);
    return null;
  }
  render(h(MemoryRouter, { initialEntries: [path] }, h(Where), h(Routes, null, h(Route, { path: '/me/*', element: h(YouRoutes) }), h(Route, { path: '/setup', element: null }))));
  await new Promise(r => setTimeout(r, 10));
  return places.at(-1);
}

beforeEach(() => {
  seen.length = 0;
  resetSetupSessionForTests();
});

describe('Profile & health’s address (journey §16, §19.2)', () => {
  it('once set up, lists the chapters, and opens a chapter by its address', async () => {
    expect(await land('/me/profile', SET_UP)).toBe('/me/profile');
    expect(seen).toEqual(['Profile & health']);
    seen.length = 0;
    expect(await land('/me/profile?chapter=about', SET_UP)).toBe('/me/profile?chapter=about');
    expect(seen).toEqual(['Edit about']);
  });

  it('an address that names no chapter opens the list', async () => {
    for (const chapter of ['welcome', 'nonsense']) {
      seen.length = 0;
      await land(`/me/profile?chapter=${chapter}`, SET_UP);
      expect(seen, chapter).toEqual(['Profile & health']);
    }
  });

  it('while setup is unfinished, is setup itself (L-20, board D80)', async () => {
    // "Look around first": no profile yet.
    expect(await land('/me/profile', { settings: { ...settings, onboardingComplete: true, setup: { stage: 'lookAround' } } })).toBe('/setup');
    // A draft with a profile restored, still open.
    expect(await land('/me/profile?chapter=health', { ...SET_UP, settings: { ...SET_UP.settings, setup: { stage: 'open' } } })).toBe('/setup');
    // Nothing stored to edit, whatever the record says: never an empty editor.
    expect(await land('/me/profile', { settings: { ...settings, onboardingComplete: true, setup: { stage: 'done' } } })).toBe('/setup');
    // Finished without saving: the app is open for this session, and nothing is stored to edit (B-07).
    enterWithoutSaving();
    expect(await land('/me/profile', SET_UP)).toBe('/setup');
    expect(seen).toEqual([]);
  });
});
