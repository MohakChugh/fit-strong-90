/**
 * What Me → Data says about where the record is and how safe it is (journey
 * §6.5, §16; B-24, B-25), as plain lines. Pure, so each sentence is tested.
 */
import type { ImportPreview } from '@/store/transfer';
import type { HabitSettings } from '@/types/habits';
import type { InstallContext } from '@/screens/welcome/install';
import { shortDate } from './dates';

export type BackupState =
  | { kind: 'never' }
  | { kind: 'shared' | 'checked'; at: string; via?: 'share' | 'download' };

/**
 * The last backup, told apart (B-25): never made, handed over but not read
 * back, or checked. A cancelled share is none of these: it is never recorded.
 */
export function backupState(habits: Pick<HabitSettings, 'lastExportAt' | 'lastExportVia' | 'lastCheckedExportAt'> | undefined): BackupState {
  const at = habits?.lastExportAt;
  if (at === undefined) return { kind: 'never' };
  const via = habits?.lastExportVia;
  return { kind: habits?.lastCheckedExportAt === at ? 'checked' : 'shared', at, ...(via ? { via } : {}) };
}

export function backupLine(state: BackupState): string {
  if (state.kind === 'never') return 'Last backup: never';
  const how = state.via === 'share' ? 'shared ' : state.via === 'download' ? 'downloaded ' : '';
  return `Last backup: ${how}${shortDate(state.at)} · ${state.kind === 'checked' ? 'checked' : 'not checked'}`;
}

/** B-24's words for where the app is running. */
export function installStatus(context: InstallContext, device: string): { label: string; detail: string } {
  if (context === 'installed') return { label: 'Installed', detail: `Installing helps ${device === 'device' ? 'this device' : device} keep your data, but it isn’t a backup.` };
  if (context === 'iosBrowser') return { label: 'Not installed', detail: 'Safari may remove data from websites you haven’t opened for a while.' };
  return { label: 'In this browser', detail: 'Clearing this browser’s data would delete it. Back up now and then.' };
}

export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Storage used (§18.3), as the browser estimates it. */
export function storageLine(usage: number | undefined): string {
  return usage === undefined || !Number.isFinite(usage) || usage < 0 ? 'Not known in this browser' : `About ${fileSize(usage)}`;
}

export type CheckOutcome = 'latest' | 'other' | 'undated' | 'damaged';

/** A file read back: whole and the last backup's own snapshot, or why it isn't (B-25). */
export function checkOutcome(
  preview: Pick<ImportPreview, 'exportedAt' | 'rejected' | 'unreadableObservations' | 'unreadableFields'>,
  latest: string | undefined,
): CheckOutcome {
  const rejected = Object.values(preview.rejected ?? {}).reduce((n, k) => n + (k ?? 0), 0);
  if (rejected + preview.unreadableObservations + (preview.unreadableFields?.length ?? 0) > 0) return 'damaged';
  if (!preview.exportedAt) return 'undated';
  return preview.exportedAt === latest ? 'latest' : 'other';
}

export function checkedLine(outcome: CheckOutcome, made: string | undefined, latest: string | undefined, device: string): string {
  switch (outcome) {
    case 'latest': return `Checked. This is your latest backup, made ${shortDate(made ?? '')}, and it reads back whole.`;
    case 'damaged': return 'Parts of this file can’t be read, so it isn’t a whole backup. Make a new one.';
    case 'undated': return 'This file reads back, but it doesn’t say when it was made, so it can’t be matched to your latest backup.';
    case 'other': return latest
      ? `This file reads back, but it isn’t your latest backup: it was made ${shortDate(made ?? '')}, and your latest is from ${shortDate(latest)}.`
      : `This file reads back, but no backup has been made on this ${device} yet, so there is nothing to match it to.`;
  }
}
