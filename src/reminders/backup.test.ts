import { describe, expect, it } from 'vitest';
import { BACKUP_EVERY_DAYS, backupMark, backupNudge, recordSpan } from './backup';

const DAY = 86_400_000;
const NOW = new Date(Date.UTC(2026, 9, 8, 12, 0, 0));
const ago = (days: number, extraMs = 0) => NOW.getTime() - days * DAY - extraMs;
const iso = (ms: number) => new Date(ms).toISOString();

describe('backupNudge', () => {
  it('stays quiet when there is nothing to back up', () => {
    expect(backupNudge(NOW, undefined, {})).toEqual({ due: false });
    expect(backupNudge(NOW, { at: iso(ago(400)) }, {})).toEqual({ due: false });
  });

  it('never backed up: asks once the oldest record is a month old', () => {
    expect(BACKUP_EVERY_DAYS).toBe(30);
    expect(backupNudge(NOW, undefined, { first: ago(29, 1), last: ago(0) }).due).toBe(false);
    expect(backupNudge(NOW, undefined, { first: ago(30), last: ago(0) }).due).toBe(true);
    expect(backupNudge(NOW, undefined, { first: ago(30) }).due).toBe(false);
  });

  it('backed up before: asks a month later, if anything new was recorded since', () => {
    expect(backupNudge(NOW, { at: iso(ago(29)) }, { first: ago(90), last: ago(1) })).toEqual({ due: false, daysSince: 29 });
    expect(backupNudge(NOW, { at: iso(ago(30)) }, { first: ago(90), last: ago(1) })).toEqual({ due: true, daysSince: 30 });
    expect(backupNudge(NOW, { at: iso(ago(45)) }, { first: ago(90), last: ago(44) })).toEqual({ due: true, daysSince: 45 });
  });

  it('does not ask when nothing changed since the last backup, however old', () => {
    expect(backupNudge(NOW, { at: iso(ago(45)) }, { first: ago(90), last: ago(46) })).toEqual({ due: false, daysSince: 45 });
    expect(backupNudge(NOW, { at: iso(ago(45)) }, { first: ago(90), last: ago(45) })).toEqual({ due: false, daysSince: 45 });
  });

  it('reads a backup stamped a little after the screen read the clock as just made, not as a changed clock', () => {
    // The screen read the time when it opened; the backup was made minutes later,
    // or on a device whose clock runs a few minutes ahead.
    const span = { first: ago(120), last: ago(1) };
    expect(backupNudge(NOW, { at: iso(NOW.getTime() + 5 * 60_000) }, span)).toEqual({ due: false, daysSince: 0 });
    expect(backupNudge(NOW, { at: iso(NOW.getTime() + DAY - 1) }, span)).toEqual({ due: false, daysSince: 0 });
  });

  it('treats an unreadable or future backup date as no backup at all', () => {
    expect(backupNudge(NOW, { at: 'last Tuesday' }, { first: ago(40), last: ago(1) })).toEqual({ due: true });
    expect(backupNudge(NOW, { at: iso(NOW.getTime() + DAY) }, { first: ago(40), last: ago(1) })).toEqual({ due: true });
    expect(backupNudge(NOW, { at: iso(NOW.getTime() + DAY) }, { first: ago(10), last: ago(1) })).toEqual({ due: false });
  });
});

describe('recordSpan', () => {
  it('finds the earliest and latest moment across every kind of record', () => {
    const span = recordSpan({
      observations: [
        { at: '2026-09-01T08:00:00.000+05:30' },
        { at: '2026-09-02T08:00:00.000+05:30', editedAt: '2026-10-05T10:00:00.000+05:30' },
      ],
      sessions: [{ date: '2026-08-20', startedAt: '2026-08-20T06:00:00.000Z', completedAt: '2026-08-20T07:00:00.000Z' }],
      checkIns: [{ date: '2026-10-01' }],
      bodyMetrics: [{ date: '2026-08-15' }],
    });
    expect(span.first).toBe(new Date('2026-08-15T00:00:00').getTime());
    expect(span.last).toBe(Date.parse('2026-10-05T10:00:00.000+05:30'));
  });

  it('is empty for an empty record, and ignores what it cannot read', () => {
    expect(recordSpan({ observations: [], sessions: [], checkIns: [], bodyMetrics: [] })).toEqual({});
    expect(recordSpan({
      observations: [{ at: 'not a time' }],
      sessions: [{ date: '', startedAt: null, completedAt: null }],
      checkIns: [{ date: '2026-13-45' }],
      bodyMetrics: [],
    })).toEqual({});
  });

  it('counts a date-only record from that day\'s midnight, the earliest it could have been made', () => {
    const span = recordSpan({ observations: [], sessions: [], checkIns: [{ date: '2026-10-08' }], bodyMetrics: [] });
    expect(span.first).toBe(new Date(2026, 9, 8).getTime());
  });
});

describe('backupNudge, against the stored revision the backup holds', () => {
  // Backed up 31 days ago at revision 10; recording that mark was revision 11.
  const backedUp = { at: iso(ago(31)), revision: 10 };
  // A record whose every date is long before the backup.
  const old = { first: ago(200), last: ago(150) };

  it('counts anything stored after the backup as new, whatever date it is for', () => {
    // A backdated session, a past check-in, a profile or a settings edit: each moves the revision.
    expect(backupNudge(NOW, backedUp, old, 12)).toEqual({ due: true, daysSince: 31 });
  });

  it('does not count recording the backup itself, the one change it always makes', () => {
    expect(backupNudge(NOW, backedUp, old, 11)).toEqual({ due: false, daysSince: 31 });
    // Even with a record dated after it: the revision says it was in the file.
    expect(backupNudge(NOW, backedUp, { first: ago(200), last: ago(1) }, 11).due).toBe(false);
  });

  it('still waits a month after the backup, however much is new', () => {
    expect(backupNudge(NOW, { at: iso(ago(29)), revision: 10 }, old, 40)).toEqual({ due: false, daysSince: 29 });
  });

  it('judges a mark from another database, at or past this one\'s revision, by dates', () => {
    // A backup restored from another device's file carries that device's numbers.
    expect(backupNudge(NOW, { at: iso(ago(31)), revision: 500 }, old, 12).due).toBe(false);
    expect(backupNudge(NOW, { at: iso(ago(31)), revision: 500 }, { first: ago(200), last: ago(1) }, 12).due).toBe(true);
    expect(backupNudge(NOW, { at: iso(ago(31)), revision: 12 }, old, 12).due).toBe(false);
    // Exactly at this revision cannot be this database's own mark, which is always followed by its own commit.
    expect(backupNudge(NOW, { at: iso(ago(31)), revision: 12 }, { first: ago(200), last: ago(1) }, 12).due).toBe(true);
  });

  it('judges a mark without a revision, or without the current one, by dates', () => {
    expect(backupNudge(NOW, { at: iso(ago(31)) }, { first: ago(200), last: ago(1) }, 12).due).toBe(true);
    expect(backupNudge(NOW, { at: iso(ago(31)) }, old, 12).due).toBe(false);
    expect(backupNudge(NOW, backedUp, old).due).toBe(false);
  });
});

describe('backupMark', () => {
  it('reads the mark the habits keep, with or without a revision', () => {
    expect(backupMark(undefined)).toBeUndefined();
    expect(backupMark({ lastExportSeq: 3 })).toBeUndefined();
    expect(backupMark({ lastExportAt: 'x' })).toEqual({ at: 'x' });
    expect(backupMark({ lastExportAt: 'x', lastExportSeq: 3 })).toEqual({ at: 'x', revision: 3 });
  });
});
