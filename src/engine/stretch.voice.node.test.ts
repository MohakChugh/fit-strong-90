import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { CATALOG } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { catchUpText, scriptFor } from '@/session/script';
import { clipKey, splitSentences } from '@/voice/sentences';
import type { VoiceManifest } from '@/voice/clips';
import type { WorkoutSession } from '@/types';
import type { DailyCheckIn } from '@/types/checkin';
import { segmentsFor } from './timing';
import { buildStretchPlan, STRETCH_FOCI, STRETCH_MINUTES, stretchOffered } from './stretch';

/**
 * Every sentence a Stretch routine can say is already recorded in every voice
 * pack, so nothing falls back to the phone's robotic voice. This asks the
 * packs themselves rather than `scripts/voice/lines.json`, which is only as
 * fresh as the last catalogue run.
 */
const packs = (JSON.parse(fs.readFileSync('public/voice/index.json', 'utf8')) as { packs: string[] }).packs
  .map(id => ({ id, manifest: JSON.parse(fs.readFileSync(`public/voice/${id}/manifest.json`, 'utf8')) as VoiceManifest }));

const PROFILES: ProfileInput[] = [
  {},
  { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' }, ladder: { hinge: 2, squat: 2, neuralGate: false } },
  { pain: { areas: ['sciatica'], sciaticaSide: 'right', worseWith: 'extension', preference: 'extension' }, ladder: { hinge: 1, squat: 1, neuralGate: false } },
  { pain: { areas: ['lowerBack', 'sciatica', 'hamstring', 'calf'], sciaticaSide: 'both', preference: 'flexion' }, ladder: { hinge: 0, squat: 0, neuralGate: false } },
  { health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', clearance: 'vigorous', medicinesReviewed: true } },
  { health: { hypertension: 'treated', betaBlocker: true, diuretic: true } },
  { health: { diabetes: 'type2', peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot', medicinesReviewed: true, metformin: true } },
  { health: { diabetes: 'type2', retinopathy: 'severe_or_proliferative', medicinesReviewed: true, metformin: true } },
];
const CHECKINS: Partial<DailyCheckIn>[] = [
  {},
  { back: { pain: 4, newNeuro: false, caudaEquinaFlag: false } },
  { back: { pain: 2, legPain: 3, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } },
  { back: { pain: 7, newNeuro: false, caudaEquinaFlag: false } },
  { news: ['footProblem'] },
  { bp: { sys: 165, dia: 101 } },
];
const FAMILIAR: WorkoutSession[] = ['2026-09-01', '2026-09-02'].map(date => ({
  id: date, date, dayOfWeek: 'tuesday', muscleGroup: 'mobility', phase: 'foundation', week: 1, status: 'completed',
  sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
  mobility: CATALOG.map(m => ({ exerciseId: m.id, seconds: 30 })),
}));

describe('Stretch narration', () => {
  it('is recorded in every voice pack, for every routine on offer', () => {
    const missing = new Set<string>();
    const check = (text?: string) => {
      if (!text) return;
      for (const s of splitSentences(text)) {
        for (const p of packs) if (!(clipKey(s) in p.manifest.lines)) missing.add(`${p.id}: ${s}`);
      }
    };
    for (const input of PROFILES) {
      for (const verbosity of ['auto', 'standard'] as const) {
        const profile = createDefaultProfile({ ...input, voice: { verbosity } });
        // Weeks 1, 5 and 9 cover each length of deep hold.
        for (const date of ['2026-10-05', '2026-11-02', '2026-11-30']) {
          for (const ci of CHECKINS) {
            const checkIn = { date, urgentSymptoms: false, news: [], sleep: 'gt7' as const, energy: 4 as const, ...ci };
            for (const sessions of [[], FAMILIAR]) {
              for (const focus of STRETCH_FOCI) {
                for (const minutes of STRETCH_MINUTES) {
                  if (!stretchOffered({ focus, minutes })) continue;
                  const plan = buildStretchPlan({ profile, date, startDate: '2026-10-05', sessions, checkIn, focus, minutes });
                  for (const exposures of [0, 5]) {
                    for (const step of plan.steps) {
                      for (const seg of segmentsFor(step)) check(catchUpText(step, seg.side) ?? undefined);
                      for (const c of scriptFor(step, { profile, plan, coaching: getCoaching, exposures: () => exposures })) {
                        check(c.say ?? c.text);
                        if (!c.say) check(c.short);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(packs.length).toBeGreaterThan(0);
    expect([...missing]).toEqual([]);
  }, 60_000); // A few thousand routines: seconds alone, longer beside the rest of the suite.
});
