import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Shown { text: string; options?: { id?: string; action?: { onClick: (event: { preventDefault: () => void }) => void }; onDismiss?: () => void } }
const shown: Shown[] = [];
const dismissed: string[] = [];
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options?: Shown['options']) => { shown.push({ text, ...(options ? { options } : {}) }); }, {
    dismiss: (key: string) => { dismissed.push(key); },
  }),
}));

const { endFoodUndos, offerFoodUndo } = await import('./undo');

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
  it('forgets a toast the person dismissed, so it no longer counts towards the two', () => {
    offer('Lunch deleted', '/hub/food');
    shown[0].options!.onDismiss!();
    offer('Dinner deleted', '/hub/food');
    offer('Snack deleted', '/hub/food');
    expect(dismissed).toEqual([]);
  });
});
