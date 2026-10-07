import type { CardioMeta, CatalogMeta, EquipmentTag, ExerciseMeta, MobilityMeta } from '@/types/catalog';
import type { EquipmentAccess } from '@/types/profile';
import { STRENGTH } from './strength';
import { MOBILITY } from './mobility';
import { CARDIO } from './cardio';

export { STRENGTH, MOBILITY, CARDIO };

export const CATALOG: CatalogMeta[] = [...STRENGTH, ...MOBILITY, ...CARDIO];

const byId = new Map<string, CatalogMeta>(CATALOG.map(m => [m.id, m]));

export function getMeta(id: string): CatalogMeta | undefined {
  return byId.get(id);
}

export function getStrength(id: string): ExerciseMeta | undefined {
  const m = byId.get(id);
  return m?.kind === 'strength' ? m : undefined;
}

export function getMobility(id: string): MobilityMeta | undefined {
  const m = byId.get(id);
  return m?.kind === 'mobility' ? m : undefined;
}

export function getCardio(id: string): CardioMeta | undefined {
  const m = byId.get(id);
  return m?.kind === 'cardio' ? m : undefined;
}

/** Follow aliasOf to the id whose content replaces a retired duplicate. */
export function canonicalId(id: string): string {
  const m = byId.get(id);
  return m && 'aliasOf' in m && m.aliasOf ? m.aliasOf : id;
}

/** Display name for any catalogue id (falls back to a readable id). */
export function nameOf(id: string): string {
  return byId.get(id)?.name ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Equipment available for each training location. */
export const EQUIPMENT_BY_ACCESS: Record<EquipmentAccess, EquipmentTag[]> = {
  fullGym: [
    'barbell', 'trapBar', 'dumbbells', 'kettlebell', 'bench', 'cable', 'machine', 'pullupBar', 'landmine',
    'backExtensionBench', 'bands', 'mat', 'foamRoller', 'strap', 'chair', 'wall', 'dowel', 'box',
    'treadmill', 'bike', 'recumbentBike', 'elliptical', 'rower',
  ],
  homeDumbbells: ['dumbbells', 'kettlebell', 'bench', 'bands', 'mat', 'foamRoller', 'strap', 'chair', 'wall', 'dowel', 'box'],
  homeNone: ['mat', 'chair', 'wall', 'strap', 'dowel', 'box'],
};

/** True when every item in `need` (or in one alternative set) is available. */
export function hasEquipment(meta: CatalogMeta, available: EquipmentTag[]): boolean {
  const ok = (set: EquipmentTag[]) => set.every(e => available.includes(e));
  if (ok(meta.equipment)) return true;
  return meta.kind === 'strength' && (meta.equipmentAlt ?? []).some(ok);
}
