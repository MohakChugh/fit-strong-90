import { describe, expect, it } from 'vitest';
import { toastSpace, toastsShown } from './toastSpace';

const toast = (offsetHeight: number, removed?: 'true' | 'false', visible?: 'true' | 'false') =>
  ({ offsetHeight, dataset: { ...(removed ? { removed } : {}), ...(visible ? { visible } : {}) } });

describe('the room the standing toasts take (M19, B-04)', () => {
  it('is each toast’s height and a gap above it, and nothing with none', () => {
    expect(toastSpace([])).toBe(0);
    expect(toastSpace([toast(80, 'false')])).toBe(94);
    expect(toastSpace([toast(80), toast(104, 'false')])).toBe(212);
  });

  it('leaves out a toast on its way out, and one waiting its turn', () => {
    expect(toastSpace([toast(80, 'true'), toast(104, 'false')])).toBe(118);
    expect(toastSpace([toast(80, 'false', 'false'), toast(104, 'false', 'true')])).toBe(118);
  });
});

describe('how many toasts show at once (M19)', () => {
  it('one on a screen under 24 lines of body text tall, so two never cover most of it; three elsewhere', () => {
    // A 320 × 568 phone: at 100% text it is 35 lines tall, at 200% under 18.
    expect(toastsShown(568, 16)).toBe(3);
    expect(toastsShown(568, 32)).toBe(1);
    // A 428 × 926 phone at 200%: 29 lines.
    expect(toastsShown(926, 32)).toBe(3);
    expect(toastsShown(24 * 20, 20)).toBe(3);
    expect(toastsShown(24 * 20 - 1, 20)).toBe(1);
  });
});
