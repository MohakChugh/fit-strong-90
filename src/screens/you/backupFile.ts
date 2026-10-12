/**
 * What makes a prepared backup file stale.
 *
 * The file is made when the Backup sheet opens, so the share button is one
 * fresh tap (iOS refuses to share from anything else). If the record changes
 * while the sheet is open, the file is made again — but recording that a
 * backup was saved must not count as a change to it.
 */

import type { UserSettings } from '@/types';

/** Settings as a backup sees them, without the record of backups itself. */
export function settingsKey(settings: UserSettings): string {
  const habits = { ...settings.habits };
  delete habits.lastExportAt;
  delete habits.lastExportSeq;
  return JSON.stringify({ ...settings, habits });
}
