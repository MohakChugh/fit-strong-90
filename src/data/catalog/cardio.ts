/**
 * Cardio modalities (spec §4.4). Legacy ids are kept: treadmill-walk is the
 * incline treadmill walk, stationary-bike is the upright bike.
 */

import type { CardioMeta } from '@/types/catalog';

export const CARDIO: CardioMeta[] = [
  { id: 'treadmill-walk', name: 'Incline Treadmill Walk', kind: 'cardio', equipment: ['treadmill'], flags: { weightBearing: true }, intervals: true },
  { id: 'recumbent-bike', name: 'Recumbent Bike', kind: 'cardio', equipment: ['recumbentBike'], flags: {}, intervals: true },
  { id: 'elliptical', name: 'Elliptical', kind: 'cardio', equipment: ['elliptical'], flags: { weightBearing: true }, intervals: true },
  { id: 'brisk-walking', name: 'Brisk Walk', kind: 'cardio', equipment: [], flags: { weightBearing: true }, intervals: true },
  { id: 'stationary-bike', name: 'Upright Bike', kind: 'cardio', equipment: ['bike'], flags: { seatedFlexion: true }, intervals: true },
  { id: 'rowing-machine', name: 'Rowing Machine', kind: 'cardio', equipment: ['rower'], flags: { spinalFlexion: 1, weightBearing: true }, intervals: true, ladder: { track: 'hinge', level: 3 } },
];
