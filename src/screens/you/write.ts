/**
 * How the You screens change nested settings.
 *
 * Through the store's `update`, not `setSettings({ habits: … })`: a screen that
 * builds the new habits from what it last rendered can lose a change made a
 * moment earlier that has not reached it yet — turn on water, then quickly
 * sitting breaks, and the second write would put water back off. `update`
 * hands the edit the latest state at the moment of writing, so both survive.
 */

import { getState, update, type UpdateOptions } from '@/store/useStore';
import { StoreFailure, type StoreResult } from '@/store/db';
import { fluidRestriction } from '@/reminders/water';
import type { UserSettings } from '@/types';
import type { HabitSettings } from '@/types/habits';
import type { MedicineAnswer, UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import type { BackupMark } from '@/reminders/backup';
import { withCalendarExport, withoutCalendarHabits, type CalendarExport } from '@/reminders/calendarNotice';
import type { HabitId } from '@/reminders/schedule';
import { withLeft } from '@/screens/move/plan';
import { withJoinAnswers } from '@/programme/join';
import type { JoinAnswers } from '@/types/setup';

export function changeHabits(edit: (habits: HabitSettings) => HabitSettings): Promise<StoreResult> {
  return update(previous => ({
    ...previous,
    settings: { ...previous.settings, habits: edit(previous.settings.habits ?? {}) },
  }));
}

/** Change one display setting, from the latest ones (journey §16 Display). */
export function changeDisplay(edit: (display: NonNullable<UserSettings['display']>) => NonNullable<UserSettings['display']>): Promise<StoreResult> {
  return update(previous => ({ ...previous, settings: { ...previous.settings, display: edit(previous.settings.display ?? {}) } }));
}

/**
 * Change the profile, with the settings as they are in the same write.
 * Someone without one yet gets the defaults marked for review, so choosing a
 * voice can never leave health answers that look confirmed but were never
 * given.
 */
export function changeProfile(edit: (profile: UserProfile, settings: UserSettings) => UserProfile, options: UpdateOptions = {}): Promise<StoreResult> {
  return update(previous => ({
    ...previous,
    profile: edit(previous.profile ?? createDefaultProfile({ weightKg: previous.settings.currentWeight || 0, needsHealthReview: true }), previous.settings),
  }), options);
}

/**
 * Remember what the last backup covered, for the monthly nudge: when its
 * snapshot was taken and that snapshot's stored revision, not when the file
 * happened to be handed over. Also how it left (B-25). A backup without a
 * revision clears an older one, so a new time never borrows an old backup's
 * coverage, and a new backup is not checked until its own file is read back.
 * This write is itself one stored change, which the nudge allows for.
 */
export function recordExport(mark: Required<Pick<BackupMark, 'at'>> & BackupMark & { via?: 'share' | 'download' }): Promise<StoreResult> {
  return changeHabits(habits => {
    const next: HabitSettings = { ...habits, lastExportAt: mark.at };
    if (mark.revision === undefined) delete next.lastExportSeq;
    else next.lastExportSeq = mark.revision;
    if (mark.via === undefined) delete next.lastExportVia;
    else next.lastExportVia = mark.via;
    if (next.lastCheckedExportAt !== mark.at) delete next.lastCheckedExportAt;
    return next;
  });
}

/**
 * A backup file read back in Restore's preview (B-25, D61): the last
 * backup's own snapshot, so that backup is checked. Recording this is one
 * more stored change. When the backup's own mark is the only change since
 * its snapshot, the mark moves past this one too, so a check never reads as
 * new data to the nudge (`reminders/backup.ts`).
 */
export function recordBackupCheck(at: string): Promise<StoreResult> {
  const { revision, settings } = getState();
  const seq = settings.habits?.lastExportSeq;
  const onlyTheMark = seq !== undefined && revision === seq + 1;
  return changeHabits(habits => (habits.lastExportAt !== at ? habits : {
    ...habits,
    lastCheckedExportAt: at,
    ...(onlyTheMark && habits.lastExportSeq === seq ? { lastExportSeq: seq + 1 } : {}),
  }));
}

/** Remember the calendar file just made (D-01), so the app can say when Calendar keeps reminding after it has stopped. */
export function recordCalendarExport(made: CalendarExport): Promise<StoreResult> {
  return changeHabits(habits => ({ ...habits, calendarExport: withCalendarExport(habits.calendarExport, made) }));
}

/** The person says they deleted these habits' events from Calendar. */
export function forgetCalendarEvents(deleted: readonly HabitId[]): Promise<StoreResult> {
  return changeHabits(({ calendarExport, ...habits }) => {
    const left = withoutCalendarHabits(calendarExport, deleted);
    return left ? { ...habits, calendarExport: left } : habits;
  });
}

/** Join the 12-week programme: its four answers and a start date (board D8, D81). The same write Your plan makes. */
export function joinProgramme(j: JoinAnswers): Promise<StoreResult> {
  return update(previous => withJoinAnswers(previous, j));
}

/** Leave it: no start date. Every session, record and answer stays. */
export function leaveProgramme(): Promise<StoreResult> {
  return update(withLeft);
}

/** Said when another window changed the fluid-limit answer since this one showed it: neither is written over (board D196). */
export const FLUID_CHANGED = 'Your fluid-limit answer changed in another window of FitStrong. Check it here, then Save again.';

/**
 * Record the fluid-limit answer on the profile, where it now lives. The old
 * copy in the habits is left as it was, never written: everything here reads
 * the profile's answer first, and a reader not yet moved over still sees the
 * old one. A limit — or not knowing — also turns water reminders off in the
 * same write.
 *
 * `shown` is the answer the screen showed when it opened: if another window
 * has stored a different one since, the write is refused rather than put
 * over it. A changed answer is clinical (codex F-setup-02): `options` holds
 * it until stored (`hold`), for the record it was given in (`generation`).
 */
export function setFluidRestriction(answer: MedicineAnswer, water?: NonNullable<HabitSettings['water']>, shown?: { answer: MedicineAnswer | undefined }, options: UpdateOptions = {}): Promise<StoreResult> {
  return update(previous => {
    if (shown && fluidRestriction(previous.profile, previous.settings.habits) !== shown.answer) throw new StoreFailure('conflict', FLUID_CHANGED);
    const profile = previous.profile ?? createDefaultProfile({ weightKg: previous.settings.currentWeight || 0, needsHealthReview: true });
    const habits = { ...(previous.settings.habits ?? {}) };
    if (answer !== false) {
      if (habits.water) habits.water = { ...habits.water, enabled: false };
    } else if (water) {
      habits.water = water;
    }
    return {
      ...previous,
      profile: { ...profile, health: { ...profile.health, fluidRestriction: answer } },
      settings: { ...previous.settings, habits },
    };
  }, options);
}
