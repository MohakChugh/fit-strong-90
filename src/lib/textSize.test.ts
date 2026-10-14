import { describe, expect, it, vi } from 'vitest';
import { TEXT_SCALES, applyTextScale, applyTextSize, followsSystemTextSize, isTextScale, rootFontSize, rootSizeFor, scaleFromRoot } from './textSize';

describe('iOS text size', () => {
  it('keeps the design unchanged at the default size and scales with larger ones', () => {
    expect(rootSizeFor(17)).toBe(16);
    expect(rootSizeFor(21)).toBeCloseTo(19.76, 2);
  });

  it('ignores a broken measurement and clamps an extreme one', () => {
    expect(rootSizeFor(Number.NaN)).toBeNull();
    expect(rootSizeFor(0)).toBeNull();
    expect(rootSizeFor(500)).toBe(56);
    expect(rootSizeFor(1)).toBe(12.8);
  });

  it('follows the system size only where it is the person’s setting: on iPhone and iPad, not macOS Safari (S-08)', () => {
    // macOS WebKit knows the keyword, but there it is a fixed 13px that would shrink the app to 80%.
    expect(followsSystemTextSize({ supportsKeyword: true, maxTouchPoints: 0 })).toBe(false);
    expect(followsSystemTextSize({ supportsKeyword: true, maxTouchPoints: 5 })).toBe(true);
    expect(followsSystemTextSize({ supportsKeyword: false, maxTouchPoints: 5 })).toBe(false);
  });

  it('reads the text size as a scale of the design’s 16 px, and a broken size as the default', () => {
    expect(scaleFromRoot(16)).toBe(1);
    expect(scaleFromRoot(20.8)).toBeCloseTo(1.3, 10);
    expect(scaleFromRoot(32)).toBe(2);
    expect(scaleFromRoot(Number.NaN)).toBe(1);
    expect(scaleFromRoot(0)).toBe(1);
  });
});

describe('the app’s own text size (journey §16 Display, D60)', () => {
  it('offers five sizes', () => {
    expect(TEXT_SCALES).toEqual([1, 1.15, 1.3, 1.6, 2]);
    expect(isTextScale(1.3)).toBe(true);
    expect(isTextScale(1.4)).toBe(false);
    expect(isTextScale('1.3')).toBe(false);
  });

  it('takes the larger of the device’s size and its own, so it never makes text smaller', () => {
    expect(rootFontSize('', 1)).toBe('');
    expect(rootFontSize('', 1.15)).toBe('115%');
    expect(rootFontSize('', 2)).toBe('200%');
    expect(rootFontSize('16px', 1.3)).toBe('20.8px');
    expect(rootFontSize('32px', 1.3)).toBe('32px');
    expect(rootFontSize('130%', 1.15)).toBe('130%');
    expect(rootFontSize('100%', 1.6)).toBe('160%');
    expect(rootFontSize('100%', 1.15)).toBe('115%');
    expect(rootFontSize('19.76px', 1)).toBe('19.76px');
  });

  /** A stand-in for `document`: the root's inline font size and its data attributes. */
  const fakeDoc = (fontSize = '') => ({ documentElement: { style: { fontSize }, dataset: {} as Record<string, string | undefined> } }) as unknown as Document;

  it('gives back exactly what the device set when turned off (Review Focus 4)', () => {
    const browser = fakeDoc('200%');
    applyTextScale(1.3, browser);
    expect(browser.documentElement.style.fontSize).toBe('200%');
    applyTextScale(1, browser);
    expect(browser.documentElement.style.fontSize).toBe('200%');
    expect(browser.documentElement.dataset.textBase).toBeUndefined();
    const ios = fakeDoc('19.76px');
    applyTextScale(1.6, ios);
    expect(ios.documentElement.style.fontSize).toBe('25.6px');
    applyTextScale(undefined, ios);
    expect(ios.documentElement.style.fontSize).toBe('19.76px');
  });

  it('keeps the device’s size under it while the app’s size changes, and gives it back (Review Focus 4)', () => {
    const ios = fakeDoc('19.76px');
    applyTextScale(1.3, ios);
    expect(ios.documentElement.style.fontSize).toBe('20.8px');
    applyTextScale(1.6, ios);
    expect(ios.documentElement.style.fontSize).toBe('25.6px');
    applyTextScale(1, ios);
    expect(ios.documentElement.style.fontSize).toBe('19.76px');
  });

  it('puts a new iOS Text Size under the app’s own size while that is on (Review Focus 4)', () => {
    // An iPhone whose Text Size goes up to 24 pt, then to 40 pt, while the app's Largest is on.
    let body = '24px';
    vi.stubGlobal('CSS', { supports: () => true });
    vi.stubGlobal('navigator', { maxTouchPoints: 5 });
    vi.stubGlobal('getComputedStyle', () => ({ fontSize: body }));
    try {
      const root = { style: { fontSize: '19.76px' }, dataset: {} as Record<string, string | undefined>, appendChild: () => {} };
      const doc = { documentElement: root, createElement: () => ({ style: {}, remove: () => {} }) } as unknown as Document;
      applyTextScale(2, doc);
      expect(root.style.fontSize).toBe('32px');
      applyTextSize(doc, 2);
      expect(root.dataset.textBase).toBe(`${rootSizeFor(24)}px`);
      expect(root.style.fontSize).toBe('32px');
      // Now larger than the app's own: the device's wins at once (D60).
      body = '40px';
      applyTextSize(doc, 2);
      expect(root.style.fontSize).toBe(`${rootSizeFor(40)}px`);
      applyTextScale(1, doc);
      expect(root.style.fontSize).toBe(`${rootSizeFor(40)}px`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('leaves a root it never changed alone, and ignores a size this build does not offer', () => {
    const doc = fakeDoc('200%');
    applyTextScale(1, doc);
    applyTextScale(7, doc);
    expect(doc.documentElement.style.fontSize).toBe('200%');
    expect(doc.documentElement.dataset.textBase).toBeUndefined();
  });
});
