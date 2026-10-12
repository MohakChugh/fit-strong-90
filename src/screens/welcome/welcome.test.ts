import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { migrateData, CURRENT_VERSION } from '@/services/storage';
import { createDefaultProfile } from '@/profile/defaults';
import { programmeInFlow, wizardSteps } from '@/components/profile/wizardSteps';
import { finished, stepAfter, stepBefore, stepGuard, welcomeSteps, welcomeWizardSteps, withAnswers, withFocus, type Focus } from './assemble';
import { deviceNoun, installContext, type InstallEnv } from './install';

/** A fresh device: what the store holds before Welcome writes anything. */
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);

const sciatica = createDefaultProfile({
  weightKg: 82,
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
  health: { diabetes: 'type2', hypertension: 'treated' },
});
const answers = { profile: sciatica, startDate: '2026-10-12', useMetric: false };

function through(focus: Focus): AppData | undefined {
  return finished(withAnswers(withFocus(fresh(), focus), answers));
}

describe('the Welcome flow\'s writes', () => {
  it('starts from a device that is not onboarded and not in the programme', () => {
    expect(fresh().settings.onboardingComplete).toBe(false);
    expect(fresh().settings.startDate).toBe('');
  });

  it('saves the focus first, and nothing else', () => {
    const after = withFocus(fresh(), 'stretch');
    expect(after.settings.focus).toBe('stretch');
    expect(after.settings.onboardingComplete).toBe(false);
    expect(after.profile).toBeUndefined();
  });

  it('Build strength enters the programme on the start date the questions asked for', () => {
    const done = through('strength');
    expect(done?.settings.startDate).toBe('2026-10-12');
    expect(done?.settings.focus).toBe('strength');
    expect(done?.settings.onboardingComplete).toBe(true);
  });

  it('every other focus stays out of the programme, whatever date the questions offered', () => {
    for (const focus of ['stretch', 'move', 'explore'] as const) {
      const done = through(focus);
      expect(done?.settings.startDate, focus).toBe('');
      expect(done?.settings.focus).toBe(focus);
      expect(done?.settings.onboardingComplete).toBe(true);
    }
  });

  it('keeps the health answers exactly as given, with weight and units in settings', () => {
    const done = through('move');
    expect(done?.profile).toEqual(sciatica);
    expect(done?.settings.currentWeight).toBe(82);
    expect(done?.settings.useMetric).toBe(false);
  });

  it('does not finish without the health answers, or without a focus', () => {
    expect(finished(withFocus(fresh(), 'strength'))).toBeUndefined();
    expect(finished({ ...fresh(), profile: sciatica })).toBeUndefined();
  });

  it('a changed mind before finishing follows the latest focus', () => {
    const strength = withAnswers(withFocus(fresh(), 'strength'), answers);
    expect(strength.settings.startDate).toBe('2026-10-12');
    const stretch = withAnswers(withFocus(strength, 'stretch'), answers);
    expect(finished(stretch)?.settings.startDate).toBe('');
  });

  it('writes only what was answered here, on top of what another copy stored meanwhile (D-03)', () => {
    const opened = createDefaultProfile({ weightKg: 82 });
    const meanwhile = { ...opened, health: { ...opened.health, footStatus: 'current_wound_or_active_charcot' as const } };
    const here = { ...opened, pain: { ...opened.pain, areas: ['lowerBack' as const] } };
    const after = withAnswers({ ...withFocus(fresh(), 'stretch'), profile: meanwhile }, { profile: here, startDate: '', useMetric: true, opened: { profile: opened, useMetric: true } });
    expect(after.profile?.pain.areas).toEqual(['lowerBack']);
    expect(after.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
  });

  it('leaves every other setting alone', () => {
    const before = { ...fresh(), settings: { ...fresh().settings, theme: 'dark' as const, defaultRestSeconds: 120 } };
    const done = finished(withAnswers(withFocus(before, 'move'), answers));
    expect(done?.settings.theme).toBe('dark');
    expect(done?.settings.defaultRestSeconds).toBe(120);
  });
});

describe('the questions Welcome asks', () => {
  it('asks Build strength everything, programme included', () => {
    const steps = wizardSteps(welcomeWizardSteps('strength'), 'onboarding');
    expect(steps).toEqual(['about', 'body', 'health', 'summary']);
    expect(programmeInFlow(steps)).toBe(true);
  });

  it('asks everyone else only what safety needs, with no programme questions and no plan', () => {
    for (const focus of ['stretch', 'move', 'explore', undefined] as const) {
      const steps = wizardSteps(welcomeWizardSteps(focus), 'onboarding');
      expect(steps, String(focus)).toEqual(['body', 'health', 'summary']);
      expect(programmeInFlow(steps)).toBe(false);
    }
  });
});

describe('the order of the steps', () => {
  it('in Safari on an iPhone, shows how to install before asking anything', () => {
    expect(welcomeSteps('iosBrowser')).toEqual(['focus', 'keep', 'health']);
    expect(stepAfter('iosBrowser', 'keep')).toBe('health');
    expect(stepAfter('iosBrowser', 'health')).toBe('done');
    expect(stepBefore('iosBrowser', 'health')).toBe('keep');
  });

  it('everywhere else, asks first and explains last', () => {
    for (const context of ['installed', 'android', 'desktop'] as const) {
      expect(welcomeSteps(context)).toEqual(['focus', 'health', 'keep']);
      expect(stepAfter(context, 'health')).toBe('keep');
      expect(stepAfter(context, 'keep')).toBe('done');
    }
    expect(stepBefore('installed', 'focus')).toBeUndefined();
  });

  it('sends a step opened out of order back to what it needs', () => {
    const none = fresh();
    const focused = withFocus(fresh(), 'move');
    const answered = withAnswers(focused, answers);
    expect(stepGuard('installed', 'health', none)).toBe('focus');
    expect(stepGuard('installed', 'health', focused)).toBeUndefined();
    expect(stepGuard('installed', 'keep', focused)).toBe('health');
    expect(stepGuard('installed', 'keep', answered)).toBeUndefined();
    // Before the questions in Safari, the install step needs only a focus.
    expect(stepGuard('iosBrowser', 'keep', focused)).toBeUndefined();
    expect(stepGuard('iosBrowser', 'keep', none)).toBe('focus');
    expect(stepGuard('desktop', 'focus', none)).toBeUndefined();
  });
});

describe('installContext', () => {
  const env = (userAgent: string, standalone = false, maxTouchPoints = 0): InstallEnv => ({ userAgent, standalone, maxTouchPoints });
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15';
  const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

  it('knows an installed app wherever it runs', () => {
    expect(installContext(env(IPHONE, true))).toBe('installed');
    expect(installContext(env(ANDROID, true))).toBe('installed');
  });

  it('treats every iPhone browser as Safari, because on iOS every browser is', () => {
    expect(installContext(env(IPHONE))).toBe('iosBrowser');
    expect(installContext(env(CHROME_IOS))).toBe('iosBrowser');
  });

  it('sees through an iPad asking for the desktop site, but not a Mac', () => {
    expect(installContext(env(IPAD, false, 5))).toBe('iosBrowser');
    expect(installContext(env(IPAD, false, 0))).toBe('desktop');
    expect(deviceNoun(env(IPAD, false, 5))).toBe('iPad');
  });

  it('names the device in copy', () => {
    expect(deviceNoun(env(IPHONE))).toBe('iPhone');
    expect(deviceNoun(env(ANDROID))).toBe('device');
    expect(installContext(env(ANDROID))).toBe('android');
  });
});

describe('Explore first', () => {
  it('skips the questions on every device: the focus, then keeping the record, then done', () => {
    for (const context of ['iosBrowser', 'installed', 'android', 'desktop'] as const) {
      expect(welcomeSteps(context, 'explore'), context).toEqual(['focus', 'keep']);
      expect(stepAfter(context, 'focus', 'explore')).toBe('keep');
      expect(stepAfter(context, 'keep', 'explore')).toBe('done');
      expect(stepBefore(context, 'keep', 'explore')).toBe('focus');
    }
  });

  it('finishes with the health questions unanswered, never with answers made up', () => {
    const done = finished(withFocus(fresh(), 'explore'));
    expect(done?.settings.onboardingComplete).toBe(true);
    expect(done?.profile).toBeUndefined();
    expect(done?.settings.startDate).toBe('');
  });

  it('keeps answers given before choosing to explore exactly as they were', () => {
    const partial = { ...withFocus(fresh(), 'explore'), profile: createDefaultProfile({ needsHealthReview: true }) };
    expect(finished(partial)?.profile).toEqual(partial.profile);
  });

  it('sends the questions page on to the next step, and needs no answers for the last one', () => {
    const exploring = withFocus(fresh(), 'explore');
    expect(stepGuard('installed', 'health', exploring)).toBe('keep');
    expect(stepGuard('iosBrowser', 'health', exploring)).toBe('keep');
    expect(stepGuard('installed', 'keep', exploring)).toBeUndefined();
  });

  it('still asks the questions of every other focus', () => {
    for (const focus of ['strength', 'stretch', 'move'] as const) {
      expect(finished(withFocus(fresh(), focus)), focus).toBeUndefined();
      expect(welcomeSteps('installed', focus)).toEqual(['focus', 'health', 'keep']);
    }
  });
});
