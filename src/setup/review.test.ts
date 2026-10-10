import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { chapterSections } from '@/screens/you/summaries';
import { completedSetup, profileFrom, settingsFrom } from './assemble';
import { COMPLEX, GLIFLOZIN_NO_DIABETES, JOIN, MINIMAL, withC, withMeds } from './fixtures';
import { clearanceNotes, reviewRecord, reviewThings } from './review';

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
const base = migrateData({ version: CURRENT_VERSION } as AppData).settings;
const of = (a: typeof MINIMAL) => {
  const p = profileFrom(a, undefined, TODAY, CTX);
  return { p, s: { ...base, ...settingsFrom(a, base, p, TODAY) } };
};

describe('“Here’s what we’ll do for you” (journey §6.2)', () => {
  it('names up to three concrete things, safety first', () => {
    const { p, s } = of(COMPLEX);
    expect(reviewThings(p, s, t => t)).toEqual([
      'Ask for your glucose before you move, with an “I feel low” button.',
      'Choose back-safe stretches from how your back feels that day.',
      'Leave out stretches that pull on the nerve in your left leg.',
    ]);
  });

  it('without conditions, says what the reminders will do', () => {
    const { p, s } = of({ ...MINIMAL, water: { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' }, fluidLimit: 'no' });
    expect(reviewThings(p, s, t => t)).toEqual(['Remind you to drink water every 2 hours from 09:00.', 'Ask how you are before any movement.']);
  });

  it('says what needs a clinician first, in the engine’s words', () => {
    expect(clearanceNotes(of(MINIMAL).p)).toEqual([]);
    expect(clearanceNotes(of(withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none', dizzy: 'no' })).p).length).toBeGreaterThan(0);
  });

  it('names untreated blood pressure and recent eye treatment, and nothing that is not about clearance', () => {
    expect(clearanceNotes(of(withC({ bp: 'yes' }, { bpMedicine: 'no', clearance: 'none', targets: 'no' })).p))
      .toEqual(['High blood pressure that is untreated or unknown: no intervals or heavy lifts until it is checked.']);
    expect(clearanceNotes(of(withC({ eyes: 'yes' }, { eyeTreatment: 'yes', clearance: 'none' })).p))
      .toEqual(['Recent eye treatment or surgery: no exercise until your eye doctor clears you.']);
    // Kidney disease has its own reason, which isn't a clearance; cleared for vigorous exercise, nothing waits.
    expect(clearanceNotes(of(withC({ kidney: 'yes' }, { kidneyTreatment: 'no', fluidLimit: 'no', clearance: 'vigorous' })).p)).toEqual([]);
  });
});

describe('each thing is said only when the answers call for it (journey §6.2)', () => {
  const things = (a: typeof MINIMAL) => {
    const { profile, settings } = reviewRecord(a, { settings: base }, TODAY, CTX);
    return reviewThings(profile, settings, t => t);
  };
  const ASK = 'Ask how you are before any movement.';

  it('ketones, for a “-gliflozin” taken without diabetes (A-06)', () => {
    expect(things(GLIFLOZIN_NO_DIABETES)).toEqual(['Ask about ketones and the signs of ketoacidosis at each check-in.', ASK]);
  });
  it('breath and rising, for high blood pressure, or a blood-pressure medicine without it', () => {
    const BREATH = 'No breath-holding, and slow, steady rises from the floor.';
    expect(things(withC({ bp: 'yes' }, { bpMedicine: 'no', clearance: 'none', targets: 'no' }))).toEqual([BREATH, ASK]);
    expect(things(withMeds({ betaBlocker: 'yes' }, { dizzy: 'no' }))).toEqual([BREATH, ASK]);
  });
  it('low impact and foot checks, for numb feet, “Not sure” included', () => {
    for (const feetNumb of ['yes', 'unsure'] as const) {
      expect(things(withC({ feet: 'yes' }, { feetNumb, footWound: 'no', footRestriction: 'no' })), feetNumb)
        .toEqual(['Low-impact choices and foot checks.', ASK]);
    }
  });
  it('the nerve in both legs, for sciatica down both', () => {
    expect(things(withC({ pain: 'yes' }, { painAreas: ['sciatica'], sciaticaSide: 'both', worseWith: 'unknown', neuroHistory: 'no', clearance: 'none' })))
      .toEqual(['Choose back-safe stretches from how your back feels that day.', 'Leave out stretches that pull on the nerve in your legs.', ASK]);
  });
  it('a walk after the meals chosen', () => {
    expect(things({ ...MINIMAL, mealWalk: { on: true, meals: ['lunch'] }, mealFinish: { lunch: '13:30' } }))
      .toEqual(['Suggest a short walk after lunch.', ASK]);
  });
  it('the programme, once setup joined it, before finishing stores it', () => {
    const a = { ...MINIMAL, programme: 'join' as const, join: JOIN };
    expect(things(a)).toEqual(['Start your 12-week programme on the day you chose.', ASK]);
    const { profile, settings } = reviewRecord(a, { settings: base }, TODAY, CTX);
    const movement = chapterSections(profile, settings, TODAY).find(c => c.chapter === 'movement')!.rows;
    expect(movement.find(r => r.label === 'The 12-week programme')?.value).toMatch(/^Joined, from /);
  });
});

describe('Review shows what finishing stores (§6.2)', () => {
  it('the same profile and settings as “Start using FitStrong”, the programme included', () => {
    const data = migrateData({ version: CURRENT_VERSION } as AppData);
    for (const a of [MINIMAL, COMPLEX, { ...COMPLEX, programme: 'join' as const, join: JOIN }]) {
      const done = completedSetup(data, a, `${TODAY}T09:00:00+05:30`, { ...CTX, hasSteps: false });
      const shown = reviewRecord(a, data, TODAY, CTX);
      expect(shown.profile).toEqual(done.profile);
      // Only completion, setup's own record and Home's first tiles are added on finishing.
      expect({ ...shown.settings, onboardingComplete: done.settings.onboardingComplete, setup: done.settings.setup, home: done.settings.home }).toEqual(done.settings);
    }
  });
});
