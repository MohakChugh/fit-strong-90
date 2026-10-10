import { afterEach, describe, expect, it } from 'vitest';
import type { BpReading, CheckInRecord, DailyCheckIn, EpisodeKind, GlucoseEntry, KetoneReading, NewsItem, Readiness, RedFlag } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { bpPartialId, bpReadingId, evaluateCheckIn, glucoseReadingId, ketoneReadingId, plainAnswersForTests, profileOnlyReadiness } from './readiness';
import { onScreenPermission, permission, resumePermission, type Mode } from './permission';

/**
 * C2-05: every gate evaluates the whole history, and the engine used to read
 * each earlier day's answers by gathering every later day's again, so its
 * cost grew with the square of the history. It now indexes the answers once
 * per evaluation. The answers must be exactly the ones the plain way gives,
 * on any history, and fast on a long one.
 */

const MODES: Mode[] = ['guided', 'stretch', 'walk'];
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const };
const back = { areas: ['lowerBack', 'sciatica'] as ('lowerBack' | 'sciatica')[], sciaticaSide: 'left' as const };
const PROFILES: UserProfile[] = [
  createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' }, pain: back }),
  createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true, sglt2i: true, ketoneTest: 'blood', peripheralNeuropathy: 'yes' }, pain: back }),
  createDefaultProfile({ health: { ...known, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } }),
  createDefaultProfile({ health: { ...known, diabetes: 'type1', insulin: 'injections_or_pump', highHypoRisk: true, glucoseUnit: 'mmol/L' } }),
];

/** A small seeded generator, so a failing history can be replayed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const dayAfter = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const localAt = (date: string, h: number, m = 0) => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m);
};

const NEWS: NewsItem[] = ['unwell', 'vomiting', 'highNotFalling', 'lowSymptoms', 'lowOne', 'lowTwoPlus', 'lowSevere', 'fainted', 'dizzy', 'footProblem', 'hotSwollenFoot', 'steroid', 'hot', 'unusualFatigue'];
const DAY_ENDING: NewsItem[] = ['fainted', 'highNotFalling', 'vomiting', 'lowSevere'];
const FLAGS: RedFlag[] = ['newWeakness', 'backFever', 'backSudden', 'footProblem', 'hotSwollenFoot'];
const FLAG_KIND: Record<RedFlag, EpisodeKind> = { newWeakness: 'redFlag', backFever: 'redFlag', backSudden: 'redFlag', footProblem: 'foot', hotSwollenFoot: 'foot' };

/**
 * `days` records with gaps between some, and everything the carried rules
 * read: lows and severe lows, extremes, HI and LO, ketones, every class of
 * blood pressure and half-readings, red flags and day-ending news said and
 * unticked, days with no "Right now" answer and days of Track readings only,
 * and answers — about that day's incidents, earlier ones and even later ones,
 * in any offset and precision, taken back or not.
 */
function history(days: number, seed: number, rate: number): CheckInRecord[] {
  const r = rng(seed);
  const chance = (p: number) => r() < p;
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const glucose = () => (chance(rate) ? pick([40, 50, 58, 62, 68, 320, 610, 700]) : 80 + Math.floor(r() * 150));
  const pressure = (): [number, number] => (chance(rate * 2) ? pick([[190, 110], [186, 124], [170, 105], [150, 95], [85, 55], [190, 10]] as [number, number][]) : [110 + Math.floor(r() * 30), 70 + Math.floor(r() * 15)]);
  const records: DailyCheckIn[] = [];
  /** Everything an answer could name, and what each day held that the carried rules act on. */
  const incidents: { kind: EpisodeKind; id: string }[] = [];
  const serious: { kind: EpisodeKind; id: string; day: number }[] = [];
  let date = '2020-01-01';
  for (let i = 0; i < days; i++) {
    date = dayAfter(date, chance(0.15) ? (chance(0.2) ? 2 + Math.floor(r() * 40) : 2) : 1);
    const at = (h: number, m = 0) => localAt(date, h, m).toISOString();
    const c: DailyCheckIn = { date, urgentSymptoms: false, emergency: [], news: [] };
    if (chance(0.7)) c.sleep = pick(['lt5', '5to7', 'gt7'] as const);
    if (chance(0.7)) c.energy = pick([1, 2, 3, 4, 5] as const);
    if (chance(rate)) delete c.emergency;
    if (chance(rate)) { c.readingsOnly = true; delete c.emergency; }
    if (chance(rate / 2)) { c.emergency = [pick(['chest', 'stroke', 'dka'] as const)]; c.urgentSymptoms = true; }
    for (const n of NEWS) if (chance(rate)) c.news.push(n);
    if (chance(rate)) c.newsEarlier = [pick(DAY_ENDING)];
    if (chance(0.4)) {
      c.back = {
        pain: Math.floor(r() * 8), legPain: Math.floor(r() * 6), reach: pick(['back', 'buttock', 'thigh', 'belowKnee', 'foot'] as const),
        newWeakness: chance(rate), newSensory: chance(rate), feverish: chance(rate), suddenSevere: chance(rate), weaknessFast: false, worseFunction: chance(rate),
      };
      c.back.newNeuro = !!(c.back.newWeakness || c.back.newSensory);
    }
    if (chance(rate)) c.flagsEarlier = [pick(FLAGS)];
    const reading = (h: number, timed = true): GlucoseEntry => (chance(rate / 2)
      ? { display: pick(['HI', 'LO'] as const), ...(timed ? { measuredAt: at(h, Math.floor(r() * 60)) } : {}) }
      : { value: glucose(), unit: 'mg/dL', ...(timed ? { measuredAt: at(h, Math.floor(r() * 60)) } : {}), source: 'meter' });
    const now = reading(9 + Math.floor(r() * 10));
    if ('display' in now) c.glucoseDisplay = now; else c.glucose = now;
    if (chance(0.25)) c.glucoseEarlier = Array.from({ length: 1 + Math.floor(r() * 3) }, () => reading(6 + Math.floor(r() * 12), chance(0.9)));
    const ketone = (h: number): KetoneReading => (chance(0.5)
      ? { kind: 'blood', value: pick([0.2, 0.8, 1.8, 3.4]), measuredAt: at(h) }
      : { kind: 'urine', category: pick(['negative', 'trace', 'small', 'moderate', 'large'] as const), measuredAt: at(h) });
    if (chance(rate * 2)) c.ketones = ketone(10);
    if (chance(rate)) c.ketonesEarlier = [ketone(7)];
    const bp = (h: number): BpReading => { const [sys, dia] = pressure(); return { sys, dia, at: at(h, Math.floor(r() * 60)) }; };
    if (chance(0.35)) c.bpReadings = Array.from({ length: chance(0.5) ? 2 : 1 }, () => bp(9));
    if (chance(rate * 2)) c.bpEarlier = [bp(7)];
    if (chance(rate)) c.bpPartial = [chance(0.5) ? { sys: 192, at: at(8) } : { dia: 125, at: at(8) }];
    if (chance(rate)) c.bpSymptoms = chance(0.5);
    if (chance(rate)) c.lowRecovered = true;
    if (chance(rate)) c.lowSymptomsAt = at(9, 30);
    if (chance(rate)) c.provoked = [pick(['brisk-walking', 'cat-cow', 'bird-dog'])];
    if (chance(rate)) c.logged = { glucose: [{ value: glucose(), unit: 'mg/dL', measuredAt: at(14) }], bp: [bp(15)] };
    records.push(c);
    // What answers can name: this day's readings, flags and news; and which of them the carried rules act on.
    const add = (kind: EpisodeKind, id: string, carries: boolean) => {
      incidents.push({ kind, id });
      if (carries) serious.push({ kind, id, day: i });
    };
    for (const e of [...(c.glucoseEarlier ?? []), c.glucose, c.glucoseDisplay]) {
      if (!e) continue;
      const extreme = 'display' in e ? e.display === 'HI' : e.value >= 600;
      add(extreme ? 'extremeGlucose' : 'severeLow', glucoseReadingId(e, date), 'display' in e || e.value >= 600 || e.value < 54);
    }
    for (const k of [...(c.ketonesEarlier ?? []), ...(c.ketones ? [c.ketones] : [])]) add('ketones', ketoneReadingId(k, date), k.kind === 'blood' ? k.value >= 0.6 : k.category !== 'negative');
    for (const b of [...(c.bpReadings ?? []), ...(c.bpEarlier ?? [])]) add('severeBp', bpReadingId(b, date), b.sys >= 180 || b.dia >= 120);
    for (const b of c.bpPartial ?? []) add('severeBp', bpPartialId(b, date), true);
    const reported = new Set<RedFlag>([...(c.flagsEarlier ?? []), ...(c.back?.newWeakness ? ['newWeakness' as const] : []), ...(c.back?.feverish ? ['backFever' as const] : []),
      ...(c.back?.suddenSevere ? ['backSudden' as const] : []), ...(c.news.includes('footProblem') ? ['footProblem' as const] : []), ...(c.news.includes('hotSwollenFoot') ? ['hotSwollenFoot' as const] : [])]);
    for (const f of FLAGS) add(FLAG_KIND[f], `flag:${f}@${date}`, reported.has(f));
    for (const n of DAY_ENDING) add(n === 'lowSevere' ? 'severeLow' : 'news', `news:${n}@${date}`, c.news.includes(n) || !!c.newsEarlier?.includes(n));
  }
  // Answers: about a day's own serious things, earlier ones, and now and then anything at all, a later day's too.
  const answerFor = (at: number) => {
    const own = serious.filter(x => x.day === at);
    const before = serious.filter(x => x.day < at);
    const which = r();
    return which < 0.4 && own.length ? pick(own) : which < 0.8 && before.length ? pick(before) : pick(incidents);
  };
  records.forEach((c, i) => {
    const last = i === records.length - 1;
    if (!last && !chance(rate * 6)) return;
    c.resolutions = Array.from({ length: (last ? 2 : 1) + Math.floor(r() * 3) }, () => {
      const about = answerFor(i);
      const t = localAt(c.date, Math.floor(r() * 24), Math.floor(r() * 60));
      const written = pick(['z', 'offset', 'fraction'] as const);
      const answeredAt = written === 'z' ? t.toISOString()
        : written === 'fraction' ? new Date(t.getTime() + 500).toISOString()
          : new Date(t.getTime() + 5.5 * 3_600_000).toISOString().replace('Z', '+05:30');
      return { kind: about.kind, readings: [about.id], resolution: pick(['mistake', 'assessed', 'resolved', 'reopened'] as const), at: answeredAt };
    });
  });
  return records.map(c => ({ ...c, readiness: {} as Readiness }));
}

/** The same question asked the plain way and through the index. */
function both<T>(ask: () => T): [T, T] {
  plainAnswersForTests(true);
  const plain = ask();
  plainAnswersForTests(false);
  return [plain, ask()];
}
afterEach(() => plainAnswersForTests(false));

describe('the engine reads a long history the way it reads a short one (C2-05)', () => {
  // First: as the app ships, before any test has set the seam.
  it('20,000 days: one evaluation, and each gate, in under 1 s (the quadratic version took 1.6–4.6 s; the margin keeps a busy machine from failing it)', () => {
    const profile = PROFILES[0];
    const all = history(20_001, 5, 0.004);
    const today = all.at(-1)!;
    const recent = all.slice(0, -1);
    const now = localAt(today.date, 10);
    const next = dayAfter(today.date, 1);
    // The best of five runs: the time the engine takes, not the time other work on the machine took from it.
    const ms = (f: () => unknown) => Math.min(...[0, 1, 2, 3, 4].map(() => { const t = performance.now(); f(); return performance.now() - t; }));
    // Once to warm up, as the app does on its first screen.
    evaluateCheckIn(profile, today, recent, now);
    expect(ms(() => evaluateCheckIn(profile, today, recent, now))).toBeLessThan(1000);
    for (const mode of MODES) expect(ms(() => permission({ profile, checkIn: today, now, recent }, mode)), mode).toBeLessThan(1000);
    expect(ms(() => profileOnlyReadiness(profile, { date: next, recent: all, now: localAt(next, 8) }))).toBeLessThan(1000);
  }, 60_000);

  it('gives exactly the plain way’s readiness and permissions, for every mode, on any history', () => {
    let compared = 0;
    let carried = 0;
    let settled = 0;
    for (const [n, profile] of PROFILES.entries()) {
      for (let seed = 1; seed <= 8; seed++) {
        const all = history(140, seed * 97 + n, 0.04);
        const today = all.at(-1)!;
        const recent = all.slice(0, -1);
        const next = dayAfter(today.date, 1);
        for (const hour of [0, 10, 23]) {
          const now = localAt(today.date, hour, 30);
          const [a, b] = both(() => evaluateCheckIn(profile, today, recent, now));
          expect(b).toEqual(a);
          if (a.reasons.some(x => x.code.startsWith('carried'))) carried++;
          if ((a.episodes ?? []).some(e => e.readings.some(x => x.settled))) settled++;
          for (const mode of MODES) {
            const input = { profile, checkIn: today, now, recent };
            for (const gate of [permission, resumePermission, onScreenPermission]) {
              const [x, y] = both(() => gate(input, mode));
              expect(y, `${gate.name} ${mode}`).toEqual(x);
              compared++;
            }
          }
          // The next morning, before any check-in: what the history alone still asks.
          const morning = localAt(next, hour, 30);
          const [c, d] = both(() => profileOnlyReadiness(profile, { date: next, recent: all, now: morning }));
          expect(d).toEqual(c);
          for (const mode of MODES) {
            const [x, y] = both(() => permission({ profile, now: morning, recent: all }, mode));
            expect(y, `next day ${mode}`).toEqual(x);
            compared++;
          }
        }
      }
    }
    expect(compared).toBe(PROFILES.length * 8 * 3 * (MODES.length * 3 + MODES.length));
    // The histories really do carry and settle things: the comparison is not of empty answers.
    expect(carried).toBeGreaterThan(20);
    expect(settled).toBeGreaterThan(5);
  }, 120_000);

});
