import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn, EpisodeAnswer, Readiness } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { evaluateCheckIn, glucoseReadingId } from '@/engine/readiness';
import { permission, resumePermission } from '@/engine/permission';
import { resetPendingCheckInsForTests, saveCheckInRecord } from '@/components/checkin/pending';
import { deviceGate, reachableHistory, walkInput, walkRefusal } from './gate';
import type { WalkIntent } from './live';

/**
 * C2-05: a walk asks its gate every second, and the engine's cost grows with
 * the square of the history. The walk passes only the days the rules can
 * reach, worked out when the history changes — never on a tick — and the
 * answers must be exactly the ones the whole history gives.
 */

const ALL: WalkIntent[] = ['start', 'restart', 'live'];
const settings = { currentWeight: 82 } as AppData['settings'];
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'moderate' as const, glucoseMonitor: 'meter' as const };
const profiles: UserProfile[] = [
  createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump' } }),
  createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true }, pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' } }),
  createDefaultProfile({ health: { ...known } }),
];

/** A small seeded generator, so a failure can be replayed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const iso = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};
function dayAfter(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * A history of `days` daily check-ins, mostly ordinary, with the rarer
 * things the rules carry: severe and extreme glucose, a low that needed help,
 * ketones, severe blood pressure, answers about readings, reach, low sleep,
 * emergencies and old records without an emergency list.
 */
function history(days: number, seed: number, profile: UserProfile, rare = 0.02): CheckInRecord[] {
  const r = rng(seed);
  const start = '2000-01-01';
  const out: CheckInRecord[] = [];
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  for (let i = 0; i < days; i++) {
    const date = dayAfter(start, i);
    const c: DailyCheckIn = {
      date, urgentSymptoms: false, emergency: [], news: [], sleep: r() < 0.1 ? 'lt5' : 'gt7', energy: r() < 0.1 ? 2 : 4,
      glucose: { value: 90 + Math.floor(r() * 120), unit: 'mg/dL', measuredAt: iso(date, 8) },
    };
    if (r() < 0.3) c.back = { pain: Math.floor(r() * 6), reach: pick(['back', 'buttock', 'thigh', 'belowKnee', 'foot']), newNeuro: false, caudaEquinaFlag: false };
    if (r() < rare) c.glucose = { value: pick([42, 48, 620, 700]), unit: 'mg/dL', measuredAt: iso(date, 9) };
    if (r() < rare) c.news = [...c.news, 'lowSevere'];
    if (r() < rare) c.ketones = { kind: 'blood', value: pick([1.8, 3.4]), measuredAt: iso(date, 10) };
    if (r() < rare) c.bpReadings = [{ sys: 190, dia: 110, at: iso(date, 11) }, { sys: 186, dia: 112, at: iso(date, 11, 2) }];
    if (r() < rare / 2) { c.emergency = ['chest']; c.urgentSymptoms = true; }
    if (r() < rare / 2) delete c.emergency;
    // An answer about an earlier serious reading: assessed, a mistake, or taken back.
    if (r() < rare && out.length) {
      const earlier = out[Math.floor(r() * out.length)];
      const g = earlier.glucose;
      if (g) {
        const answer: EpisodeAnswer = { kind: g.value >= 600 ? 'extremeGlucose' : 'severeLow', readings: [glucoseReadingId(g)], resolution: pick(['assessed', 'mistake', 'reopened'] as const), at: iso(date, 12) };
        c.resolutions = [answer];
      }
    }
    out.push({ ...c, readiness: evaluateCheckIn(profile, c) as Readiness });
  }
  return out;
}

describe('the days the walk gate needs (C2-05)', () => {
  it('gives exactly the answers the whole history gives, whatever the history holds', () => {
    let compared = 0;
    for (const [n, profile] of profiles.entries()) {
      for (let seed = 1; seed <= 6; seed++) {
        const full = history(240, seed * 31 + n, profile, 0.06);
        // Today with its own check-in, and today with none yet (the carried rules alone).
        const lastDay = full.at(-1)!.date;
        for (const [today, list] of [[lastDay, full], [dayAfter(lastDay, 1), full], [lastDay, full.slice(0, -1)]] as const) {
          const reduced = reachableHistory(list, today, profile);
          expect(reduced.length).toBeLessThan(list.length);
          for (const hour of [0, 9, 23]) {
            const now = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), hour, 30);
            for (const intent of ALL) {
              const whole = walkRefusal(walkInput({ profile, checkIns: list }, now), intent);
              const some = walkRefusal(walkInput({ profile, checkIns: reduced }, now), intent);
              expect(some).toEqual(whole);
              compared++;
            }
            // And the engine's whole answer, restrictions and all, not only its refusals.
            const a = walkInput({ profile, checkIns: list }, now);
            const b = walkInput({ profile, checkIns: reduced }, now);
            expect(permission(b, 'walk')).toEqual(permission(a, 'walk'));
            expect(resumePermission(b, 'walk')).toEqual(resumePermission(a, 'walk'));
          }
        }
      }
    }
    expect(compared).toBe(3 * 6 * 3 * 3 * 3);
    // The slow way, on purpose: the whole history, hundreds of times.
  }, 60_000);

  it('gives the same answers in the cases each kept day is there for', () => {
    const sciatica = profiles[1];
    const base = history(120, 99, sciatica, 0);
    const at = (c: CheckInRecord[], i: number, over: Partial<DailyCheckIn>) => {
      const next = [...c];
      const plain: DailyCheckIn = { ...next[i], ...over };
      next[i] = { ...plain, readiness: evaluateCheckIn(sciatica, plain) as Readiness };
      return next;
    };
    const ordinaryBack = { pain: 2, newNeuro: false, caudaEquinaFlag: false } as const;
    const n = base.length;
    const cases: [string, CheckInRecord[]][] = [
      // The last check-in's chest pain stands into a day with none yet.
      ['last check-in emergency', at(base, n - 1, { emergency: ['chest'], urgentSymptoms: true })],
      // An old record without the emergency list.
      ['no emergency list', (() => { const c = at(base, n - 1, {}); delete (c[n - 1] as DailyCheckIn).emergency; return c; })()],
      // A severe low long ago, answered a few days later: settled, so not carried.
      ['old answered severe low', at(at(base, 10, { glucose: { value: 45, unit: 'mg/dL', measuredAt: iso(base[10].date, 9) } }), 14, {
        resolutions: [{ kind: 'severeLow', readings: [glucoseReadingId({ value: 45, unit: 'mg/dL', measuredAt: iso(base[10].date, 9) })], resolution: 'assessed', at: iso(base[14].date, 12) }],
      })],
      // The same low never answered: carried to today.
      ['old unanswered severe low', at(base, 10, { glucose: { value: 45, unit: 'mg/dL', measuredAt: iso(base[10].date, 9) } })],
      // Symptoms reached the buttock long ago, the last reach on record; today they reach the foot.
      ['spread since the last reach', at(base.map((c, i) => (i > 20 ? { ...c, back: { ...ordinaryBack } } : c)), n - 1, { back: { pain: 3, reach: 'foot', newNeuro: false, caudaEquinaFlag: false } })],
      // Low sleep yesterday and today.
      ['two days running', at(at(base, n - 2, { sleep: 'lt5' }), n - 1, { sleep: 'lt5' })],
    ];
    for (const [what, list] of cases) {
      const lastDay = list.at(-1)!.date;
      // Today with its check-in; the next day with none yet; and three days on, the last check-in no longer yesterday's.
      for (const [today, l] of [[lastDay, list], [dayAfter(lastDay, 1), list], [dayAfter(lastDay, 3), list]] as const) {
        const reduced = reachableHistory(l, today, sciatica);
        const now = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), 10, 0);
        const a = walkInput({ profile: sciatica, checkIns: l }, now);
        const b = walkInput({ profile: sciatica, checkIns: reduced }, now);
        expect(permission(b, 'walk'), what).toEqual(permission(a, 'walk'));
        expect(resumePermission(b, 'walk'), what).toEqual(resumePermission(a, 'walk'));
      }
    }
  });

  it('keeps today, the last check-in, the last reach, every serious reading and every answer', () => {
    const profile = profiles[0];
    const full = history(400, 7, profile, 0.05);
    const today = full.at(-1)!.date;
    const kept = new Set(reachableHistory(full, today, profile));
    expect(kept.has(full.at(-1)!)).toBe(true);
    expect(kept.has(full.at(-2)!)).toBe(true);
    expect(kept.has([...full.slice(0, -1)].reverse().find(c => c.back?.reach)!)).toBe(true);
    for (const c of full.filter(x => x.resolutions?.length)) expect(kept.has(c)).toBe(true);
    for (const c of full.filter(x => x.news.includes('lowSevere'))) expect(kept.has(c)).toBe(true);
    // An ordinary day long ago is not needed.
    const ordinary = full.slice(0, -10).find(c => !c.resolutions && !c.news.length && !c.ketones && !c.bpReadings && c.glucose!.value < 300 && c.glucose!.value > 80);
    expect(kept.has(ordinary!)).toBe(false);
  });

  it('works the days out again when the profile changes, or the day does', () => {
    const profile = profiles[2];
    const checkIns = history(60, 5, profile, 0);
    const today = checkIns.at(-1)!.date;
    let now = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), 23, 59);
    let state = { profile, checkIns, settings };
    const gate = deviceGate(() => state, () => now);
    expect(gate('live')).toBe(true);
    // A foot that needs protecting is added to the profile mid-walk.
    state = { ...state, profile: createDefaultProfile({ health: { ...known, footStatus: 'current_wound_or_active_charcot' } }) };
    expect(gate('live')).toBe(false);

    // A check-in dated tomorrow (a clock set wrong) is no part of today, and is tomorrow's at midnight.
    state = { profile, checkIns: [...checkIns, { ...checkIns.at(-1)!, date: dayAfter(today, 1), emergency: ['chest'], urgentSymptoms: true }], settings };
    expect(gate('live')).toBe(true);
    now = new Date(now.getTime() + 2 * 60_000);
    expect(gate('live')).toBe(false);
  });

  it('works the days out again when an answer the device refused arrives, though the store has not changed', async () => {
    const profile = profiles[2];
    const checkIns = history(60, 8, profile, 0);
    const state = { profile, checkIns, settings };
    const today = checkIns.at(-1)!.date;
    const now = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), 10, 0);
    const gate = deviceGate(() => state, () => now);
    expect(gate('live')).toBe(true);
    try {
      await saveCheckInRecord({ date: today, urgentSymptoms: true, emergency: ['chest'], news: [], sleep: 'gt7', energy: 4 }, {
        profile,
        update: async apply => { apply({ checkIns } as AppData); return { ok: false }; },
      });
      expect(gate('live')).toBe(false);
    } finally {
      resetPendingCheckInsForTests();
    }
  });

  it('asks in a few milliseconds a tick at 10,000 days, working the history out only when it changes', () => {
    const profile = profiles[0];
    const checkIns = history(10_000, 11, profile, 0.002);
    const state = { profile, checkIns, settings };
    const today = checkIns.at(-1)!.date;
    let now = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), 9, 0);
    const gate = deviceGate(() => state, () => now);

    const first = performance.now();
    gate('live');
    const once = performance.now() - first;

    const ticks = 60;
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) {
      now = new Date(now.getTime() + 1000);
      gate('live');
    }
    const perTick = (performance.now() - t0) / ticks;
    console.info(`C2-05: 10,000 days — working out the reachable days once ${once.toFixed(0)} ms; then ${perTick.toFixed(2)} ms a tick`);
    expect(perTick).toBeLessThan(3);
  });
});
