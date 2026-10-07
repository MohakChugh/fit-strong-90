import type { Clip, Pose } from '../types';

const one = (id: string, pose: Pose, view: Clip['view'] = 'side'): Clip => ({ id, duration: 4, view, keys: [{ t: 0, pose }] });

export const TEST_CLIPS: Clip[] = [
  one('t-supine', { root: [0, 0.1, 0], rootRot: [-90, 0, 0], footL: [0.12, 0, 0.75], footR: [-0.12, 0, 0.75], kneePoleL: [0, 1, 0], kneePoleR: [0, 1, 0], shoulderL: [0, 15, 0], shoulderR: [0, 15, 0] }),
  one('t-quad', { root: [0, 0.49, 0], rootRot: [82, 0, 0], hipL: [82, 0, 0], hipR: [82, 0, 0], kneeL: 90, kneeR: 90, ankleL: [-40, 0], ankleR: [-40, 0], handL: [0.19, 0, 0.46], handR: [-0.19, 0, 0.46], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1], neck: [-10, 0, 0] }),
  one('t-plank', { root: [0, 0.3, 0], rootRot: [78, 0, 0], footL: [0.1, 0, -0.95], footR: [-0.1, 0, -0.95], footRotL: [0, 0, 0], footRotR: [0, 0, 0], heelL: 70, heelR: 70, handL: [0.17, 0, 0.62], handR: [-0.17, 0, 0.62], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1] }),
  one('t-seated', { root: [0, 0.5, -0.05], footL: [0.15, 0, 0.42], footR: [-0.15, 0, 0.42], shoulderL: [5, 6, 0], shoulderR: [5, 6, 0] }),
  one('t-goblet', { root: [0, 0.52, -0.2], rootRot: [32, 0, 0], neck: [-18, 0, 0], footL: [0.17, 0, 0.02], footR: [-0.17, 0, 0.02], footRotL: [0, 14, 0], footRotR: [0, -14, 0], handSpace: 'chest', handL: [0.05, 0.1, 0.24], handR: [-0.05, 0.1, 0.24], palmL: [-1, 0, 0], palmR: [1, 0, 0], fingersL: [0, 1, 0.3], fingersR: [0, 1, 0.3], elbowPoleL: [0.2, -1, 0.3], elbowPoleR: [-0.2, -1, 0.3], gripL: 0.9, gripR: 0.9 }, 'threeQuarter'),
];

