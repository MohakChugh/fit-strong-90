/**
 * When to suggest backing up (D17).
 *
 * The record lives only on this device, so losing the device loses the
 * record unless there is a copy. A gentle monthly nudge, and only when there
 * is something new to protect: a nudge that fires with nothing changed since
 * the last backup teaches people to ignore it.
 *
 * "Something new" is judged by the store's revision, which moves on every
 * stored change — a reading entered today for last June, a backdated workout,
 * a past check-in, a profile or a settings edit alike. A backup's mark holds
 * the revision of the snapshot in its file (Codex screens review F27).
 */

/** "Monthly", as the platform research recommends. */
export const BACKUP_EVERY_DAYS = 30;

const DAY_MS = 86_400_000;

/** The earliest and latest moment anything in the record was written, as epoch ms. */
export interface RecordSpan {
  first?: number;
  last?: number;
}

/** What the last backup held: when its snapshot was taken, and that snapshot's stored revision. */
export interface BackupMark {
  at?: string;
  /** Absent for a backup made before revisions were kept: judged by dates. */
  revision?: number;
}

export interface BackupNudge {
  due: boolean;
  /** Whole days since the last backup; absent when there has never been one. */
  daysSince?: number;
}

/** The last backup's mark, as the habits keep it. */
export function backupMark(habits: { lastExportAt?: string; lastExportSeq?: number } | undefined): BackupMark | undefined {
  if (habits?.lastExportAt === undefined) return undefined;
  return { at: habits.lastExportAt, ...(habits.lastExportSeq !== undefined ? { revision: habits.lastExportSeq } : {}) };
}

/**
 * Whether to suggest a backup now. `revision` is the store's stored revision.
 *
 * - Nothing recorded: no.
 * - Never backed up: once the oldest record is a month old. A first day's
 *   two entries are not worth a nag; a month of history is.
 * - Backed up before: when that was a month ago or more *and* the record holds
 *   something the backup does not (`newSince`).
 *
 * A backup date a day or more in the future (the clock was changed) or one
 * that cannot be read counts as never, which errs towards suggesting a copy.
 * One less than a day ahead was just made: after the screen read the clock,
 * or on a device whose clock runs a little fast.
 */
export function backupNudge(now: Date, mark: BackupMark | undefined, span: RecordSpan, revision?: number): BackupNudge {
  if (span.first === undefined || span.last === undefined) return { due: false };

  const exported = mark?.at === undefined ? NaN : Date.parse(mark.at);
  if (!Number.isFinite(exported) || exported - now.getTime() >= DAY_MS) {
    return { due: now.getTime() - span.first >= BACKUP_EVERY_DAYS * DAY_MS };
  }

  const daysSince = Math.max(0, Math.floor((now.getTime() - exported) / DAY_MS));
  return { due: daysSince >= BACKUP_EVERY_DAYS && newSince({ at: exported, revision: mark?.revision }, span, revision), daysSince };
}

/**
 * Whether the record holds something the backup does not. Recording the
 * backup's mark is itself one stored change, so anything beyond it is new.
 * Revisions belong to one database: a mark at or past this one's revision
 * came from another (a restored file's settings), and like a mark made before
 * revisions were kept, it is judged by the records' dates.
 */
function newSince(mark: { at: number; revision?: number }, span: RecordSpan, revision: number | undefined): boolean {
  if (mark.revision !== undefined && revision !== undefined && mark.revision < revision) return revision > mark.revision + 1;
  return (span.last ?? -Infinity) > mark.at;
}

/** The parts of the store a span is read from. Structural, so tests need no store. */
export interface SpanSource {
  observations: readonly { at: string; editedAt?: string }[];
  sessions: readonly { date: string; startedAt: string | null; completedAt: string | null }[];
  checkIns: readonly { date: string }[];
  bodyMetrics: readonly { date: string }[];
}

/**
 * A date-only record (`YYYY-MM-DD`) counts from that day's local midnight:
 * the earliest it can have been written, so it never makes a record look
 * newer than its backup.
 */
function moment(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`).getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

export function recordSpan(source: SpanSource): RecordSpan {
  let first: number | undefined;
  let last: number | undefined;
  const see = (value: string | null | undefined) => {
    const ms = moment(value);
    if (ms === undefined) return;
    if (first === undefined || ms < first) first = ms;
    if (last === undefined || ms > last) last = ms;
  };
  for (const o of source.observations) { see(o.at); see(o.editedAt); }
  for (const s of source.sessions) { see(s.date); see(s.startedAt); see(s.completedAt); }
  for (const c of source.checkIns) see(c.date);
  for (const m of source.bodyMetrics) see(m.date);
  return { ...(first !== undefined ? { first } : {}), ...(last !== undefined ? { last } : {}) };
}
