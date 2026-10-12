import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Shown { text: string; options?: { id?: string; action?: { onClick: (event: { preventDefault: () => void }) => void }; onDismiss?: () => void } }
const shown: Shown[] = [];
const dismissed: string[] = [];
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options?: Shown['options']) => { shown.push({ text, ...(options ? { options } : {}) }); }, {
    dismiss: (key: string) => { dismissed.push(key); },
  }),
}));

const { endFoodUndos, holdFoodUndoScope, offerFoodUndo } = await import('./undo');

const offer = (text: string, scope: string, undo: () => Promise<string | undefined> = async () => undefined) =>
  offerFoodUndo({ text, restored: `${text} back`, scope, undo });
const keyOf = (text: string) => shown.find(s => s.text === text)!.options!.id!;

beforeEach(() => {
  endFoodUndos();
  shown.length = 0;
  dismissed.length = 0;
});

describe('Undo for a food delete (B-04, B-05)', () => {
  it('keeps the two latest standing, on no timer, and ends the oldest', () => {
    offer('Lunch deleted', '/hub/food');
    offer('Dinner deleted', '/hub/food');
    expect(dismissed).toEqual([]);
    offer('Snack deleted', '/hub/food');
    expect(dismissed).toEqual([keyOf('Lunch deleted')]);
    expect(shown.every(s => (s.options as { duration?: number }).duration === Infinity)).toBe(true);
  });
  it('ends only the screen’s own when that screen is left, and all of them on an unrelated change', () => {
    offer('Lunch deleted', '/day/2026-10-08');
    offer('Usual lunch removed', '/hub/food/usual');
    endFoodUndos('/hub/food/usual');
    expect(dismissed).toEqual([keyOf('Usual lunch removed')]);
    endFoodUndos();
    expect(dismissed).toEqual([keyOf('Usual lunch removed'), keyOf('Lunch deleted')]);
  });
  it('stays until the record is stored back, then says so; a refusal keeps it and says why', async () => {
    let answer: string | undefined = 'The disk is full.';
    offer('Lunch deleted', '/hub/food', async () => answer);
    const event = { preventDefault: vi.fn() };
    shown[0].options!.action!.onClick(event);
    await vi.waitFor(() => expect(shown.map(s => s.text)).toContain('That didn’t save. The disk is full.'));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(dismissed).toEqual([]);
    answer = undefined;
    shown[0].options!.action!.onClick(event);
    await vi.waitFor(() => expect(shown.map(s => s.text)).toContain('Lunch deleted back'));
    expect(dismissed).toEqual([keyOf('Lunch deleted')]);
  });
  it('stores the record back once, however often Undo is tapped while it saves or as the toast leaves', async () => {
    let finish!: (problem: string | undefined) => void;
    const undo = vi.fn(() => new Promise<string | undefined>(resolve => { finish = resolve; }));
    offer('Lunch deleted', '/hub/food', undo);
    const event = { preventDefault: vi.fn() };
    // A shaky double tap: the second lands while the first is being written.
    shown[0].options!.action!.onClick(event);
    shown[0].options!.action!.onClick(event);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    finish(undefined);
    await vi.waitFor(() => expect(shown.map(s => s.text)).toContain('Lunch deleted back'));
    // The toast is on its way out, and still takes a tap.
    shown[0].options!.action!.onClick(event);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(shown.filter(s => s.text === 'Lunch deleted back')).toHaveLength(1);
  });
  it('ends a screen’s Undo when the screen is left, not when it remounts at once (React StrictMode)', () => {
    vi.useFakeTimers();
    try {
      const release = holdFoodUndoScope('/day/2026-10-06');
      offer('Breakfast deleted', '/day/2026-10-06');
      // StrictMode: the effect is cleaned up and run again straight away.
      release();
      const again = holdFoodUndoScope('/day/2026-10-06');
      vi.runAllTimers();
      expect(dismissed).toEqual([]);
      // Leaving for real ends it.
      again();
      vi.runAllTimers();
      expect(dismissed).toEqual([keyOf('Breakfast deleted')]);
    } finally {
      vi.useRealTimers();
    }
  });
  it('keeps a scope while any screen holding it is still mounted', () => {
    vi.useFakeTimers();
    try {
      const one = holdFoodUndoScope('/hub/food');
      const two = holdFoodUndoScope('/hub/food');
      offer('Lunch deleted', '/hub/food');
      one();
      vi.runAllTimers();
      expect(dismissed).toEqual([]);
      two();
      vi.runAllTimers();
      expect(dismissed).toEqual([keyOf('Lunch deleted')]);
    } finally {
      vi.useRealTimers();
    }
  });
  it('forgets a toast the person dismissed, so it no longer counts towards the two', () => {
    offer('Lunch deleted', '/hub/food');
    shown[0].options!.onDismiss!();
    offer('Dinner deleted', '/hub/food');
    offer('Snack deleted', '/hub/food');
    expect(dismissed).toEqual([]);
  });
});
