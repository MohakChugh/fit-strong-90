import { describe, expect, it } from 'vitest';
import type { UserSettings } from '@/types';
import { settingsKey } from './backupFile';

describe('settingsKey', () => {
  const settings = { theme: 'system', focus: 'stretch', habits: { inApp: false } } as unknown as UserSettings;

  it('ignores the record of backups, so recording one does not make the file stale', () => {
    const stamped = { ...settings, habits: { ...settings.habits, lastExportAt: '2026-10-08T09:00:00.000+05:30', lastExportSeq: 9 } };
    expect(settingsKey(stamped)).toBe(settingsKey(settings));
  });

  it('notices any other change', () => {
    expect(settingsKey({ ...settings, focus: 'move' })).not.toBe(settingsKey(settings));
    expect(settingsKey({ ...settings, habits: { inApp: true } })).not.toBe(settingsKey(settings));
  });
});
