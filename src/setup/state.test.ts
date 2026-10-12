import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { SetupState } from '@/types/setup';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { setupStateOf, showsNewHome, upgradeSkipped, waitingFood, withNewHomeSeen } from './state';

const v1 = createDefaultProfile({ weightKg: 78, health: { diabetes: 'type2', medicinesReviewed: true } });

describe('where setup stands (journey §6.6, §19.1; board D80)', () => {
  it('a first run is open', () => {
    expect(setupStateOf({ onboardingComplete: false }, undefined)).toEqual({ stage: 'open', skipped: [] });
  });

  it('a v1 Welcome left part-way is open, so setup carries on from what it kept (K-57)', () => {
    expect(setupStateOf({ onboardingComplete: false }, v1).stage).toBe('open');
  });

  it('v1’s Explore first is v2’s Look around first', () => {
    expect(setupStateOf({ onboardingComplete: true }, undefined)).toEqual({ stage: 'lookAround', skipped: [], upgraded: true });
  });

  it('a record set up in v1 is done, waiting only on chapters with new questions (§6.6)', () => {
    expect(setupStateOf({ onboardingComplete: true }, v1)).toEqual({ stage: 'done', skipped: ['about', 'food'], upgraded: true });
    const named = { ...v1, name: 'Asha', food: { pattern: 'vegetarian' as const, avoid: [], level: 'ideas' as const } };
    expect(upgradeSkipped({}, named)).toEqual([]);
    expect(upgradeSkipped({ habits: { mealWalk: { enabled: true, meals: ['lunch'] } } }, named)).toEqual(['day']);
  });

  it('a finished setup with no profile, a backup whose health answers were left out, carries on as Look around first (H5-17)', () => {
    const restored = { onboardingComplete: true, setup: { stage: 'done' as const, skipped: [], answers: { name: 'Kai' } } };
    expect(setupStateOf(restored, undefined).stage).toBe('lookAround');
    expect(setupStateOf(restored, v1).stage).toBe('done');
  });

  it('keeps what Me was told “Not now” before this build wrote anything (Plan 4, D65)', () => {
    expect(setupStateOf({ onboardingComplete: false, setup: { declined: ['food'] } }, undefined)).toEqual({ stage: 'open', skipped: [], declined: ['food'] });
    expect(setupStateOf({ onboardingComplete: true, setup: { declined: ['food'] } }, v1))
      .toEqual({ stage: 'done', skipped: ['about', 'food'], upgraded: true, declined: ['food'] });
  });

  it('a stored state wins; one whose skipped list was left out on import reads as nothing skipped (Review Focus 5)', () => {
    const stored: SetupState = { stage: 'done', skipped: [], completedAt: '2026-10-08T09:00:00.000+05:30' };
    expect(setupStateOf({ onboardingComplete: true, setup: stored }, v1)).toEqual(stored);
    expect(setupStateOf({ onboardingComplete: true, setup: { stage: 'open' } }, v1)).toEqual({ stage: 'open', skipped: [] });
  });

  it('answering the new-Home row keeps everything else', () => {
    const data: AppData = { ...migrateData({ version: CURRENT_VERSION } as AppData), profile: v1 };
    data.settings = { ...data.settings, onboardingComplete: true };
    expect(withNewHomeSeen(data).settings.setup).toEqual({ stage: 'done', skipped: ['about', 'food'], upgraded: true, newHomeSeen: true });
    expect(withNewHomeSeen(data).profile).toBe(data.profile);
  });

  it('the new-Home row shows once, for a record set up in v1, and never beside a safety state (§6.6, motion rule 2)', () => {
    const data: AppData = { ...migrateData({ version: CURRENT_VERSION } as AppData), profile: v1 };
    data.settings = { ...data.settings, onboardingComplete: true };
    const upgraded = setupStateOf(data.settings, v1);
    expect(showsNewHome(upgraded, false)).toBe(true);
    expect(showsNewHome(upgraded, true)).toBe(false);
    const seen = withNewHomeSeen(data);
    expect(showsNewHome(setupStateOf(seen.settings, v1), false)).toBe(false);
    // Set up in this build, or still looking around: nothing is new to them.
    expect(showsNewHome({ stage: 'done', skipped: [] }, false)).toBe(false);
    expect(showsNewHome(setupStateOf({ onboardingComplete: true }, undefined), false)).toBe(false);
  });
});

describe('the food answers setup keeps for a food record not made yet (H5R-10, K5R-01, H5-20; board D192)', () => {
  const answers = { allergies: ['peanut' as const], customAllergies: ['brinjal'], foodLevel: 'meals' as const, hardBefore: 'yes' as const };
  const waiting = { allergies: ['peanut'], customAllergies: ['brinjal'], level: 'meals', hardBefore: 'yes' };

  it('are read as the allergies are: this session’s while setup goes on without saving, else the finished answers, else the draft’s', () => {
    expect(waitingFood({ stage: 'done', answers })).toEqual(waiting);
    expect(waitingFood({ stage: 'lookAround', draft: { answers } })).toEqual(waiting);
    expect(waitingFood({ stage: 'open', draft: { answers: { ...answers, foodLevel: 'ideas' } } }, { unsaved: true, answers: { ...answers, foodLevel: 'estimates' } }))
      .toEqual({ ...waiting, level: 'estimates' });
    // A session that's saving reads as the record does.
    expect(waitingFood({ stage: 'open', draft: { answers } }, { unsaved: false, answers: { foodLevel: 'estimates' } })).toEqual(waiting);
    // "No food allergies" is an answer too.
    expect(waitingFood({ stage: 'done', answers: { allergies: [] } })).toEqual({ allergies: [] });
  });

  it('are nothing where setup keeps none', () => {
    expect(waitingFood({ stage: 'done', answers: { name: 'Kai' } })).toEqual({});
    expect(waitingFood(undefined)).toEqual({});
  });
});
