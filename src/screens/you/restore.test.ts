import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { SetupAnswers } from '@/types/setup';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { replaceErases, restoreLocked } from './restore';

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

  it('the profile and settings, and the records', () => {
    expect(replaceErases({ ...empty, profile: createDefaultProfile() })).toBe('your profile and settings');
    expect(replaceErases({ ...empty, sessions: [{}, {}], profile: createDefaultProfile() })).toBe('the 2 sessions and your profile and settings');
  });
});
