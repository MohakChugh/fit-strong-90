/**
 * Enumerate every sentence the coach can say, by running the real plan and
 * script builders over a broad grid of profiles, days, weeks and check-ins.
 *   npx tsx --tsconfig tsconfig.app.json scripts/voice/catalog.ts
 * Writes scripts/voice/lines.json (sorted, unique).
 */
import fs from 'node:fs';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { catchUpText, scriptFor } from '@/session/script';
import { segmentsFor } from '@/engine/timing';
import { getCoaching } from '@/data/coaching';
import { splitSentences } from '@/voice/sentences';
import type { DailyCheckIn } from '@/types/checkin';

const PROFILES: ProfileInput[] = [
  {},
  { experience: 'beginner' }, { experience: 'advanced' },
  { pain: { areas: ['lowerBack'] }, ladder: { hinge: 2, squat: 2 } },
  { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' }, ladder: { hinge: 2, squat: 2, neuralGate: false } },
  { pain: { areas: ['sciatica'], sciaticaSide: 'right', worseWith: 'extension', preference: 'extension' }, ladder: { hinge: 1, squat: 1, neuralGate: false } },
  { pain: { areas: ['lowerBack', 'sciatica', 'hamstring', 'calf'], sciaticaSide: 'both', preference: 'flexion' }, ladder: { hinge: 0, squat: 0, neuralGate: false } },
  { ladder: { hinge: 4, squat: 4 } },
  { health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', clearance: 'vigorous' } },
  { health: { diabetes: 'type1', insulin: 'injections_or_pump', highHypoRisk: true, glucoseMonitor: 'cgm', clearance: 'vigorous' } },
  { health: { diabetes: 'type2', sglt2i: true, currentlyActive: false } },
  { health: { hypertension: 'treated', betaBlocker: true, diuretic: true } },
  { health: { diabetes: 'type2', peripheralNeuropathy: 'yes', retinopathy: 'moderate', clearance: 'moderate' } },
  { health: { retinopathy: 'severe_or_proliferative', kidneyDisease: 'ckd', dizzyOnStandingOrAutonomicNeuropathy: true } },
  { equipment: 'homeDumbbells' }, { equipment: 'homeNone', pain: { areas: ['lowerBack'] } },
  { sessionMinutes: 45 }, { sessionMinutes: 75 },
  { trainingDays: ['monday', 'wednesday', 'friday'] }, { trainingDays: ['monday', 'tuesday', 'thursday', 'friday'] },
  { trainingDays: ['monday', 'tuesday', 'thursday', 'friday', 'saturday'] },
  { trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
  // No machines: with a foot problem there is no cardio, and every schedule's
  // day names appear in that welcome.
  { equipment: 'homeNone', trainingDays: ['monday', 'wednesday', 'friday'] },
  { equipment: 'homeNone', trainingDays: ['monday', 'tuesday', 'thursday', 'friday'] },
  { equipment: 'homeNone', trainingDays: ['monday', 'tuesday', 'thursday', 'friday', 'saturday'] },
  { equipment: 'homeNone', trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
];
const CHECKINS: Partial<DailyCheckIn>[] = [
  {},
  { back: { pain: 4, newNeuro: false, caudaEquinaFlag: false } },
  { back: { pain: 2, legPain: 3, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } },
  { back: { pain: 7, newNeuro: false, caudaEquinaFlag: false } },
  { bp: { sys: 150, dia: 92 } }, { bp: { sys: 165, dia: 101 } },
  { sleep: 'lt5' }, { news: ['hot'] }, { news: ['dizzy'] }, { news: ['footProblem'] },
  { news: ['footProblem'], back: { pain: 6, newNeuro: false, caudaEquinaFlag: false } },
  { glucose: { value: 110, unit: 'mg/dL' } }, { glucose: { value: 80, unit: 'mg/dL' } },
];
const WEEKS = [1, 2, 4, 5, 6, 8, 9, 10, 12];
const START = '2026-01-05'; // a Monday

const lines = new Set<string>();
const add = (t?: string) => { if (t) for (const s of splitSentences(t)) lines.add(s); };

let plans = 0;
for (const input of PROFILES) {
  for (const verbosity of ['auto', 'standard'] as const) {
    const profile = createDefaultProfile({ ...input, voice: { verbosity } });
    for (const week of WEEKS) {
      for (let day = 0; day < 7; day++) {
        const d = new Date(Date.UTC(2026, 0, 5 + (week - 1) * 7 + day));
        const date = d.toISOString().slice(0, 10);
        for (const ci of CHECKINS) {
          const checkIn = { date, urgentSymptoms: false, news: [], sleep: 'gt7' as const, energy: 4 as const, ...ci };
          const plan = buildSessionPlan({ profile, date, startDate: START, sessions: [], checkIn });
          plans++;
          for (const exposures of [0, 5]) {
            for (const step of plan.steps) {
              for (const seg of segmentsFor(step)) add(catchUpText(step, seg.side) ?? undefined);
              for (const c of scriptFor(step, { profile, plan, coaching: getCoaching, exposures: () => exposures })) {
                add(c.say ?? c.text);
                if (!c.say) add(c.short);
              }
            }
          }
        }
      }
    }
  }
}

const sorted = [...lines].sort();
fs.writeFileSync('scripts/voice/lines.json', JSON.stringify(sorted, null, 0));
const words = sorted.reduce((n, s) => n + s.split(/\s+/).length, 0);
console.log(`${plans} plans → ${sorted.length} unique sentences, ${words} words (~${Math.round(words / 150)} min of speech)`);
