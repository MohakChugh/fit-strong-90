import type { HealthProfile, UserProfile } from '@/types/profile';

export const DEFAULT_HEALTH: HealthProfile = {
  diabetes: 'none',
  insulin: 'none',
  sulfonylureaOrMeglitinide: false,
  sglt2i: false,
  highHypoRisk: false,
  hypertension: 'none',
  betaBlocker: false,
  diuretic: false,
  heartOrVascularDisease: false,
  kidneyDisease: 'none',
  retinopathy: 'none_or_mild',
  peripheralNeuropathy: 'no',
  footStatus: 'healthy',
  dizzyOnStandingOrAutonomicNeuropathy: false,
  glucoseMonitor: 'none',
  glucoseUnit: 'mg/dL',
  ketoneTest: 'none',
  bpMonitor: false,
  currentlyActive: true,
  clearance: 'none',
};

const BASE_PROFILE: UserProfile = {
  version: 1,
  weightKg: 0,
  experience: 'intermediate',
  trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  sessionMinutes: 60,
  equipment: 'fullGym',
  goals: ['strong', 'lean', 'flexible', 'athletic', 'painFreeBack'],
  pain: { areas: [], worseWith: 'unknown', preference: 'untested' },
  health: DEFAULT_HEALTH,
  ladder: { hinge: 3, squat: 3, neuralGate: true },
  flexibilityTargets: ['hamstrings', 'hipFlexors', 'thoracic'],
  dislikes: [],
  restDayMobility: true,
  voice: { pack: 'af_heart', rate: 0.85, verbosity: 'auto', mode: 'coach', muted: false, checked: false },
};

/** Recursively-partial input for building a profile. */
export type ProfileInput = Partial<Omit<UserProfile, 'pain' | 'health' | 'ladder' | 'voice'>> & {
  pain?: Partial<UserProfile['pain']>;
  health?: Partial<HealthProfile>;
  ladder?: Partial<UserProfile['ladder']>;
  voice?: Partial<UserProfile['voice']>;
};

/** Build a complete profile from defaults plus any overrides (nested objects merge). */
export function createDefaultProfile(input: ProfileInput = {}): UserProfile {
  return {
    ...BASE_PROFILE,
    ...input,
    pain: { ...BASE_PROFILE.pain, ...input.pain },
    health: { ...BASE_PROFILE.health, ...input.health },
    ladder: { ...BASE_PROFILE.ladder, ...input.ladder },
    voice: { ...BASE_PROFILE.voice, ...input.voice },
  };
}
