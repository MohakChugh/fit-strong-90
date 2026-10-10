import { describe, expect, it } from 'vitest';
import { TEXT_SCALES } from '@/lib/textSize';
import { TEXT_SIZE_CHOICES, displayChoices, displayLine, fadeTheme } from './display';

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
