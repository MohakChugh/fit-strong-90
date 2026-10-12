/**
 * What each Welcome step writes, and the order the steps come in.
 *
 * Every step saves as it goes, so leaving half-way (to add the app to the Home
 * Screen, or because the phone rang) keeps what was answered. Only the last
 * step sets `onboardingComplete`, which is what moves the app on to Today.
 */

import type { AppData, UserSettings } from '@/types';
import type { WizardResult } from '@/components/profile/ProfileWizard';
import type { WizardStep } from '@/components/profile/wizardSteps';
import type { InstallContext } from './install';
import { answeredProfile } from '@/components/profile/wizardSteps';

export type Focus = NonNullable<UserSettings['focus']>;

export const FOCUSES: readonly Focus[] = ['strength', 'stretch', 'move', 'explore'];

export function isFocus(value: unknown): value is Focus {
  return typeof value === 'string' && (FOCUSES as readonly string[]).includes(value);
}

/** Step one: "What would you like more of?" A default for Today, not an identity. */
export function withFocus(previous: AppData, focus: Focus): AppData {
  return { ...previous, settings: { ...previous.settings, focus } };
}

/**
 * Which of the profile wizard's steps Welcome asks. Build strength needs the
 * programme's questions and its plan. Anyone else is asked only what safety
 * needs before they move — back and legs, health — and the acknowledgement:
 * no training days, no equipment, no weekly plan.
 */
export function welcomeWizardSteps(focus: Focus | undefined): WizardStep[] {
  return focus === 'strength' ? ['about', 'body', 'health', 'summary'] : ['body', 'health', 'summary'];
}

/**
 * The health questions' answers. Only Build strength enters the 12-week
 * programme, so only it keeps the start date the questions ask for; anyone
 * else stays out of the programme until they choose it (D8), which an empty
 * start date says.
 */
export function withAnswers(previous: AppData, result: WizardResult): AppData {
  // Only what was changed here, on top of what is stored now (D-03).
  const profile = answeredProfile(previous.profile, result);
  return {
    ...previous,
    profile,
    settings: {
      ...previous.settings,
      currentWeight: profile.weightKg,
      useMetric: result.useMetric,
      startDate: previous.settings.focus === 'strength' ? result.startDate : '',
    },
  };
}

/**
 * The last step. `undefined` without a focus, or without a profile for anyone
 * who chose something to do: their first session depends on those answers.
 * Explore first is browsing and logging, which need none of them, so it
 * finishes with the health questions unanswered — never with answers made up
 * to get past them. Whatever was answered stays as it was; the movement gate
 * asks the rest before anyone moves.
 */
export function finished(previous: AppData): AppData | undefined {
  const focus = previous.settings.focus;
  if (!isFocus(focus) || (focus !== 'explore' && !previous.profile)) return undefined;
  return { ...previous, settings: { ...previous.settings, onboardingComplete: true } };
}

export type Step = 'focus' | 'keep' | 'health';

export const STEP_PATH: Record<Step, string> = {
  focus: '/welcome',
  keep: '/welcome/keep',
  health: '/welcome/health',
};

/**
 * In Safari on an iPhone the install step comes before the questions: the
 * Home Screen app starts with nothing Safari holds, so answers given first
 * would have to be given again. Everywhere else, installing changes nothing
 * about the data, and the questions come first. Explore first asks none:
 * browsing and logging need no health answers, and the movement gate asks
 * them before the first movement.
 */
export function welcomeSteps(context: InstallContext, focus?: Focus): Step[] {
  if (focus === 'explore') return ['focus', 'keep'];
  return context === 'iosBrowser' ? ['focus', 'keep', 'health'] : ['focus', 'health', 'keep'];
}

/** The step after this one, or `'done'` when this one finishes Welcome. */
export function stepAfter(context: InstallContext, step: Step, focus?: Focus): Step | 'done' {
  const steps = welcomeSteps(context, focus);
  return steps[steps.indexOf(step) + 1] ?? 'done';
}

export function stepBefore(context: InstallContext, step: Step, focus?: Focus): Step | undefined {
  const steps = welcomeSteps(context, focus);
  return steps[steps.indexOf(step) - 1];
}

/**
 * Where someone who opened a step directly must go instead, if anywhere:
 * the questions need a focus, a step after the questions needs their answers,
 * and a step this focus does not have goes on to the next one it does.
 */
export function stepGuard(context: InstallContext, step: Step, data: Pick<AppData, 'settings' | 'profile'>): Step | undefined {
  if (step === 'focus') return undefined;
  const focus = data.settings.focus;
  if (!isFocus(focus)) return 'focus';
  const steps = welcomeSteps(context, focus);
  if (!steps.includes(step)) return steps[1];
  if (steps.includes('health') && steps.indexOf(step) > steps.indexOf('health') && !data.profile) return 'health';
  return undefined;
}
