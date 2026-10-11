/**
 * Review's "Here's what we'll do for you" (journey §6.2). Up to three things
 * the answers change, safety first, each something the app really does: these
 * are v1's own adaptations, said plainly. Then what needs a clinician first,
 * in the engine's own words.
 */
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { SetupAnswers } from '@/types/setup';
import { deriveHealth, profileRules } from '@/engine/health';
import { isEnrolled } from '@/health/recommend';
import { withJoinAnswers } from '@/programme/join';
import { MEAL_LABEL } from '@/reminders/copy';
import { everyLabel, listOf } from '@/screens/you/summaries';
import { profileFrom, settingsFrom } from './assemble';
import { diabetesOf, has } from './facts';
import type { Ctx } from './graph';

/** v1's acknowledgement, kept for every first-time profile (board D84). Review's tick box says it. */
export const ACKNOWLEDGEMENT = 'I understand this is general information, not medical advice. I will stop and get help for chest pain, faintness or severe breathlessness, and follow my care team’s medication plan.';

/**
 * The profile and settings "Start using FitStrong" stores (`completedSetup`),
 * for Review to show before they are: the programme joined in setup included,
 * so Review never says "Not joined" to someone who just joined.
 */
export function reviewRecord(a: SetupAnswers, base: { profile?: UserProfile; settings: UserSettings }, today: string, ctx: Ctx): { profile: UserProfile; settings: UserSettings } {
  const profile = profileFrom(a, base.profile, today, ctx);
  const shown = { profile, settings: { ...base.settings, ...settingsFrom(a, base.settings, profile, today) } };
  return a.programme === 'join' && a.join !== undefined ? withJoinAnswers(shown, a.join) : shown;
}

export function reviewThings(p: UserProfile, s: Pick<UserSettings, 'habits' | 'startDate'>, clock: (hhmm: string) => string): string[] {
  const d = deriveHealth(p.health);
  const areas = p.pain.areas;
  const back = areas.includes('lowerBack') || areas.includes('sciatica');
  const leg = p.pain.sciaticaSide === 'both' ? 'legs' : `${p.pain.sciaticaSide ?? 'left'} leg`;
  const water = s.habits?.water;
  const walk = s.habits?.mealWalk;
  return [
    d.hypoRisk && 'Ask for your glucose before you move, with an “I feel low” button.',
    d.ketoneRisk && 'Ask about ketones and the signs of ketoacidosis at each check-in.',
    back && 'Choose back-safe stretches from how your back feels that day.',
    areas.includes('sciatica') && `Leave out stretches that pull on the nerve in your ${leg}.`,
    (p.health.hypertension !== 'none' || d.onBpMeds) && 'No breath-holding, and slow, steady rises from the floor.',
    p.health.peripheralNeuropathy !== 'no' && 'Low-impact choices and foot checks.',
    water?.enabled && `Remind you to drink water ${everyLabel(water.everyMinutes).toLowerCase()} from ${clock(water.from)}.`,
    walk?.enabled && walk.meals.length > 0 && `Suggest a short walk after ${listOf(walk.meals.map(m => MEAL_LABEL[m].toLowerCase()))}.`,
    isEnrolled(s, p) && 'Start your 12-week programme on the day you chose.',
    'Ask how you are before any movement.',
  ].filter((x): x is string => typeof x === 'string').slice(0, 3);
}

/** What needs a clinician before vigorous exercise, as the engine says it (v1's summary step). */
export function clearanceNotes(p: UserProfile): string[] {
  return profileRules(p).reasons
    .filter(r => r.code.startsWith('clearance') || r.code === 'bpUnknown' || r.code === 'eyeTreatment')
    .map(r => r.message);
}

/**
 * Why diabetes reads as "Other" when the person didn't choose "Another type"
 * (`diabetesOf`, board D78), for Review to say under Your health (K5-11;
 * board D153); `undefined` otherwise.
 */
export function whyOtherDiabetes(a: SetupAnswers): string | undefined {
  if (diabetesOf(a) !== 'other') return undefined;
  const chip = a.conditions?.diabetes;
  if (!has(chip) || a.diabetesType === 'prediabetes') {
    return 'Diabetes shows as “Other” because insulin, or a tablet that can cause lows, is ticked or marked “Not sure”. FitStrong checks for lows as it would with diabetes.';
  }
  if (chip === 'unsure') return 'Diabetes shows as “Other” because you’re not sure you have it. FitStrong takes the care diabetes needs until you know.';
  return a.diabetesType === 'other' ? undefined : 'Diabetes shows as “Other” because its type isn’t known. FitStrong takes the care any type needs.';
}
