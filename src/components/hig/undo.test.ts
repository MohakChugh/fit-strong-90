import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UndoOutcome } from './undo';

type Shown = { text: string; id?: string; duration?: number; onDismiss?: () => void; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));

const { NOT_RESTORED, dismissUndoFor, endUndos, followPlace, offerUndo, resetUndosForTests } = await import('./undo');

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
/** What a toast says now: its latest showing. */
const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const ids = () => [...new Set(sonner.shown.map(s => s.id!))];
const standing = () => ids().filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo');
const press = async (id: string) => {
  latest(id).action!.onClick({ preventDefault() {} });
  await tick();
};
const offer = (text: string, scope: string, undo: () => Promise<UndoOutcome> = async () => ({ done: true }), entry?: string) =>
  offerUndo({ text: `${text} deleted`, restored: `${text} restored`, scope, ...(entry ? { entry } : {}), undo });

afterEach(() => {
  resetUndosForTests();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
});

describe('Undo, two deep, never on a timer (B-04, M19, D113)', () => {
  it('stacks a second, and a third ends the oldest', () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today');
    expect(standing()).toHaveLength(2);
    offer('Glucose 140 mg/dL', '/day/today');
    expect(standing()).toEqual(ids().slice(1));
  });

  it('restoring one keeps the other, and says so in its place until it is closed (K8-03)', async () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today');
    const [first, second] = ids();
    await press(first);
    expect(standing()).toEqual([second]);
    expect(latest(first)).toMatchObject({ text: 'Water 500 ml restored', action: { label: 'Close' } });
    expect(sonner.dismissed).not.toContain(first);
  });

  it('keeps the Undo in place, with why, when the restore didn’t save (K8-03)', async () => {
    offer('Water 500 ml', '/day/today', async () => ({ done: false, problem: 'This device is full.' }));
    const [first] = ids();
    await press(first);
    expect(latest(first)).toMatchObject({ text: `Water 500 ml deleted. ${NOT_RESTORED} This device is full.`, action: { label: 'Undo' } });
    expect(standing()).toEqual([first]);
  });

  it('says what happened, never a failure, when there was nothing to put back (K8-06)', async () => {
    offer('Glucose 118 mg/dL', '/day/today', async () => ({ done: true, said: 'Already back in your check-in.' }));
    const [first] = ids();
    await press(first);
    expect(latest(first).text).toBe('Already back in your check-in.');
    expect(sonner.shown.some(s => /didn’t save|wasn’t restored/.test(s.text))).toBe(false);
  });

  it('asks once for a second tap while the first restore is saving', async () => {
    let asked = 0;
    offer('Water 500 ml', '/day/today', async () => { asked += 1; return { done: true }; });
    const [first] = ids();
    latest(first).action!.onClick({ preventDefault() {} });
    latest(first).action!.onClick({ preventDefault() {} });
    await tick();
    expect(asked).toBe(1);
  });

  it('puts nothing on a timer', async () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today', async () => ({ done: false, problem: 'No space.' }));
    for (const id of ids()) await press(id);
    expect(sonner.shown.every(s => s.duration === Infinity)).toBe(true);
  });

  it('says nothing when a restore settles after its Undo has ended, by leaving, an edit or a swipe, and the Undo that stands now stays (P8S-16)', async () => {
    const waits: ((o: UndoOutcome) => void)[] = [];
    const slow = () => new Promise<UndoOutcome>(resolve => waits.push(resolve));
    const ends: [string, (first: string) => void, UndoOutcome][] = [
      ['its screen left', () => followPlace({ path: '/home' }), { done: true }],
      ['an edit stored', () => endUndos(), { done: false, problem: 'No space.' }],
      ['swiped away', first => latest(first).onDismiss!(), { done: true }],
    ];
    for (const [how, end, outcome] of ends) {
      resetUndosForTests();
      sonner.shown.length = 0;
      sonner.dismissed.length = 0;
      waits.length = 0;
      offer('Water 500 ml', '/day/today', slow);
      const [first] = ids();
      // Undo tapped: its restore is still saving.
      latest(first).action!.onClick({ preventDefault() {} });
      end(first);
      offer('Water 250 ml', '/home');
      const [, second] = ids();
      const said = sonner.shown.filter(x => x.id === first).length;
      waits[0](outcome);
      await tick();
      expect(sonner.shown.filter(x => x.id === first).length, how).toBe(said);
      expect(standing(), how).toContain(second);
    }
  });

  it('forgets a toast the person swiped away, so it no longer counts towards the two', () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today');
    latest(ids()[0]).onDismiss!();
    offer('Glucose 140 mg/dL', '/day/today');
    // The one swiped away left room: nothing else is ended to make it.
    expect(sonner.dismissed).toEqual([]);
  });

  it('follows where each screen was opened from, and a tab that later reopens a detail doesn’t bring it back (P8-14)', () => {
    offer('Water 500 ml', '/day/today');
    followPlace({ path: '/track/reading/g1', from: '/day/today' });
    followPlace({ path: '/track/walk/W', from: '/track/reading/g1' });
    followPlace({ path: '/day/today' });
    expect(standing()).toHaveLength(1);
    followPlace({ path: '/home' });
    expect(standing()).toEqual([]);
    followPlace({ path: '/track/reading/g1', from: '/day/today' });
    expect(standing()).toEqual([]);
  });

  it('ends on a detail opened from another screen, and a restored line goes when its screen is left', async () => {
    offer('Glucose 140 mg/dL', '/hub/glucose');
    followPlace({ path: '/track/walk/W', from: '/day/today' });
    expect(standing()).toEqual([]);
    offer('Water 500 ml', '/day/today');
    const water = ids()[1];
    await press(water);
    followPlace({ path: '/home' });
    expect(sonner.dismissed).toContain(water);
  });

  it('keeps a restored line beside two newer Undos: only Undos count towards the two', async () => {
    offer('Water 500 ml', '/day/today');
    const [first] = ids();
    await press(first);
    offer('Water 250 ml', '/day/today');
    offer('Glucose 140 mg/dL', '/day/today');
    expect(sonner.dismissed).toEqual([]);
    expect(latest(first).text).toBe('Water 500 ml restored');
    expect(standing()).toEqual(ids().slice(1));
  });

  it('holds the toast open while it restores: the tap stops it closing itself', () => {
    offer('Water 500 ml', '/day/today');
    const preventDefault = vi.fn();
    latest(ids()[0]).action!.onClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('asks again on Undo after a restore that didn’t save', async () => {
    let asked = 0;
    offer('Water 500 ml', '/day/today', async () => (++asked === 1 ? { done: false, problem: 'No space.' } : { done: true }));
    const [first] = ids();
    await press(first);
    await press(first);
    expect(asked).toBe(2);
    expect(latest(first)).toMatchObject({ text: 'Water 500 ml restored', action: { label: 'Close' } });
  });

  it('says nothing when its entry is restored from Recently deleted while its own restore saves', async () => {
    let finish: (o: UndoOutcome) => void = () => undefined;
    offer('Water 500 ml', '/day/today', () => new Promise<UndoOutcome>(resolve => { finish = resolve; }), 'deleted-1');
    const [first] = ids();
    latest(first).action!.onClick({ preventDefault() {} });
    dismissUndoFor('deleted-1');
    const said = sonner.shown.filter(s => s.id === first).length;
    finish({ done: false, problem: 'It was restored already.' });
    await tick();
    expect(sonner.shown.filter(s => s.id === first).length).toBe(said);
    expect(sonner.dismissed).toContain(first);
  });

  it('ends every Undo on an edit, and one whose entry was restored from Recently deleted', () => {
    offer('Water 500 ml', '/day/today', undefined, 'deleted-1');
    offer('Water 250 ml', '/day/today', undefined, 'deleted-2');
    dismissUndoFor('deleted-1');
    expect(standing()).toEqual([ids()[1]]);
    endUndos();
    expect(standing()).toEqual([]);
  });
});
