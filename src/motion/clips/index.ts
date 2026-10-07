/** Registry of motion clips, keyed by catalogue exercise id. */
import { canonicalId } from '@/data/catalog';
import type { Clip } from '../types';
import { TEST_CLIPS } from './test';
import { STRENGTH_LOWER } from './strength-lower';
import { STRENGTH_UPPER } from './strength-upper';
import { CORE_CARDIO } from './core-cardio';
import { MOBILITY_UPPER } from './mobility-upper';
import { MOBILITY_LOWER } from './mobility-lower';

const STAND: Clip = { id: 'stand', duration: 4, view: 'threeQuarter', keys: [{ t: 0, pose: {} }] };

/** Clips for real exercises (tests check these against the catalogue and coaching). */
export const EXERCISE_CLIPS: Clip[] = [...STRENGTH_LOWER, ...STRENGTH_UPPER, ...CORE_CARDIO, ...MOBILITY_UPPER, ...MOBILITY_LOWER];

const byId = new Map([STAND, ...TEST_CLIPS, ...EXERCISE_CLIPS].map(c => [c.id, c]));

/** The clip for an exercise id, following a retired id's alias to the clip that replaced it. */
export function getClip(id: string): Clip | undefined {
  return byId.get(id) ?? byId.get(canonicalId(id));
}

export function clipIds(): string[] {
  return [...byId.keys()];
}
