import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render } from '@/test/host';
import type { ImportPreview } from '@/store/transfer';
import { restoreLocked } from './restore';
import { PreviewBody } from './RestoreFlow';

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

describe('a merge’s preview, for records brought back on another device (board D136, D147)', () => {
  const preview = (over: Partial<ImportPreview>): ImportPreview => ({
    ok: true, observations: {}, unreadableObservations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0, focusOverrides: 0,
    hasSettings: false, hasProfile: false, alreadyHere: 0, isEmpty: false, records: { meals: 3 }, ...over,
  });
  const shown = (over: Partial<ImportPreview>) => {
    const h = render(createElement(PreviewBody, { preview: preview(over), place: 'you', device: 'phone', heldHere: 3, onMerge() {}, onReplace() {} }));
    const text = h.text();
    h.unmount();
    return text;
  };

  it('says a copy that takes its original’s place counts once, and one that differs from this phone’s is left out', () => {
    const text = shown({ restoredHere: 1, restoredKept: 2 });
    expect(text).toContain('1 record on this phone was deleted and brought back on the device the file came from. Merging keeps the brought-back copy in its place, once.');
    expect(text).toContain('2 records in it were brought back on the device the file came from, and differ from this phone’s. Merging keeps this phone’s and leaves the brought-back copies out.');
    expect(shown({ restoredKept: 1 })).toContain('1 record in it was brought back on the device the file came from, and differs from this phone’s. Merging keeps this phone’s and leaves the brought-back copy out.');
    expect(shown({ restoredHere: 0, restoredKept: 0 })).not.toContain('brought back');
  });
});
