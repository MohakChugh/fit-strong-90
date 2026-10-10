/**
 * Codex round 3 release conditions, driven through the real callers: the
 * check-in sheet (`CheckInBody`), `useGuided().saveCheckIn` and the real
 * store over a fake IndexedDB that can refuse or hold writes. Nothing here
 * re-implements the save or the merge; every step is a tap, a typed number or
 * a write the store itself reports.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect } from 'react';
import type { CheckInRecord, DailyCheckIn, Mode } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';
import { formatTime } from '@/lib/time';

const navigate = vi.hoisted(() => ({ to: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate.to }));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { useGuided } = await import('@/hooks/useGuided');
const { CheckInBody } = await import('./CheckInSheet');
const { correctCheckInPressure, effectiveCheckIns, pendingCheckIn, reportSymptoms, resetPendingCheckInsForTests, restorePendingCheckInsForTests, saveCheckInRecord } = await import('./pending');
const { decode } = await import('@/store/transfer');
const { permission, resumePermission, PERMISSION_TEXT } = await import('@/engine/permission');
const { CANNOT_SWALLOW, evaluateCheckIn, TREAT } = await import('@/engine/readiness');
const { useStartMovement } = await import('./useStartMovement');
const { NEWS_LABEL } = await import('./copy');
const walkGate = await import('@/walk/gate');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const PROFILES = {
  insulin: { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', bpMonitor: false } },
  lowRisk: { health: { ...known, diabetes: 'type2', metformin: true, bpMonitor: false } },
  sglt2: { health: { ...known, diabetes: 'type2', metformin: true, sglt2i: true, ketoneTest: 'blood', bpMonitor: false } },
  bp: { health: { ...known, bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } },
} satisfies Record<string, ProfileInput>;

/** Whether the next check-in write is refused, decided from the rows it would write. */
let refuse: (rows: CheckInRecord[]) => boolean = () => false;
let fake: ReturnType<typeof fakeIndexedDB>;
let host: Host | undefined;
let onStart = vi.fn();

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0);
const DAY = '2026-10-09';
const clock = (h: number, mi = 0, day = 9) => vi.setSystemTime(at(2026, 10, day, h, mi));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  refuse = () => false;
  onStart = vi.fn();
  fake = fakeIndexedDB({
    failWrite: (_name, row) => (row.key === 'checkIns' && refuse(row.value as CheckInRecord[]) ? new DOMException('Full', 'QuotaExceededError') : undefined),
  });
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function seed(profile: UserProfile, records: DailyCheckIn[] = []) {
  const recs = records.map((c, i) => ({ ...c, readiness: evaluateCheckIn(profile, c, records.slice(0, i)) }));
  await store.update(prev => ({ ...prev, profile, checkIns: recs }));
}

/** The sheet as Today and the start buttons mount it: the real hook's record, save and earlier days. */
function Harness({ mode = 'guided' as Mode }) {
  const g = useGuided();
  return createElement(CheckInBody, {
    open: true, onOpenChange: () => {}, profile: g.profile, date: g.date, initial: g.checkIn, onSave: g.saveCheckIn, onStart, mode, recent: g.checkIns,
  });
}
async function openSheet(mode: Mode = 'guided') {
  host?.unmount();
  host = render(createElement(Harness, { mode }));
  await host.settle();
  return host;
}
const h = () => host!;
const changeAnswers = async () => { if (h().buttons('Change answers').length) await h().click(h().button('Change answers')); };
const seePlan = () => h().click(h().button('See today’s plan'));
const none = async () => { if (h().buttons('None of these', { exact: true }).length) await h().click(h().buttons('None of these', { exact: true })[0]); };
const typeGlucose = async (v: string) => h().change(h().field('Glucose reading'), { value: v });
const startOffered = () => h().buttons(/^Start/).length > 0;
const stored = () => store.getState().checkIns.find(c => c.date === DAY);
const asked = (profile: UserProfile, now = new Date()) => {
  const g = effectiveCheckIns(store.getState().checkIns, profile);
  return permission({ profile, checkIn: g.find(c => c.date === now.toLocaleDateString('en-CA')), now, recent: g }, 'guided');
};

describe('release condition 1 (B01): an answer settles the readings it names, never a later incident, and nothing expires at midnight', () => {
  it('a typo answered as a mistake, then a genuine 650 and a normal reading: the new extreme still calls for help', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p);
    await openSheet();
    await none();
    await typeGlucose('600');
    await seePlan();
    expect(h().text()).toMatch(/Call emergency services now/);
    clock(9, 2);
    await changeAnswers();
    await typeGlucose('110');
    await seePlan();
    await changeAnswers();
    expect(h().text()).toMatch(/That very high glucose reading from earlier/);
    await h().click(h().button('I typed it wrongly'));
    await seePlan();
    expect(startOffered()).toBe(true);

    clock(11);
    await openSheet();
    await changeAnswers();
    await typeGlucose('650');
    await seePlan();
    clock(11, 3);
    await changeAnswers();
    await typeGlucose('110');
    await seePlan();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(startOffered()).toBe(false);
    expect(asked(p).disposition).toBe('emergency');
  });

  it('an urgent ketone typo answered as a mistake does not settle a later genuine 3.1', async () => {
    const p = createDefaultProfile(PROFILES.sglt2);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 120, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 55).toISOString() },
      ketonesEarlier: [{ kind: 'blood', value: 3, measuredAt: at(2026, 10, 9, 8, 0).toISOString() }], ketones: { kind: 'blood', value: 0.1, measuredAt: at(2026, 10, 9, 8, 50).toISOString() } }]);
    await openSheet();
    await changeAnswers();
    expect(h().text()).toMatch(/That ketone reading from earlier/);
    await h().click(h().button('I typed it wrongly'));
    await seePlan();
    expect(asked(p).allowed).toBe(true);

    clock(10);
    await openSheet();
    await changeAnswers();
    await h().change(h().field('Blood ketones, mmol/L'), { value: '3.1' });
    await typeGlucose('125');
    await seePlan();
    clock(10, 5);
    await changeAnswers();
    await h().change(h().field('Blood ketones, mmol/L'), { value: '0.1' });
    await typeGlucose('120');
    await seePlan();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(asked(p).disposition).toBe('emergency');
  });

  it('a severe blood pressure typo answered as a mistake does not settle a later genuine one, and its repeat means contact today', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet();
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '190' });
    await h().change(h().field('Reading 1, bottom number'), { value: '80' });
    await seePlan();
    clock(9, 2);
    await changeAnswers();
    await h().change(h().field('Reading 1, top number'), { value: '120' });
    await seePlan();
    await changeAnswers();
    await h().click(h().button('I typed it wrongly'));
    await seePlan();
    expect(asked(p).allowed).toBe(true);

    clock(12);
    await openSheet();
    await changeAnswers();
    await h().change(h().field('Reading 1, top number'), { value: '192' });
    await h().change(h().field('Reading 1, bottom number'), { value: '82' });
    await seePlan();
    expect(asked(p)).toMatchObject({ allowed: false, disposition: 'hold' });
    // A normal reading after it is not an answer to it.
    clock(12, 2);
    await changeAnswers();
    await h().change(h().field('Reading 1, top number'), { value: '121' });
    await h().change(h().field('Reading 1, bottom number'), { value: '79' });
    await seePlan();
    expect(asked(p)).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(startOffered()).toBe(false);
    // And a second severe reading, in a later save, confirms it: contact today.
    clock(12, 4);
    await changeAnswers();
    await h().change(h().field('Reading 2, top number'), { value: '188' });
    await h().change(h().field('Reading 2, bottom number'), { value: '84' });
    await seePlan();
    expect(asked(p)).toMatchObject({ allowed: false, disposition: 'today' });
    expect(startOffered()).toBe(false);
  });

  it('"Not settled yet" takes an answer back, and it stays taken back (P04)', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
      glucoseEarlier: [{ value: 600, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 0).toISOString() }], glucose: { value: 110, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 55).toISOString() } }]);
    await openSheet();
    await changeAnswers();
    await h().click(h().button('I typed it wrongly'));
    await seePlan();
    expect(asked(p).allowed).toBe(true);
    // Taken back later, in another sitting: the earlier answer must not come back.
    clock(9, 30);
    await openSheet();
    await changeAnswers();
    await h().click(h().button('Not settled yet'));
    await seePlan();
    expect(asked(p).disposition).toBe('emergency');
    await openSheet();
    await changeAnswers();
    await typeGlucose('112');
    await seePlan();
    expect(asked(p).disposition).toBe('emergency');
  });

  describe('23:59 to 00:01 (the coordinator’s cases): no check-in yet on the new day', () => {
    const night = async (p: UserProfile, c: Partial<DailyCheckIn>) => {
      clock(23, 59, 9);
      await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...c }]);
      clock(0, 1, 10);
    };
    const newDay = (p: UserProfile, mode: Mode = 'walk') => {
      const list = effectiveCheckIns(store.getState().checkIns, p);
      const today = list.find(c => c.date === new Date().toLocaleDateString('en-CA'));
      const input = { profile: p, ...(today ? { checkIn: today } : {}), now: new Date(), recent: list };
      return { start: permission(input, mode), live: resumePermission(input, mode) };
    };
    const t2359 = () => at(2026, 10, 9, 23, 58).toISOString();

    it('an emergency symptom still stands, until a new check-in answers the question', async () => {
      const p = createDefaultProfile(PROFILES.lowRisk);
      await night(p, { emergency: ['chest'], urgentSymptoms: true, glucose: { value: 110, unit: 'mg/dL', measuredAt: t2359() } });
      expect(newDay(p).start.disposition).toBe('emergency');
      expect(newDay(p).live.disposition).toBe('emergency');
      // The first check-in of the new day asks "Right now?" again.
      await openSheet('walk');
      await none();
      await typeGlucose('110');
      await seePlan();
      expect(newDay(p).start.allowed).toBe(true);
    });

    it('a level 2 low and a low that needed help still stand, until answered', async () => {
      const p = createDefaultProfile(PROFILES.insulin);
      await night(p, { glucoseEarlier: [{ value: 50, unit: 'mg/dL', measuredAt: t2359() }], glucose: { value: 110, unit: 'mg/dL', measuredAt: t2359() } });
      expect(newDay(p).live).toMatchObject({ allowed: false, disposition: 'today' });
      // The new day's reading belongs to the night's low (scan X2-08), so it
      // is taken as its re-check would be: 15 minutes or more after it.
      clock(0, 20, 10);
      await openSheet();
      await none();
      await typeGlucose('120');
      await seePlan();
      expect(asked(p)).toMatchObject({ allowed: false, disposition: 'today' });
      await changeAnswers();
      expect(h().text()).toMatch(/That severe low from earlier/);
      await h().click(h().button('A clinician has checked me since'));
      await seePlan();
      // Assessed today: today's no-exercise rule still holds (D29), and tomorrow it does not.
      expect(asked(p).disposition).toBe('today');
      clock(9, 0, 11);
      expect(newDay(p, 'guided').live.allowed).toBe(true);

      const q = createDefaultProfile(PROFILES.insulin);
      store.resetForTests();
      await store.start({ factory: fakeIndexedDB(), broadcast: null });
      await night(q, { news: ['lowSevere'], glucose: { value: 110, unit: 'mg/dL', measuredAt: t2359() } });
      expect(newDay(q).live).toMatchObject({ allowed: false, disposition: 'today' });
    });

    it('a confirmed severe blood pressure pair still means contact today', async () => {
      const p = createDefaultProfile(PROFILES.bp);
      await night(p, { bpReadings: [{ sys: 190, dia: 80, at: t2359() }, { sys: 186, dia: 82, at: t2359() }] });
      expect(newDay(p).live).toMatchObject({ allowed: false, disposition: 'today' });
      await openSheet();
      await none();
      await h().change(h().field('Reading 1, top number'), { value: '128' });
      await h().change(h().field('Reading 1, bottom number'), { value: '80' });
      await seePlan();
      expect(asked(p).disposition).toBe('today');
    });

    it('an extreme glucose still needs emergency help, whatever the new reading', async () => {
      const p = createDefaultProfile(PROFILES.lowRisk);
      await night(p, { glucose: { value: 600, unit: 'mg/dL', measuredAt: t2359() } });
      expect(newDay(p).start.disposition).toBe('emergency');
      expect(newDay(p).live.disposition).toBe('emergency');
      await openSheet();
      await none();
      await typeGlucose('110');
      await seePlan();
      expect(h().text()).toMatch(/Call emergency services now/);
      await changeAnswers();
      expect(h().text()).toMatch(/That very high glucose reading from earlier/);
    });
  });
});

describe('release condition 2 (B02): the open sheet never shows a looser answer than the app holds', () => {
  it('a 50 arriving while the outcome is open removes Start at once', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    await openSheet();
    await none();
    await typeGlucose('110');
    await seePlan();
    expect(startOffered()).toBe(true);
    // Another screen saves a level 2 low while this sheet stays open.
    const elsewhere = { ...stored()!, glucose: { value: 50, unit: 'mg/dL' as const, measuredAt: new Date().toISOString() }, glucoseEarlier: [stored()!.glucose!] };
    await store.update(prev => ({ ...prev, checkIns: [{ ...elsewhere, readiness: evaluateCheckIn(p, elsewhere) }] }));
    await h().settle();
    expect(startOffered()).toBe(false);
    expect(h().text()).toMatch(/No exercise today/);
  });

  it('an older normal save finishing after a chest answer leaves the emergency on screen', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    await openSheet();
    await none();
    await typeGlucose('110');
    fake.control.hold();
    await seePlan();
    await changeAnswers();
    await h().click(h().button('Show the list again'));
    await h().click(h().button(/Chest pain or pressure/));
    expect(h().text()).toMatch(/Call emergency services now/);
    // The normal save finishes first; the chest one is held behind it.
    fake.control.release();
    fake.control.hold();
    await h().settle();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(startOffered()).toBe(false);
    // Neither the banner nor the form softens: the chest answer is still ticked.
    expect(h().button(/Chest pain or pressure/).props['aria-checked']).toBe(true);
    fake.control.release();
    await h().settle();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(stored()?.emergency).toEqual(['chest']);
  });
});

describe('release condition 3 (B04): a refused safety write is kept, lossless, for every gate', () => {
  it('a refused emergency survives closing and reopening, and every gate reads it', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 110, unit: 'mg/dL', measuredAt: new Date().toISOString() } }]);
    refuse = rows => rows.some(r => r.emergency?.includes('chest'));
    await openSheet();
    await changeAnswers();
    await h().click(h().button('Show the list again'));
    await h().click(h().button(/Chest pain or pressure/));
    expect(h().text()).toMatch(/could not save/);
    expect(stored()?.emergency).toEqual([]);
    await openSheet();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(startOffered()).toBe(false);
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      const list = effectiveCheckIns(store.getState().checkIns, p);
      expect(permission({ profile: p, checkIn: list.find(c => c.date === DAY), now: new Date(), recent: list }, mode).disposition, mode).toBe('emergency');
    }
  });

  it('a second refused save from a stale callback keeps the first refused low (P06b)', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    const seen: { save?: (c: DailyCheckIn) => Promise<{ record: CheckInRecord; stored: boolean }>; effective?: CheckInRecord } = {};
    function Capture() {
      const g = useGuided();
      useEffect(() => {
        seen.save ??= g.saveCheckIn;
        seen.effective = g.checkIn;
      });
      return null;
    }
    host = render(createElement(Capture));
    await host.settle();
    const stale = seen.save!;
    refuse = () => true;
    const base = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7' as const, energy: 4 as const };
    const first = await stale({ ...base, glucose: { value: 50, unit: 'mg/dL', measuredAt: new Date().toISOString() } });
    expect(first.stored).toBe(false);
    await host.settle();
    expect(seen.effective?.readiness.disposition).toBe('today');
    clock(9, 3);
    const second = await stale({ ...base, glucose: { value: 110, unit: 'mg/dL', measuredAt: new Date().toISOString() } });
    expect(second.stored).toBe(false);
    await host.settle();
    expect(seen.effective?.readiness.disposition).toBe('today');
    expect(pendingCheckIn(DAY)?.glucoseEarlier?.some(g => 'value' in g && g.value === 50)).toBe(true);
    // A later write that lands carries the low with it, and only then is it let go.
    refuse = () => false;
    await stale({ ...base, glucose: { value: 112, unit: 'mg/dL', measuredAt: new Date().toISOString() } });
    expect(stored()?.glucoseEarlier?.some(g => 'value' in g && g.value === 50)).toBe(true);
    expect(pendingCheckIn(DAY)).toBeUndefined();
  });
});

describe('release condition 8 (B07): one severe number with acute symptoms is an emergency, with nothing invented', () => {
  for (const [box, value, other] of [['top', '190', 'bottom'], ['bottom', '125', 'top']] as const) {
    it(`the ${box} number alone`, async () => {
      const p = createDefaultProfile(PROFILES.bp);
      await seed(p);
      await openSheet();
      await none();
      await h().change(h().field(`Reading 1, ${box} number`), { value });
      expect(h().field(`Reading 1, ${other} number`).props.value).toBe('');
      await h().click(h().button('Symptoms with the high reading'));
      expect(h().text()).toMatch(/Call emergency services now/);
      expect(startOffered()).toBe(false);
      const saved = stored()!;
      expect(saved.bpReadings ?? []).toEqual([]);
      expect(saved.bpPartial).toEqual([box === 'top' ? { sys: 190, at: expect.any(String) } : { dia: 125, at: expect.any(String) }]);
      expect(asked(p).disposition).toBe('emergency');
    });
  }
});

describe('release condition 9, engine part: unknown BP medicines for heart and kidney profiles without a hypertension diagnosis', () => {
  for (const health of [{ heartOrVascularDisease: true }, { kidneyDisease: 'ckd' as const }]) {
    it(JSON.stringify(health), () => {
      const p = createDefaultProfile({ health: { ...known, ...health } });
      const c = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7' as const, energy: 4 as const };
      const r = permission({ profile: p, checkIn: { ...c, readiness: evaluateCheckIn(p, c) }, now: new Date() }, 'guided');
      expect(r.allowed).toBe(true);
      expect(r.codes).toEqual(expect.arrayContaining(['rpeOnly', 'COOL']));
    });
  }
});

describe('the coordinator’s round 3 additions', () => {
  it('every start asks with the effective earlier days: a refused 23:59 emergency still stands at 00:01', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    clock(23, 50);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 110, unit: 'mg/dL', measuredAt: new Date().toISOString() } }]);
    refuse = rows => rows.some(r => r.emergency?.includes('chest'));
    clock(23, 59);
    await openSheet('walk');
    await changeAnswers();
    await h().click(h().button('Show the list again'));
    await h().click(h().button(/Chest pain or pressure/));
    expect(stored()?.emergency).toEqual([]);
    clock(0, 1, 10);
    const seen: { asks?: (m: Mode) => { disposition: string } } = {};
    function Starts() {
      const { permissionFor } = useStartMovement();
      useEffect(() => { seen.asks = permissionFor; });
      return null;
    }
    host?.unmount();
    host = render(createElement(Starts));
    await host.settle();
    for (const mode of ['walk', 'guided', 'stretch'] as const) expect(seen.asks!(mode).disposition, mode).toBe('emergency');
  });

  it('a reason only the profile can answer comes with a link to Profile and health', async () => {
    const p = createDefaultProfile({ ...PROFILES.lowRisk, needsHealthReview: true });
    await seed(p);
    await openSheet();
    await none();
    await seePlan();
    const link = h().all().find(n => n.type === 'a' && /Open Profile and health/.test(JSON.stringify(n.children)));
    expect(link?.props.href).toBe('#/you/profile');
  });
});

describe('the coordinator’s BP timing item (Today F23)', () => {
  it('guides the minute between readings and keeps the time each was entered, never inventing the gap', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet();
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '132' });
    await h().change(h().field('Reading 1, bottom number'), { value: '84' });
    expect(h().text()).toMatch(/Sit quietly\. Take the second reading in a minute\./);
    clock(9, 1);
    vi.setSystemTime(new Date(2026, 9, 9, 9, 1, 5));
    await h().change(h().field('Reading 2, top number'), { value: '128' });
    await h().change(h().field('Reading 2, bottom number'), { value: '82' });
    await seePlan();
    const [a, b] = stored()!.bpReadings!;
    expect(Date.parse(b.at!) - Date.parse(a.at!)).toBeGreaterThanOrEqual(60_000);
  });

  it('a pair typed straight after each other keeps its real, short gap', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet();
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '132' });
    await h().change(h().field('Reading 1, bottom number'), { value: '84' });
    vi.setSystemTime(new Date(2026, 9, 9, 9, 0, 10));
    await h().change(h().field('Reading 2, top number'), { value: '128' });
    await h().change(h().field('Reading 2, bottom number'), { value: '82' });
    await seePlan();
    const [a, b] = stored()!.bpReadings!;
    expect(Date.parse(b.at!) - Date.parse(a.at!)).toBe(10_000);
  });

  it('a severe first reading does not wait for the minute', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet();
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '190' });
    await h().change(h().field('Reading 1, bottom number'), { value: '84' });
    expect(h().text()).toMatch(/That is very high/);
    expect(h().text()).not.toMatch(/Take the second reading in a minute/);
    await seePlan();
    expect(asked(p)).toMatchObject({ allowed: false });
  });
});

describe('reportSymptoms: one way for the player and Walk to report what happens during movement', () => {
  it('adds to today’s answers, keeps two quick reports, times the low at the report, and keeps it on refusal', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: ['hot'], sleep: '5to7', energy: 3, glucose: { value: 140, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 55).toISOString() } }]);
    const seen: { report?: ReturnType<typeof useGuided>['reportSymptoms']; effective?: CheckInRecord } = {};
    function Reporter() {
      const g = useGuided();
      useEffect(() => { seen.report = g.reportSymptoms; seen.effective = g.checkIn; });
      return null;
    }
    host = render(createElement(Reporter));
    await host.settle();
    clock(9, 10);
    const [low, provoked] = await Promise.all([
      seen.report!({ news: ['lowSymptoms'] }, new Date()),
      seen.report!({ provoked: ['goblet-squat'] }),
    ]);
    expect(low.stored && provoked.stored).toBe(true);
    const day = stored()!;
    expect(day.news).toEqual(expect.arrayContaining(['hot', 'lowSymptoms']));
    expect(day.provoked).toEqual(['goblet-squat']);
    expect(day.lowSymptomsAt).toBe(at(2026, 10, 9, 9, 10).toISOString());
    expect(day.sleep).toBe('5to7');
    expect(day.glucose?.value).toBe(140);
    // A reading taken before the symptoms does not answer them.
    expect(asked(p)).toMatchObject({ allowed: false, needsCheckIn: true });
    // Refused by the device, the report still counts.
    refuse = rows => rows.some(r => r.glucose?.value === 60);
    clock(9, 12);
    const refused = await seen.report!({ glucose: { value: 60, unit: 'mg/dL' } });
    expect(refused.stored).toBe(false);
    await host.settle();
    expect(seen.effective?.glucose?.value).toBe(60);
    expect(seen.effective?.glucoseEarlier?.some(g => 'value' in g && g.value === 140)).toBe(true);
  });
});

describe('acceptance J03 step 1 and J16 step 4: a save stores only what was answered', () => {
  const BACKP = { pain: { areas: ['lowerBack', 'sciatica'] as ('lowerBack' | 'sciatica')[], sciaticaSide: 'left' as const }, health: { ...known, diabetes: 'type2' as const, metformin: true, glucoseMonitor: 'cgm' as const, bpMonitor: true } };
  const painObs = () => store.getState().observations.filter(o => (o.kind === 'backPain' || o.kind === 'legPain') && o.context === `checkIn:${DAY}`);

  it('None of these, a glucose, then chest pain: no pain, reach, sleep, energy, arrow or symptom answer is invented', async () => {
    const p = createDefaultProfile(BACKP);
    await seed(p);
    await openSheet();
    await none();
    await typeGlucose('140');
    await h().click(h().button('Show the list again'));
    await h().click(h().button(/Chest pain or pressure/));
    const c = stored()!;
    expect(c.emergency).toEqual(['chest']);
    expect(c.back).toBeUndefined();
    expect(c.sleep).toBeUndefined();
    expect(c.energy).toBeUndefined();
    expect(c.bpSymptoms).toBeUndefined();
    expect(c.glucose?.trend).toBeUndefined();
    expect(painObs()).toEqual([]);
  });

  it('back pain 1 with leg pain left alone stores back pain only; an unanswered list stores no flags', async () => {
    const p = createDefaultProfile(BACKP);
    await seed(p);
    await openSheet();
    await none();
    await h().change(h().field('Back pain now'), { value: '1' });
    await h().click(h().button('Thigh', { exact: true }));
    expect(h().text()).toMatch(/Not answered/);
    await seePlan();
    const c = stored()!;
    expect(c.back).toEqual({ pain: 1, reach: 'thigh' });
    expect(painObs().map(o => [o.kind, o.value])).toEqual([['backPain', 1]]);
  });

  it('a pain of 0 set from the keyboard is an answer, though the slider never moved', async () => {
    const p = createDefaultProfile(BACKP);
    await seed(p);
    await openSheet();
    await none();
    const slider = h().field('Back pain now');
    await (slider.props.onKeyUp as (e: unknown) => void)({ key: 'Home', currentTarget: { value: '0' } });
    await h().settle();
    await h().click(h().buttons('None of these', { exact: true }).find(b => b !== h().buttons('None of these', { exact: true })[0])!);
    await h().click(h().button('Over 7 h', { exact: true }));
    await h().click(h().button('Good', { exact: true }));
    await seePlan();
    const c = stored()!;
    expect(c.back).toMatchObject({ pain: 0, newWeakness: false, feverish: false });
    expect(c.back?.legPain).toBeUndefined();
    expect(c.sleep).toBe('gt7');
    expect(c.energy).toBe(4);
    expect(painObs().map(o => [o.kind, o.value])).toEqual([['backPain', 0]]);
  });

  it('reopening keeps what was answered and still leaves out what was not', async () => {
    const p = createDefaultProfile(BACKP);
    await seed(p);
    await openSheet();
    await none();
    await h().change(h().field('Back pain now'), { value: '2' });
    await seePlan();
    await openSheet();
    await changeAnswers();
    await h().click(h().button('Under 5 h', { exact: true }));
    await seePlan();
    const c = stored()!;
    expect(c.back).toEqual({ pain: 2 });
    expect(c.sleep).toBe('lt5');
    expect(c.energy).toBeUndefined();
  });
});

describe('acceptance J17 step 7: an emergency the device refused still stops everything after a reload', () => {
  it('kept across the reload, read by every gate, and let go once a durable write covers it', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], glucose: { value: 110, unit: 'mg/dL', measuredAt: new Date().toISOString() } }]);
    refuse = rows => rows.some(r => r.emergency?.includes('chest'));
    await openSheet();
    await changeAnswers();
    await h().click(h().button('Show the list again'));
    await h().click(h().button(/Chest pain or pressure/));
    expect(stored()?.emergency).toEqual([]);
    expect(local.get('fit-strong-90-pending-checkins')).toBeTruthy();

    // The reload: the page's memory is gone; the device still holds the old normal record.
    host?.unmount();
    host = undefined;
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    restorePendingCheckInsForTests();
    expect(store.getState().checkIns.find(c => c.date === DAY)?.emergency).toEqual([]);

    const seen: { asks?: (m: Mode) => { disposition: string }; effective?: CheckInRecord } = {};
    function Gates() {
      const { permissionFor } = useStartMovement();
      const g = useGuided();
      useEffect(() => { seen.asks = permissionFor; seen.effective = g.checkIn; });
      return null;
    }
    host = render(createElement(Gates));
    await host.settle();
    expect(seen.effective?.emergency).toEqual(['chest']);
    for (const mode of ['guided', 'stretch', 'walk'] as const) expect(seen.asks!(mode).disposition, mode).toBe('emergency');
    await openSheet();
    expect(h().text()).toMatch(/Call emergency services now/);

    // Storage works again: the next save carries the emergency to the device, and only then is the copy dropped.
    refuse = () => false;
    await changeAnswers();
    if (h().buttons('Show the list again').length) await h().click(h().button('Show the list again'));
    await h().click(h().button(/Severe breathlessness that is new/));
    expect(stored()?.emergency).toEqual(expect.arrayContaining(['chest', 'breathless']));
    expect(local.get('fit-strong-90-pending-checkins')).toBeUndefined();
  });
});

describe('acceptance J17 step 9: a check-in still on its way when the page reloads does not stand in for one', () => {
  // What every gate reads after the reload, as the screens read it.
  const seen: { asks?: (m: Mode) => { allowed: boolean; needsCheckIn: boolean; disposition: string }; effective?: CheckInRecord } = {};
  function Gates() {
    const { permissionFor } = useStartMovement();
    const g = useGuided();
    useEffect(() => { seen.asks = permissionFor; seen.effective = g.checkIn; });
    return null;
  }

  it('after the reload it is evidence only: every start asks again, and the answer is stored once', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p);
    await openSheet();
    // The device takes the write but never finishes it: another tab holds the database.
    fake.control.hold();
    await h().click(h().button('None of these'));
    await h().click(h().button('See today’s plan'));
    expect(local.get('fit-strong-90-pending-checkins')).toBeTruthy();

    // The reload: the write never landed, so the device holds the profile and no check-in.
    host?.unmount();
    host = undefined;
    store.resetForTests();
    fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    await seed(p);
    restorePendingCheckInsForTests();
    expect(store.getState().checkIns.find(c => c.date === DAY)).toBeUndefined();

    host = render(createElement(Gates));
    await host.settle();
    expect(seen.effective?.emergency).toBeUndefined();
    for (const mode of ['guided', 'stretch', 'walk'] as const) expect(seen.asks!(mode), mode).toMatchObject({ allowed: false, needsCheckIn: true });

    // The sheet asks again, with nothing answered for the person.
    await openSheet();
    expect(h().button('None of these').props['aria-checked']).toBe(false);
    await h().click(h().button('None of these'));
    await h().click(h().button('See today’s plan'));
    expect(store.getState().checkIns.filter(c => c.date === DAY)).toHaveLength(1);
    expect(stored()?.emergency).toEqual([]);
    expect(local.get('fit-strong-90-pending-checkins')).toBeUndefined();
    expect(asked(p).allowed).toBe(true);
  });

  it('a kept copy the stored record already holds changes nothing', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p);
    await openSheet();
    await h().click(h().button('None of these'));
    await h().click(h().button('See today’s plan'));
    // The write landed, but the page went before it heard: the copy is still there.
    local.set('fit-strong-90-pending-checkins', JSON.stringify({ waiting: [stored()], refused: [] }));
    restorePendingCheckInsForTests();
    host?.unmount();
    host = render(createElement(Gates));
    await host.settle();
    expect(seen.effective?.emergency).toEqual([]);
    expect(seen.asks!('guided')).toMatchObject({ allowed: true, needsCheckIn: false });
  });
});

describe('scan M-01: a report on a day with no check-in yet is filed on that day and never taken for a check-in', () => {
  it('a report after midnight, from a screen last drawn before it, holds only what was said', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p, [{ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: at(2026, 10, 8, 23, 35).toISOString() } }]);
    clock(23, 40, 8);
    const seen: { report?: ReturnType<typeof useGuided>['reportSymptoms'] } = {};
    function Screen() {
      const g = useGuided();
      useEffect(() => { seen.report = g.reportSymptoms; });
      return null;
    }
    host = render(createElement(Screen));
    await host.settle();
    // Nothing draws the screen again before the report, as in a paused session.
    clock(0, 5, 9);
    await seen.report!({ news: ['lowSymptoms'] });
    const day = store.getState().checkIns.find(c => c.date === DAY)!;
    expect(store.getState().checkIns.find(c => c.date === '2026-10-08')?.lowSymptomsAt).toBeUndefined();
    expect(day.news).toEqual(['lowSymptoms']);
    expect(day.lowSymptomsAt).toBe(at(2026, 10, 9, 0, 5).toISOString());
    for (const k of ['sleep', 'energy', 'emergency', 'back'] as const) expect(day[k], k).toBeUndefined();

    // A reading and "symptoms gone" settle the low, but the day is still not checked in.
    clock(0, 20, 9);
    await seen.report!({ glucose: { value: 110, unit: 'mg/dL', measuredAt: new Date().toISOString() }, newsGone: ['lowSymptoms'], lowRecovered: true });
    expect(asked(p)).toMatchObject({ allowed: false, needsCheckIn: true });

    // The check-in opens with its first question unanswered: nothing reads as "None of these".
    await openSheet();
    expect(h().text()).toMatch(/Right now, any of these/);
    expect(h().button('None of these').props['aria-checked']).toBe(false);
    expect(h().buttons(/^Start/)).toHaveLength(0);
  });
});

describe('a mode the profile alone rules out is refused on the sheet before any answer', () => {
  const foot = { health: { ...known, diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot', bpMonitor: false } } satisfies ProfileInput;

  it('walking with a foot that needs protecting: the refusal shows at once, and no Start', async () => {
    await seed(createDefaultProfile(foot));
    await openSheet('walk');
    expect(h().text()).toMatch(/No walk for now/);
    expect(h().text()).toMatch(/foot needs protecting/);
    expect(h().buttons(/^Start/)).toHaveLength(0);
  });

  it('where the check-in decides, only the questions show', async () => {
    await seed(createDefaultProfile(foot));
    await openSheet('stretch');
    expect(h().text()).not.toMatch(/No walk for now|No exercise/);
    expect(h().text()).toMatch(/Right now, any of these/);
  });
});

describe('scan C2-02: after a reload, a waiting update never takes back an answer the device stored', () => {
  async function reload() {
    host?.unmount();
    host = undefined;
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    restorePendingCheckInsForTests();
  }
  const deps = (p: UserProfile) => ({ profile: p, update: store.update, date: DAY });

  it('the stored "None of these" still counts, and the next save keeps it', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], glucose: { value: 110, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 55).toISOString() } }]);
    clock(9, 30);
    refuse = () => true;
    expect((await reportSymptoms({ glucose: { value: 150, unit: 'mg/dL' } }, deps(p))).stored).toBe(false);
    expect(asked(p).allowed).toBe(true);

    await reload();
    expect(stored()?.emergency).toEqual([]);
    const effective = effectiveCheckIns(store.getState().checkIns, p).find(c => c.date === DAY);
    expect(effective?.emergency).toEqual([]);
    // The refused reading still counts.
    expect(effective?.glucose?.value).toBe(150);
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      const g = effectiveCheckIns(store.getState().checkIns, p);
      expect(permission({ profile: p, checkIn: g.find(c => c.date === DAY), now: new Date(), recent: g }, mode), mode).toMatchObject({ allowed: true, needsCheckIn: false });
    }

    refuse = () => false;
    expect((await reportSymptoms({ news: ['dizzy'] }, deps(p))).stored).toBe(true);
    expect(stored()?.emergency).toEqual([]);
    expect(stored()?.glucose?.value).toBe(150);
    expect(stored()?.news).toEqual(['dizzy']);
  });

  it('a pressure correction after the reload reads the same rule: it never stores an answer the device was never given', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    // A check-in the device refused, so only the kept copy holds it.
    refuse = () => true;
    await openSheet();
    await h().click(h().button('None of these'));
    await h().change(h().field('Reading 1, top number'), { value: '150' });
    await h().change(h().field('Reading 1, bottom number'), { value: '95' });
    await h().click(h().button('See today’s plan'));
    expect(stored()).toBeUndefined();

    await reload();
    refuse = () => false;
    const reading = effectiveCheckIns(store.getState().checkIns, p).find(c => c.date === DAY)!.bpReadings![0];
    const fixed = await correctCheckInPressure({ at: reading.at, was: { sys: 150, dia: 95 }, to: { sys: 140, dia: 90 } }, deps(p));
    expect(fixed).toMatchObject({ matched: true, stored: true });
    expect(stored()?.bpReadings?.map(r => [r.sys, r.dia])).toEqual([[140, 90]]);
    // Corrected, but still not today's check-in: that answer was never stored.
    expect(stored()?.emergency).toBeUndefined();
    expect(asked(p)).toMatchObject({ allowed: false, needsCheckIn: true });
  });
});

describe('scan X2-01: a reading logged in Track reaches every movement gate', () => {
  const seen: { asks?: (m: Mode) => { allowed: boolean; needsCheckIn: boolean; disposition: string; reasons: string[] } } = {};
  function Gates() {
    const { permissionFor } = useStartMovement();
    useEffect(() => { seen.asks = permissionFor; });
    return null;
  }
  const gates = async () => {
    host?.unmount();
    host = render(createElement(Gates));
    await host.settle();
    return seen.asks!;
  };
  const glucose = (value: number) => store.addObservation({ kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', tag: 'beforeExercise' });
  const pressure = (sys: number, dia: number, id: string) => store.addObservations([
    { id: `${id}:bloodPressureSystolic`, kind: 'bloodPressureSystolic', value: sys, scope: 'pointInTime', source: 'manual', context: `bp:${id}` },
    { id: `${id}:bloodPressureDiastolic`, kind: 'bloodPressureDiastolic', value: dia, scope: 'pointInTime', source: 'manual', context: `bp:${id}` },
  ]);

  it('a 50 logged after a 140 check-in holds an insulin user, on every gate', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 9, 0).toISOString(), source: 'meter' } }]);
    clock(9, 1);
    expect((await gates())('walk').allowed).toBe(true);
    clock(9, 5);
    expect((await glucose(50)).ok).toBe(true);
    clock(9, 7);
    const ask = await gates();
    for (const mode of ['guided', 'stretch', 'walk'] as const) expect(ask(mode), mode).toMatchObject({ allowed: false, disposition: 'today' });
    // The walk's own gate, outside React, says the same.
    expect(walkGate.deviceGate(() => store.getState())('start')).toBe(false);
  });

  it('a severe blood pressure logged after a normal check-in holds stretch and walk', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, bpReadings: [{ sys: 124, dia: 78, at: at(2026, 10, 9, 8, 50).toISOString() }, { sys: 122, dia: 76, at: at(2026, 10, 9, 8, 52).toISOString() }] }]);
    clock(9, 5);
    expect((await pressure(192, 104, 'track-1')).ok).toBe(true);
    const ask = await gates();
    for (const mode of ['stretch', 'walk'] as const) expect(ask(mode).allowed, mode).toBe(false);
  });

  it('a Track reading alone never counts as today’s check-in, but a dangerous one still stops', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    clock(9, 0);
    await glucose(140);
    expect((await gates())('walk')).toMatchObject({ allowed: false, needsCheckIn: true });
    clock(9, 10);
    await glucose(50);
    expect((await gates())('walk')).toMatchObject({ allowed: false, disposition: 'today' });
  });

  it('a serious Track reading yesterday is carried and asked about like a check-in one', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    clock(20, 0, 8);
    await seed(p);
    await glucose(650);
    clock(9, 0, 9);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 }]);
    expect((await gates())('walk')).toMatchObject({ allowed: false, disposition: 'emergency' });
    await openSheet();
    expect(h().text()).toContain(`650 mg/dL at ${formatTime(20, 0)} on 8 Oct`);
  });
});

describe('scan X2-07: each open serious reading is answered for itself', () => {
  it('a typo answer for the 600 leaves the genuine 650 an emergency', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p, [{
      date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
      glucoseEarlier: [{ value: 600, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 7, 0).toISOString() }, { value: 650, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 30).toISOString() }],
      glucose: { value: 110, unit: 'mg/dL', measuredAt: at(2026, 10, 9, 8, 55).toISOString() },
    }]);
    expect(asked(p).disposition).toBe('emergency');
    await openSheet();
    await changeAnswers();
    // Two questions, one per reading, each naming its own.
    expect(h().buttons('I typed it wrongly')).toHaveLength(2);
    expect(h().text()).toContain(`600 mg/dL at ${formatTime(7, 0)}`);
    expect(h().text()).toContain(`650 mg/dL at ${formatTime(8, 30)}`);
    await h().click(h().buttons('I typed it wrongly')[0]);
    await seePlan();
    expect(stored()?.resolutions?.map(a => a.readings)).toEqual([['g:' + at(2026, 10, 9, 7, 0).toISOString() + ':600mg/dL']]);
    expect(asked(p).disposition).toBe('emergency');
  });
});

describe('scan X2-12: the outcome follows the profile as it is now', () => {
  it('after a fluid limit is recorded, no "Drink some water" from a check-in saved before it', async () => {
    const free = createDefaultProfile({ health: { ...PROFILES.lowRisk.health, fluidRestriction: false, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } });
    await seed(free);
    await openSheet();
    await none();
    // Over 180 is preparation advice on a day that is allowed, so it shows when the sheet reopens.
    await typeGlucose('200');
    await seePlan();
    expect(h().text()).toMatch(/Drink some water/);
    const limited = createDefaultProfile({ health: { ...free.health, fluidRestriction: true } });
    await store.update(prev => ({ ...prev, profile: limited }));
    await openSheet();
    expect(h().text()).not.toMatch(/Drink some water/);
    expect(h().text()).toMatch(/Keep to your fluid plan/);
  });
});

describe('scan X2-15: a check-in reading is timed when it was taken, not when the sheet was saved', () => {
  it('a glucose typed at 09:00 and saved at 09:40 is 65 minutes old at 10:05', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    clock(9, 0);
    await openSheet();
    await none();
    await typeGlucose('140');
    clock(9, 40);
    await seePlan();
    expect(stored()?.glucose?.measuredAt).toBe(at(2026, 10, 9, 9, 0).toISOString());
    clock(10, 5);
    expect(asked(p)).toMatchObject({ allowed: false, needsCheckIn: true });
  });

  it('a number corrected as it is typed keeps the time it was first entered; a new number after a save is a new reading', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    clock(9, 0);
    await openSheet();
    await none();
    await typeGlucose('14');
    clock(9, 1);
    await typeGlucose('140');
    await seePlan();
    expect(stored()?.glucose?.measuredAt).toBe(at(2026, 10, 9, 9, 0).toISOString());
    clock(9, 30);
    await changeAnswers();
    await typeGlucose('150');
    clock(9, 31);
    await seePlan();
    expect(stored()?.glucose).toMatchObject({ value: 150, measuredAt: at(2026, 10, 9, 9, 30).toISOString() });
  });
});

describe('scan X2-02 and X2-03: yesterday’s red flag and foot sore are asked about by name, and the answer releases them', () => {
  const back = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { ...known, bpMonitor: false, peripheralNeuropathy: 'yes', diabetes: 'type2', metformin: true } } satisfies ProfileInput;
  const walk = (p: UserProfile) => {
    const g = effectiveCheckIns(store.getState().checkIns, p);
    return permission({ profile: p, checkIn: g.find(c => c.date === DAY), now: new Date(), recent: g }, 'walk');
  };

  it('a foot drop: still a stop after "None of these", until "A clinician has checked it"', async () => {
    const p = createDefaultProfile(back);
    await seed(p, [{ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, back: { pain: 2, legPain: 2, reach: 'foot', newWeakness: true, newNeuro: true } }]);
    await openSheet('walk');
    await none();
    await seePlan();
    expect(walk(p)).toMatchObject({ allowed: false, disposition: 'today' });
    await changeAnswers();
    expect(h().text()).toMatch(/What you reported earlier: New foot drop or foot dragging, or a leg getting weaker on 8 Oct/);
    await h().click(h().button('A clinician has checked it'));
    await seePlan();
    expect(walk(p).allowed).toBe(true);
  });

  it('a foot sore: no walking until "It has healed"', async () => {
    const p = createDefaultProfile(back);
    await seed(p, [{ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: ['footProblem'], sleep: 'gt7', energy: 4 }]);
    await openSheet('walk');
    await none();
    await seePlan();
    expect(walk(p).allowed).toBe(false);
    await changeAnswers();
    await h().click(h().button('It has healed'));
    await seePlan();
    expect(walk(p).allowed).toBe(true);
  });
});

describe('the 15 g treatment, wherever the check-in says it, comes with what to do for someone who cannot swallow safely', () => {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** The words the player and the walk use, in order, with the emergency call. */
  const swallow = () => new RegExp([CANNOT_SWALLOW.title, CANNOT_SWALLOW.line, PERMISSION_TEXT.emergencyTitle].map(esc).join('\\s*') + `\\s*\\.\\s*${esc(PERMISSION_TEXT.emergencyCall)}`);

  it('a level 1 low: "Now" has the one 15 g sentence, then the line and the call', async () => {
    await seed(createDefaultProfile(PROFILES.insulin));
    await openSheet();
    await none();
    await typeGlucose('62');
    await seePlan();
    expect(h().text()).toMatch(/Now/);
    expect(h().text()).toContain(TREAT);
    expect(h().text()).toMatch(swallow());
  });

  it('a number under 34 with mg/dL showing: the same sentence and the same line while the unit is asked', async () => {
    await seed(createDefaultProfile(PROFILES.insulin));
    await openSheet();
    await none();
    await typeGlucose('3.1');
    expect(h().text()).toMatch(/I meant 3\.1 mmol\/L/);
    expect(h().text()).toContain(TREAT);
    expect(h().text()).toMatch(swallow());
  });
});

describe('scan J2-01: lows the app recorded in the last 24 hours count, whatever the answer', () => {
  const walkNow = (p: UserProfile) => {
    const g = effectiveCheckIns(store.getState().checkIns, p, store.getState().observations);
    return permission({ profile: p, checkIn: g.find(c => c.date === DAY), now: new Date(), recent: g }, 'walk');
  };

  it('a 62 on a walk and a 64 in Track at bedtime: the sheet names them, and "None" still means no exercise today', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    clock(21, 30, 8);
    await seed(p, [{ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 62, unit: 'mg/dL', measuredAt: at(2026, 10, 8, 7, 38).toISOString(), source: 'meter' } }]);
    expect((await store.addObservation({ kind: 'glucose', value: 64, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', tag: 'bedtime' })).ok).toBe(true);
    clock(7, 0);
    await openSheet('walk');
    await none();
    expect(h().text()).toContain(`Recorded in the app: 62 mg/dL at ${formatTime(7, 38)} on 8 Oct, 64 mg/dL at ${formatTime(21, 30)} on 8 Oct.`);
    await h().click(h().button('None', { exact: true }));
    await typeGlucose('118');
    await seePlan();
    expect(h().text()).toMatch(/No walk for now/);
    expect(h().text()).toMatch(/Two or more lows in the last 24 hours/);
    expect(walkNow(p).allowed).toBe(false);
  });
});

describe('scan J2-09: with the health questions unanswered, no check-in is asked first', () => {
  const seen: { asks?: (m: Mode) => { allowed: boolean; needsCheckIn: boolean } } = {};
  function Gates() {
    const { permissionFor } = useStartMovement();
    useEffect(() => { seen.asks = permissionFor; });
    return null;
  }

  it('"Explore first", then Walk: the refusal and the way to the profile, before any question', async () => {
    host = render(createElement(Gates));
    await host.settle();
    for (const mode of ['guided', 'stretch', 'walk'] as const) expect(seen.asks!(mode), mode).toMatchObject({ allowed: false, needsCheckIn: false });
    await openSheet('walk');
    expect(h().text()).toMatch(/Finish the health questions in your profile first/);
    expect(h().text()).toMatch(/Open Profile and health/);
  });
});

describe('Codex R5, through the sheet', () => {
  const BACK_BP = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { ...known, bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } } satisfies ProfileInput;
  const effective = (p: UserProfile, mode: Mode) => {
    const g = effectiveCheckIns(store.getState().checkIns, p, store.getState().observations);
    return permission({ profile: p, checkIn: g.find(c => c.date === DAY), now: new Date(), recent: g }, mode);
  };
  const tap = async (label: string) => h().click(h().button(label));

  it('R5-01: a foot drop said at 09:00, then "None" at 10:00: still no walk, and asked by name until a clinician has checked it', async () => {
    const p = createDefaultProfile(BACK_BP);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, back: { pain: 2, legPain: 2, reach: 'foot', newWeakness: true, newNeuro: true } }]);
    clock(10);
    await openSheet('walk');
    await changeAnswers();
    await tap('New foot drop or foot dragging, or a leg getting weaker');
    await seePlan();
    expect(stored()?.back?.newWeakness).toBe(false);
    expect(effective(p, 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    await changeAnswers();
    expect(h().text()).toMatch(/New foot drop or foot dragging, or a leg getting weaker/);
    for (const offered of ['Not checked yet', 'A clinician has checked it', 'I ticked it by mistake']) expect(h().buttons(offered), offered).toHaveLength(1);
    for (const notOffered of ['It has gone', 'It has healed']) expect(h().buttons(notOffered), notOffered).toHaveLength(0);
    await tap('A clinician has checked it');
    await seePlan();
    expect(effective(p, 'walk').allowed).toBe(true);
  });

  it('R5-02: new tingling stored, then "hot" with the tingling gone in a save the device refuses: no guided session, and the heat counts', async () => {
    const p = createDefaultProfile(BACK_BP);
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, back: { pain: 2, legPain: 2, reach: 'thigh', newSensory: true, newNeuro: true } }]);
    await openSheet('stretch');
    await changeAnswers();
    await tap('New or worse tingling or numbness, with no weakness');
    await tap('Hot or humid today');
    refuse = () => true;
    await seePlan();
    expect(stored()?.back?.newSensory).toBe(true);
    expect(effective(p, 'guided').allowed).toBe(false);
    expect(effective(p, 'stretch').restrictions.join(' ')).toMatch(/water|cool/i);
  });

  it('R5-03: 320 at 09:10, then a 140 entered at 09:20 but timed 09:00: still held', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p);
    clock(9, 10);
    await openSheet();
    await none();
    await typeGlucose('320');
    await seePlan();
    clock(9, 20);
    await changeAnswers();
    await typeGlucose('140');
    await h().change(h().field('Time measured'), { value: '09:00' });
    await seePlan();
    expect(effective(p, 'walk')).toMatchObject({ allowed: false, disposition: 'hold' });
  });

  it('R5-06: 190/10 with new numbness can be saved, and is an emergency', async () => {
    const p = createDefaultProfile(BACK_BP);
    await seed(p);
    await openSheet('stretch');
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '190' });
    await h().change(h().field('Reading 1, bottom number'), { value: '10' });
    await tap('New or worse tingling or numbness, with no weakness');
    await seePlan();
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(effective(p, 'stretch').disposition).toBe('emergency');
  });
});

describe('R5 follow-up, through the sheet', () => {
  const effective = (p: UserProfile, mode: Mode) => {
    const g = effectiveCheckIns(store.getState().checkIns, p, store.getState().observations);
    return permission({ profile: p, checkIn: g.find(c => c.date === DAY), now: new Date(), recent: g }, mode);
  };
  const tap = async (label: string) => h().click(h().button(label));
  const timed = async (value: string, hm: string) => {
    await typeGlucose(value);
    await h().change(h().field('Time measured'), { value: hm });
  };

  it('60 at 09:20, a 58 typed next but timed 09:00, then 64 at 09:25: still under 70 at the re-check, so no exercise today', async () => {
    const p = createDefaultProfile(PROFILES.insulin);
    await seed(p);
    clock(9, 20);
    await openSheet('walk');
    await none();
    await timed('60', '09:20');
    await seePlan();
    clock(9, 21);
    await changeAnswers();
    await timed('58', '09:00');
    await seePlan();
    clock(9, 25);
    await changeAnswers();
    await timed('64', '09:25');
    await seePlan();
    expect(h().text()).toMatch(/still under 70 mg\/dL when you re-checked/);
    expect(startOffered()).toBe(false);
    expect(effective(p, 'walk').allowed).toBe(false);
  });

  it('R5-06: 190/10, then reading 1 corrected to 120/80: no exercise today, until "I typed it wrongly"', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet('walk');
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '190' });
    await h().change(h().field('Reading 1, bottom number'), { value: '10' });
    await seePlan();
    expect(startOffered()).toBe(false);
    clock(9, 2);
    await changeAnswers();
    await h().change(h().field('Reading 1, top number'), { value: '120' });
    await h().change(h().field('Reading 1, bottom number'), { value: '80' });
    await seePlan();
    expect(stored()?.bpEarlier).toEqual([{ sys: 190, dia: 10, at: expect.any(String) }]);
    expect(startOffered()).toBe(false);
    expect(effective(p, 'walk').allowed).toBe(false);
    await changeAnswers();
    expect(h().text()).toMatch(/That very high blood pressure reading from earlier: Blood pressure 190\/10/);
    await tap('I typed it wrongly');
    await seePlan();
    expect(startOffered()).toBe(true);
    expect(effective(p, 'walk').allowed).toBe(true);
  });

  it('"Fainted today" at 09:00, then "None of these" at 10:00: no exercise today, and asked by name until "I ticked it by mistake"', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p);
    await openSheet('walk');
    await none();
    await tap(NEWS_LABEL.fainted);
    await seePlan();
    expect(startOffered()).toBe(false);
    clock(10);
    await changeAnswers();
    await h().click(h().buttons('None of these', { exact: true }).at(-1)!);
    await seePlan();
    expect(stored()?.news).toEqual([]);
    expect(startOffered()).toBe(false);
    expect(effective(p, 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    await changeAnswers();
    expect(h().text()).toContain(`What you said earlier today: ${NEWS_LABEL.fainted}`);
    for (const offered of ['It happened', 'I ticked it by mistake']) expect(h().buttons(offered), offered).toHaveLength(1);
    expect(h().buttons('A clinician has checked me since')).toHaveLength(0);
    await tap('I ticked it by mistake');
    await seePlan();
    expect(startOffered()).toBe(true);
    expect(effective(p, 'walk').allowed).toBe(true);
  });
});

describe('R5 follow-up: a release given today does not cover the same item ticked again later that day', () => {
  const effective = (p: UserProfile, mode: Mode) => {
    const g = effectiveCheckIns(store.getState().checkIns, p, store.getState().observations);
    return permission({ profile: p, checkIn: g.find(c => c.date === DAY), now: new Date(), recent: g }, mode);
  };
  const tap = async (label: string) => h().click(h().button(label));
  const noNews = async () => h().click(h().buttons('None of these', { exact: true }).at(-1)!);
  const FOOT_DROP = 'New foot drop or foot dragging, or a leg getting weaker';

  it('fainting: ticked, "None of these", "I ticked it by mistake" releases it; ticked again, then "None of these": no exercise, and asked again', async () => {
    const p = createDefaultProfile(PROFILES.lowRisk);
    await seed(p);
    await openSheet('walk');
    await none();
    await tap(NEWS_LABEL.fainted);
    await seePlan();
    clock(10);
    await changeAnswers();
    await noNews();
    await seePlan();
    clock(10, 5);
    await changeAnswers();
    await tap('I ticked it by mistake');
    await seePlan();
    expect(startOffered()).toBe(true);
    clock(11);
    await changeAnswers();
    await tap(NEWS_LABEL.fainted);
    await seePlan();
    expect(startOffered()).toBe(false);
    clock(12);
    await changeAnswers();
    await noNews();
    await seePlan();
    expect(startOffered()).toBe(false);
    expect(effective(p, 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    await changeAnswers();
    expect(h().text()).toContain(`What you said earlier today: ${NEWS_LABEL.fainted}`);
    expect(h().button('It happened').props['aria-checked']).toBe(true);
    expect(h().button('I ticked it by mistake').props['aria-checked']).toBe(false);
  });

  it('a foot drop: unticked, "I ticked it by mistake" releases it; ticked again, then unticked: no walk, and asked again', async () => {
    const p = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { ...known, bpMonitor: false } });
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, back: { pain: 2, legPain: 2, reach: 'foot', newWeakness: true, newNeuro: true } }]);
    clock(10);
    await openSheet('walk');
    await changeAnswers();
    await tap(FOOT_DROP);
    await seePlan();
    await changeAnswers();
    await tap('I ticked it by mistake');
    await seePlan();
    expect(effective(p, 'walk').allowed).toBe(true);
    clock(11);
    await changeAnswers();
    await tap(FOOT_DROP);
    await seePlan();
    expect(effective(p, 'walk').allowed).toBe(false);
    clock(12);
    await changeAnswers();
    await tap(FOOT_DROP);
    await seePlan();
    expect(stored()?.back?.newWeakness).toBe(false);
    expect(effective(p, 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    await changeAnswers();
    expect(h().text()).toMatch(/What you reported earlier: New foot drop or foot dragging, or a leg getting weaker/);
    expect(h().button('Not checked yet').props['aria-checked']).toBe(true);
  });
});

describe('N-01: what the device had stored is read with a waiting save, and never written back inside a record', () => {
  it('a blood pressure correction made while a refused save waits stores the record without it', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    const taken = at(2026, 10, 9, 8, 50).toISOString();
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, bpReadings: [{ sys: 150, dia: 95, at: taken }] }]);
    refuse = () => true;
    expect((await reportSymptoms({ news: ['hot'] }, { profile: p, update: store.update, date: DAY })).stored).toBe(false);
    refuse = () => false;
    const fixed = await correctCheckInPressure({ at: taken, was: { sys: 150, dia: 95 }, to: { sys: 145, dia: 92 } }, { profile: p, update: store.update, date: DAY });
    expect(fixed).toMatchObject({ matched: true, stored: true });
    expect(stored()?.bpReadings).toEqual([{ sys: 145, dia: 92, at: taken }]);
    expect(stored()?.news).toContain('hot');
    expect(stored()).not.toHaveProperty('durable');
  });
});

describe('P-01: a record a gate reads, saved as it is, is stored as a check-in and comes back from its backup', () => {
  it('a cached effective record saved when its day is absent keeps nothing only the gates carry, and the backup imports whole', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    const taken = at(2026, 10, 9, 8, 50).toISOString();
    await seed(p, [{ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, bpReadings: [{ sys: 150, dia: 95, at: taken }] }]);
    // Track's reading of the day, and a refused save waiting: the gates' copy carries both.
    expect((await store.addObservation({ kind: 'glucose', value: 140, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' })).ok).toBe(true);
    refuse = () => true;
    expect((await reportSymptoms({ news: ['hot'] }, { profile: p, update: store.update, date: DAY })).stored).toBe(false);
    refuse = () => false;
    const cached = effectiveCheckIns(store.getState().checkIns, p, store.getState().observations).find(c => c.date === DAY)!;
    expect(cached).toHaveProperty('durable');
    expect(cached).toHaveProperty('logged');
    // The day then goes from the device and nothing waits for it: the cached copy is saved as it is.
    expect((await store.removeCheckIn(DAY)).ok).toBe(true);
    resetPendingCheckInsForTests();
    const saved = await saveCheckInRecord(cached, { profile: p, update: store.update });
    expect(saved.stored).toBe(true);
    for (const field of ['durable', 'logged', 'readingsOnly']) {
      expect(saved.record, field).not.toHaveProperty(field);
      expect(stored(), field).not.toHaveProperty(field);
    }
    expect(stored()?.news).toContain('hot');
    // The backup that holds it is one this same app takes back.
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    expect(store.previewRecord(await decode(exported.value.bytes))).toMatchObject({ ok: true, checkIns: 1, rejected: { checkIns: 0 } });
  });
});

describe('A saved half-reading, reopened: the symptom question is still asked', () => {
  it('190 with the other box empty, saved; on the next visit "Symptoms with the high reading" is there, and it calls for help', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet('walk');
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '190' });
    await seePlan();
    expect(stored()?.bpPartial).toEqual([{ sys: 190, at: expect.any(String) }]);
    clock(9, 5);
    await openSheet('walk');
    await changeAnswers();
    // Back in its row as it was entered, so its other number can be filled in there (Q-01).
    expect(h().field('Reading 1, top number').props.value).toBe('190');
    expect(h().field('Reading 1, bottom number').props.value).toBe('');
    await h().click(h().button('Symptoms with the high reading'));
    expect(h().text()).toMatch(/Call emergency services now/);
    expect(stored()?.bpSymptoms).toBe(true);
    expect(asked(p).disposition).toBe('emergency');
  });

  it('190 saved alone, then its other number filled in in the same row: one measurement, read as that reading (Q-01)', async () => {
    const p = createDefaultProfile(PROFILES.bp);
    await seed(p);
    await openSheet('walk');
    await none();
    await h().change(h().field('Reading 1, top number'), { value: '190' });
    await seePlan();
    const half = stored()!.bpPartial![0];
    clock(9, 5);
    await openSheet('walk');
    await changeAnswers();
    await h().change(h().field('Reading 1, bottom number'), { value: '100' });
    await seePlan();
    const [reading] = stored()!.bpReadings!;
    expect(reading).toMatchObject({ sys: 190, dia: 100 });
    expect(stored()?.bpPartial).toEqual([{ ...half, completion: reading }]);
    // Asked about as the one reading it is: no "other number not entered" beside it.
    const ids = (stored()!.readiness.episodes ?? []).flatMap(e => e.readings).map(x => x.id);
    expect(ids.some(id => id.startsWith('bpp:'))).toBe(false);
    expect(stored()!.readiness.reasons.map(x => x.code)).toContain('bpSevereUnconfirmed');
  });
});
