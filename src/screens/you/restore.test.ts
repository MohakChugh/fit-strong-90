import { describe, expect, it } from 'vitest';
import { restoreLocked } from './restore';

describe('restoreLocked (N04)', () => {
  it('holds the sheet open and refuses another file while an import is being written', () => {
    expect(restoreLocked({ kind: 'importing' })).toBe(true);
  });

  it('lets everything else be closed and replaced', () => {
    for (const kind of ['idle', 'reading', 'problem', 'preview', 'confirmReplace', 'done'] as const) {
      expect(restoreLocked({ kind }), kind).toBe(false);
    }
  });
});
