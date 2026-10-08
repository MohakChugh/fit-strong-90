/**
 * The seven personas of codex-acceptance.md, as v4 `AppData` blobs seeded into
 * `localStorage['fit-strong-90-data']` before the first app script runs, so
 * the real migration moves them into IndexedDB.
 *
 * Overrides apply recursively and replace arrays rather than merging them.
 * All profiles, readings and dates are synthetic fixtures.
 */

const clone = v => structuredClone(v);

/** Deep merge where arrays (and non-objects) replace; `undefined` deletes the key. */
export function merge(base, over) {
  if (over === undefined) return clone(base);
  if (Array.isArray(over) || over === null || typeof over !== 'object') return clone(over);
  const out = base && typeof base === 'object' && !Array.isArray(base) ? clone(base) : {};
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete out[k];
    else out[k] = merge(out[k], v);
  }
  return out;
}

/** Remove dotted paths, e.g. `profile.health.metformin`. */
export function omit(data, paths) {
  const out = clone(data);
  for (const p of paths) {
    const parts = p.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) node = node?.[part];
    if (node) delete node[parts.at(-1)];
  }
  return out;
}

export const ENVELOPE = {
  version: 4,
  settings: {
    startDate: '',
    currentWeight: 78,
    targetGoal: '',
    defaultRestSeconds: 90,
    useMetric: true,
    theme: 'system',
    onboardingComplete: true,
    gymDays: {
      monday: 'upper', tuesday: 'rest', wednesday: 'rest', thursday: 'lower',
      friday: 'rest', saturday: 'upper', sunday: 'rest',
    },
    warmupEnabled: false,
    cooldownEnabled: false,
    defaultWarmupExercises: ['hip-opener-stretch'],
    defaultCooldownExercises: ['breathing-cooldown'],
    supersetRestSeconds: 20,
  },
  sessions: [],
  bodyMetrics: [],
  personalRecords: [],
  checkIns: [],
  focusOverrides: {},
  profile: {
    version: 1,
    weightKg: 78,
    heightCm: 175,
    birthYear: 1982,
    experience: 'beginner',
    trainingDays: ['monday', 'thursday', 'saturday'],
    sessionMinutes: 45,
    equipment: 'homeNone',
    goals: ['flexible'],
    pain: { areas: [], worseWith: 'unknown', preference: 'untested' },
    health: {
      diabetes: 'none',
      insulin: 'none',
      sulfonylureaOrMeglitinide: false,
      sglt2i: false,
      metformin: false,
      priorDkaOrInsulinDeficiency: false,
      medicinesReviewed: true,
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
      clearance: 'vigorous',
    },
    ladder: { hinge: 2, squat: 2, neuralGate: false },
    flexibilityTargets: ['hamstrings', 'hipFlexors'],
    dislikes: [],
    restDayMobility: true,
    voice: { pack: 'af_heart', rate: 0.85, verbosity: 'auto', mode: 'coach', muted: true, checked: true },
    figure: 'male',
    needsHealthReview: false,
  },
};

/** C0: a synthetic 25 September check-in, also embedded in the legacy session. */
export const C0 = {
  date: '2026-09-25',
  urgentSymptoms: false,
  back: { pain: 2, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false },
  news: [],
  glucose: { value: 104, unit: 'mg/dL' },
  bp: { sys: 126, dia: 82 },
  sleep: 'gt7',
  energy: 4,
  readiness: {
    outcome: 'green', modifiers: [], back: 'green', nerveFlag: false,
    reasons: [], actions: [], vigorousLocked: false, capHeavy: false,
    rpeOnly: false, notices: [],
  },
};

export const LEGACY_SESSION = {
  id: 'legacy-strength',
  date: '2026-09-25',
  dayOfWeek: 'friday',
  muscleGroup: 'upper',
  phase: 'foundation',
  week: 1,
  status: 'completed',
  sets: [
    { id: 'legacy-set-1', exerciseId: 'dumbbell-bench-press', setNumber: 1, plannedReps: 12, actualReps: 12, weight: 20, status: 'completed', rpe: 7 },
    { id: 'legacy-set-2', exerciseId: 'face-pull', setNumber: 1, plannedReps: 12, actualReps: 12, weight: 20, status: 'completed', rpe: 6 },
  ],
  startedAt: '2026-09-25T09:00:00+05:30',
  completedAt: '2026-09-25T09:20:00+05:30',
  notes: 'Retain this session note',
  totalVolume: 480,
  warmup: [{ exerciseId: 'hip-opener-stretch', completed: true, durationSeconds: 30 }],
  cooldown: [{ exerciseId: 'breathing-cooldown', completed: true, durationSeconds: 60 }],
  supersetGroups: [{ id: 'legacy-superset', exerciseIds: ['dumbbell-bench-press', 'face-pull'], restBetweenSeconds: 20, restAfterRoundSeconds: 90 }],
  exerciseNotes: { 'face-pull': 'Retain this exercise note' },
  guided: true,
  focus: 'upperA',
  planId: 'legacy-plan',
  mobility: [{ exerciseId: 'hip-opener-stretch', seconds: 30 }],
  cardio: { modality: 'walk', minutes: 5, format: 'continuous' },
  painAfter: 2,
  symptomChecks: { 'hip-opener-stretch': 'same' },
  durationSeconds: 1200,
};

const P01_OVERRIDES = {
  settings: { startDate: '2026-09-24', focus: 'strength' },
  profile: {
    equipment: 'fullGym',
    goals: ['strong', 'flexible', 'painFreeBack'],
    pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' },
    health: {
      diabetes: 'type2', metformin: true, metforminSince: '2019', glucoseMonitor: 'meter',
      hypertension: 'treated', bpMonitor: true,
    },
    food: { pattern: 'vegetarian', avoid: [], region: 'north' },
  },
  sessions: [{ ...LEGACY_SESSION, checkIn: C0 }],
  bodyMetrics: [{ date: '2026-09-25', weight: 78, waist: 95, notes: 'Retain this measurement note' }],
  personalRecords: [{ exerciseId: 'dumbbell-bench-press', weight: 20, reps: 12, date: '2026-09-25', volume: 240 }],
  focusOverrides: { '2026-09-25': 'upperA' },
  checkIns: [C0],
};

const OVERRIDES = {
  P01: P01_OVERRIDES,
  P02: {
    settings: { focus: 'stretch', startDate: '', currentWeight: 65 },
    profile: { trainingDays: [], equipment: 'homeNone', goals: ['flexible'], weightKg: 65 },
  },
  P03: {
    settings: { focus: 'move', startDate: '' },
    profile: {
      health: {
        diabetes: 'type2', sulfonylureaOrMeglitinide: true, metformin: true, metforminSince: '2023', glucoseMonitor: 'meter',
      },
    },
  },
  P04: {
    settings: { focus: 'move', startDate: '' },
    profile: {
      health: {
        diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', metformin: true, metforminSince: '2022',
        glucoseMonitor: 'meter', sulfonylureaOrMeglitinide: false, sglt2i: false, priorDkaOrInsulinDeficiency: false,
      },
    },
  },
  P05: {
    settings: { focus: 'stretch', startDate: '' },
    profile: {
      equipment: 'homeNone',
      health: {
        diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot',
      },
    },
  },
  P06: {
    settings: { focus: 'stretch', startDate: '', statusPeriods: [{ kind: 'flare', from: '2026-10-08' }] },
    profile: {
      pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' },
    },
    checkIns: [(() => {
      const c = clone(C0);
      c.date = '2026-10-07';
      delete c.glucose;
      delete c.bp;
      c.back = { ...c.back, pain: 3, legPain: 2, reach: 'thigh' };
      return c;
    })()],
  },
};

/**
 * In the programme since 24 September 2026, P01's start date. With the
 * envelope's Monday, Thursday and Saturday training days that meets D35's
 * rule (a start date and training days), and Thursday 8 October is a
 * programme day. The defined setup for a case about the guided session itself
 * whose persona is otherwise not enrolled.
 */
export const ENROLLED = { settings: { startDate: '2026-09-24' } };

/**
 * A persona's v4 blob. `patch` is applied on top (same merge rules), `remove`
 * deletes dotted paths afterwards. P07 has no blob at all.
 */
export function persona(id, { patch, remove } = {}) {
  if (id === 'P07') return null;
  const over = OVERRIDES[id];
  if (!over) throw new Error(`Unknown persona ${id}`);
  let data = merge(ENVELOPE, over);
  if (patch) data = merge(data, patch);
  if (remove) data = omit(data, remove);
  return data;
}

/** The normal current answers (spec "Normal current answers"). */
export const NORMAL = {
  sleep: 'Over 7 h',
  energy: 'Good',
  backPain: 0,
  legPain: 0,
  reach: 'Back',
  bp: [[124, 78], [122, 76]],
  glucoseDiabetic: '110',
};
