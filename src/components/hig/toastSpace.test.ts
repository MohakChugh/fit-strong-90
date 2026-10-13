import { describe, expect, it } from 'vitest';
import { toastSpace } from './toastSpace';

const toast = (offsetHeight: number, removed?: 'true' | 'false') => ({ offsetHeight, dataset: removed ? { removed } : {} });

describe('the room the standing toasts take (M19, B-04)', () => {
  it('is each toast’s height and a gap above it, and nothing with none', () => {
    expect(toastSpace([])).toBe(0);
    expect(toastSpace([toast(80, 'false')])).toBe(94);
    expect(toastSpace([toast(80), toast(104, 'false')])).toBe(212);
  });

  it('leaves out a toast on its way out', () => {
    expect(toastSpace([toast(80, 'true'), toast(104, 'false')])).toBe(118);
  });
});
