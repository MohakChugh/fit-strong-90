import { describe, expect, it } from 'vitest';
import { followsSystemTextSize, rootSizeFor, scaleFromRoot } from './textSize';

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
