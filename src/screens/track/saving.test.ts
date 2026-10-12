import { describe, expect, it, vi } from 'vitest';
import { glucoseEscalation } from './escalation';
import { SAVE_WORDS, saveLabel, saveWithGuidance, settle } from './saving';

const never = () => new Promise<string | undefined>(() => {});

describe('saveWithGuidance (F01): guidance first, the write only settles its status', () => {
  it('shows the guidance for a dangerous reading before a pending write settles', () => {
    const show = vi.fn();
    const write = vi.fn(never);
    void saveWithGuidance({ escalation: glucoseEscalation(600, 'mg/dL'), write, show });
    expect(write).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('hands the guidance the write itself, so a refusal can be shown beside it', async () => {
    let pending: Promise<string | undefined> | undefined;
    await saveWithGuidance({ escalation: glucoseEscalation(600, 'mg/dL'), write: async () => 'Storage is full', show: p => { pending = p; } });
    expect(await settle(pending!)).toEqual({ state: 'failed', message: 'Storage is full' });
  });

  it('shows nothing for an ordinary reading, whose form keeps the error itself', async () => {
    const show = vi.fn();
    expect(await saveWithGuidance({ escalation: undefined, write: async () => 'Storage is full', show })).toBe('Storage is full');
    expect(show).not.toHaveBeenCalled();
  });
});

describe('save status words', () => {
  it('never says saved before the write has settled, nor after a refusal', () => {
    expect(saveLabel({ state: 'saving' }, SAVE_WORDS)).toBe('Saving on this device…');
    expect(saveLabel({ state: 'saved' }, SAVE_WORDS)).toBe('Saved on this device');
    expect(saveLabel({ state: 'failed', message: 'Storage is full' }, SAVE_WORDS)).toBe('Not saved: Storage is full');
  });

  it('settles a write into its state', async () => {
    expect(await settle(Promise.resolve(undefined))).toEqual({ state: 'saved' });
    expect(await settle(Promise.reject(new Error('boom')))).toEqual({ state: 'failed', message: 'boom' });
  });
});
