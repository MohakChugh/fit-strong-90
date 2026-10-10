import { describe, expect, it } from 'vitest';
import { RECORD_STORES } from '@/store/records';
import type { CollectionCounts, ImportPreview } from '@/store/transfer';
import { shortDate } from './dates';
import { backupLine, backupState, checkOutcome, checkedLine, fileSize, installStatus, storageLine } from './dataStatus';

const AT = '2026-10-08T09:00:00.000+05:30';
const OLDER = '2026-10-01T09:00:00.000+05:30';
/** Nothing left out of any collection. */
const none = {
  observations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0, focusOverrides: 0, contentState: 0,
  ...Object.fromEntries(RECORD_STORES.map(s => [s, 0])),
} as CollectionCounts;
const whole: Pick<ImportPreview, 'exportedAt' | 'rejected' | 'unreadableObservations' | 'unreadableFields'> = { exportedAt: AT, rejected: none, unreadableObservations: 0, unreadableFields: [] };

describe('the backup’s state (B-25)', () => {
  it('is never until a backup has been handed over', () => {
    expect(backupLine(backupState(undefined))).toBe('Last backup: never');
    expect(backupLine(backupState({}))).toBe('Last backup: never');
  });
  it('tells a shared or downloaded backup from a checked one', () => {
    expect(backupLine(backupState({ lastExportAt: AT, lastExportVia: 'share' }))).toBe(`Last backup: shared ${shortDate(AT)} · not checked`);
    expect(backupLine(backupState({ lastExportAt: AT, lastExportVia: 'download' }))).toBe(`Last backup: downloaded ${shortDate(AT)} · not checked`);
    expect(backupLine(backupState({ lastExportAt: AT }))).toBe(`Last backup: ${shortDate(AT)} · not checked`);
    expect(backupLine(backupState({ lastExportAt: AT, lastExportVia: 'share', lastCheckedExportAt: AT }))).toBe(`Last backup: shared ${shortDate(AT)} · checked`);
  });
  it('never counts an older backup’s check for a newer one', () => {
    expect(backupState({ lastExportAt: AT, lastCheckedExportAt: OLDER }).kind).toBe('shared');
  });
});

describe('a backup file read back (B-25; Review Focus 5)', () => {
  it('is the latest only when it is whole and its snapshot is the last backup’s', () => {
    expect(checkOutcome(whole, AT)).toBe('latest');
    expect(checkOutcome(whole, OLDER)).toBe('other');
    expect(checkOutcome(whole, undefined)).toBe('other');
    expect(checkOutcome({ ...whole, exportedAt: undefined }, AT)).toBe('undated');
    expect(checkOutcome({ ...whole, unreadableObservations: 2 }, AT)).toBe('damaged');
    expect(checkOutcome({ ...whole, rejected: { ...none, sessions: 1 } }, AT)).toBe('damaged');
    expect(checkOutcome({ ...whole, unreadableFields: ['settings.theme'] }, AT)).toBe('damaged');
  });
  it('says what the check found', () => {
    expect(checkedLine('latest', AT, AT, 'iPhone')).toBe(`Checked. This is your latest backup, made ${shortDate(AT)}, and it reads back whole.`);
    expect(checkedLine('other', OLDER, AT, 'iPhone')).toBe(`This file reads back, but it isn’t your latest backup: it was made ${shortDate(OLDER)}, and your latest is from ${shortDate(AT)}.`);
    expect(checkedLine('other', OLDER, undefined, 'iPhone')).toBe('This file reads back, but no backup has been made on this iPhone yet, so there is nothing to match it to.');
    expect(checkedLine('undated', undefined, AT, 'iPhone')).toBe('This file reads back, but it doesn’t say when it was made, so it can’t be matched to your latest backup.');
    expect(checkedLine('damaged', AT, AT, 'iPhone')).toBe('Parts of this file can’t be read, so it isn’t a whole backup. Make a new one.');
  });

  describe('an older file from the same date as the latest says both times, as the dates alone can’t tell them apart', () => {
    // Local times, so the times read the same in any time zone.
    const MORNING = new Date(2026, 9, 8, 9, 5).toISOString();
    const EVENING = new Date(2026, 9, 8, 18, 30).toISOString();
    const DAY = shortDate(MORNING);

    it('on a 12-hour clock', () => {
      expect(DAY).toBe(shortDate(EVENING));
      expect(checkedLine('other', MORNING, EVENING, 'iPhone', true))
        .toBe(`This file reads back, but it isn’t your latest backup: it was made ${DAY}, 9:05 am, and your latest is from ${DAY}, 6:30 pm.`);
    });

    it('on a 24-hour clock', () => {
      expect(checkedLine('other', MORNING, EVENING, 'iPhone', false))
        .toBe(`This file reads back, but it isn’t your latest backup: it was made ${DAY}, 09:05, and your latest is from ${DAY}, 18:30.`);
    });

    it('a file from another date keeps the dates alone', () => {
      const before = new Date(2026, 9, 7, 9, 5).toISOString();
      expect(checkedLine('other', before, EVENING, 'iPhone', true))
        .toBe(`This file reads back, but it isn’t your latest backup: it was made ${shortDate(before)}, and your latest is from ${DAY}.`);
    });

    it('a date that can’t be read is never given a time, even beside another that can’t', () => {
      // Both read "on a date that cannot be read": the same words, but not the same date, and no time to give.
      const neither = checkedLine('other', 'not a date', 'nor this', 'iPhone', true);
      expect(neither).toContain('it was made on a date that cannot be read, and your latest is from');
      expect(neither).toMatch(/cannot be read\.$/);
      expect(checkedLine('other', 'not a date', EVENING, 'iPhone', true)).not.toMatch(/\d:\d\d/);
    });
  });
});

describe('install status (B-24)', () => {
  it('says installing helps but is not a backup, and what Safari may do', () => {
    expect(installStatus('installed', 'iPhone')).toEqual({ label: 'Installed', detail: 'Installing helps iPhone keep your data, but it isn’t a backup.' });
    expect(installStatus('installed', 'device').detail).toBe('Installing helps this device keep your data, but it isn’t a backup.');
    expect(installStatus('iosBrowser', 'iPhone')).toEqual({ label: 'Not installed', detail: 'Safari may remove data from websites you haven’t opened for a while.' });
    expect(installStatus('desktop', 'device')).toEqual({ label: 'In this browser', detail: 'Clearing this browser’s data would delete it. Back up now and then.' });
  });
});

describe('sizes', () => {
  it('reads bytes as KB or MB, and an unknown use plainly', () => {
    expect(fileSize(300)).toBe('1 KB');
    expect(fileSize(5 * 1024)).toBe('5 KB');
    expect(fileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(storageLine(2.5 * 1024 * 1024)).toBe('About 2.5 MB');
    expect(storageLine(undefined)).toBe('Not known in this browser');
    expect(storageLine(Number.NaN)).toBe('Not known in this browser');
  });
});
