import { describe, expect, it } from 'vitest';
import { applyChange, mergeChanges } from './params';

const today = '2026-10-08';

describe('applyChange', () => {
  it('keeps today and the timeline out of the address', () => {
    expect(applyChange(new URLSearchParams('day=2026-10-05&view=trends'), { day: today, view: 'timeline' }, today).toString()).toBe('');
    expect(applyChange(new URLSearchParams(''), { day: '2026-10-05' }, today).toString()).toBe('day=2026-10-05');
    expect(applyChange(new URLSearchParams(''), { view: 'trends' }, today).toString()).toBe('view=trends');
  });

  it('closes Quick Log and leaves everything else alone', () => {
    expect(applyChange(new URLSearchParams('day=2026-10-05&add=glucose'), { add: null }, today).toString()).toBe('day=2026-10-05');
    expect(applyChange(new URLSearchParams('add=glucose&other=1'), {}, today).toString()).toBe('add=glucose&other=1');
  });
});

describe('mergeChanges', () => {
  it('lets two changes made in one tick land as one, so neither is lost', () => {
    // A save on a past day moves the view to that day; closing the sheet then
    // clears ?add. Applied one after the other from the same starting address,
    // the second would undo the first.
    const merged = mergeChanges(mergeChanges(undefined, { day: '2026-10-06', view: 'timeline' }), { add: null });
    expect(applyChange(new URLSearchParams('add=glucose&view=trends'), merged, today).toString()).toBe('day=2026-10-06');
  });
});
