import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import type { AppData } from '@/types';
import type { SetupAnswers } from '@/types/setup';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { render } from '@/test/host';
import type { ImportPreview } from '@/store/transfer';
import { replaceErases, restoreLocked } from './restore';
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

describe('what Replace erases, so it is asked twice whenever something would go (H5-25, K5-06)', () => {
  const settings = migrateData({ version: CURRENT_VERSION } as AppData).settings;
  const empty = { observations: [], sessions: [], checkIns: [], bodyMetrics: [], personalRecords: [], settings };
  const draft = (answers: SetupAnswers) => ({ ...empty, settings: { ...settings, setup: { stage: 'open' as const, draft: { at: 'about.figure' as const, answers } } } });

  it('nothing on a device that holds nothing, or only the usual unit', () => {
    expect(replaceErases(empty)).toBeUndefined();
    expect(replaceErases(draft({ metric: true }))).toBeUndefined();
  });

  it('the setup answers so far, with no records', () => {
    expect(replaceErases(draft({ metric: true, name: 'Kai' }))).toBe('your setup answers so far');
  });

  it('a number typed that isn’t an answer yet is one of them (H5R-17)', () => {
    const typed = { ...empty, settings: { ...settings, setup: { stage: 'open' as const, draft: { at: 'about.name' as const, answers: { metric: true }, raw: { birthYear: '195' } } } } };
    expect(replaceErases(typed)).toBe('your setup answers so far');
  });

  it('settings the person changed, with no profile or answers: Display, reminders, Home, a goal (H5-25, H5R-17)', () => {
    const changed = (patch: Partial<typeof settings>) => replaceErases({ ...empty, settings: { ...settings, ...patch } });
    expect(changed({ display: { textScale: 1.3 } as never })).toBe('your settings');
    expect(changed({ habits: { water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' } } })).toBe('your settings');
    expect(changed({ weeklyMovementGoalMinutes: 90 })).toBe('your settings');
    const named = draft({ metric: true, name: 'Kai' });
    expect(replaceErases({ ...named, settings: { ...named.settings, theme: 'dark' } })).toBe('your setup answers so far and your settings');
  });

  it('but not what the app keeps for itself: the unit, setup’s stage, a backup’s own marks', () => {
    const kept = (patch: Partial<typeof settings>) => replaceErases({ ...empty, settings: { ...settings, ...patch } });
    expect(kept({ useMetric: !settings.useMetric })).toBeUndefined();
    expect(kept({ onboardingComplete: true, setup: { stage: 'lookAround' } })).toBeUndefined();
    expect(kept({ habits: { lastExportAt: '2026-10-08T19:00:00.000+05:30', lastExportSeq: 4, lastExportVia: 'share' } })).toBeUndefined();
  });

  it('nor this phone’s own walk answers and records, which Replace keeps whatever the file holds (`withDeviceConsent`; B-26, board D174, D176)', () => {
    const walk = (w: NonNullable<typeof settings.walk>) => replaceErases({ ...empty, settings: { ...settings, walk: w } });
    // Keep walk routes answered in Me → Data; a change to the clock the page saw, walking or not (D185); an "Erase all routes".
    expect(walk({ saveRoutes: true, map: 'off' })).toBeUndefined();
    expect(walk({ saveRoutes: 'unasked', map: 'unasked', clock: { generation: 1, days: ['2026-10-12'] } })).toBeUndefined();
    expect(walk({ saveRoutes: false, map: 'unasked', erased: { generation: 1, walks: ['mgk1walk-0001aaaa'] } })).toBeUndefined();
    // Beside a setting Replace does take, that one is still named.
    expect(replaceErases({ ...empty, settings: { ...settings, walk: { saveRoutes: true, map: 'on' }, theme: 'dark' } })).toBe('your settings');
  });

  it('the profile and settings, and the records', () => {
    expect(replaceErases({ ...empty, profile: createDefaultProfile() })).toBe('your profile and settings');
    expect(replaceErases({ ...empty, sessions: [{}, {}], profile: createDefaultProfile() })).toBe('the 2 sessions and your profile and settings');
  });

  it('the walk routes kept here, as records Replace deletes, with no other records (Plan 6 with H5-25)', () => {
    expect(replaceErases({ ...empty, records: { routes: [{}, {}] } })).toBe('the 2 routes');
    expect(replaceErases({ ...empty, records: { routes: [{}] }, profile: createDefaultProfile() })).toBe('the 1 route and your profile and settings');
  });
});

describe('a merge’s preview, for records brought back on another device (board D136, D147)', () => {
  const preview = (over: Partial<ImportPreview>): ImportPreview => ({
    ok: true, observations: {}, unreadableObservations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0, focusOverrides: 0,
    hasSettings: false, hasProfile: false, alreadyHere: 0, isEmpty: false, records: { meals: 3 }, ...over,
  });
  const shown = (over: Partial<ImportPreview>) => {
    const h = render(createElement(PreviewBody, { preview: preview(over), saveRoutes: false, place: 'you', device: 'phone', erases: true, onMerge() {}, onReplace() {} }));
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
