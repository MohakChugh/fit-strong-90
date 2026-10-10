/**
 * How the You screens change nested settings.
 *
 * Through the store's `update`, not `setSettings({ habits: … })`: a screen that
 * builds the new habits from what it last rendered can lose a change made a
 * moment earlier that has not reached it yet — turn on water, then quickly
 * sitting breaks, and the second write would put water back off. `update`
 * hands the edit the latest state at the moment of writing, so both survive.
 */

import { update } from '@/store/useStore';
import type { StoreResult } from '@/store/db';
import type { HabitSettings } from '@/types/habits';
import type { MedicineAnswer, UserProfile } from '@/types/profile';
import type { WizardResult } from '@/components/profile/ProfileWizard';
import { answeredProfile } from '@/components/profile/wizardSteps';
import { createDefaultProfile } from '@/profile/defaults';
import type { BackupMark } from '@/reminders/backup';
import { withCalendarExport, withoutCalendarHabits, type CalendarExport } from '@/reminders/calendarNotice';
import type { HabitId } from '@/reminders/schedule';
import { withJoined, withLeft } from '@/screens/move/plan';

export function changeHabits(edit: (habits: HabitSettings) => HabitSettings): Promise<StoreResult> {
  return update(previous => ({
    ...previous,
    settings: { ...previous.settings, habits: edit(previous.settings.habits ?? {}) },
  }));
}

/**
 * Change the profile. Someone without one yet gets the defaults marked for
 * review, so choosing a voice can never leave health answers that look
 * confirmed but were never given.
 */
export function changeProfile(edit: (profile: UserProfile) => UserProfile): Promise<StoreResult> {
  return update(previous => ({
    ...previous,
    profile: edit(previous.profile ?? createDefaultProfile({ weightKg: previous.settings.currentWeight || 0, needsHealthReview: true })),
  }));
}

/**
 * Remember what the last backup covered, for the monthly nudge: when its
 * snapshot was taken and that snapshot's stored revision — not when the file
 * happened to be handed over. A backup without a revision clears an older
 * one, so a new time never borrows an old backup's coverage. This write is
 * itself one stored change, which the nudge allows for.
 */
export function recordExport(mark: Required<Pick<BackupMark, 'at'>> & BackupMark): Promise<StoreResult> {
  return changeHabits(habits => {
    const next: HabitSettings = { ...habits, lastExportAt: mark.at };
    if (mark.revision === undefined) delete next.lastExportSeq;
    else next.lastExportSeq = mark.revision;
    return next;
  });
}

/** The units chosen in the wizard, unless it left them as it found them. */
const answeredMetric = (previous: boolean, result: Pick<WizardResult, 'useMetric' | 'opened'>) =>
  result.opened && result.opened.useMetric === result.useMetric ? previous : result.useMetric;

/**
 * Save answers from the profile wizard. The programme start date is written
 * only when the wizard asked it (`startDate: true`), so an edit of the health
 * questions can never move, or clear, the programme.
 */
export function saveProfileAnswers(result: WizardResult, { startDate }: { startDate: boolean }): Promise<StoreResult> {
  return update(previous => {
    const profile = answeredProfile(previous.profile, result);
    return {
      ...previous,
      profile,
      settings: {
        ...previous.settings,
        currentWeight: profile.weightKg,
        useMetric: answeredMetric(previous.settings.useMetric, result),
        ...(startDate ? { startDate: result.startDate } : {}),
      },
    };
  });
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

/** Join the 12-week programme: its answers and a start date (board D8). The same write Move's Your plan makes. */
export function joinProgramme(answers: Pick<WizardResult, 'profile' | 'useMetric' | 'opened'>, startDate: string): Promise<StoreResult> {
  return update(previous => withJoined(previous, {
    profile: answeredProfile(previous.profile, answers),
    useMetric: answeredMetric(previous.settings.useMetric, answers),
  }, startDate));
}

/** Leave it: no start date. Every session, record and answer stays. */
export function leaveProgramme(): Promise<StoreResult> {
  return update(withLeft);
}

/**
 * Record the fluid-limit answer on the profile, where it now lives. The old
 * copy in the habits is left as it was, never written: everything here reads
 * the profile's answer first, and a reader not yet moved over still sees the
 * old one. A limit — or not knowing — also turns water reminders off in the
 * same write.
 */
export function setFluidRestriction(answer: MedicineAnswer, water?: NonNullable<HabitSettings['water']>): Promise<StoreResult> {
  return update(previous => {
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
  });
}
