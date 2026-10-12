import { describe, expect, it } from 'vitest';
import {
  answerReminder,
  clearReminders,
  getPending,
  prunePending,
  showReminders,
  subscribePending,
  withShown,
  withoutReminder,
} from './pending';
import type { Occurrence } from './schedule';

const at = (habit: Occurrence['habit'], clock: string, meal?: Occurrence['meal']): Occurrence => {
  const [h, m] = clock.split(':').map(Number);
  const key = meal ? `${habit}:${meal}` : habit;
  return { habit, ...(meal ? { meal } : {}), day: '2026-10-08', minute: h * 60 + m, id: `${key}@2026-10-08T${clock}` };
};

describe('withShown', () => {
  it('puts the newest first', () => {
    const list = withShown([], [at('sittingBreak', '10:30'), at('water', '11:00')], 1);
    expect(list.map(p => p.occurrence.id)).toEqual(['water@2026-10-08T11:00', 'sittingBreak@2026-10-08T10:30']);
  });

  it('replaces an unanswered reminder of the same habit instead of stacking', () => {
    const first = withShown([], [at('water', '11:00'), at('sittingBreak', '11:00')], 1);
    const next = withShown(first, [at('water', '13:00')], 2);
    expect(next.map(p => p.occurrence.id)).toEqual(['water@2026-10-08T13:00', 'sittingBreak@2026-10-08T11:00']);
  });

  it('keeps one per habit even when handed two', () => {
    expect(withShown([], [at('water', '11:00'), at('water', '13:00')], 1).map(p => p.occurrence.id)).toEqual(['water@2026-10-08T13:00']);
  });

  it('treats each meal as its own reminder', () => {
    const list = withShown([], [at('mealWalk', '13:30', 'lunch')], 1);
    expect(withShown(list, [at('mealWalk', '20:30', 'dinner')], 2).length).toBe(2);
  });
});

describe('withoutReminder', () => {
  it('removes exactly the one answered', () => {
    const list = withShown([], [at('water', '11:00'), at('sittingBreak', '11:00')], 1);
    expect(withoutReminder(list, 'water@2026-10-08T11:00').map(p => p.occurrence.id)).toEqual(['sittingBreak@2026-10-08T11:00']);
    expect(withoutReminder(list, 'nothing').length).toBe(2);
  });
});

describe('the shared list', () => {
  it('tells subscribers about each change, and not about a non-change', () => {
    clearReminders();
    let heard = 0;
    const stop = subscribePending(() => heard++);
    showReminders([at('water', '11:00')]);
    expect(getPending().length).toBe(1);
    answerReminder('not-there');
    answerReminder('water@2026-10-08T11:00');
    expect(getPending()).toEqual([]);
    clearReminders();
    stop();
    showReminders([at('water', '13:00')]);
    expect(heard).toBe(2);
    clearReminders();
  });
});

describe('prunePending', () => {
  it('drops what may no longer show, keeps the rest, and tells subscribers once', () => {
    clearReminders();
    showReminders([at('water', '11:00'), at('sittingBreak', '11:00')]);
    let heard = 0;
    const stop = subscribePending(() => heard++);
    prunePending(p => p.occurrence.habit !== 'water');
    expect(getPending().map(p => p.occurrence.habit)).toEqual(['sittingBreak']);
    // Nothing to drop: no change, no news.
    prunePending(() => true);
    expect(heard).toBe(1);
    stop();
    clearReminders();
  });
});
