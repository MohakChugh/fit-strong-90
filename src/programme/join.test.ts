import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { isEnrolled } from '@/health/recommend';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { JOIN } from '@/setup/fixtures';
import { joinInitial, joinLine, joinProblem, withJoinAnswers } from './join';

const TODAY = '2026-10-10';

describe('the programme’s Join flow (journey §6.2 ch. 6; D35; board D81)', () => {
  it('starts from what the profile says, on today', () => {
    const p = createDefaultProfile({ experience: 'beginner', equipment: 'homeNone', trainingDays: ['tuesday'], sessionMinutes: 45 });
    expect(joinInitial(p, TODAY)).toEqual({ experience: 'beginner', equipment: 'homeNone', days: ['tuesday'], minutes: 45, startDate: TODAY });
  });

  it('needs a day, and a start of today or later', () => {
    expect(joinProblem('days', { ...JOIN, days: [] }, TODAY)).toBe('Choose at least one day.');
    expect(joinProblem('length', { ...JOIN, startDate: '2026-10-09' }, TODAY)).toMatch(/today or a later/i);
    expect(joinProblem('length', JOIN, TODAY)).toBeNull();
    expect(joinProblem('experience', JOIN, TODAY)).toBeNull();
  });

  it('joins with those answers and that start date, in week order, and changes nothing else', () => {
    const before: AppData = { ...migrateData({ version: CURRENT_VERSION } as AppData), profile: createDefaultProfile({ health: { footStatus: 'current_wound_or_active_charcot' } }) };
    const after = withJoinAnswers(before, { ...JOIN, days: ['saturday', 'monday'] });
    expect(after.profile).toMatchObject({ experience: 'beginner', equipment: 'homeNone', trainingDays: ['monday', 'saturday'], sessionMinutes: 45 });
    expect(after.profile?.health).toEqual(before.profile?.health);
    expect(after.settings.startDate).toBe('2026-10-12');
    expect(isEnrolled(after.settings, after.profile)).toBe(true);
  });

  it('says what was chosen in one line', () => {
    expect(joinLine(JOIN)).toBe('3 days a week, 45 minutes, from Monday 12 October');
    expect(joinLine({ ...JOIN, days: ['monday'] })).toMatch(/^1 day a week/);
  });
});
