import { describe, expect, it } from 'vitest';
import { TEXT_SCALES } from '@/lib/textSize';
import { TEXT_SIZE_CHOICES, displayChoices, displayLine, fadeTheme, systemDisplayStore } from './display';

const none = { reducedMotion: false, reducedTransparency: false, moreContrast: false };

describe('displayChoices: the device’s settings come first (journey §16)', () => {
  it('follows the app’s own choice when the device asks for nothing', () => {
    expect(displayChoices(undefined, none)).toEqual({ reduceMotion: { on: false, bySystem: false }, reduceTransparency: { on: false, bySystem: false } });
    expect(displayChoices({ reduceMotion: true, reduceTransparency: true }, none))
      .toEqual({ reduceMotion: { on: true, bySystem: false }, reduceTransparency: { on: true, bySystem: false } });
  });
  it('is on, and the device’s doing, when the device asks', () => {
    expect(displayChoices({ reduceMotion: false }, { ...none, reducedMotion: true }).reduceMotion).toEqual({ on: true, bySystem: true });
    expect(displayChoices(undefined, { ...none, moreContrast: true }).reduceTransparency).toEqual({ on: true, bySystem: true });
    expect(displayChoices(undefined, { ...none, reducedTransparency: true }).reduceTransparency).toEqual({ on: true, bySystem: true });
  });
});

describe('displayLine', () => {
  it('says the theme and the text size, and what is reduced', () => {
    expect(displayLine({ theme: 'system' })).toBe('Automatic · Standard text');
    expect(displayLine({ theme: 'dark', display: { textScale: 1.3, reduceMotion: true } })).toBe('Dark · Larger text · Reduce motion');
    expect(displayLine({ theme: 'light', display: { textScale: 7, reduceTransparency: true } })).toBe('Light · Standard text · Reduce transparency');
  });
});

describe('the choices', () => {
  it('are the five sizes this build can apply (journey §20.4 rule 13)', () => {
    expect(TEXT_SIZE_CHOICES.map(c => Number(c.value))).toEqual([...TEXT_SCALES]);
  });
});

describe('fadeTheme (M23)', () => {
  /** A stand-in document: its root's data attributes, and a view transition that runs its update at once. */
  const fakeDoc = (transitions: boolean) => {
    const ran: string[] = [];
    const doc = {
      documentElement: { dataset: {} as Record<string, string | undefined> },
      ...(transitions ? { startViewTransition: (update: () => void) => { ran.push('transition'); update(); } } : {}),
    } as unknown as Document;
    return { doc, ran };
  };
  it('changes the theme inside a root transition with the tab hand-over', () => {
    const { doc, ran } = fakeDoc(true);
    let changed = 0;
    fadeTheme(() => { changed += 1; }, false, doc);
    expect([ran, changed, doc.documentElement.dataset.nav]).toEqual([['transition'], 1, 'tab']);
  });
  it('changes it at once under Reduce Motion, or where the browser has no view transitions', () => {
    const reduced = fakeDoc(true);
    let changed = 0;
    fadeTheme(() => { changed += 1; }, true, reduced.doc);
    fadeTheme(() => { changed += 1; }, false, fakeDoc(false).doc);
    expect([reduced.ran, changed, reduced.doc.documentElement.dataset.nav]).toEqual([[], 2, undefined]);
  });
});

describe('systemDisplayStore: the device’s settings as they are now, while Display is open (codex H4-07)', () => {
  /** A window whose three media queries can change, and whose page can come back into view. */
  function device(start: Record<string, boolean> = {}) {
    const matches = new Map<string, boolean>(Object.entries(start));
    const listeners = new Map<string, Set<() => void>>();
    const seen = new Set<() => void>();
    const win = {
      matchMedia: (query: string) => ({
        get matches() { return matches.get(query) ?? false; },
        addEventListener: (_: string, f: () => void) => { if (!listeners.has(query)) listeners.set(query, new Set()); listeners.get(query)!.add(f); },
        removeEventListener: (_: string, f: () => void) => listeners.get(query)?.delete(f),
      }),
      document: {
        addEventListener: (_: string, f: () => void) => seen.add(f),
        removeEventListener: (_: string, f: () => void) => seen.delete(f),
      },
    };
    const set = (query: string, on: boolean) => { matches.set(query, on); for (const f of listeners.get(query) ?? []) f(); };
    const back = () => { for (const f of [...seen]) f(); };
    const count = () => [...listeners.values()].reduce((n, l) => n + l.size, 0) + seen.size;
    return { win: win as unknown as Window, set, back, matches, count };
  }
  const MOTION = '(prefers-reduced-motion: reduce)';

  it('a Reduce Motion turned off while open: the switch is the app’s own again, and no longer the device’s', () => {
    const d = device({ [MOTION]: true });
    const store = systemDisplayStore(d.win);
    let told = 0;
    store.subscribe(() => { told += 1; });
    expect(displayChoices(undefined, store.read()).reduceMotion).toEqual({ on: true, bySystem: true });
    d.set(MOTION, false);
    expect(told).toBe(1);
    expect(displayChoices(undefined, store.read()).reduceMotion).toEqual({ on: false, bySystem: false });
  });

  it('listens to all three, and reads again when the app comes back into view', () => {
    const d = device();
    const store = systemDisplayStore(d.win);
    let told = 0;
    const stop = store.subscribe(() => { told += 1; });
    d.set('(prefers-reduced-transparency: reduce)', true);
    d.set('(prefers-contrast: more)', true);
    expect(told).toBe(2);
    expect(store.read()).toEqual({ reducedMotion: false, reducedTransparency: true, moreContrast: true });
    // Changed while the app was away, with no event to say so.
    d.matches.set(MOTION, true);
    d.back();
    expect(told).toBe(3);
    expect(store.read().reducedMotion).toBe(true);
    stop();
    expect(d.count()).toBe(0);
  });

  it('the same answer twice is the same object, as useSyncExternalStore needs', () => {
    const store = systemDisplayStore(device().win);
    expect(store.read()).toBe(store.read());
  });
});
