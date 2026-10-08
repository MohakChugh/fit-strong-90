import { describe, expect, it } from 'vitest';
import { followsSystemTextSize, rootSizeFor } from './textSize';

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
});
